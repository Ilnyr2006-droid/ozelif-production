import express from 'express'
import fs from 'node:fs/promises'
import path from 'node:path'
import { renderCategorySeoPage } from '../lib/public-category-seo.mjs'
import { renderCatalogSeoLandingPage } from '../lib/public-seo-landing.mjs'
import {
  getCatalogSeoLandingByPath,
  matchesCatalogSeoLandingProduct,
} from '../lib/catalog-seo-landings.mjs'

const PAGE_LIMIT = 48

function asyncRoute(handler) {
  return (request, response, next) => {
    Promise.resolve(handler(request, response, next)).catch(next)
  }
}

async function readTemplate(frontendRoot, pathname = '/') {
  const routePath = pathname === '/'
    ? path.join(frontendRoot, 'index.html')
    : path.join(frontendRoot, pathname.replace(/^\//, ''), 'index.html')

  try {
    return await fs.readFile(routePath, 'utf8')
  } catch (error) {
    if (error?.code !== 'ENOENT') throw error
    return fs.readFile(path.join(frontendRoot, 'index.html'), 'utf8')
  }
}

async function listAllProducts(repository, categorySlug) {
  const first = await repository.listProducts(categorySlug, {
    limit: PAGE_LIMIT,
    offset: 0,
  })

  if (!first?.category) return null

  const items = [...first.items]
  for (
    let offset = first.pagination.limit;
    offset < first.pagination.total;
    offset += first.pagination.limit
  ) {
    const page = await repository.listProducts(categorySlug, {
      limit: first.pagination.limit,
      offset,
    })
    if (!page?.category) break
    items.push(...page.items)
  }

  return {
    ...first,
    items,
    pagination: {
      ...first.pagination,
      offset: 0,
      limit: items.length,
      hasMore: false,
    },
  }
}

export function createPublicCategorySeoRouter({ repository, frontendRoot }) {
  if (!repository?.listProducts) throw new Error('A public catalog repository is required')
  const router = express.Router()

  router.get('/:categorySlug/:landingSlug', asyncRoute(async (request, response, next) => {
    if (
      !/^[a-z0-9-]+$/.test(request.params.categorySlug)
      || !/^[a-z0-9-]+$/.test(request.params.landingSlug)
    ) {
      next()
      return
    }

    const pathname = `/${request.params.categorySlug}/${request.params.landingSlug}`
    const landing = getCatalogSeoLandingByPath(pathname)
    if (!landing) {
      next()
      return
    }

    const categoryPayload = await listAllProducts(repository, landing.categorySlug)
    const template = await readTemplate(frontendRoot, landing.path)

    if (!categoryPayload?.category) {
      response
        .status(404)
        .setHeader('Cache-Control', 'no-store')
        .type('html')
        .send(renderCategorySeoPage(template, { slug: landing.categorySlug }, { notFound: true }))
      return
    }

    const products = categoryPayload.items.filter(product => (
      matchesCatalogSeoLandingProduct(product, landing)
    ))

    if (!products.length) {
      response.setHeader('X-Robots-Tag', 'noindex, follow')
    }

    response
      .setHeader('Cache-Control', 'public, max-age=300')
      .type('html')
      .send(renderCatalogSeoLandingPage(template, landing, products))
  }))

  router.get('/:categorySlug', asyncRoute(async (request, response, next) => {
    if (!/^[a-z0-9-]+$/.test(request.params.categorySlug)) {
      next()
      return
    }

    const categoryPayload = await listAllProducts(repository, request.params.categorySlug)
    const template = await readTemplate(frontendRoot)

    if (!categoryPayload?.category) {
      response
        .status(404)
        .setHeader('Cache-Control', 'no-store')
        .type('html')
        .send(renderCategorySeoPage(template, { slug: request.params.categorySlug }, { notFound: true }))
      return
    }

    if (!categoryPayload.items.length) {
      response.setHeader('X-Robots-Tag', 'noindex, follow')
    }

    response
      .setHeader('Cache-Control', 'public, max-age=300')
      .type('html')
      .send(renderCategorySeoPage(template, categoryPayload.category, { products: categoryPayload.items }))
  }))

  return router
}
