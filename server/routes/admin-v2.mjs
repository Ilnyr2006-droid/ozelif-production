
import express from 'express'
import { pool, query, transaction } from '../lib/db.mjs'
import { requireAdmin, requirePermission } from '../lib/admin-auth.mjs'
import { normalizeCatalogSlug } from '../lib/catalog-slug.mjs'
import {
  getPricingSettings,
  recalculateAllPrices,
  recalculateProduct,
  refreshCbrRate,
} from '../lib/pricing.mjs'

function asyncRoute(handler) {
  return (request, response, next) => {
    Promise.resolve(handler(request, response, next)).catch(next)
  }
}

async function audit(client, adminId, action, entityType, entityId, beforeData, afterData) {
  await client.query(
    `INSERT INTO audit_log
      (admin_user_id, action, entity_type, entity_id, before_data, after_data)
     VALUES ($1,$2,$3,$4,$5,$6)`,
    [adminId, action, entityType, entityId, beforeData, afterData],
  )
}

function numberOrNull(value) {
  if (value === '' || value == null) return null
  const number = Number(value)
  return Number.isFinite(number) ? number : null
}

async function saveVariants(client, productId, variants) {
  if (!Array.isArray(variants)) return

  const keptIds = []

  for (let index = 0; index < variants.length; index += 1) {
    const variant = variants[index]
    const id = String(variant.id ?? '').trim() || null

    if (id) {
      const result = await client.query(
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
          String(variant.name ?? `Вариант ${index + 1}`).trim(),
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
      if (result.rowCount) keptIds.push(result.rows[0].id)
    } else {
      const result = await client.query(
        `INSERT INTO product_variants
          (product_id, name, sku, source_price_usd, source_old_price_usd,
           unit, stock_quantity, is_active, sort_order)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
         RETURNING id`,
        [
          productId,
          String(variant.name ?? `Вариант ${index + 1}`).trim(),
          variant.sku || null,
          numberOrNull(variant.sourcePriceUsd),
          numberOrNull(variant.sourceOldPriceUsd),
          variant.unit || null,
          numberOrNull(variant.stockQuantity),
          variant.isActive !== false,
          index,
        ],
      )
      keptIds.push(result.rows[0].id)
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

export function createAdminV2Router() {
  const router = express.Router()
  router.use(requireAdmin)

  router.get('/catalogs', requirePermission('catalog:read'), asyncRoute(async (_request, response) => {
    const result = await query(`
      SELECT c.*,
             count(p.id)::int AS products_count
        FROM categories c
        LEFT JOIN products p ON p.category_id = c.id
       GROUP BY c.id
       ORDER BY c.sort_order, c.created_at
    `)
    response.json({ items: result.rows })
  }))

  router.post('/catalogs', requirePermission('catalog:write'), asyncRoute(async (request, response) => {
    const result = await transaction(async client => {
      const name = String(request.body?.name ?? '').trim()
      const slug = normalizeCatalogSlug(request.body?.slug || name)
      if (!name || !slug) throw new Error('Укажите название и адрес каталога')

      const inserted = await client.query(
        `INSERT INTO categories
          (name, slug, description, cover_image, sort_order, is_published,
           show_on_home, show_in_menu)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
         RETURNING *`,
        [
          name,
          slug,
          String(request.body?.description ?? '').trim(),
          request.body?.coverImage || null,
          Number(request.body?.sortOrder ?? 0),
          request.body?.isPublished !== false,
          request.body?.showOnHome !== false,
          request.body?.showInMenu !== false,
        ],
      )
      await audit(client, request.admin.id, 'create', 'category', inserted.rows[0].id, null, inserted.rows[0])
      return inserted.rows[0]
    })
    response.status(201).json({ item: result })
  }))

  router.patch('/catalogs/:id', requirePermission('catalog:write'), asyncRoute(async (request, response) => {
    const result = await transaction(async client => {
      const before = await client.query('SELECT * FROM categories WHERE id = $1', [request.params.id])
      if (!before.rowCount) return null
      const current = before.rows[0]

      const updated = await client.query(
        `UPDATE categories
            SET name = $2,
                slug = $3,
                description = $4,
                cover_image = $5,
                sort_order = $6,
                is_published = $7,
                show_on_home = $8,
                show_in_menu = $9,
                updated_at = now()
          WHERE id = $1
          RETURNING *`,
        [
          request.params.id,
          String(request.body?.name ?? current.name).trim(),
          normalizeCatalogSlug(request.body?.slug ?? current.slug),
          request.body?.description ?? current.description,
          request.body?.coverImage ?? current.cover_image,
          Number(request.body?.sortOrder ?? current.sort_order),
          request.body?.isPublished ?? current.is_published,
          request.body?.showOnHome ?? current.show_on_home,
          request.body?.showInMenu ?? current.show_in_menu,
        ],
      )

      await audit(client, request.admin.id, 'update', 'category', request.params.id, current, updated.rows[0])
      return updated.rows[0]
    })

    if (!result) {
      response.status(404).json({ error: 'Каталог не найден' })
      return
    }
    response.json({ item: result })
  }))

  router.delete('/catalogs/:id', requirePermission('catalog:delete'), asyncRoute(async (request, response) => {
    await transaction(async client => {
      const before = await client.query('SELECT * FROM categories WHERE id = $1', [request.params.id])
      if (!before.rowCount) {
        const error = new Error('Каталог не найден')
        error.status = 404
        throw error
      }

      const products = await client.query(
        'SELECT count(*)::int AS count FROM products WHERE category_id = $1',
        [request.params.id],
      )
      if (products.rows[0].count > 0) {
        const error = new Error('Сначала удалите или перенесите товары этого каталога')
        error.status = 409
        throw error
      }

      await client.query('DELETE FROM categories WHERE id = $1', [request.params.id])
      await audit(client, request.admin.id, 'delete', 'category', request.params.id, before.rows[0], null)
    })
    response.status(204).end()
  }))

  router.get('/products', requirePermission('catalog:read'), asyncRoute(async (request, response) => {
    const categoryId = String(request.query.categoryId ?? '').trim()
    const search = String(request.query.q ?? '').trim()

    const result = await query(
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
        WHERE ($1 = '' OR p.category_id::text = $1)
          AND (
            $2 = ''
            OR p.name ILIKE '%' || $2 || '%'
            OR coalesce(p.sku, '') ILIKE '%' || $2 || '%'
          )
        ORDER BY p.updated_at DESC
        LIMIT 500`,
      [categoryId, search],
    )

    response.json({ items: result.rows })
  }))

  router.post('/products', requirePermission('catalog:write'), asyncRoute(async (request, response) => {
    const result = await transaction(async client => {
      const name = String(request.body?.name ?? '').trim()
      const categoryId = String(request.body?.categoryId ?? '').trim()
      const slug = normalizeSlug(request.body?.slug || name)
      if (!name || !categoryId || !slug) throw new Error('Укажите каталог, название и адрес товара')

      const inserted = await client.query(
        `INSERT INTO products
          (category_id, name, slug, description, sku, source_price_usd,
           source_old_price_usd, unit, stock_quantity, min_order,
           primary_image, is_published)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
         RETURNING *`,
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
        ],
      )

      await saveVariants(client, inserted.rows[0].id, request.body?.variants ?? [])
      await recalculateProduct(client, inserted.rows[0].id)
      const final = await client.query('SELECT * FROM products WHERE id = $1', [inserted.rows[0].id])
      await audit(client, request.admin.id, 'create', 'product', inserted.rows[0].id, null, final.rows[0])
      return final.rows[0]
    })

    response.status(201).json({ item: result })
  }))

  router.patch('/products/:id', requirePermission('catalog:write'), asyncRoute(async (request, response) => {
    const result = await transaction(async client => {
      const before = await client.query('SELECT * FROM products WHERE id = $1', [request.params.id])
      if (!before.rowCount) return null
      const current = before.rows[0]

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
        ],
      )

      if (Array.isArray(request.body?.variants)) {
        await saveVariants(client, request.params.id, request.body.variants)
      }

      await recalculateProduct(client, request.params.id)
      const after = await client.query('SELECT * FROM products WHERE id = $1', [request.params.id])
      await audit(client, request.admin.id, 'update', 'product', request.params.id, current, after.rows[0])
      return after.rows[0]
    })

    if (!result) {
      response.status(404).json({ error: 'Товар не найден' })
      return
    }

    response.json({ item: result })
  }))

  router.delete('/products/:id', requirePermission('catalog:delete'), asyncRoute(async (request, response) => {
    await transaction(async client => {
      const before = await client.query('SELECT * FROM products WHERE id = $1', [request.params.id])
      if (!before.rowCount) {
        const error = new Error('Товар не найден')
        error.status = 404
        throw error
      }

      await client.query('DELETE FROM products WHERE id = $1', [request.params.id])
      await audit(client, request.admin.id, 'delete', 'product', request.params.id, before.rows[0], null)
    })
    response.status(204).end()
  }))

  router.get('/pricing', requirePermission('pricing:read'), asyncRoute(async (_request, response) => {
    response.json({ settings: await getPricingSettings() })
  }))

  router.patch('/pricing', requirePermission('pricing:write'), asyncRoute(async (request, response) => {
    const result = await transaction(async client => {
      const before = await getPricingSettings(client)
      const markup = Number(request.body?.markupPercent ?? before.markup_percent)

      if (!Number.isFinite(markup) || markup < -100 || markup > 1000) {
        const error = new Error('Наценка должна быть от -100% до 1000%')
        error.status = 400
        throw error
      }

      const updated = await client.query(
        `UPDATE store_pricing_settings
            SET markup_percent = $1,
                auto_update = $2,
                updated_at = now()
          WHERE id = true
          RETURNING *`,
        [
          markup,
          request.body?.autoUpdate ?? before.auto_update,
        ],
      )

      await recalculateAllPrices(client, updated.rows[0])
      await audit(client, request.admin.id, 'update', 'pricing_settings', 'global', before, updated.rows[0])
      return updated.rows[0]
    })

    response.json({ settings: result })
  }))

  router.post('/pricing/refresh', requirePermission('pricing:write'), asyncRoute(async (_request, response) => {
    const settings = await refreshCbrRate()
    response.json({ settings })
  }))

  router.use((error, _request, response, next) => {
    if (!error) return next()
    if (error.code === '23505') {
      response.status(409).json({ error: 'Такой адрес уже используется' })
      return
    }
    response.status(error.status || 500).json({ error: error.message || 'Внутренняя ошибка' })
  })

  return router
}
