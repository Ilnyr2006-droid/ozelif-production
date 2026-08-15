import assert from 'node:assert/strict'
import { once } from 'node:events'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import express from 'express'
import { createPublicProductSeoRouter } from './public-product-seo.mjs'

async function withSeoServer(repository, verify) {
  const frontendRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'ozelif-product-seo-'))
  await fs.writeFile(path.join(frontendRoot, 'index.html'), '<html><head><title>OZELIF</title><meta name="description" content="old" /></head><body><div id="root"></div></body></html>')
  const app = express()
  app.use(createPublicProductSeoRouter({ repository, frontendRoot }))
  const server = app.listen(0, '127.0.0.1')
  await once(server, 'listening')
  try {
    await verify(`http://127.0.0.1:${server.address().port}`)
  } finally {
    server.close()
    await once(server, 'close')
    await fs.rm(frontendRoot, { recursive: true, force: true })
  }
}

test('renders a product route from any published category returned by the shared catalog repository', async () => {
  const routes = []
  await withSeoServer({
    getProductByRoute: async (category, route) => {
      routes.push({ category, route })
      return {
        name: 'Vegetale Visky',
        url: '/novaya-kategoriya/tproduct/814535079882-vegetale-visky',
        category: { slug: 'novaya-kategoriya', name: 'Новая категория' },
        price: 431,
        currency: 'RUB',
        variants: [],
        images: [],
      }
    },
  }, async baseUrl => {
    const response = await fetch(`${baseUrl}/novaya-kategoriya/tproduct/814535079882-vegetale-visky`)
    assert.equal(response.status, 200)
    assert.match(response.headers.get('content-type') ?? '', /text\/html/)
    assert.match(await response.text(), /"@type":"Product"/)
  })
  assert.deepEqual(routes, [{ category: 'novaya-kategoriya', route: '814535079882-vegetale-visky' }])
})

test('does not render unpublished or unknown products', async () => {
  await withSeoServer({ getProductByRoute: async () => null }, async baseUrl => {
    const response = await fetch(`${baseUrl}/odejnayakozha/tproduct/missing-product`)
    assert.equal(response.status, 404)
  })
})
