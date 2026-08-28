import assert from 'node:assert/strict'
import test from 'node:test'
import express from 'express'
import { BASE_STATIC_PATHS, renderSitemapXml } from './public-sitemap.mjs'
import { createPublicSitemapRouter } from '../routes/public-sitemap.mjs'

test('renders published category and product URLs using their current slugs', () => {
  const xml = renderSitemapXml({
    siteUrl: 'https://ozelifkoja.ru/',
    staticPaths: ['/'],
    categories: [{ slug: 'mebelnaya-kozha', updated_at: '2026-08-01T12:00:00Z' }],
    products: [{ category_slug: 'mebelnaya-kozha', identifier: '123', slug: 'velour', updated_at: '2026-08-01T12:00:00Z' }],
  })
  assert.match(xml, /https:\/\/ozelifkoja\.ru\/mebelnaya-kozha/)
  assert.match(xml, /https:\/\/ozelifkoja\.ru\/mebelnaya-kozha\/tproduct\/123-velour/)
  assert.match(xml, /<lastmod>2026-08-01<\/lastmod>/)
})

test('omits published empty categories from the dynamic sitemap', async () => {
  const app = express()
  app.use(createPublicSitemapRouter({
    siteUrl: 'https://example.test',
    query: async () => ({
      rows: [
        { kind: 'category', category_slug: 'galantereynayakozha', updated_at: '2026-08-01T00:00:00.000Z' },
      ],
    }),
  }))
  const server = await new Promise(resolve => {
    const instance = app.listen(0, () => resolve(instance))
  })
  try {
    const { port } = server.address()
    const response = await fetch(`http://127.0.0.1:${port}/sitemap.xml`)
    const xml = await response.text()
    assert.equal(response.status, 200)
    assert.doesNotMatch(xml, /https:\/\/example\.test\/galantereynayakozha/)
  } finally {
    await new Promise(resolve => server.close(resolve))
  }
})

test('includes the sale page in the base sitemap paths', () => {
  assert.ok(BASE_STATIC_PATHS.includes('/sale'))
})

test('renders a factual lastmod for dated static paths', () => {
  const xml = renderSitemapXml({
    siteUrl: 'https://ozelifkoja.ru/',
    staticPaths: [{ path: '/sale', updatedAt: '2026-08-26T10:00:00Z' }],
  })

  assert.match(xml, /<loc>https:\/\/ozelifkoja\.ru\/sale<\/loc><lastmod>2026-08-26<\/lastmod>/)
})
