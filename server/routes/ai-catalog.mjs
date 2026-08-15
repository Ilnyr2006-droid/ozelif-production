
import express from 'express'
import {
  getPublishedCatalogSummary,
  getPublishedProduct,
  searchPublishedProducts,
} from '../lib/ai-catalog.mjs'

function asyncRoute(handler) {
  return (request, response, next) => {
    Promise.resolve(handler(request, response, next)).catch(next)
  }
}

function messageFromBody(request) {
  return String(
    request.body?.query
      ?? request.body?.q
      ?? request.body?.message
      ?? '',
  ).trim()
}

export function createAiCatalogRouter() {
  const router = express.Router()

  router.use((_request, response, next) => {
    response.setHeader('Cache-Control', 'no-store')
    next()
  })

  router.get('/summary', asyncRoute(async (_request, response) => {
    response.json({
      ok: true,
      catalog: await getPublishedCatalogSummary(),
    })
  }))

  router.get('/search', asyncRoute(async (request, response) => {
    const result = await searchPublishedProducts(
      request.query?.q,
      { limit: request.query?.limit },
    )

    response.json({
      ok: true,
      ...result,
    })
  }))

  router.post('/search', asyncRoute(async (request, response) => {
    const result = await searchPublishedProducts(
      messageFromBody(request),
      { limit: request.body?.limit },
    )

    response.json({
      ok: true,
      ...result,
    })
  }))

  router.get('/products/:identifier', asyncRoute(async (request, response) => {
    const item = await getPublishedProduct(request.params.identifier)

    if (!item) {
      response.status(404).json({
        ok: false,
        error: 'product_not_found',
      })
      return
    }

    response.json({
      ok: true,
      item,
    })
  }))

  return router
}
