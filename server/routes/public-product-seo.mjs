import express from 'express'
import fs from 'node:fs/promises'
import path from 'node:path'
import { renderProductSeoPage } from '../lib/public-product-seo.mjs'


async function productModulePreload(frontendRoot, categorySlug) {
  const prefixes = {
    odejnayakozha: 'ClothingLeatherCatalogPage-',
  }

  const prefix = prefixes[categorySlug]
  if (!prefix) return null

  try {
    const files = await fs.readdir(path.join(frontendRoot, 'assets'))
    const filename = files
      .filter(file => file.startsWith(prefix) && file.endsWith('.js'))
      .sort()
      .at(-1)

    return filename ? `/assets/${filename}` : null
  } catch {
    return null
  }
}

function asyncRoute(handler) {
  return (request, response, next) => {
    Promise.resolve(handler(request, response, next)).catch(next)
  }
}

export function createPublicProductSeoRouter({ repository, frontendRoot }) {
  if (!repository?.getProductByRoute) throw new Error('A public catalog repository is required')
  const router = express.Router()
  const indexPath = path.join(frontendRoot, 'index.html')

  router.get('/:categorySlug/tproduct/:routeIdentifier', asyncRoute(async (request, response) => {
    const product = await repository.getProductByRoute(
      request.params.categorySlug,
      request.params.routeIdentifier,
    )
    if (!product) {
      response.status(404).type('text/plain').send('Not found')
      return
    }

    const [template, modulePreloadHref] = await Promise.all([
      fs.readFile(indexPath, 'utf8'),
      productModulePreload(frontendRoot, request.params.categorySlug),
    ])
    response
      .setHeader('Cache-Control', 'public, max-age=300')
      .type('html')
      .send(renderProductSeoPage(template, product, {
        categoryName: product.category?.name || 'Каталог',
        modulePreloadHref,
      }))
  }))

  return router
}
