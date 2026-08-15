
import 'dotenv/config'
import {
  buildProductVectorDocument,
  productVectorContentHash,
  productVectorFilename,
} from '../lib/product-vector-document.mjs'
import {
  attachFileToVectorStore,
  deleteOpenAiFile,
  getVectorStore,
  uploadTextFile,
  waitForVectorStoreFile,
} from '../lib/openai-vector-store.mjs'
import { closePool, query } from '../lib/db.mjs'

function argumentValue(name, fallback = null) {
  const prefix = `--${name}=`
  const item = process.argv.find(value => value.startsWith(prefix))
  return item ? item.slice(prefix.length) : fallback
}

function hasArgument(name) {
  return process.argv.includes(`--${name}`)
}

function requiredEnv(name) {
  const value = String(process.env[name] ?? '').trim()
  if (!value) throw new Error(`Missing environment variable: ${name}`)
  return value
}

function uniqueFileIds(values) {
  return [...new Set(
    (values ?? [])
      .flat()
      .map(value => String(value ?? '').trim())
      .filter(Boolean),
  )]
}

async function claimQueueItem() {
  const result = await query(
    `
      WITH candidate AS (
        SELECT product_id
        FROM product_vector_sync_queue
        WHERE
          (
            status IN ('pending', 'failed')
            AND available_at <= now()
          )
          OR (
            status = 'processing'
            AND locked_at < now() - interval '15 minutes'
          )
        ORDER BY
          CASE status WHEN 'processing' THEN 0 ELSE 1 END,
          available_at,
          updated_at
        LIMIT 1
        FOR UPDATE SKIP LOCKED
      )
      UPDATE product_vector_sync_queue q
      SET
        status = 'processing',
        attempts = q.attempts + 1,
        locked_at = now(),
        last_error = NULL,
        updated_at = now()
      FROM candidate
      WHERE q.product_id = candidate.product_id
      RETURNING q.*
    `,
  )

  return result.rows[0] ?? null
}

async function loadProduct(productId) {
  const result = await query(
    `
      SELECT
        p.id,
        p.legacy_id AS "legacyId",
        p.name,
        p.slug,
        p.description,
        p.sku,
        p.is_published AS "isPublished",
        p.attributes,
        p.updated_at AS "updatedAt",
        c.name AS "categoryName",
        c.slug AS "categorySlug",
        COALESCE(
          (
            SELECT json_agg(
              json_build_object(
                'unit', v.unit,
                'isActive', v.is_active
              )
              ORDER BY v.sort_order, v.created_at
            )
            FROM product_variants v
            WHERE v.product_id = p.id
          ),
          '[]'::json
        ) AS variants
      FROM products p
      JOIN categories c ON c.id = p.category_id
      WHERE p.id = $1
      LIMIT 1
    `,
    [productId],
  )

  return result.rows[0] ?? null
}

async function loadIndex(productId) {
  const result = await query(
    `
      SELECT *
      FROM product_vector_index
      WHERE product_id = $1
      LIMIT 1
    `,
    [productId],
  )

  return result.rows[0] ?? null
}

async function markDone(productId) {
  await query(
    `
      UPDATE product_vector_sync_queue
      SET
        status = 'done',
        available_at = now(),
        last_error = NULL,
        locked_at = NULL,
        updated_at = now()
      WHERE product_id = $1
    `,
    [productId],
  )
}

async function markFailed(item, error) {
  const delaySeconds = Math.min(
    3_600,
    30 * (2 ** Math.min(Number(item.attempts ?? 1) - 1, 7)),
  )

  await query(
    `
      UPDATE product_vector_sync_queue
      SET
        status = 'failed',
        available_at = now() + ($2::text || ' seconds')::interval,
        last_error = $3,
        locked_at = NULL,
        updated_at = now()
      WHERE product_id = $1
    `,
    [
      item.product_id,
      String(delaySeconds),
      String(error?.message ?? error).slice(0, 4_000),
    ],
  )

  await query(
    `
      UPDATE product_vector_index
      SET
        sync_status = 'error',
        last_error = $2,
        updated_at = now()
      WHERE product_id = $1
    `,
    [
      item.product_id,
      String(error?.message ?? error).slice(0, 4_000),
    ],
  )
}

async function cleanFiles(fileIds) {
  const remaining = []

  for (const fileId of uniqueFileIds(fileIds)) {
    try {
      await deleteOpenAiFile(fileId)
    } catch (error) {
      remaining.push(fileId)
      console.error(
        `[product-vector] failed to delete stale file ${fileId}:`,
        error?.message ?? error,
      )
    }
  }

  return remaining
}

async function removeProductIndex(item, index) {
  const fileIds = uniqueFileIds([
    item.old_file_ids,
    index?.openai_file_id,
    index?.stale_file_ids,
  ])

  const remaining = await cleanFiles(fileIds)

  if (remaining.length) {
    await query(
      `
        INSERT INTO product_vector_index (
          product_id,
          openai_file_id,
          vector_store_id,
          content_hash,
          sync_status,
          last_error,
          stale_file_ids,
          created_at,
          updated_at
        )
        VALUES ($1, NULL, $2, NULL, 'error', $3, $4, now(), now())
        ON CONFLICT (product_id) DO UPDATE
        SET
          openai_file_id = NULL,
          content_hash = NULL,
          sync_status = 'error',
          last_error = EXCLUDED.last_error,
          stale_file_ids = EXCLUDED.stale_file_ids,
          updated_at = now()
      `,
      [
        item.product_id,
        process.env.OPENAI_PRODUCT_VECTOR_STORE_ID ?? null,
        'Не удалось удалить часть старых OpenAI Files',
        remaining,
      ],
    )

    throw new Error('Не удалось удалить часть старых OpenAI Files')
  }

  await query(
    'DELETE FROM product_vector_index WHERE product_id = $1',
    [item.product_id],
  )
  await markDone(item.product_id)
}

async function syncProduct(item, vectorStoreId) {
  const product = await loadProduct(item.product_id)
  const index = await loadIndex(item.product_id)

  if (
    item.operation === 'delete'
    || !product
    || product.isPublished !== true
  ) {
    await removeProductIndex(item, index)
    return { action: 'deleted', productId: item.product_id }
  }

  const content = buildProductVectorDocument(product)
  const contentHash = productVectorContentHash(content)

  if (
    index?.openai_file_id
    && index?.vector_store_id === vectorStoreId
    && index?.content_hash === contentHash
  ) {
    const remaining = await cleanFiles([
      item.old_file_ids,
      index.stale_file_ids,
    ])

    await query(
      `
        UPDATE product_vector_index
        SET
          sync_status = $2,
          stale_file_ids = $3,
          last_error = $4,
          last_synced_at = now(),
          updated_at = now()
        WHERE product_id = $1
      `,
      [
        product.id,
        remaining.length ? 'error' : 'synced',
        remaining,
        remaining.length
          ? 'Не удалось удалить часть устаревших файлов'
          : null,
      ],
    )

    await markDone(product.id)
    return { action: 'unchanged', productId: product.id }
  }

  await query(
    `
      INSERT INTO product_vector_index (
        product_id,
        vector_store_id,
        sync_status,
        created_at,
        updated_at
      )
      VALUES ($1, $2, 'syncing', now(), now())
      ON CONFLICT (product_id) DO UPDATE
      SET
        vector_store_id = EXCLUDED.vector_store_id,
        sync_status = 'syncing',
        last_error = NULL,
        updated_at = now()
    `,
    [product.id, vectorStoreId],
  )

  const uploaded = await uploadTextFile({
    filename: productVectorFilename(product),
    content,
  })

  let attached = false

  try {
    await attachFileToVectorStore({
      vectorStoreId,
      fileId: uploaded.id,
      attributes: {
        project: 'ozelif',
        source: 'product',
        product_id: product.id,
        category_slug: product.categorySlug,
        published: true,
        content_hash: contentHash.slice(0, 48),
        updated_at: Math.floor(
          new Date(product.updatedAt).getTime() / 1_000,
        ),
      },
    })

    attached = true

    await waitForVectorStoreFile({
      vectorStoreId,
      fileId: uploaded.id,
    })

    const staleFileIds = uniqueFileIds([
      item.old_file_ids,
      index?.stale_file_ids,
      index?.openai_file_id,
    ]).filter(fileId => fileId !== uploaded.id)

    await query(
      `
        INSERT INTO product_vector_index (
          product_id,
          openai_file_id,
          vector_store_id,
          content_hash,
          indexed_product_updated_at,
          sync_status,
          last_synced_at,
          last_error,
          stale_file_ids,
          created_at,
          updated_at
        )
        VALUES (
          $1, $2, $3, $4, $5, 'synced',
          now(), NULL, $6, now(), now()
        )
        ON CONFLICT (product_id) DO UPDATE
        SET
          openai_file_id = EXCLUDED.openai_file_id,
          vector_store_id = EXCLUDED.vector_store_id,
          content_hash = EXCLUDED.content_hash,
          indexed_product_updated_at =
            EXCLUDED.indexed_product_updated_at,
          sync_status = 'synced',
          last_synced_at = now(),
          last_error = NULL,
          stale_file_ids = EXCLUDED.stale_file_ids,
          updated_at = now()
      `,
      [
        product.id,
        uploaded.id,
        vectorStoreId,
        contentHash,
        product.updatedAt,
        staleFileIds,
      ],
    )

    const remaining = await cleanFiles(staleFileIds)

    await query(
      `
        UPDATE product_vector_index
        SET
          stale_file_ids = $2,
          sync_status = $3,
          last_error = $4,
          updated_at = now()
        WHERE product_id = $1
      `,
      [
        product.id,
        remaining,
        remaining.length ? 'error' : 'synced',
        remaining.length
          ? 'Новый документ создан, но часть старых файлов не удалена'
          : null,
      ],
    )

    await markDone(product.id)

    return {
      action: 'synced',
      productId: product.id,
      fileId: uploaded.id,
    }
  } catch (error) {
    if (!attached || uploaded?.id) {
      try {
        await deleteOpenAiFile(uploaded.id)
      } catch {
        // Новый неиспользуемый файл будет виден в логах OpenAI.
      }
    }

    throw error
  }
}

async function reconcileQueue() {
  await query(
    `
      INSERT INTO product_vector_sync_queue (
        product_id,
        operation,
        status,
        attempts,
        available_at,
        old_file_ids,
        created_at,
        updated_at
      )
      SELECT
        p.id,
        'upsert',
        'pending',
        0,
        now(),
        '{}'::text[],
        now(),
        now()
      FROM products p
      ON CONFLICT (product_id) DO UPDATE
      SET
        operation = 'upsert',
        status = 'pending',
        attempts = 0,
        available_at = now(),
        last_error = NULL,
        locked_at = NULL,
        updated_at = now()
    `,
  )

  const orphaned = await query(
    `
      SELECT
        i.product_id,
        ARRAY(
          SELECT DISTINCT file_id
          FROM unnest(
            COALESCE(i.stale_file_ids, '{}'::text[])
            || ARRAY[i.openai_file_id]
          ) AS file_id
          WHERE file_id IS NOT NULL AND file_id <> ''
        ) AS file_ids
      FROM product_vector_index i
      LEFT JOIN products p ON p.id = i.product_id
      WHERE p.id IS NULL OR p.is_published = false
    `,
  )

  for (const row of orphaned.rows) {
    await query(
      'SELECT enqueue_product_vector_sync($1, $2, $3)',
      [row.product_id, 'delete', row.file_ids],
    )
  }

  return orphaned.rowCount
}

async function status() {
  const result = await query(
    `
      SELECT
        (SELECT count(*)::int FROM products
          WHERE is_published = true) AS published_products,
        (SELECT count(*)::int FROM product_vector_index
          WHERE sync_status = 'synced') AS synced_products,
        (SELECT count(*)::int FROM product_vector_sync_queue
          WHERE status = 'pending') AS pending,
        (SELECT count(*)::int FROM product_vector_sync_queue
          WHERE status = 'processing') AS processing,
        (SELECT count(*)::int FROM product_vector_sync_queue
          WHERE status = 'failed') AS failed,
        (SELECT count(*)::int FROM product_vector_index
          WHERE sync_status = 'error') AS index_errors
    `,
  )

  return result.rows[0]
}

async function main() {
  const vectorStoreId = requiredEnv('OPENAI_PRODUCT_VECTOR_STORE_ID')
  await getVectorStore(vectorStoreId)

  if (hasArgument('reconcile')) {
    const orphaned = await reconcileQueue()
    console.log({ reconcile: true, orphaned })
  }

  if (hasArgument('status')) {
    console.log(await status())
    return
  }

  const concurrency = Math.max(
    1,
    Math.min(Number(argumentValue('concurrency', '3')), 8),
  )
  const maxItems = Math.max(
    1,
    Math.min(Number(argumentValue('max', '30')), 2_000),
  )
  const drain = hasArgument('drain')
  let processed = 0

  while (processed < maxItems) {
    const batch = []

    for (let index = 0; index < concurrency; index += 1) {
      const item = await claimQueueItem()
      if (!item) break
      batch.push(item)
    }

    if (!batch.length) break

    const results = await Promise.all(
      batch.map(async item => {
        try {
          const result = await syncProduct(item, vectorStoreId)
          console.log(result)
          return true
        } catch (error) {
          console.error({
            action: 'failed',
            productId: item.product_id,
            error: error?.message ?? String(error),
          })
          await markFailed(item, error)
          return false
        }
      }),
    )

    processed += batch.length

    if (!drain) break

    if (!results.some(Boolean) && batch.length === concurrency) {
      break
    }
  }

  console.log({
    processed,
    status: await status(),
  })
}

try {
  await main()
} finally {
  await closePool()
}
