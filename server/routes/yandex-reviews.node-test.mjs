import assert from 'node:assert/strict'
import { once } from 'node:events'
import test from 'node:test'
import express from 'express'
import { createYandexReviewsService, fallbackYandexReviews } from '../lib/yandex-reviews.mjs'
import { createYandexReviewsRouter } from './yandex-reviews.mjs'

async function withServer(service, verify) {
  const app = express()
  app.use('/api/yandex-reviews', createYandexReviewsRouter({ service }))
  const server = app.listen(0, '127.0.0.1')
  await once(server, 'listening')

  try {
    await verify(`http://127.0.0.1:${server.address().port}`)
  } finally {
    server.close()
    await once(server, 'close')
  }
}

test('returns a normalized upstream response and caches it', async () => {
  let calls = 0
  const service = createYandexReviewsService({
    sourceUrl: 'https://reviews.example.test/feed.json',
    fetchImpl: async () => {
      calls += 1
      return new Response(JSON.stringify({
        rating: '4.8',
        ratingsCount: '41',
        reviewsCount: '19',
        reviews: [{ authorName: 'Клиент', text: 'Отличный выбор материалов.' }],
      }), { status: 200, headers: { 'content-type': 'application/json' } })
    },
  })

  await withServer(service, async baseUrl => {
    const first = await fetch(`${baseUrl}/api/yandex-reviews`)
    assert.equal(first.status, 200)
    assert.match(first.headers.get('cache-control') ?? '', /no-store/)
    assert.deepEqual(await first.json(), {
      rating: 4.8,
      ratingsCount: 41,
      reviewsCount: 19,
      reviews: [{ author: 'Клиент', excerpt: 'Отличный выбор материалов.' }],
    })

    const second = await fetch(`${baseUrl}/api/yandex-reviews`)
    assert.equal(second.status, 200)
  })

  assert.equal(calls, 1)
})

test('returns built-in reviews when the upstream source times out', async () => {
  const service = createYandexReviewsService({
    sourceUrl: 'https://reviews.example.test/feed.json',
    timeoutMs: 5,
    fetchImpl: (_url, { signal }) => new Promise((_resolve, reject) => {
      signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')), { once: true })
    }),
  })

  await withServer(service, async baseUrl => {
    const response = await fetch(`${baseUrl}/api/yandex-reviews`)
    assert.equal(response.status, 200)
    assert.deepEqual(await response.json(), fallbackYandexReviews())
  })
})

test('returns built-in reviews when no upstream source is configured', async () => {
  const service = createYandexReviewsService()

  await withServer(service, async baseUrl => {
    const response = await fetch(`${baseUrl}/api/yandex-reviews`)
    assert.equal(response.status, 200)
    assert.match(response.headers.get('content-type') ?? '', /application\/json/)
    assert.deepEqual(await response.json(), fallbackYandexReviews())
  })
})
