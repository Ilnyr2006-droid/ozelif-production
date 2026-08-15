import assert from 'node:assert/strict'
import { once } from 'node:events'
import test from 'node:test'
import express from 'express'
import {
  jsonErrorHandler,
  jsonNotFoundHandler,
} from './http-errors.mjs'

async function withServer(configure, verify) {
  const app = express()
  configure(app)
  app.use(jsonNotFoundHandler)
  app.use(jsonErrorHandler)

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

test('returns JSON 404 for an unknown route', async () => {
  await withServer(() => {}, async baseUrl => {
    const response = await fetch(`${baseUrl}/api/not-a-route`)

    assert.equal(response.status, 404)
    assert.match(response.headers.get('content-type') ?? '', /application\/json/)
    assert.deepEqual(await response.json(), {
      error: 'not_found',
      path: '/api/not-a-route',
    })
  })
})

test('returns JSON 500 when a late route throws', async () => {
  await withServer(app => {
    app.get('/api/late-route', () => {
      throw new Error('late route failure')
    })
  }, async baseUrl => {
    const response = await fetch(`${baseUrl}/api/late-route`)

    assert.equal(response.status, 500)
    assert.match(response.headers.get('content-type') ?? '', /application\/json/)
    assert.deepEqual(await response.json(), { error: 'late route failure' })
  })
})

test('preserves a late route validation status', async () => {
  await withServer(app => {
    app.get('/api/invalid-request', () => {
      const error = new Error('Нужны обязательные данные')
      error.status = 400
      throw error
    })
  }, async baseUrl => {
    const response = await fetch(`${baseUrl}/api/invalid-request`)

    assert.equal(response.status, 400)
    assert.deepEqual(await response.json(), { error: 'Нужны обязательные данные' })
  })
})
