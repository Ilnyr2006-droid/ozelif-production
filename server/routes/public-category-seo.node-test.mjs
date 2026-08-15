import assert from 'node:assert/strict'
import { once } from 'node:events'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import express from 'express'
import { createPublicCategorySeoRouter } from './public-category-seo.mjs'

async function withServer(payloads, verify) {
  const frontendRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'ozelif-category-seo-'))
  await fs.writeFile(path.join(frontendRoot, 'index.html'), '<html><head><title>OZELIF</title><meta name="description" content="old" /></head><body><div id="root"></div></body></html>')
  const calls = []
  const app = express()
  app.use(createPublicCategorySeoRouter({
    repository: {
      listProducts: async (slug, query) => {
        calls.push({ slug, query })
        return payloads[slug] ?? null
      },
    },
    frontendRoot,
  }))
  const server = app.listen(0, '127.0.0.1')
  await once(server, 'listening')
  try {
    await verify(`http://127.0.0.1:${server.address().port}`, calls)
  } finally {
    server.close()
    await once(server, 'close')
    await fs.rm(frontendRoot, { recursive: true, force: true })
  }
}

test('renders a published database category and its products without a frontend rebuild', async () => {
  await withServer({
    'new-category': {
      category: { slug: 'new-category', name: 'Новая категория', coverImage: '/images/new.webp' },
      items: [{
        id: '100',
        name: 'Новый материал',
        url: '/new-category/tproduct/100-new-material',
        primaryImage: { url: '/images/product.webp', alt: 'Новый материал' },
        variants: [{ price: '950', unit: 'фут²', isActive: true }],
      }],
    },
  }, async (baseUrl, calls) => {
    const response = await fetch(`${baseUrl}/new-category`)
    const html = await response.text()
    assert.equal(response.status, 200)
    assert.deepEqual(calls, [{ slug: 'new-category', query: { limit: 48, offset: 0 } }])
    assert.match(html, /Новая категория — купить в Москве/)
    assert.match(html, /rel="canonical" href="https:\/\/ozelifkoja\.ru\/new-category"/)
    assert.match(html, /<h1>Новая категория<\/h1>/)
    assert.match(html, /Новый материал/)
    assert.match(html, /от 950 ₽ \/ фут²/)
    assert.match(html, /"@type":"ItemList"/)
    assert.match(html, /"@type":"Store"/)
    assert.doesNotMatch(html, /<div id="root"><\/div>/)
  })
})

test('returns an HTML 404 with noindex for an unknown category', async () => {
  await withServer({}, async baseUrl => {
    const response = await fetch(`${baseUrl}/missing-category`)
    const html = await response.text()
    assert.equal(response.status, 404)
    assert.match(response.headers.get('content-type') ?? '', /text\/html/)
    assert.match(html, /name="robots" content="noindex,follow"/)
  })
})

test('renders clothing leather search intent and keeps a multi-unit price paired with dm2', async () => {
  await withServer({
    odejnayakozha: {
      category: {
        slug: 'odejnayakozha',
        name: 'Одежная кожа',
        seoTitle: 'Одежная кожа — OZELIF',
        seoDescription: 'Короткое старое описание.',
      },
      items: [{
        id: '266593405722',
        name: 'Andas Black',
        url: '/odejnayakozha/tproduct/266593405722-andas-black',
        price: 46.33,
        unit: 'фут²',
        attributes: { material: 'Овчина', thickness: '0.5-0.6' },
        variants: [
          { price: 437.05, unit: 'фут²', currency: 'RUB', isActive: true },
          { price: 46.33, unit: 'дм²', currency: 'RUB', isActive: true },
        ],
      }],
    },
  }, async baseUrl => {
    const response = await fetch(`${baseUrl}/odejnayakozha`)
    const html = await response.text()
    assert.equal(response.status, 200)
    assert.match(html, /<title>Одежная кожа — купить натуральную кожу в Москве \| OZELIF<\/title>/)
    assert.match(html, /Краснобогатырской улице, 24/)
    assert.match(html, /OZELIF поставляет натуральную одежную кожу/)
    assert.match(html, /Сырьё в каталоге/)
    assert.match(html, /Овчина/)
    assert.match(html, /От 0,5 до 0,6 мм по данным карточек каталога/)
    assert.doesNotMatch(html, /Мы производим кожу/)
    assert.doesNotMatch(html, /шкур коз/)
    assert.match(html, /от 46,33 ₽ \/ дм²/)
    assert.doesNotMatch(html, /46,33 ₽ \/ фут²/)
  })
})
