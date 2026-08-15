import assert from 'node:assert/strict'
import test from 'node:test'
import {
  createPublicCatalogRepository,
  normalizeCategorySlug,
  normalizeProductIdentifier,
  normalizePublicProductPricing,
  parseCatalogListQuery,
} from './public-catalog.mjs'

test('normalizes bounded public catalog query parameters', () => {
  assert.deepEqual(parseCatalogListQuery({
    limit: '99',
    offset: '-1',
    sort: 'unknown',
    q: '  vegetale  ',
    color: ['Коричневый', 'ignored'],
  }), {
    limit: 48,
    offset: 0,
    sort: 'default',
    q: 'vegetale',
    subtype: null,
    color: 'Коричневый',
    material: null,
    thickness: null,
  })
  assert.equal(normalizeCategorySlug('ODEJNAYAKOZHA'), 'odejnayakozha')
  assert.equal(normalizeCategorySlug('../private'), null)
  assert.equal(normalizeProductIdentifier('  814535079882  '), '814535079882')
})

test('keeps a public product price paired with the unit of its primary active variant', () => {
  const product = normalizePublicProductPricing({
    price: 46.33,
    oldPrice: null,
    currency: 'RUB',
    unit: 'фут²',
    variants: [
      { price: 1, unit: 'шт.', isActive: false },
      { price: 437.05, oldPrice: 480, currency: 'RUB', unit: 'фут²', isActive: true },
      { price: 46.33, oldPrice: null, currency: 'RUB', unit: 'дм²', isActive: true },
    ],
  })

  assert.equal(product.price, 437.05)
  assert.equal(product.oldPrice, 480)
  assert.equal(product.unit, 'фут²')
})

test('lists published products with one parameterized query and complete contract', async () => {
  const calls = []
  const repository = createPublicCatalogRepository({
    query: async (sql, params) => {
      calls.push({ sql, params })
      return {
        rows: [{
          category: {
            id: 'odejnayakozha',
            databaseId: 'category-uuid',
            slug: 'odejnayakozha',
            name: 'Одежная кожа',
          },
          total: 88,
          items: [{
            id: '814535079882',
            databaseId: 'product-uuid',
            legacyId: '814535079882',
            slug: 'vegetale-visky',
            url: '/odejnayakozha/tproduct/814535079882-vegetale-visky',
            category: { slug: 'odejnayakozha', name: 'Одежная кожа' },
            price: 431,
            oldPrice: null,
            currency: 'RUB',
            unit: 'фут²',
            variants: [{ id: 'variant-legacy', price: 431, unit: 'фут²', isActive: true }],
            images: [{ url: '/images/catalog/clothing-leather/814535079882/w1680-v2.webp', alt: 'Vegetale Visky', sortOrder: 0 }],
            attributes: { subtype: ['Гладкая'], material: 'Овчина' },
          }],
        }],
      }
    },
  })

  const result = await repository.listProducts('odejnayakozha', {
    limit: '24',
    offset: '24',
    sort: 'price-asc',
    q: "vegetale' OR 1=1 --",
    subtype: 'Гладкая',
  })

  assert.equal(calls.length, 1)
  assert.match(calls[0].sql, /AND is_published = true/)
  assert.match(calls[0].sql, /p\.is_published = true/)
  assert.match(calls[0].sql, /v\.is_active = true/)
  assert.match(calls[0].sql, /jsonb_agg/)
  assert.doesNotMatch(calls[0].sql, /vegetale' OR 1=1/)
  assert.deepEqual(calls[0].params, [
    'odejnayakozha',
    "%vegetale' OR 1=1 --%",
    'Гладкая',
    null,
    null,
    null,
    24,
    24,
  ])
  assert.equal(result.pagination.total, 88)
  assert.equal(result.pagination.hasMore, true)
  assert.equal(result.items[0].id, '814535079882')
  assert.equal(result.items[0].category.slug, 'odejnayakozha')
  assert.equal(result.items[0].variants[0].isActive, true)
})

test('returns a category-scoped detail item by legacy id, UUID or slug in one query', async () => {
  const calls = []
  const item = {
    id: '814535079882',
    databaseId: 'product-uuid',
    legacyId: '814535079882',
    slug: 'vegetale-visky',
    category: { slug: 'odejnayakozha', name: 'Одежная кожа' },
    price: 431,
    oldPrice: null,
    currency: 'RUB',
    unit: 'фут²',
    variants: [{ id: 'variant-legacy', price: 431, oldPrice: null, unit: 'фут²', isActive: true }],
    images: [],
  }
  const repository = createPublicCatalogRepository({
    query: async (sql, params) => {
      calls.push({ sql, params })
      return { rows: [{ item }] }
    },
  })

  const result = await repository.getProduct('odejnayakozha', 'vegetale-visky')

  assert.equal(calls.length, 1)
  assert.match(calls[0].sql, /p\.legacy_id = \$2 OR p\.id::text = \$2 OR p\.slug = \$2/)
  assert.match(calls[0].sql, /v\.is_active = true/)
  assert.deepEqual(calls[0].params, ['odejnayakozha', 'vegetale-visky'])
  assert.deepEqual(result, item)
})

test('returns a published product by its complete legacy detail route in one query', async () => {
  const calls = []
  const item = { id: '814535079882', slug: 'vegetale-visky', name: 'Vegetale Visky', variants: [], images: [] }
  const repository = createPublicCatalogRepository({
    query: async (sql, params) => {
      calls.push({ sql, params })
      return { rows: [{ item }] }
    },
  })

  const result = await repository.getProductByRoute('odejnayakozha', '814535079882-vegetale-visky')

  assert.equal(calls.length, 1)
  assert.match(calls[0].sql, /COALESCE\(p\.legacy_id, p\.id::text\) \|\| '-' \|\| p\.slug = \$2/)
  assert.match(calls[0].sql, /c\.is_published = true/)
  assert.match(calls[0].sql, /p\.is_published = true/)
  assert.deepEqual(calls[0].params, ['odejnayakozha', '814535079882-vegetale-visky'])
  assert.deepEqual(result, item)
})

test('returns null when no published category exists', async () => {
  const repository = createPublicCatalogRepository({
    query: async () => ({ rows: [{ category: null, total: 0, items: [] }] }),
  })

  assert.equal(await repository.listProducts('missing-category'), null)
})
