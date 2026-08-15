import { vi } from 'vitest'

type StaticVariant = { id: string; title: string; unit: string | null; shade: string | null; shadeHex: string | null; priceRub: number | null; oldPriceRub: number | null; currency: 'RUB' | null }
type StaticProduct = { id: string; slug: string; title: string; image: string | null; subtype: string[] | string; material?: string | null; color?: string | null; normalizedColor?: string | null; hideSize?: string | null; thickness?: string | null; country?: string | null; coating?: string | null; origin?: string | null; brand?: string | null; tapeColor?: string | null; metalColor?: string | null; length?: string | null; minimumOrder?: string | null; variants: StaticVariant[] }

export function catalogApiItem(product: StaticProduct) {
  const subtype = Array.isArray(product.subtype) ? product.subtype : [product.subtype]
  return { id: product.id, slug: product.slug, name: product.title, description: null, article: null, price: null, oldPrice: null, currency: 'RUB', unit: null, minOrder: product.minimumOrder ?? null, attributes: { subtype, material: product.material ?? null, color: product.color ?? null, normalizedColor: product.normalizedColor ?? null, hideSize: product.hideSize ?? null, thickness: product.thickness ?? null, country: product.country ?? null, coating: product.coating ?? null, origin: product.origin ?? null, brand: product.brand ?? null, tapeColor: product.tapeColor ?? null, metalColor: product.metalColor ?? null, length: product.length ?? null }, primaryImage: product.image ? { url: product.image, alt: product.title, sortOrder: 0 } : null, images: product.image ? [{ url: product.image, alt: product.title, sortOrder: 0 }] : [], variants: product.variants.map(variant => ({ id: variant.id, name: variant.title, sku: null, price: variant.priceRub, oldPrice: variant.oldPriceRub, currency: variant.currency, unit: variant.unit, attributes: { shade: variant.shade, shadeHex: variant.shadeHex }, isActive: true })) }
}

export function stubPublicCatalogApi(categorySlug: string, products: StaticProduct[], category: { name?: string; description?: string | null } = {}) {
  const items = products.map(catalogApiItem)
  const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
    const path = String(input)
    if (path.endsWith('/api/public/catalog/v1/categories')) {
      return new Response(JSON.stringify({ items: [
        { databaseId: categorySlug, slug: categorySlug, name: category.name ?? categorySlug, description: category.description ?? null, coverImage: null, filterConfig: null, seoTitle: null, seoDescription: null, showOnHome: true, showInMenu: true },
        { databaseId: 'galantereynayakozha', slug: 'galantereynayakozha', name: 'Галантерейная кожа', description: 'Материал для сумок, ремней, кошельков и малых кожаных изделий.', coverImage: '/images/categories/leather-goods.webp', filterConfig: null, seoTitle: null, seoDescription: null, showOnHome: true, showInMenu: true },
      ] }), { headers: { 'Content-Type': 'application/json' } })
    }
    if (path.includes('/categories/galantereynayakozha/products')) {
      return new Response(JSON.stringify({ category: { slug: 'galantereynayakozha', name: 'Галантерейная кожа', description: 'Материал для сумок, ремней, кошельков и малых кожаных изделий.', coverImage: '/images/categories/leather-goods.webp' }, pagination: { limit: 48, offset: 0, total: 0, hasMore: false }, items: [] }), { headers: { 'Content-Type': 'application/json' } })
    }
    const match = path.match(new RegExp(`/categories/${categorySlug}/products/([^?]+)$`))
    if (match) {
      const item = items.find(product => product.id === decodeURIComponent(match[1]) || product.slug === decodeURIComponent(match[1]))
      return new Response(JSON.stringify(item ? { item } : { error: 'not_found' }), { status: item ? 200 : 404, headers: { 'Content-Type': 'application/json' } })
    }
    if (path.includes(`/categories/${categorySlug}/products`)) return new Response(JSON.stringify({ category: { slug: categorySlug, name: category.name ?? categorySlug, description: category.description ?? null }, pagination: { limit: 48, offset: 0, total: items.length, hasMore: false }, items }), { headers: { 'Content-Type': 'application/json' } })
    return new Response(JSON.stringify({ error: 'not_found' }), { status: 404, headers: { 'Content-Type': 'application/json' } })
  })
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}
