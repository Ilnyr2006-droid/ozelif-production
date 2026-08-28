import express from 'express'
import { BASE_STATIC_PATHS, renderSitemapXml } from '../lib/public-sitemap.mjs'
import {
  CATALOG_SEO_LANDINGS,
  matchesCatalogSeoLandingProduct,
} from '../lib/catalog-seo-landings.mjs'

function asyncRoute(handler) {
  return (request, response, next) => {
    Promise.resolve(handler(request, response, next)).catch(next)
  }
}

export function createPublicSitemapRouter({ query, siteUrl }) {
  const router = express.Router()

  router.get('/sitemap.xml', asyncRoute(async (_request, response) => {
    const result = await query(`
      SELECT
        c.slug AS category_slug,
        c.updated_at,
        NULL::text AS slug,
        NULL::text AS identifier,
        NULL::text AS name,
        NULL::jsonb AS attributes,
        'category' AS kind
      FROM categories c
      WHERE c.is_published = true
      UNION ALL
      SELECT
        c.slug AS category_slug,
        p.updated_at,
        p.slug,
        COALESCE(p.legacy_id, p.id::text) AS identifier,
        p.name,
        p.attributes,
        'product' AS kind
      FROM products p
      JOIN categories c ON c.id = p.category_id
      WHERE p.is_published = true
        AND c.is_published = true
      ORDER BY kind, category_slug, slug
    `)

    const products = result.rows.filter(row => row.kind === 'product')
    const categoriesWithProducts = new Set(products.map(row => row.category_slug))
    const categories = result.rows
      .filter(row => row.kind === 'category' && categoriesWithProducts.has(row.category_slug))
      .map(row => ({ ...row, slug: row.category_slug }))

    const activeLandingPaths = CATALOG_SEO_LANDINGS
      .filter(landing => products.some(product => (
        product.category_slug === landing.categorySlug
        && matchesCatalogSeoLandingProduct(product, landing)
      )))
      .map(landing => {
        const updatedAt = products
          .filter(product => (
            product.category_slug === landing.categorySlug
            && matchesCatalogSeoLandingProduct(product, landing)
          ))
          .map(product => product.updated_at)
          .filter(Boolean)
          .sort((left, right) => new Date(right).getTime() - new Date(left).getTime())[0]
        return { path: landing.path, updatedAt }
      })

    response
      .setHeader('Cache-Control', 'public, max-age=300')
      .type('application/xml')
      .send(renderSitemapXml({
        siteUrl,
        staticPaths: [...BASE_STATIC_PATHS, ...activeLandingPaths],
        categories,
        products,
      }))
  }))

  return router
}
