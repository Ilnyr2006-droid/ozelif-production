const DEFAULT_LIMIT = 24
const MAX_LIMIT = 48
const MAX_OFFSET = 100_000

const SORT_ORDERS = {
  default: 'p.updated_at DESC, p.id DESC',
  name: 'lower(p.name) ASC, p.id ASC',
  'price-asc': 'p.base_price ASC NULLS LAST, p.id ASC',
  'price-desc': 'p.base_price DESC NULLS LAST, p.id ASC',
}

async function databaseQuery(sql, params) {
  const { query } = await import('./db.mjs')
  return query(sql, params)
}

function firstValue(value) {
  return Array.isArray(value) ? value[0] : value
}

function cleanText(value, maxLength) {
  const text = String(firstValue(value) ?? '').trim()
  return text ? text.slice(0, maxLength) : null
}

function boundedInteger(value, fallback, maximum) {
  const parsed = Number(firstValue(value))
  if (!Number.isInteger(parsed) || parsed < 0) return fallback
  return Math.min(parsed, maximum)
}

function parseJson(value, fallback) {
  if (value === null || value === undefined) return fallback
  if (typeof value === 'string') {
    try {
      return JSON.parse(value)
    } catch {
      return fallback
    }
  }
  return value
}

export function parseCatalogListQuery(raw = {}) {
  const sortValue = cleanText(raw.sort, 32)

  return {
    limit: Math.max(1, boundedInteger(raw.limit, DEFAULT_LIMIT, MAX_LIMIT)),
    offset: boundedInteger(raw.offset, 0, MAX_OFFSET),
    sort: Object.hasOwn(SORT_ORDERS, sortValue ?? '') ? sortValue : 'default',
    q: cleanText(raw.q, 200),
    subtype: cleanText(raw.subtype, 160),
    color: cleanText(raw.color, 160),
    material: cleanText(raw.material, 160),
    thickness: cleanText(raw.thickness, 80),
  }
}

export function normalizeCategorySlug(value) {
  const slug = cleanText(value, 120)?.toLocaleLowerCase('ru') ?? ''
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) ? slug : null
}

export function normalizeProductIdentifier(value) {
  return cleanText(value, 180)
}

function categoryFromRow(row) {
  const category = parseJson(row.category, null)
  return category && typeof category === 'object' ? category : null
}

function positivePrice(value) {
  const number = Number(value)
  return Number.isFinite(number) && number > 0 ? number : null
}

export function normalizePublicProductPricing(product) {
  if (!product || typeof product !== 'object') return product

  const variants = Array.isArray(product.variants)
    ? product.variants.filter(variant => variant?.isActive !== false)
    : []
  const primaryVariant = variants.find(variant => positivePrice(variant?.price) !== null)
  if (!primaryVariant) return product

  return {
    ...product,
    price: positivePrice(primaryVariant.price),
    oldPrice: positivePrice(primaryVariant.oldPrice),
    currency: primaryVariant.currency || product.currency || 'RUB',
    unit: primaryVariant.unit || null,
  }
}

function listFromRow(row, query) {
  const category = categoryFromRow(row)
  if (!category) return null

  const total = Number(row.total ?? 0)
  const items = parseJson(row.items, [])

  return {
    category,
    pagination: {
      limit: query.limit,
      offset: query.offset,
      total: Number.isFinite(total) ? total : 0,
      hasMore: query.offset + query.limit < total,
    },
    items: Array.isArray(items) ? items.map(normalizePublicProductPricing) : [],
  }
}

const productJson = `jsonb_build_object(
  'id', COALESCE(p.legacy_id, p.id::text),
  'databaseId', p.id,
  'legacyId', p.legacy_id,
  'slug', p.slug,
  'url', '/' || c.slug || '/tproduct/' || COALESCE(p.legacy_id, p.id::text) || '-' || p.slug,
  'category', jsonb_build_object('slug', c.slug, 'name', c.name),
  'name', p.name,
  'description', p.description,
  'sku', p.sku,
  'article', p.attributes->>'article',
  'price', p.base_price,
  'oldPrice', p.old_price,
  'currency', p.currency,
  'unit', p.unit,
  'minOrder', p.min_order,
  'attributes', p.attributes,
  'primaryImage', CASE
    WHEN p.primary_image IS NULL OR p.primary_image = '' THEN NULL
    ELSE jsonb_build_object('url', p.primary_image, 'alt', p.name, 'sortOrder', 0)
  END,
  'variants', variants.items,
  'images', images.items
)`

const variantsLateral = `LEFT JOIN LATERAL (
  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'id', COALESCE(v.legacy_id, v.id::text),
        'databaseId', v.id,
        'legacyId', v.legacy_id,
        'name', v.name,
        'sku', v.sku,
        'price', v.price,
        'oldPrice', v.old_price,
        'currency', 'RUB',
        'unit', v.unit,
        'stockQuantity', v.stock_quantity,
        'attributes', v.attributes,
        'isActive', v.is_active
      )
      ORDER BY v.sort_order, v.created_at, v.id
    ),
    '[]'::jsonb
  ) AS items
  FROM product_variants v
  WHERE v.product_id = p.id
    AND v.is_active = true
) variants ON true`

const imagesLateral = `LEFT JOIN LATERAL (
  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'url', i.url,
        'alt', i.alt,
        'sortOrder', i.sort_order
      )
      ORDER BY i.sort_order, i.created_at, i.id
    ),
    '[]'::jsonb
  ) AS items
  FROM product_images i
  WHERE i.product_id = p.id
) images ON true`

export function createPublicCatalogRepository({ query = databaseQuery } = {}) {
  return {
    async listCategories() {
      const result = await query(`
        SELECT id::text AS "databaseId", slug, name, description,
               cover_image AS "coverImage", filter_config AS "filterConfig",
               seo_title AS "seoTitle", seo_description AS "seoDescription"
               , show_on_home AS "showOnHome", show_in_menu AS "showInMenu"
        FROM categories
        WHERE is_published = true
        ORDER BY sort_order, created_at, id
      `)

      return result.rows
    },

    async listProducts(categorySlug, rawQuery = {}) {
      const slug = normalizeCategorySlug(categorySlug)
      if (!slug) return null

      const filters = parseCatalogListQuery(rawQuery)
      const orderBy = SORT_ORDERS[filters.sort]
      const result = await query(`
        WITH category AS (
          SELECT id, slug, name, description, cover_image, filter_config,
                 seo_title, seo_description
          FROM categories
          WHERE slug = $1
            AND is_published = true
        ),
        filtered AS (
          SELECT p.*, c.slug AS category_slug, c.name AS category_name
          FROM products p
          JOIN category c ON c.id = p.category_id
          WHERE p.is_published = true
            AND ($2::text IS NULL OR p.name ILIKE $2 OR COALESCE(p.sku, '') ILIKE $2)
            AND ($3::text IS NULL OR p.attributes @> jsonb_build_object('subtype', jsonb_build_array($3::text)))
            AND ($4::text IS NULL OR p.attributes->>'normalizedColor' = $4)
            AND ($5::text IS NULL OR p.attributes->>'material' = $5)
            AND ($6::text IS NULL OR p.attributes->>'thickness' = $6)
        ),
        paged AS (
          SELECT *
          FROM filtered p
          ORDER BY ${orderBy}
          LIMIT $7 OFFSET $8
        )
        SELECT
          (SELECT jsonb_build_object(
            'id', c.slug,
            'databaseId', c.id,
            'slug', c.slug,
            'name', c.name,
            'description', c.description,
            'coverImage', c.cover_image,
            'filterConfig', c.filter_config,
            'seoTitle', c.seo_title,
            'seoDescription', c.seo_description
          ) FROM category c) AS category,
          (SELECT count(*)::int FROM filtered) AS total,
          COALESCE(
            jsonb_agg(${productJson} ORDER BY ${orderBy}) FILTER (WHERE p.id IS NOT NULL),
            '[]'::jsonb
          ) AS items
        FROM paged p
        JOIN categories c ON c.id = p.category_id
        ${variantsLateral}
        ${imagesLateral}
      `, [
        slug,
        filters.q ? `%${filters.q}%` : null,
        filters.subtype,
        filters.color,
        filters.material,
        filters.thickness,
        filters.limit,
        filters.offset,
      ])

      return listFromRow(result.rows[0] ?? {}, filters)
    },

    async listSaleProducts() {
      const result = await query(`
        SELECT ${productJson} AS item
        FROM products p
        JOIN categories c ON c.id = p.category_id
        ${variantsLateral}
        ${imagesLateral}
        WHERE p.is_published = true
          AND c.is_published = true
          AND (
            (p.base_price IS NOT NULL AND p.old_price > p.base_price)
            OR EXISTS (
              SELECT 1
              FROM product_variants discount_variant
              WHERE discount_variant.product_id = p.id
                AND discount_variant.is_active = true
                AND discount_variant.price IS NOT NULL
                AND discount_variant.old_price > discount_variant.price
            )
          )
        ORDER BY p.updated_at DESC, p.id DESC
      `)
      return result.rows
        .map(row => normalizePublicProductPricing(parseJson(row.item, null)))
        .filter(Boolean)
    },

    async getProduct(categorySlug, identifier) {
      const slug = normalizeCategorySlug(categorySlug)
      const productIdentifier = normalizeProductIdentifier(identifier)
      if (!slug || !productIdentifier) return null

      const result = await query(`
        SELECT ${productJson} AS item
        FROM products p
        JOIN categories c ON c.id = p.category_id
        ${variantsLateral}
        ${imagesLateral}
        WHERE c.slug = $1
          AND c.is_published = true
          AND p.is_published = true
          AND (p.legacy_id = $2 OR p.id::text = $2 OR p.slug = $2)
        ORDER BY CASE WHEN p.legacy_id = $2 THEN 0 WHEN p.id::text = $2 THEN 1 ELSE 2 END
        LIMIT 1
      `, [slug, productIdentifier])

      return normalizePublicProductPricing(parseJson(result.rows[0]?.item, null))
    },

    // Product URLs keep both the legacy identifier and the readable slug. Keep
    // this lookup in the repository so SEO rendering uses the same published
    // product contract as the public API, without a second request per page.
    async getProductByRoute(categorySlug, routeIdentifier) {
      const slug = normalizeCategorySlug(categorySlug)
      const productRoute = normalizeProductIdentifier(routeIdentifier)
      if (!slug || !productRoute) return null

      const result = await query(`
        SELECT ${productJson} AS item
        FROM products p
        JOIN categories c ON c.id = p.category_id
        ${variantsLateral}
        ${imagesLateral}
        WHERE c.slug = $1
          AND c.is_published = true
          AND p.is_published = true
          AND (
            COALESCE(p.legacy_id, p.id::text) || '-' || p.slug = $2
            OR p.slug = $2
          )
        ORDER BY CASE WHEN COALESCE(p.legacy_id, p.id::text) || '-' || p.slug = $2 THEN 0 ELSE 1 END
        LIMIT 1
      `, [slug, productRoute])

      return normalizePublicProductPricing(parseJson(result.rows[0]?.item, null))
    },
  }
}
