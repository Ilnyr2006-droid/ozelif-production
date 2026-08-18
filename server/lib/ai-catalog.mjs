
import { query } from './db.mjs'

const SYNONYM_GROUPS = [
  ['черный', 'черная', 'черное', 'черные', 'черн', 'black', 'nero'],
  ['коричневый', 'коричневая', 'коричневые', 'коричн', 'brown', 'marrone', 'cognac', 'коньяк'],
  ['белый', 'белая', 'белые', 'white', 'bianco'],
  ['красный', 'красная', 'красные', 'red', 'rosso'],
  ['синий', 'синяя', 'синие', 'blue', 'blu'],
  ['зеленый', 'зеленая', 'зеленые', 'green', 'verde'],
  ['бежевый', 'бежевая', 'бежевые', 'beige'],
  ['серый', 'серая', 'серые', 'grey', 'gray', 'grigio'],
  ['замша', 'замшевый', 'suede'],
  ['дубленка', 'дубленочный', 'дубленка', 'shearling'],
  ['обувь', 'обувная', 'обувной', 'shoe'],
  ['одежда', 'одежная', 'одежной', 'clothing'],
  ['фурнитура', 'молния', 'кнопка', 'кнопки', 'пряжка', 'hardware'],
  ['сумка', 'сумки', 'галантерея', 'кошелек', 'кошелька', 'рюкзак'],
  ['куртка', 'куртки', 'косуха', 'бомбер'],
  ['пальто', 'тренч'],
  ['мягкий', 'мягкая', 'мягкие', 'мягкость'],
  ['плотный', 'плотная', 'плотные', 'плотность'],
  ['тонкий', 'тонкая', 'тонкие'],
]

const STOP_WORDS = new Set([
  'для',
  'под',
  'или',
  'мне',
  'нужна',
  'нужен',
  'нужно',
  'хочу',
  'найди',
  'покажи',
  'есть',
  'какая',
  'какой',
  'какие',
  'товар',
  'товары',
  'сколько',
  'стоит',
  'какие',
  'какой',
  'характеристика',
  'характеристики',
  'характеристик',
  'точно',
  'сейчас',
  'осталось',
  'наличие',
  'наличии',
  'кожа',
  'кожи',
  'кожу',
])

const ROUTE_BY_CATEGORY = {
  odejnayakozha: '/odejnayakozha',
  dublyonka: '/dublyonka',
  zamsha: '/zamsha',
  obuvnayakozha: '/obuvnayakozha',
  furnitura: '/furnitura',
}

export function normalizeCatalogQuery(value) {
  return String(value ?? '')
    .toLocaleLowerCase('ru')
    .replace(/ё/g, 'е')
    .replace(/[^\p{L}\p{N}.,-]+/gu, ' ')
    .replace(/(\d),(\d)/g, '$1.$2')
    .replace(/\s+/g, ' ')
    .trim()
}

function stemRussianToken(token) {
  if (token.length < 6 || !/[а-я]/.test(token)) return token

  const endings = [
    'иями', 'ями', 'ами', 'ого', 'ему', 'ому', 'ыми', 'ими',
    'ая', 'яя', 'ое', 'ее', 'ые', 'ие', 'ый', 'ий', 'ой',
    'ов', 'ев', 'ах', 'ях', 'ам', 'ям', 'ом', 'ем',
    'а', 'я', 'ы', 'и', 'е', 'у', 'ю', 'о',
  ]

  for (const ending of endings) {
    if (token.endsWith(ending) && token.length - ending.length >= 4) {
      return token.slice(0, -ending.length)
    }
  }

  return token
}

export function expandCatalogSearchTerms(value) {
  const normalized = normalizeCatalogQuery(value)
  if (!normalized) return []

  const tokens = normalized
    .split(' ')
    .map(token => token.trim())
    .filter(token => token.length >= 2 && !STOP_WORDS.has(token))

  const expanded = new Set()

  for (const token of tokens) {
    expanded.add(token)

    const stem = stemRussianToken(token)
    if (stem.length >= 3) expanded.add(stem)

    for (const group of SYNONYM_GROUPS) {
      if (group.some(item => item === token || item === stem || item.startsWith(stem))) {
        for (const synonym of group) expanded.add(synonym)
      }
    }
  }

  return [...expanded]
    .map(item => normalizeCatalogQuery(item))
    .filter(item => item.length >= 2)
    .slice(0, 40)
}

function safeLimit(value, fallback = 8) {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return fallback
  return Math.max(1, Math.min(Math.trunc(parsed), 24))
}

function productUrl(row) {
  const categoryPath = ROUTE_BY_CATEGORY[row.category_slug] ?? `/${row.category_slug}`
  const identifier = row.legacy_id || row.id

  return {
    categoryUrl: categoryPath,
    productUrl: row.slug
      ? `${categoryPath}/tproduct/${identifier}-${row.slug}`
      : categoryPath,
  }
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
    sourcePriceUsd: variant?.sourcePriceUsd === null
      || variant?.sourcePriceUsd === undefined
      ? null
      : Number(variant.sourcePriceUsd),
  }
}

function mapProduct(row) {
  const urls = productUrl(row)

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
    score: Number(row.search_score ?? 0),
    updatedAt: row.updated_at,
    ...urls,
  }
}

export async function searchPublishedProducts(searchText, options = {}) {
  const normalizedQuery = normalizeCatalogQuery(searchText)
  const terms = expandCatalogSearchTerms(normalizedQuery)
  const limit = safeLimit(options.limit)
  const categorySlug = String(
    options.categorySlug ?? '',
  ).trim()

  const result = await query(
    `
      WITH product_base AS (
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
          lower(
            replace(
              concat_ws(
                ' ',
                p.name,
                p.slug,
                p.description,
                p.sku,
                c.name,
                c.slug,
                p.attributes::text
              ),
              'ё',
              'е'
            )
          ) AS haystack,
          lower(replace(p.name, 'ё', 'е')) AS normalized_name,
          COALESCE(
            (
              SELECT json_agg(
                json_build_object(
                  'id', v.id,
                  'name', v.name,
                  'unit', v.unit,
                  'priceRub', v.price,
                  'oldPriceRub', v.old_price,
                  'sourcePriceUsd', v.source_price_usd
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
          AND (
            $4::text = ''
            OR c.slug = $4::text
          )
      ),
      ranked AS (
        SELECT
          product_base.*,
          (
            CASE
              WHEN $1::text <> '' AND normalized_name = $1 THEN 120
              WHEN $1::text <> '' AND normalized_name LIKE $1 || '%' THEN 80
              WHEN $1::text <> '' AND normalized_name LIKE '%' || $1 || '%' THEN 55
              ELSE 0
            END
            +
            COALESCE(
              (
                SELECT SUM(
                  CASE
                    WHEN normalized_name LIKE '%' || term || '%' THEN 18
                    WHEN lower(replace(category_name, 'ё', 'е')) LIKE '%' || term || '%' THEN 12
                    WHEN haystack LIKE '%' || term || '%' THEN 7
                    ELSE 0
                  END
                )
                FROM unnest($2::text[]) AS term
              ),
              0
            )
          ) AS search_score
        FROM product_base
      )
      SELECT *
      FROM ranked
      WHERE
        $1::text = ''
        OR search_score > 0
      ORDER BY
        search_score DESC,
        updated_at DESC,
        name ASC
      LIMIT $3
    `,
    [normalizedQuery, terms, limit, categorySlug],
  )

  return {
    query: normalizedQuery,
    terms,
    items: result.rows.map(mapProduct),
  }
}

export async function getPublishedProduct(identifier) {
  const value = String(identifier ?? '').trim()
  if (!value) return null

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
                'oldPriceRub', v.old_price,
                'sourcePriceUsd', v.source_price_usd
              )
              ORDER BY v.sort_order, v.created_at
            )
            FROM product_variants v
            WHERE v.product_id = p.id
              AND v.is_active = true
          ),
          '[]'::json
        ) AS variants,
        0 AS search_score
      FROM products p
      JOIN categories c ON c.id = p.category_id
      WHERE p.is_published = true
        AND (
          p.id::text = $1
          OR p.legacy_id = $1
          OR p.slug = $1
        )
      LIMIT 1
    `,
    [value],
  )

  return result.rowCount ? mapProduct(result.rows[0]) : null
}

export async function getPublishedCatalogSummary() {
  const result = await query(
    `
      SELECT
        count(*)::int AS products,
        count(DISTINCT p.category_id)::int AS categories,
        max(p.updated_at) AS updated_at
      FROM products p
      WHERE p.is_published = true
    `,
  )

  return result.rows[0] ?? {
    products: 0,
    categories: 0,
    updated_at: null,
  }
}
