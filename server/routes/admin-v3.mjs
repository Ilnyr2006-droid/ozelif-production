import express from 'express'
import { query, transaction } from '../lib/db.mjs'
import { requireAdmin, requirePermission } from '../lib/admin-auth.mjs'
import { recalculateProduct } from '../lib/pricing.mjs'

function asyncRoute(handler) {
  return (request, response, next) => {
    Promise.resolve(handler(request, response, next)).catch(next)
  }
}

function normalizeSlug(value) {
  return String(value ?? '')
    .trim()
    .toLocaleLowerCase('ru')
    .replace(/ё/g, 'e')
    .replace(/[а-я]/g, character => ({
      а:'a',б:'b',в:'v',г:'g',д:'d',е:'e',ж:'zh',з:'z',и:'i',й:'y',
      к:'k',л:'l',м:'m',н:'n',о:'o',п:'p',р:'r',с:'s',т:'t',у:'u',
      ф:'f',х:'h',ц:'ts',ч:'ch',ш:'sh',щ:'sch',ъ:'',ы:'y',ь:'',э:'e',
      ю:'yu',я:'ya',
    }[character] ?? character))
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function numberOrNull(value) {
  if (value === '' || value === null || value === undefined) return null
  const parsed = Number(String(value).replace(',', '.'))
  return Number.isFinite(parsed) ? parsed : null
}

function cleanAttributes(value) {
  const result = { __managed: true }

  if (!value || typeof value !== 'object' || Array.isArray(value)) return result

  for (const [rawLabel, rawValue] of Object.entries(value)) {
    if (rawLabel.startsWith('__')) continue

    const label = String(rawLabel).trim()
    const text = Array.isArray(rawValue)
      ? rawValue.map(item => String(item ?? '').trim()).filter(Boolean).join(' · ')
      : String(rawValue ?? '').trim()

    if (label && text) result[label] = text
  }

  return result
}

async function audit(client, adminId, action, entityType, entityId, beforeData, afterData) {
  await client.query(
    `INSERT INTO audit_log
      (admin_user_id, action, entity_type, entity_id, before_data, after_data)
     VALUES ($1,$2,$3,$4,$5,$6)`,
    [adminId, action, entityType, entityId, beforeData, afterData],
  )
}

async function saveVariants(client, productId, variants) {
  if (!Array.isArray(variants)) return

  const keptIds = []

  for (let index = 0; index < variants.length; index += 1) {
    const variant = variants[index]
    const id = String(variant.id ?? '').trim() || null
    const name = String(variant.name ?? `Вариант ${index + 1}`).trim()
    if (!name) continue

    if (id) {
      const updated = await client.query(
        `UPDATE product_variants
            SET name = $2,
                sku = $3,
                source_price_usd = $4,
                source_old_price_usd = $5,
                unit = $6,
                stock_quantity = $7,
                is_active = $8,
                sort_order = $9,
                updated_at = now()
          WHERE id = $1
            AND product_id = $10
          RETURNING id`,
        [
          id,
          name,
          variant.sku || null,
          numberOrNull(variant.sourcePriceUsd),
          numberOrNull(variant.sourceOldPriceUsd),
          variant.unit || null,
          numberOrNull(variant.stockQuantity),
          variant.isActive !== false,
          index,
          productId,
        ],
      )
      if (updated.rowCount) keptIds.push(updated.rows[0].id)
    } else {
      const inserted = await client.query(
        `INSERT INTO product_variants
          (product_id, name, sku, source_price_usd, source_old_price_usd,
           unit, stock_quantity, is_active, sort_order)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
         RETURNING id`,
        [
          productId,
          name,
          variant.sku || null,
          numberOrNull(variant.sourcePriceUsd),
          numberOrNull(variant.sourceOldPriceUsd),
          variant.unit || null,
          numberOrNull(variant.stockQuantity),
          variant.isActive !== false,
          index,
        ],
      )
      keptIds.push(inserted.rows[0].id)
    }
  }

  if (keptIds.length) {
    await client.query(
      `DELETE FROM product_variants
        WHERE product_id = $1
          AND NOT (id = ANY($2::uuid[]))`,
      [productId, keptIds],
    )
  } else {
    await client.query(
      'DELETE FROM product_variants WHERE product_id = $1',
      [productId],
    )
  }
}

async function fullProduct(client, id) {
  const result = await client.query(
    `SELECT p.*,
            c.name AS category_name,
            c.slug AS category_slug,
            COALESCE(
              (
                SELECT json_agg(
                  json_build_object(
                    'id', v.id,
                    'name', v.name,
                    'sku', v.sku,
                    'sourcePriceUsd', v.source_price_usd,
                    'sourceOldPriceUsd', v.source_old_price_usd,
                    'priceRub', v.price,
                    'oldPriceRub', v.old_price,
                    'unit', v.unit,
                    'stockQuantity', v.stock_quantity,
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
      WHERE p.id = $1`,
    [id],
  )

  return result.rows[0] ?? null
}

export function createAdminV3Router() {
  const router = express.Router()
  router.use(requireAdmin)
  router.use(requirePermission('catalog:write'))

  router.post('/products', asyncRoute(async (request, response) => {
    const item = await transaction(async client => {
      const name = String(request.body?.name ?? '').trim()
      const categoryId = String(request.body?.categoryId ?? '').trim()
      const slug = normalizeSlug(request.body?.slug || name)

      if (!name || !categoryId || !slug) {
        const error = new Error('Укажите каталог, название и адрес товара')
        error.status = 400
        throw error
      }

      const inserted = await client.query(
        `INSERT INTO products
          (category_id, name, slug, description, sku, source_price_usd,
           source_old_price_usd, unit, stock_quantity, min_order,
           primary_image, is_published, attributes)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
         RETURNING id`,
        [
          categoryId,
          name,
          slug,
          String(request.body?.description ?? '').trim(),
          request.body?.sku || null,
          numberOrNull(request.body?.sourcePriceUsd),
          numberOrNull(request.body?.sourceOldPriceUsd),
          request.body?.unit || null,
          numberOrNull(request.body?.stockQuantity),
          numberOrNull(request.body?.minOrder),
          request.body?.primaryImage || null,
          request.body?.isPublished !== false,
          cleanAttributes(request.body?.attributes),
        ],
      )

      const productId = inserted.rows[0].id
      await saveVariants(client, productId, request.body?.variants ?? [])
      await recalculateProduct(client, productId)

      const after = await fullProduct(client, productId)
      await audit(client, request.admin.id, 'create', 'product', productId, null, after)
      return after
    })

    response.status(201).json({ item })
  }))

  router.patch('/products/:id', asyncRoute(async (request, response) => {
    const item = await transaction(async client => {
      const beforeResult = await client.query(
        'SELECT * FROM products WHERE id = $1',
        [request.params.id],
      )

      if (!beforeResult.rowCount) return null
      const current = beforeResult.rows[0]

      await client.query(
        `UPDATE products
            SET category_id = $2,
                name = $3,
                slug = $4,
                description = $5,
                sku = $6,
                source_price_usd = $7,
                source_old_price_usd = $8,
                unit = $9,
                stock_quantity = $10,
                min_order = $11,
                primary_image = $12,
                is_published = $13,
                attributes = $14,
                updated_at = now()
          WHERE id = $1`,
        [
          request.params.id,
          request.body?.categoryId ?? current.category_id,
          String(request.body?.name ?? current.name).trim(),
          normalizeSlug(request.body?.slug ?? current.slug),
          request.body?.description ?? current.description,
          request.body?.sku ?? current.sku,
          numberOrNull(request.body?.sourcePriceUsd ?? current.source_price_usd),
          numberOrNull(request.body?.sourceOldPriceUsd ?? current.source_old_price_usd),
          request.body?.unit ?? current.unit,
          numberOrNull(request.body?.stockQuantity ?? current.stock_quantity),
          numberOrNull(request.body?.minOrder ?? current.min_order),
          request.body?.primaryImage ?? current.primary_image,
          request.body?.isPublished ?? current.is_published,
          cleanAttributes(request.body?.attributes ?? current.attributes),
        ],
      )

      if (Array.isArray(request.body?.variants)) {
        await saveVariants(client, request.params.id, request.body.variants)
      }

      await recalculateProduct(client, request.params.id)
      const after = await fullProduct(client, request.params.id)
      await audit(
        client,
        request.admin.id,
        'update',
        'product',
        request.params.id,
        current,
        after,
      )
      return after
    })

    if (!item) {
      response.status(404).json({ error: 'Товар не найден' })
      return
    }

    response.json({ item })
  }))

  router.use((error, _request, response, next) => {
    if (!error) return next()
    if (error.code === '23505') {
      response.status(409).json({ error: 'Такой адрес уже используется' })
      return
    }
    response
      .status(error.status || 500)
      .json({ error: error.message || 'Внутренняя ошибка' })
  })

  return router
}

export function createPublicProductRouter() {
  const router = express.Router()

  router.get('/:legacyId', asyncRoute(async (request, response) => {
    const result = await query(
      `SELECT p.id,
              p.legacy_id,
              p.name,
              p.slug,
              p.description,
              p.sku,
              p.base_price,
              p.old_price,
              p.unit,
              p.min_order,
              p.primary_image,
              p.attributes,
              c.name AS category_name,
              c.slug AS category_slug,
              COALESCE(
                (
                  SELECT json_agg(
                    json_build_object(
                      'priceRub', v.price,
                      'unit', v.unit,
                      'currency', 'RUB',
                      'priceSource', 'admin'
                    )
                    ORDER BY v.sort_order, v.created_at
                  )
                    FROM product_variants v
                   WHERE v.product_id = p.id
                     AND v.is_active = true
                     AND v.price IS NOT NULL
                ),
                '[]'::json
              ) AS variants
         FROM products p
         JOIN categories c ON c.id = p.category_id
        WHERE p.is_published = true
          AND (
            p.legacy_id = $1
            OR p.id::text = $1
          )
        LIMIT 1`,
      [String(request.params.legacyId)],
    )

    if (!result.rowCount) {
      response.status(404).json({ error: 'not_found' })
      return
    }

    response.json({ item: result.rows[0] })
  }))

  return router
}
