import express from 'express'
import fs from 'node:fs/promises'
import path from 'node:path'
import { renderCategorySeoPage } from '../lib/public-category-seo.mjs'

function asyncRoute(handler) {
  return (request, response, next) => {
    Promise.resolve(handler(request, response, next)).catch(next)
  }
}

export function createPublicCategorySeoRouter({ repository, frontendRoot }) {
  if (!repository?.listProducts) throw new Error('A public catalog repository is required')
  const router = express.Router()
  const indexPath = path.join(frontendRoot, 'index.html')

  router.get('/:categorySlug', asyncRoute(async (request, response, next) => {
    if (!/^[a-z0-9-]+$/.test(request.params.categorySlug)) {
      next()
      return
    }
    const categoryPayload = await repository.listProducts(request.params.categorySlug, { limit: 48, offset: 0 })
    const template = await fs.readFile(indexPath, 'utf8')

    if (!categoryPayload?.category) {
      response
        .status(404)
        .setHeader('Cache-Control', 'no-store')
        .type('html')
        .send(renderCategorySeoPage(template, { slug: request.params.categorySlug }, { notFound: true }))
      return
    }

    response
      .setHeader('Cache-Control', 'public, max-age=300')
      .type('html')
      .send(renderCategorySeoPage(template, categoryPayload.category, { products: categoryPayload.items }))
  }))

  return router
}
