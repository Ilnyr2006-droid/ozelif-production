
import { query } from './db.mjs'
import {
  normalizeCatalogQuery,
  searchPublishedProducts,
} from './ai-catalog.mjs'
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

const EXPLICIT_CATEGORY_SIGNALS = [
  {
    slug: 'zamsha',
    patterns: [/замш\p{L}*/iu, /suede/iu],
  },
  {
    slug: 'dublyonka',
    patterns: [/дубл[её]н\p{L}*/iu, /shearling/iu],
  },
  {
    slug: 'obuvnayakozha',
    patterns: [/обувн\p{L}*\s+кож\p{L}*/iu],
  },
  {
    slug: 'furnitura',
    patterns: [
      /фурнитур\p{L}*/iu,
      /молни\p{L}*/iu,
      /пряжк\p{L}*/iu,
      /люверс\p{L}*/iu,
    ],
  },
  {
    slug: 'odejnayakozha',
    patterns: [/одежн\p{L}*\s+кож\p{L}*/iu],
  },
]

const EXPLICIT_COLOR_GROUPS = [
  {
    color: 'black',
    tokens: ['черн', 'black', 'nero'],
  },
  {
    color: 'brown',
    tokens: [
      'коричн',
      'brown',
      'marrone',
      'taba',
      'cognac',
      'коньяк',
      'funduk',
    ],
  },
  {
    color: 'white',
    tokens: ['бел', 'white', 'bianco'],
  },
  {
    color: 'red',
    tokens: ['красн', 'red', 'rosso', 'bordo', 'burgundy'],
  },
  {
    color: 'blue',
    tokens: ['син', 'blue', 'blu', 'navy'],
  },
  {
    color: 'green',
    tokens: ['зелен', 'green', 'verde'],
  },
  {
    color: 'beige',
    tokens: ['беж', 'beige', 'cream', 'крем'],
  },
  {
    color: 'grey',
    tokens: ['сер', 'grey', 'gray', 'grigio'],
  },
]

const EXPLICIT_USE_GROUPS = [
  {
    use: 'light_clothing',
    label: 'юбки и другой одежды',
    patterns: [
      /юбк\p{L}*/iu,
      /плать\p{L}*/iu,
      /брюк\p{L}*/iu,
      /жакет\p{L}*/iu,
      /жилет\p{L}*/iu,
    ],
    productPatterns: [
      /юбк\p{L}*/iu,
      /плать\p{L}*/iu,
      /брюк\p{L}*/iu,
      /жакет\p{L}*/iu,
      /жилет\p{L}*/iu,
    ],
    preferredCategories: ['odejnayakozha', 'zamsha'],
  },
  {
    use: 'jacket',
    label: 'куртки и верхней одежды',
    patterns: [
      /куртк\p{L}*/iu,
      /косух\p{L}*/iu,
      /пальто/iu,
      /плащ\p{L}*/iu,
      /верхн\p{L}*\s+одежд\p{L}*/iu,
    ],
    productPatterns: [
      /куртк\p{L}*/iu,
      /одежд\p{L}*/iu,
      /пальто/iu,
      /garment/iu,
      /clothing/iu,
    ],
    preferredCategories: ['odejnayakozha'],
  },
  {
    use: 'bag',
    label: 'сумки или аксессуара',
    patterns: [
      /сумк\p{L}*/iu,
      /рюкзак\p{L}*/iu,
      /кошел\p{L}*/iu,
      /клатч\p{L}*/iu,
      /аксессуар\p{L}*/iu,
    ],
    productPatterns: [
      /сумк\p{L}*/iu,
      /аксессуар\p{L}*/iu,
      /галантер\p{L}*/iu,
      /bag/iu,
      /accessor\p{L}*/iu,
    ],
    preferredCategories: ['odejnayakozha'],
  },
  {
    use: 'shoes',
    label: 'обуви',
    patterns: [
      /обув\p{L}*/iu,
      /ботин\p{L}*/iu,
      /туфл\p{L}*/iu,
      /сапог\p{L}*/iu,
      /кроссов\p{L}*/iu,
    ],
    productPatterns: [
      /обув\p{L}*/iu,
      /shoe/iu,
      /footwear/iu,
    ],
    preferredCategories: ['obuvnayakozha'],
  },
  {
    use: 'belt',
    label: 'ремня',
    patterns: [
      /ремн\p{L}*/iu,
      /пояс\p{L}*/iu,
    ],
    productPatterns: [
      /ремн\p{L}*/iu,
      /пояс\p{L}*/iu,
      /belt/iu,
    ],
    preferredCategories: [],
  },
]

function normalizedTokens(value) {
  return normalizeCatalogQuery(value)
    .split(/[^\p{L}\p{N}.]+/gu)
    .filter(Boolean)
}

function tokenMatchesSignal(token, signal) {
  const cyrillicStem = (
    signal.length >= 3
    && /^[а-яё]+$/iu.test(signal)
  )

  return (
    token === signal
    || (
      (
        signal.length >= 4
        || cyrillicStem
      )
      && token.startsWith(signal)
    )
  )
}

export function inferExplicitColor(value) {
  const tokens = normalizedTokens(value)
  if (!tokens.length) return null

  const matches = EXPLICIT_COLOR_GROUPS
    .filter(group => (
      group.tokens.some(signal => (
        tokens.some(token => tokenMatchesSignal(token, signal))
      ))
    ))
    .map(group => group.color)

  const unique = [...new Set(matches)]
  return unique.length === 1 ? unique[0] : null
}

export function inferExplicitUse(value) {
  const source = String(value ?? '').trim()
  if (!source) return null

  const matches = EXPLICIT_USE_GROUPS
    .filter(group => (
      group.patterns.some(pattern => pattern.test(source))
    ))
    .map(group => group.use)

  const unique = [...new Set(matches)]
  return unique.length === 1 ? unique[0] : null
}

export function inferExplicitThicknessMm(value) {
  const text = normalizeCatalogQuery(value)
  if (!text) return null

  const range = text.match(
    /(\d+(?:\.\d+)?)\s*[-–—]\s*(\d+(?:\.\d+)?)\s*(?:мм|mm)/iu,
  )

  if (range) {
    const left = Number(range[1])
    const right = Number(range[2])

    if (
      Number.isFinite(left)
      && Number.isFinite(right)
      && left > 0
      && right > 0
    ) {
      return {
        min: Math.min(left, right),
        max: Math.max(left, right),
      }
    }
  }

  const single = text.match(
    /(\d+(?:\.\d+)?)\s*(?:мм|mm)/iu,
  ) ?? text.match(
    /толщ\p{L}*\D{0,20}(\d+(?:\.\d+)?)/iu,
  )

  if (!single) return null

  const number = Number(single[1])

  if (
    !Number.isFinite(number)
    || number <= 0
    || number > 10
  ) {
    return null
  }

  return {
    min: Math.max(0.1, number - 0.12),
    max: number + 0.12,
    target: number,
  }
}

function productSearchDocument(product) {
  return normalizeCatalogQuery([
    product?.name,
    product?.slug,
    product?.category,
    product?.description,
    JSON.stringify(product?.attributes ?? {}),
    ...(Array.isArray(product?.variants)
      ? product.variants.map(item => item?.name)
      : []),
  ].filter(Boolean).join(' '))
}

function productColorDocument(product) {
  const attributes = (
    product?.attributes
    && typeof product.attributes === 'object'
    && !Array.isArray(product.attributes)
  )
    ? product.attributes
    : {}

  const explicitColorValues = Object.entries(attributes)
    .filter(([key]) => {
      const normalized = normalizeCatalogQuery(key)
      return (
        normalized.includes('цвет')
        || normalized.includes('color')
        || normalized.includes('colour')
      )
    })
    .map(([, value]) => value)

  return normalizeCatalogQuery([
    product?.name,
    ...explicitColorValues,
  ].filter(Boolean).join(' '))
}

function detectedColorGroups(value) {
  const tokens = normalizedTokens(value)

  return EXPLICIT_COLOR_GROUPS
    .filter(group => (
      group.tokens.some(signal => (
        tokens.some(token => tokenMatchesSignal(token, signal))
      ))
    ))
    .map(group => group.color)
}

function productColorGroups(product) {
  const explicit = detectedColorGroups(
    productColorDocument(product),
  )

  if (explicit.length) {
    return [...new Set(explicit)]
  }

  return [...new Set(
    detectedColorGroups(
      productSearchDocument(product),
    ),
  )]
}

function productMatchesColor(product, color) {
  if (!color) return true

  const colors = productColorGroups(product)

  if (!colors.length) {
    return true
  }

  // A single-color request should not return White-Black,
  // Black-Brown or another explicitly multi-color material.
  return (
    colors.length === 1
    && colors[0] === color
  )
}

function extractProductThicknesses(product) {
  const values = []
  const attributes = (
    product?.attributes
    && typeof product.attributes === 'object'
    && !Array.isArray(product.attributes)
  )
    ? product.attributes
    : {}

  for (const [key, value] of Object.entries(attributes)) {
    const normalizedKey = normalizeCatalogQuery(key)

    if (
      !normalizedKey.includes('толщ')
      && !normalizedKey.includes('thick')
    ) {
      continue
    }

    for (const match of String(value ?? '').matchAll(
      /(\d+(?:[.,]\d+)?)/gu,
    )) {
      const number = Number(
        String(match[1]).replace(',', '.'),
      )

      if (
        Number.isFinite(number)
        && number > 0
        && number <= 10
      ) {
        values.push(number)
      }
    }
  }

  const description = String(product?.description ?? '')

  for (const match of description.matchAll(
    /(\d+(?:[.,]\d+)?)\s*(?:мм|mm)/giu,
  )) {
    const number = Number(
      String(match[1]).replace(',', '.'),
    )

    if (
      Number.isFinite(number)
      && number > 0
      && number <= 10
    ) {
      values.push(number)
    }
  }

  return [...new Set(values)]
}

function thicknessState(product, constraint) {
  if (!constraint) return 'unknown'

  const values = extractProductThicknesses(product)
  if (!values.length) return 'unknown'

  return values.some(value => (
    value >= constraint.min
    && value <= constraint.max
  ))
    ? 'match'
    : 'mismatch'
}

function useGroupById(use) {
  return EXPLICIT_USE_GROUPS.find(
    group => group.use === use,
  ) ?? null
}

function productMatchesUse(product, use) {
  if (!use) return false

  const group = useGroupById(use)
  if (!group) return false

  if (
    group.preferredCategories.includes(
      String(product?.categorySlug ?? ''),
    )
  ) {
    return true
  }

  const document = [
    product?.name,
    product?.category,
    product?.description,
    JSON.stringify(product?.attributes ?? {}),
  ].filter(Boolean).join(' ')

  return group.productPatterns.some(
    pattern => pattern.test(document),
  )
}

function bestPublishedPrice(product) {
  const variants = Array.isArray(product?.variants)
    ? product.variants
    : []

  return variants
    .map(variant => Number(variant?.priceRub))
    .find(value => Number.isFinite(value) && value > 0)
    ?? null
}

function exactProductNameMatch(product, searchText) {
  const queryText = normalizeCatalogQuery(searchText)
  const name = normalizeCatalogQuery(product?.name)

  return Boolean(
    name
    && name.length >= 4
    && queryText.includes(name)
  )
}

function asksForProductAlternatives(value) {
  const text = String(value ?? '').trim()

  return (
    /(?:аналог\p{L}*|альтернатив\p{L}*|похож\p{L}*|замен\p{L}*|сравн\p{L}*)/iu
  ).test(text)
}

export function selectExactProductScope(
  products,
  searchText,
) {
  const rows = Array.isArray(products) ? products : []

  if (
    !rows.length
    || asksForProductAlternatives(searchText)
  ) {
    return rows
  }

  const exact = rows.filter(
    product => exactProductNameMatch(
      product,
      searchText,
    ),
  )

  /*
   * One customer message may name several exact catalog products.
   * Keep every exact match so multi-product order tools receive all
   * permitted PRODUCT_IDs instead of only the first commercial name.
   */
  return exact.length
    ? exact
    : rows
}

export function buildRecommendationReason(
  product,
  searchText,
) {
  const color = inferExplicitColor(searchText)
  const thickness = inferExplicitThicknessMm(searchText)
  const use = inferExplicitUse(searchText)
  const pieces = []

  if (use && productMatchesUse(product, use)) {
    const group = useGroupById(use)
    if (group) {
      pieces.push(`подходит для ${group.label}`)
    }
  }

  if (color && productMatchesColor(product, color)) {
    const labels = {
      black: 'чёрный цвет',
      brown: 'коричневый цвет',
      white: 'белый цвет',
      red: 'красный цвет',
      blue: 'синий цвет',
      green: 'зелёный цвет',
      beige: 'бежевый цвет',
      grey: 'серый цвет',
    }

    pieces.push(labels[color] ?? 'нужный цвет')
  }

  if (
    thickness
    && thicknessState(product, thickness) === 'match'
  ) {
    const target = thickness.target

    pieces.push(
      target
        ? `толщина около ${String(target).replace('.', ',')} мм`
        : 'толщина входит в заданный диапазон',
    )
  }

  if (bestPublishedPrice(product) !== null) {
    pieces.push('цена опубликована')
  }

  if (!pieces.length) {
    return 'близко соответствует запросу по данным каталога'
  }

  return pieces.slice(0, 3).join(', ')
}

export function rankProductRecommendations(
  products,
  searchText,
  semanticMatches = [],
) {
  const input = Array.isArray(products) ? products : []
  const use = inferExplicitUse(searchText)
  const color = inferExplicitColor(searchText)
  const thickness = inferExplicitThicknessMm(searchText)

  const semanticScores = new Map(
    (semanticMatches ?? []).map(match => [
      String(match?.productId ?? ''),
      Number(match?.score),
    ]),
  )

  return input
    .map((product, index) => {
      let score = 100 - index * 4

      if (exactProductNameMatch(product, searchText)) {
        score += 500
      }

      const semanticScore = semanticScores.get(
        String(product?.id ?? ''),
      )

      if (Number.isFinite(semanticScore)) {
        score += semanticScore * 70
      }

      if (use) {
        const group = useGroupById(use)
        const preferredCategory = group?.preferredCategories.includes(
          String(product?.categorySlug ?? ''),
        )

        if (preferredCategory) {
          score += 140
        } else if (productMatchesUse(product, use)) {
          score += 60
        }
      }

      if (color && productMatchesColor(product, color)) {
        score += 55
      }

      if (
        thickness
        && thicknessState(product, thickness) === 'match'
      ) {
        score += 65
      }

      if (bestPublishedPrice(product) !== null) {
        score += 8
      }

      return {
        product: {
          ...product,
          recommendationReason:
            buildRecommendationReason(
              product,
              searchText,
            ),
        },
        score,
        index,
      }
    })
    .sort((left, right) => (
      right.score - left.score
      || left.index - right.index
    ))
    .map(item => item.product)
}

export function buildProductClarificationQuestion(
  searchText,
  products,
) {
  const rows = Array.isArray(products) ? products : []
  const normalized = normalizeCatalogQuery(searchText)

  if (
    rows.some(product => {
      const name = normalizeCatalogQuery(product?.name)
      return (
        name
        && name.length >= 4
        && normalized.includes(name)
      )
    })
  ) {
    return null
  }

  const use = inferExplicitUse(searchText)
  const category = inferExplicitCategorySlug(searchText)
  const color = inferExplicitColor(searchText)

  if (!use && !category) {
    return (
      'Что вы планируете изготовить — куртку, '
      + 'сумку, обувь, ремень или другое изделие?'
    )
  }

  if (!color && rows.length > 1) {
    return 'Какой цвет материала вам нужен?'
  }

  return null
}

export function applyExplicitProductConstraints(
  products,
  searchText,
) {
  const input = Array.isArray(products)
    ? products
    : []

  const color = inferExplicitColor(searchText)
  const thickness = inferExplicitThicknessMm(searchText)
  const use = inferExplicitUse(searchText)

  let filtered = input

  if (color) {
    filtered = filtered.filter(
      product => productMatchesColor(product, color),
    )
  }

  if (thickness) {
    filtered = filtered
      .map(product => ({
        product,
        thicknessState: thicknessState(
          product,
          thickness,
        ),
      }))
      .filter(item => item.thicknessState !== 'mismatch')
      .sort((left, right) => (
        (right.thicknessState === 'match' ? 1 : 0)
        - (left.thicknessState === 'match' ? 1 : 0)
      ))
      .map(item => item.product)
  }

  return {
    products: filtered,
    constraints: {
      color,
      thicknessMm: thickness,
      use,
    },
  }
}

export function inferExplicitCategorySlug(value) {
  const text = String(value ?? '').trim()
  if (!text) return null

  const matches = EXPLICIT_CATEGORY_SIGNALS
    .filter(group => (
      group.patterns.some(pattern => pattern.test(text))
    ))
    .map(group => group.slug)

  const unique = [...new Set(matches)]
  return unique.length === 1 ? unique[0] : null
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
  const stockQuantity = (
    variant?.stockQuantity === null
    || variant?.stockQuantity === undefined
  )
    ? null
    : Number(variant.stockQuantity)

  return {
    id: variant?.id ?? null,
    name: String(variant?.name ?? '').trim(),
    unit: String(variant?.unit ?? '').trim() || null,
    priceRub: Number.isFinite(price) ? price : null,
    oldPriceRub: Number.isFinite(oldPrice) ? oldPrice : null,
    stockQuantity: Number.isFinite(stockQuantity)
      ? stockQuantity
      : null,
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
    stockQuantity: row.stock_quantity === null
      || row.stock_quantity === undefined
      ? null
      : Number(row.stock_quantity),
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
        p.stock_quantity,
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
                'oldPriceRub', v.old_price,
                'stockQuantity', v.stock_quantity
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
  const categorySlug = (
    String(options.categorySlug ?? '').trim()
    || inferExplicitCategorySlug(searchText)
  )

  const retrievalLimit = Math.min(
    12,
    Math.max(limit, limit * 2),
  )

  const [semantic, lexical] = await Promise.all([
    searchProductIndex(searchText, {
      limit: retrievalLimit,
    }),
    searchPublishedProducts(searchText, {
      limit: retrievalLimit,
      categorySlug,
    }),
  ])

  const semanticProductsRaw = await getPublishedProductsByIds(
    semantic.matches.map(match => match.productId),
  )

  const semanticProducts = categorySlug
    ? semanticProductsRaw.filter(
        product => product.categorySlug === categorySlug,
      )
    : semanticProductsRaw

  const mergedProducts = mergeCandidateProducts(
    semanticProducts,
    lexical.items,
    retrievalLimit,
  )

  const constrained = applyExplicitProductConstraints(
    mergedProducts,
    searchText,
  )

  const ranked = rankProductRecommendations(
    constrained.products,
    searchText,
    semantic.matches,
  )

  const scoped = selectExactProductScope(
    ranked,
    searchText,
  )

  const products = scoped.slice(
    0,
    Math.min(limit, 3),
  )

  /*
   * Live AI behavior must not infer which customer detail is "missing".
   * Luna receives the customer's own words and decides whether a follow-up
   * is actually necessary. Deterministic backend stays responsible only for
   * verified catalog retrieval, constraints, ranking and IDs.
   */
  return {
    products,
    clarificationQuestion: null,
    constraints: {
      categorySlug: categorySlug || null,
      ...constrained.constraints,
    },
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
      categorySlug: categorySlug || null,
    },
  }
}
