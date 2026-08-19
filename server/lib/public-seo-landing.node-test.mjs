import assert from 'node:assert/strict'
import test from 'node:test'
import { renderCatalogSeoLandingPage } from './public-seo-landing.mjs'

const landing = {
  path: '/odejnayakozha/nappa',
  parentPath: '/odejnayakozha',
  categorySlug: 'odejnayakozha',
  categoryName: 'Одежная кожа',
  title: 'Натуральная кожа Наппа',
}

const products = [{
  name: 'Nappa Black',
  url: '/odejnayakozha/tproduct/123-nappa-black',
  attributes: { material: 'КРС' },
  variants: [{ price: 100, unit: 'дм²', currency: 'RUB', isActive: true }],
}]

test('replaces a homepage prerender fallback even when the homepage contains an h1', () => {
  const template = `<html><head>
    <title>Купить натуральную кожу в Москве — каталог и цены | OZELIF</title>
    <meta name="description" content="homepage" />
    <link rel="canonical" href="https://ozelifkoja.ru/" />
    <script type="application/ld+json">{"@type":"WebPage","name":"HOME-SCHEMA"}</script>
  </head><body><div id="root"><main data-seo-prerender="true"><article>
    <h1>Натуральная кожа в Москве — каталог и цены</h1>
    <p>HOME-ONLY-CONTENT</p>
  </article></main></div></body></html>`

  const html = renderCatalogSeoLandingPage(template, landing, products)

  assert.match(html, /<title>Купить натуральную кожу Наппа в Москве \| OZELIF<\/title>/)
  assert.match(html, /rel="canonical" href="https:\/\/ozelifkoja\.ru\/odejnayakozha\/nappa"/)
  assert.match(html, /<h1>Натуральная кожа Наппа<\/h1>/)
  assert.doesNotMatch(html, /HOME-ONLY-CONTENT/)
  assert.doesNotMatch(html, /Натуральная кожа в Москве — каталог и цены<\/h1>/)
  assert.equal((html.match(/<h1\b/gi) ?? []).length, 1)
  assert.match(html, /seo-prerender__live-products/)
  assert.match(html, /\/odejnayakozha\/tproduct\/123-nappa-black/)
})

test('keeps a route-specific prerender and appends live product content', () => {
  const template = `<html><head>
    <title>Натуральная кожа Наппа | OZELIF</title>
    <meta name="description" content="landing" />
    <link rel="canonical" href="https://ozelifkoja.ru/odejnayakozha/nappa" />
  </head><body><div id="root"><main data-seo-prerender="true"><article>
    <h1>Натуральная кожа Наппа</h1>
    <p>STATIC-LANDING-COPY</p>
  </article></main></div></body></html>`

  const html = renderCatalogSeoLandingPage(template, landing, products)

  assert.match(html, /STATIC-LANDING-COPY/)
  assert.match(html, /seo-prerender__live-products/)
  assert.equal((html.match(/<h1\b/gi) ?? []).length, 1)
})
