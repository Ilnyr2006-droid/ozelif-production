import assert from 'node:assert/strict'
import { once } from 'node:events'
import test from 'node:test'
import express from 'express'
import { createPublicCatalogRouter } from './public-catalog.mjs'

async function withServer(repository, verify) {
  const app = express()
  app.use('/api/public/catalog/v1', createPublicCatalogRouter({ repository }))
  const server = app.listen(0, '127.0.0.1')
  await once(server, 'listening')
  const { port } = server.address()

  try {
    await verify(`http://127.0.0.1:${port}`)
  } finally {
    server.close()
    await once(server, 'close')
  }
}

test('serves the public category and product contracts', async () => {
  const repository = {
    listCategories: async () => [{ id: 'odejnayakozha', name: 'Одежная кожа' }],
    listProducts: async () => ({
      category: { id: 'odejnayakozha', name: 'Одежная кожа' },
      pagination: { limit: 24, offset: 0, total: 1, hasMore: false },
      items: [{ id: '814535079882', variants: [], images: [] }],
    }),
    getProduct: async (_category, identifier) => identifier === '814535079882'
      ? { id: '814535079882', variants: [], images: [] }
      : null,
  }

  await withServer(repository, async baseUrl => {
    const categories = await fetch(`${baseUrl}/api/public/catalog/v1/categories`)
    assert.equal(categories.status, 200)
    assert.deepEqual(await categories.json(), { items: [{ id: 'odejnayakozha', name: 'Одежная кожа' }] })

    const list = await fetch(`${baseUrl}/api/public/catalog/v1/categories/odejnayakozha/products?limit=48`)
    assert.equal(list.status, 200)
    assert.equal((await list.json()).pagination.total, 1)

    const detail = await fetch(`${baseUrl}/api/public/catalog/v1/categories/odejnayakozha/products/814535079882`)
    assert.equal(detail.status, 200)
    assert.equal((await detail.json()).item.id, '814535079882')
  })
})

test('returns JSON 404 for a missing public catalog item', async () => {
  const repository = {
    listCategories: async () => [],
    listProducts: async () => null,
    getProduct: async () => null,
  }

  await withServer(repository, async baseUrl => {
    const response = await fetch(`${baseUrl}/api/public/catalog/v1/categories/missing/products/nope`)
    assert.equal(response.status, 404)
    assert.match(response.headers.get('content-type') ?? '', /application\/json/)
    assert.deepEqual(await response.json(), { error: 'not_found' })
  })
})
