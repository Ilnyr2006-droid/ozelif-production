import express from 'express'
import { createPublicCatalogRepository } from '../lib/public-catalog.mjs'

function asyncRoute(handler) {
  return (request, response, next) => {
    Promise.resolve(handler(request, response, next)).catch(next)
  }
}

export function createPublicCatalogRouter({ repository = createPublicCatalogRepository() } = {}) {
  const router = express.Router()

  router.use((_request, response, next) => {
    response.setHeader('Cache-Control', 'no-store')
    next()
  })

  router.get('/categories', asyncRoute(async (_request, response) => {
    response.json({ items: await repository.listCategories() })
  }))

  router.get('/sale', asyncRoute(async (_request, response) => {
    response.json({ items: await repository.listSaleProducts() })
  }))

  router.get('/categories/:categorySlug/products', asyncRoute(async (request, response) => {
    const result = await repository.listProducts(
      request.params.categorySlug,
      request.query,
    )

    if (!result) {
      response.status(404).json({ error: 'not_found' })
      return
    }

    response.json(result)
  }))

  router.get('/categories/:categorySlug/products/:identifier', asyncRoute(async (request, response) => {
    const item = await repository.getProduct(
      request.params.categorySlug,
      request.params.identifier,
    )

    if (!item) {
      response.status(404).json({ error: 'not_found' })
      return
    }

    response.json({ item })
  }))

  return router
}
