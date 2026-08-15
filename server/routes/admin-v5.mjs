
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

function textOrNull(value) {
  const text = String(value ?? '').trim()
  return text || null
}

function cleanAttributes(value) {
  const result = {
    __managed: true,
    __pricingManaged: true,
  }

  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return result
  }

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

async function uniqueSlug(client, categoryId, name, excludeId = null) {
  const base = normalizeSlug(name) || 'product'

  for (let index = 1; index <= 9999; index += 1) {
    const candidate = index === 1 ? base : `${base}-${index}`

    const result = await client.query(
      `SELECT 1
         FROM products
        WHERE category_id = $1
          AND slug = $2
          AND ($3::uuid IS NULL OR id <> $3::uuid)
        LIMIT 1`,
      [categoryId, candidate, excludeId],
    )

    if (!result.rowCount) return candidate
  }

  throw new Error('Не удалось создать уникальный адрес товара')
}

async function stableSlug(client, current, categoryId, name) {
  if (current.slug) {
    const conflict = await client.query(
      `SELECT 1
         FROM products
        WHERE category_id = $1
          AND slug = $2
          AND id <> $3
        LIMIT 1`,
      [categoryId, current.slug, current.id],
    )

    if (!conflict.rowCount) return current.slug
  }

  return uniqueSlug(client, categoryId, name, current.id)
}

function desiredPrices(body) {
  const primary = {
    sourcePriceUsd: numberOrNull(body?.sourcePriceUsd),
    sourceOldPriceUsd: numberOrNull(body?.sourceOldPriceUsd),
    unit: textOrNull(body?.unit),
    sortOrder: 0,
  }

  const secondary = {
    sourcePriceUsd: numberOrNull(body?.secondaryPriceUsd),
    sourceOldPriceUsd: numberOrNull(body?.secondaryOldPriceUsd),
    unit: textOrNull(body?.secondaryUnit),
    sortOrder: 1,
  }

  const rows = []

  if (primary.sourcePriceUsd !== null) rows.push(primary)

  if (secondary.sourcePriceUsd !== null) {
    if (!secondary.unit) {
      const error = new Error('Для второй цены выберите единицу измерения')
      error.status = 400
      throw error
    }

    if ((primary.unit ?? '') === secondary.unit) {
      const error = new Error('Вторая единица должна отличаться от основной')
      error.status = 400
      throw error
    }

    rows.push(secondary)
  }

  return rows
}

async function syncManagedPrices(client, productId, product, rows) {
  const existingResult = await client.query(
    `SELECT id, stock_quantity, sort_order
       FROM product_variants
      WHERE product_id = $1
      ORDER BY is_active DESC, sort_order, created_at`,
    [productId],
  )

  const existing = existingResult.rows
  const usedIds = []

  for (let index = 0; index < rows.length; index += 1) {
    const row = rows[index]
    const current = existing[index]
    const name = row.unit
      ? `${product.name} — ${row.unit}`
      : product.name

    if (current) {
      await client.query(
        `UPDATE product_variants
            SET name = $2,
                sku = $3,
                source_price_usd = $4,
                source_old_price_usd = $5,
                unit = $6,
                is_active = true,
                sort_order = $7,
                updated_at = now()
          WHERE id = $1`,
        [
          current.id,
          name,
          product.sku || null,
          row.sourcePriceUsd,
          row.sourceOldPriceUsd,
          row.unit,
          row.sortOrder,
        ],
      )
      usedIds.push(current.id)
    } else {
      const inserted = await client.query(
        `INSERT INTO product_variants
          (product_id, name, sku, source_price_usd, source_old_price_usd,
           unit, stock_quantity, is_active, sort_order)
         VALUES ($1,$2,$3,$4,$5,$6,NULL,true,$7)
         RETURNING id`,
        [
          productId,
          name,
          product.sku || null,
          row.sourcePriceUsd,
          row.sourceOldPriceUsd,
          row.unit,
          row.sortOrder,
        ],
      )
      usedIds.push(inserted.rows[0].id)
    }
  }

  if (usedIds.length) {
    await client.query(
      `UPDATE product_variants
          SET is_active = false,
              updated_at = now()
        WHERE product_id = $1
          AND NOT (id = ANY($2::uuid[]))`,
      [productId, usedIds],
    )
  } else {
    await client.query(
      `UPDATE product_variants
          SET is_active = false,
              updated_at = now()
        WHERE product_id = $1`,
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
                  ORDER BY v.is_active DESC, v.sort_order, v.created_at
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

export function createAdminV5Router() {
  const router = express.Router()
  router.use(requireAdmin)
  router.use(requirePermission('catalog:write'))

  router.post('/products', asyncRoute(async (request, response) => {
    const item = await transaction(async client => {
      const name = String(request.body?.name ?? '').trim()
      const categoryId = String(request.body?.categoryId ?? '').trim()

      if (!name || !categoryId) {
        const error = new Error('Укажите каталог и название товара')
        error.status = 400
        throw error
      }

      const prices = desiredPrices(request.body)
      const primary = prices[0] ?? {
        sourcePriceUsd: null,
        sourceOldPriceUsd: null,
        unit: null,
      }
      const slug = await uniqueSlug(client, categoryId, name)

      const inserted = await client.query(
        `INSERT INTO products
          (category_id, name, slug, description, sku, source_price_usd,
           source_old_price_usd, unit, stock_quantity, min_order,
           primary_image, is_published, attributes)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,NULL,NULL,$9,$10,$11)
         RETURNING id`,
        [
          categoryId,
          name,
          slug,
          String(request.body?.description ?? '').trim(),
          request.body?.sku || null,
          primary.sourcePriceUsd,
          primary.sourceOldPriceUsd,
          primary.unit,
          request.body?.primaryImage || null,
          request.body?.isPublished !== false,
          cleanAttributes(request.body?.attributes),
        ],
      )

      const productId = inserted.rows[0].id
      await syncManagedPrices(client, productId, {
        name,
        sku: request.body?.sku,
      }, prices)
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

      const name = String(request.body?.name ?? current.name).trim()
      const categoryId = request.body?.categoryId ?? current.category_id
      const slug = await stableSlug(client, current, categoryId, name)
      const prices = desiredPrices(request.body)
      const primary = prices[0] ?? {
        sourcePriceUsd: null,
        sourceOldPriceUsd: null,
        unit: null,
      }

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
                primary_image = $10,
                is_published = $11,
                attributes = $12,
                updated_at = now()
          WHERE id = $1`,
        [
          request.params.id,
          categoryId,
          name,
          slug,
          request.body?.description ?? current.description,
          request.body?.sku ?? current.sku,
          primary.sourcePriceUsd,
          primary.sourceOldPriceUsd,
          primary.unit,
          request.body?.primaryImage ?? current.primary_image,
          request.body?.isPublished ?? current.is_published,
          cleanAttributes(request.body?.attributes ?? current.attributes),
        ],
      )

      await syncManagedPrices(client, request.params.id, {
        name,
        sku: request.body?.sku ?? current.sku,
      }, prices)
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
