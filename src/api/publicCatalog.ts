export type PublicCatalogImage = {
  url: string
  alt: string | null
  sortOrder: number
}

export type PublicCatalogCategory = {
  databaseId: string
  slug: string
  name: string
  description: string | null
  coverImage: string | null
  filterConfig: Record<string, unknown> | null
  seoTitle: string | null
  seoDescription: string | null
  showOnHome: boolean
  showInMenu: boolean
}

type PublicCatalogApiVariant = {
  id: string
  legacyId: string | null
  name: string | null
  sku: string | null
  price: number | string | null
  oldPrice: number | string | null
  currency: string | null
  unit: string | null
  attributes: Record<string, unknown> | null
  isActive: boolean
}

export type PublicCatalogApiProduct = {
  id: string
  slug: string
  category?: { slug?: string; name?: string } | null
  name: string
  description: string | null
  article: string | null
  price: number | string | null
  oldPrice: number | string | null
  currency: string | null
  unit: string | null
  minOrder: string | null
  attributes: Record<string, unknown> | null
  primaryImage: PublicCatalogImage | null
  images: PublicCatalogImage[]
  variants: PublicCatalogApiVariant[]
}

export type PublicCatalogVariant = {
  id: string
  title: string
  unit: string | null
  shade: string | null
  shadeHex: string | null
  priceRub: number | null
  oldPriceRub: number | null
  currency: 'RUB' | null
  priceSource: 'api' | 'unverified'
}

export type PublicCatalogProduct = {
  id: string
  slug: string
  category: { slug: string; name: string } | null
  title: string
  description: string | null
  article: string | null
  subtype: string[]
  material: string | null
  color: string | null
  normalizedColor: string | null
  thickness: string | null
  grade: string | null
  hideSize: string | null
  country: string | null
  coating: string | null
  origin: string | null
  minimumOrder: string | null
  unit: string | null
  portion: string | null
  brand: string | null
  tapeColor: string | null
  metalColor: string | null
  length: string | null
  countryOfOrigin: string | null
  image: PublicCatalogImage | null
  gallery: PublicCatalogImage[]
  variants: PublicCatalogVariant[]
}

export type PublicCatalogListResponse = {
  category: (Pick<PublicCatalogCategory, 'slug' | 'name' | 'description' | 'coverImage' | 'seoTitle' | 'seoDescription'>) | null
  pagination: { limit: number; offset: number; total: number; hasMore: boolean }
  items: PublicCatalogProduct[]
}

const API_BASE = '/api/public/catalog/v1'

function numberOrNull(value: number | string | null | undefined) {
  const number = typeof value === 'string' ? Number(value.replace(',', '.')) : value
  return typeof number === 'number' && Number.isFinite(number) && number > 0 ? number : null
}

function textAttribute(attributes: Record<string, unknown> | null, key: string) {
  const value = attributes?.[key]
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

function stringListAttribute(attributes: Record<string, unknown> | null, key: string) {
  const value = attributes?.[key]
  if (Array.isArray(value)) return value.filter((item): item is string => typeof item === 'string' && Boolean(item.trim()))
  const text = textAttribute(attributes, key)
  return text ? [text] : []
}

function normalizeVariant(variant: PublicCatalogApiVariant): PublicCatalogVariant {
  const attributes = variant.attributes
  const priceRub = variant.currency === null || variant.currency === 'RUB' ? numberOrNull(variant.price) : null
  const oldPriceRub = variant.currency === null || variant.currency === 'RUB' ? numberOrNull(variant.oldPrice) : null
  return {
    id: variant.id,
    title: variant.name ?? variant.sku ?? 'Вариант',
    unit: variant.unit,
    shade: textAttribute(attributes, 'shade') ?? textAttribute(attributes, 'color'),
    shadeHex: textAttribute(attributes, 'shadeHex'),
    priceRub,
    oldPriceRub,
    currency: priceRub === null ? null : 'RUB',
    priceSource: priceRub === null ? 'unverified' : 'api',
  }
}

export function normalizePublicCatalogProduct(product: PublicCatalogApiProduct): PublicCatalogProduct {
  const attributes = product.attributes
  const gallery = product.images ?? []
  return {
    id: product.id,
    slug: product.slug,
    category: product.category?.slug && product.category?.name
      ? { slug: product.category.slug, name: product.category.name }
      : null,
    title: product.name,
    description: product.description,
    article: product.article ?? textAttribute(attributes, 'article'),
    subtype: stringListAttribute(attributes, 'subtype'),
    material: textAttribute(attributes, 'material'),
    color: textAttribute(attributes, 'color'),
    normalizedColor: textAttribute(attributes, 'normalizedColor'),
    thickness: textAttribute(attributes, 'thickness'),
    grade: textAttribute(attributes, 'grade'),
    hideSize: textAttribute(attributes, 'hideSize'),
    country: textAttribute(attributes, 'country'),
    coating: textAttribute(attributes, 'coating'),
    origin: textAttribute(attributes, 'origin'),
    minimumOrder: product.minOrder ?? textAttribute(attributes, 'minimumOrder'),
    unit: product.unit ?? textAttribute(attributes, 'unit'),
    portion: textAttribute(attributes, 'portion'),
    brand: textAttribute(attributes, 'brand'),
    tapeColor: textAttribute(attributes, 'tapeColor'),
    metalColor: textAttribute(attributes, 'metalColor'),
    length: textAttribute(attributes, 'length'),
    countryOfOrigin: textAttribute(attributes, 'country'),
    image: product.primaryImage ?? gallery[0] ?? null,
    gallery,
    variants: (product.variants ?? []).filter(variant => variant.isActive !== false).map(normalizeVariant),
  }
}

async function request<T>(path: string, signal?: AbortSignal): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, { signal, headers: { Accept: 'application/json' } })
  if (!response.ok) throw new Error(response.status === 404 ? 'not-found' : `catalog-request-${response.status}`)
  return response.json() as Promise<T>
}

export async function fetchPublicCatalogProducts(categorySlug: string, options: { limit?: number; offset?: number; signal?: AbortSignal } = {}) {
  const query = new URLSearchParams()
  if (options.limit !== undefined) query.set('limit', String(options.limit))
  if (options.offset !== undefined) query.set('offset', String(options.offset))
  const suffix = query.size ? `?${query}` : ''
  const body = await request<{ category: PublicCatalogListResponse['category']; pagination: PublicCatalogListResponse['pagination']; items: PublicCatalogApiProduct[] }>(`/categories/${encodeURIComponent(categorySlug)}/products${suffix}`, options.signal)
  return { ...body, items: body.items.map(normalizePublicCatalogProduct) }
}

let publicCatalogCategoriesCache: PublicCatalogCategory[] | null = null
let publicCatalogCategoriesRequest: Promise<PublicCatalogCategory[]> | null = null

export async function fetchPublicCatalogCategories(signal?: AbortSignal): Promise<PublicCatalogCategory[]> {
  // Categories use one shared cached request. Do not bind that shared request
  // to one caller's AbortSignal, otherwise one unmount could cancel it for
  // every consumer.
  void signal

  if (publicCatalogCategoriesCache) {
    return publicCatalogCategoriesCache
  }

  if (!publicCatalogCategoriesRequest) {
    publicCatalogCategoriesRequest = request<{ items: PublicCatalogCategory[] }>('/categories')
      .then(body => {
        publicCatalogCategoriesCache = body.items
        return body.items
      })
      .finally(() => {
        publicCatalogCategoriesRequest = null
      })
  }

  return publicCatalogCategoriesRequest
}

export async function fetchPublicCatalogSale(signal?: AbortSignal): Promise<PublicCatalogProduct[]> {
  const body = await request<{ items: PublicCatalogApiProduct[] }>('/sale', signal)
  return body.items.map(normalizePublicCatalogProduct)
}

export async function fetchAllPublicCatalogProducts(categorySlug: string, signal?: AbortSignal): Promise<PublicCatalogListResponse> {
  const first = await fetchPublicCatalogProducts(categorySlug, { limit: 48, offset: 0, signal })
  const items = [...first.items]
  for (let offset = first.pagination.limit; offset < first.pagination.total; offset += first.pagination.limit) {
    const page = await fetchPublicCatalogProducts(categorySlug, { limit: first.pagination.limit, offset, signal })
    items.push(...page.items)
  }
  return { ...first, items, pagination: { ...first.pagination, offset: 0, limit: items.length, hasMore: false } }
}

export async function fetchPublicCatalogProduct(categorySlug: string, identifier: string, signal?: AbortSignal) {
  const body = await request<{ item: PublicCatalogApiProduct }>(`/categories/${encodeURIComponent(categorySlug)}/products/${encodeURIComponent(identifier)}`, signal)
  return normalizePublicCatalogProduct(body.item)
}
