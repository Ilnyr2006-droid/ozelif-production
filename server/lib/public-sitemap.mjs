export const BASE_STATIC_PATHS = Object.freeze([
  '/',
  '/kozhaozelif',
  '/kozhaoptom',
  '/production',
  '/delivery',
  '/contacts',
])

function escapeXml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

function dateValue(value) {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date.toISOString().slice(0, 10)
}

export function renderSitemapXml({ siteUrl, staticPaths = BASE_STATIC_PATHS, categories = [], products = [] }) {
  const origin = String(siteUrl).replace(/\/$/, '')
  const entries = [
    ...staticPaths.map(path => ({ path })),
    ...categories.map(category => ({ path: `/${category.slug}`, updatedAt: category.updated_at })),
    ...products.map(product => ({
      path: `/${product.category_slug}/tproduct/${product.identifier}-${product.slug}`,
      updatedAt: product.updated_at,
    })),
  ]

  const uniqueEntries = [...new Map(entries.map(entry => [entry.path, entry])).values()]
  const urls = uniqueEntries.map(entry => {
    const lastmod = dateValue(entry.updatedAt)
    return `<url><loc>${escapeXml(`${origin}${entry.path}`)}</loc>${lastmod ? `<lastmod>${lastmod}</lastmod>` : ''}</url>`
  }).join('')
  return `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls}</urlset>`
}
