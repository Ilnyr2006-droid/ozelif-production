
import { query } from './db.mjs'
import { searchPublishedProducts } from './ai-catalog.mjs'
import { openAiRequest } from './openai-vector-store.mjs'

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

const CATEGORY_PATHS = {
  odejnayakozha: '/odejnayakozha',
  dublyonka: '/dublyonka',
  zamsha: '/zamsha',
  obuvnayakozha: '/obuvnayakozha',
  furnitura: '/furnitura',
}

function uniqueStrings(values) {
  return [...new Set(
    (values ?? [])
      .map(value => String(value ?? '').trim())
      .filter(Boolean),
  )]
}

function safeLimit(value, fallback = 6) {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return fallback
  return Math.max(1, Math.min(Math.trunc(parsed), 12))
}

function normalizeVariant(variant) {
  const price = Number(variant?.priceRub)
  const oldPrice = Number(variant?.oldPriceRub)

  return {
    id: variant?.id ?? null,
    name: String(variant?.name ?? '').trim(),
    unit: String(variant?.unit ?? '').trim() || null,
    priceRub: Number.isFinite(price) ? price : null,
    oldPriceRub: Number.isFinite(oldPrice) ? oldPrice : null,
  }
}

function productUrls(row) {
  const categoryUrl = CATEGORY_PATHS[row.category_slug]
    ?? `/${row.category_slug}`
  const identifier = row.legacy_id || row.id

  return {
    categoryUrl,
    productUrl: row.slug
      ? `${categoryUrl}/tproduct/${identifier}-${row.slug}`
      : categoryUrl,
  }
}

function mapProduct(row) {
  return {
    id: row.id,
    legacyId: row.legacy_id,
    name: row.name,
    slug: row.slug,
    category: row.category_name,
    categorySlug: row.category_slug,
    description: row.description,
    sku: row.sku,
    image: row.primary_image,
    attributes: row.attributes ?? {},
    variants: Array.isArray(row.variants)
      ? row.variants.map(normalizeVariant)
      : [],
    updatedAt: row.updated_at,
    ...productUrls(row),
  }
}

export function parseVectorSearchMatches(body) {
  const rows = Array.isArray(body?.data)
    ? body.data
    : Array.isArray(body?.results)
      ? body.results
      : []

  return rows.map((row, index) => {
    const productId = String(
      row?.attributes?.product_id
        ?? row?.attributes?.productId
        ?? '',
    ).trim()

    return {
      productId: UUID_PATTERN.test(productId) ? productId : null,
      fileId: String(row?.file_id ?? row?.id ?? '').trim() || null,
      filename: String(row?.filename ?? row?.file_name ?? '').trim() || null,
      score: Number.isFinite(Number(row?.score))
        ? Number(row.score)
        : null,
      rank: index,
      content: Array.isArray(row?.content)
        ? row.content
            .map(item => String(item?.text ?? '').trim())
            .filter(Boolean)
            .join('\n')
        : '',
    }
  })
}

async function productIdsByFileIds(fileIds) {
  const ids = uniqueStrings(fileIds)
  if (!ids.length) return new Map()

  const result = await query(
    `
      SELECT product_id, openai_file_id
      FROM product_vector_index
      WHERE openai_file_id = ANY($1::text[])
    `,
    [ids],
  )

  return new Map(
    result.rows.map(row => [
      row.openai_file_id,
      row.product_id,
    ]),
  )
}

export async function searchProductIndex(
  searchText,
  options = {},
) {
  const vectorStoreId = String(
    process.env.OPENAI_PRODUCT_VECTOR_STORE_ID ?? '',
  ).trim()
  const text = String(searchText ?? '').trim()
  const limit = safeLimit(options.limit)

  if (!vectorStoreId || !text) {
    return {
      available: false,
      vectorStoreId: vectorStoreId || null,
      matches: [],
      error: vectorStoreId
        ? null
        : 'OPENAI_PRODUCT_VECTOR_STORE_ID is not configured',
    }
  }

  try {
    const body = await openAiRequest(
      `/vector_stores/${encodeURIComponent(vectorStoreId)}/search`,
      {
        method: 'POST',
        json: {
          query: text,
          max_num_results: limit,
          ranking_options: {
            ranker: 'auto',
            score_threshold: Number(
              process.env.OPENAI_PRODUCT_SEARCH_THRESHOLD ?? 0.12,
            ),
          },
        },
        timeoutMs: 25_000,
      },
    )

    const parsed = parseVectorSearchMatches(body)
    const fileMap = await productIdsByFileIds(
      parsed
        .filter(item => !item.productId)
        .map(item => item.fileId),
    )

    const matches = parsed
      .map(item => ({
        ...item,
        productId: item.productId
          ?? fileMap.get(item.fileId)
          ?? null,
      }))
      .filter(item => item.productId)

    return {
      available: true,
      vectorStoreId,
      matches,
      error: null,
    }
  } catch (error) {
    console.error(
      '[product-index-search]',
      error instanceof Error ? error.message : error,
    )

    return {
      available: false,
      vectorStoreId,
      matches: [],
      error: error instanceof Error
        ? error.message
        : 'Product Index search failed',
    }
  }
}

export async function getPublishedProductsByIds(productIds) {
  const ids = uniqueStrings(productIds)
    .filter(value => UUID_PATTERN.test(value))
    .slice(0, 20)

  if (!ids.length) return []

  const result = await query(
    `
      SELECT
        p.id,
        p.legacy_id,
        p.name,
        p.slug,
        p.description,
        p.sku,
        p.primary_image,
        p.attributes,
        p.updated_at,
        c.name AS category_name,
        c.slug AS category_slug,
        COALESCE(
          (
            SELECT json_agg(
              json_build_object(
                'id', v.id,
                'name', v.name,
                'unit', v.unit,
                'priceRub', v.price,
                'oldPriceRub', v.old_price
              )
              ORDER BY v.sort_order, v.created_at
            )
            FROM product_variants v
            WHERE v.product_id = p.id
              AND v.is_active = true
          ),
          '[]'::json
        ) AS variants
      FROM products p
      JOIN categories c ON c.id = p.category_id
      WHERE p.is_published = true
        AND p.id = ANY($1::uuid[])
    `,
    [ids],
  )

  const byId = new Map(
    result.rows.map(row => [row.id, mapProduct(row)]),
  )

  return ids
    .map(id => byId.get(id))
    .filter(Boolean)
}

export function mergeCandidateProducts(
  semanticProducts,
  lexicalProducts,
  limit = 6,
) {
  const result = []
  const seen = new Set()

  for (const product of [
    ...(semanticProducts ?? []),
    ...(lexicalProducts ?? []),
  ]) {
    if (!product?.id || seen.has(product.id)) continue
    seen.add(product.id)
    result.push(product)
    if (result.length >= limit) break
  }

  return result
}

export async function findLiveProductCandidates(
  searchText,
  options = {},
) {
  const limit = safeLimit(options.limit)

  const [semantic, lexical] = await Promise.all([
    searchProductIndex(searchText, { limit }),
    searchPublishedProducts(searchText, { limit }),
  ])

  const semanticProducts = await getPublishedProductsByIds(
    semantic.matches.map(match => match.productId),
  )

  const products = mergeCandidateProducts(
    semanticProducts,
    lexical.items,
    limit,
  )

  return {
    products,
    semantic: {
      available: semantic.available,
      vectorStoreId: semantic.vectorStoreId,
      error: semantic.error,
      matches: semantic.matches.map(match => ({
        productId: match.productId,
        fileId: match.fileId,
        score: match.score,
        rank: match.rank,
      })),
    },
    lexical: {
      query: lexical.query,
      terms: lexical.terms,
      count: lexical.items.length,
    },
  }
}
