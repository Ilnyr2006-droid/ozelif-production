import express from 'express'
import { renderSitemapXml } from '../lib/public-sitemap.mjs'

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
        'category' AS kind
      FROM categories c
      WHERE c.is_published = true
      UNION ALL
      SELECT
        c.slug AS category_slug,
        p.updated_at,
        p.slug,
        COALESCE(p.legacy_id, p.id::text) AS identifier,
        'product' AS kind
      FROM products p
      JOIN categories c ON c.id = p.category_id
      WHERE p.is_published = true
        AND c.is_published = true
      ORDER BY kind, category_slug, slug
    `)
    const categories = result.rows
      .filter(row => row.kind === 'category')
      .map(row => ({ ...row, slug: row.category_slug }))
    const products = result.rows.filter(row => row.kind === 'product')
    response
      .setHeader('Cache-Control', 'public, max-age=300')
      .type('application/xml')
      .send(renderSitemapXml({ siteUrl, categories, products }))
  }))

  return router
}
