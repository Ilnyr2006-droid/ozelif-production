import assert from 'node:assert/strict'
import test from 'node:test'
import { getProductSeoMetadata, getPublishedProductOffer, getPublishedProductPrice, renderProductSeoPage } from './public-product-seo.mjs'

const template = `<!doctype html><html><head>
<title>Old title</title>
<meta name="description" content="old" />
<link rel="canonical" href="https://example.test/" />
<meta property="og:title" content="old" />
</head><body><div id="root"></div></body></html>`

test('uses the lowest valid published product or active variant price', () => {
  assert.equal(getPublishedProductPrice({ price: null, variants: [{ price: '490' }, { price: 431 }, { price: 0 }] }), 431)
  assert.equal(getPublishedProductPrice({ price: -1, variants: [] }), null)
})

test('keeps the lowest published price paired with its own unit', () => {
  assert.deepEqual(getPublishedProductOffer({
    price: 46.33,
    unit: 'фут²',
    currency: 'RUB',
    variants: [
      { price: 1, unit: 'шт.', isActive: false },
      { price: 437.05, unit: 'фут²', currency: 'RUB', isActive: true },
      { price: 46.33, unit: 'дм²', currency: 'RUB', isActive: true },
    ],
  }), { price: 46.33, unit: 'дм²', currency: 'RUB', from: true })
})

test('renders a multi-unit product without pairing the dm2 price with the ft2 unit', () => {
  const html = renderProductSeoPage(template, {
    id: '266593405722',
    name: 'Andas Black',
    url: '/odejnayakozha/tproduct/266593405722-andas-black',
    price: 46.33,
    unit: 'фут²',
    currency: 'RUB',
    variants: [
      { name: 'Фут²', price: 437.05, unit: 'фут²', currency: 'RUB', isActive: true },
      { name: 'Дм²', price: 46.33, unit: 'дм²', currency: 'RUB', isActive: true },
    ],
  }, { origin: 'https://ozelifkoja.ru', categoryName: 'Одежная кожа' })

  assert.match(html, /<strong>от 46,33 ₽ \/ дм²<\/strong>/)
  assert.match(html, /"unitText":"дм²"/)
  assert.doesNotMatch(html, /46,33 ₽ \/ фут²/)
})

test('renders escaped product metadata and JSON-LD into the application shell', () => {
  const html = renderProductSeoPage(template, {
    id: '814535079882',
    name: 'Vegetale <Visky>',
    description: 'Кожа для & аксессуаров',
    url: '/odejnayakozha/tproduct/814535079882-vegetale-visky',
    sku: 'VSK-1',
    price: null,
    currency: 'RUB',
    primaryImage: { url: '/images/vegetale.webp' },
    attributes: { material: 'Овчина', color: 'Коричневый' },
    variants: [{ name: 'Фут²', price: '431', unit: 'фут²', isActive: true }],
  }, { origin: 'https://ozelifkoja.ru', categoryName: 'Одежная кожа' })

  assert.match(html, /<title>Vegetale &lt;Visky&gt; №814535079882 — OZELIF<\/title>/)
  assert.match(html, /<meta name="description" content="Кожа для &amp; аксессуаров Материал: Овчина, Цвет: Коричневый\. №814535079882\." \/>/)
  assert.match(html, /<link rel="canonical" href="https:\/\/ozelifkoja\.ru\/odejnayakozha\/tproduct\/814535079882-vegetale-visky" \/>/)
  assert.match(html, /"@type":"Product"/)
  assert.match(html, /"price":"431"/)
  assert.match(html, /"unitText":"фут²"/)
  assert.match(html, /"@type":"BreadcrumbList"/)
  assert.match(html, /"@type":"Store"/)
  assert.match(html, /"seller":\{"@id":"https:\/\/ozelifkoja\.ru\/#store"\}/)
  assert.match(html, /<h1>Vegetale &lt;Visky&gt;<\/h1>/)
  assert.match(html, /<h2>Характеристики<\/h2>/)
  assert.match(html, /Фут² — 431 ₽ \/ фут²/)
  assert.doesNotMatch(html, /<div id="root"><\/div>/)
  assert.equal((html.match(/<title>/g) ?? []).length, 1)
})

test('keeps metadata unique for products with the same public name', () => {
  const first = getProductSeoMetadata({
    id: '378521427732',
    name: 'Jeans Effect',
    description: 'Мягкая натуральная кожа.',
    attributes: { material: 'Овчина', color: 'Синий', thickness: '0.8-0.9' },
  }, { categoryName: 'Одежная кожа' })
  const second = getProductSeoMetadata({
    id: '564770761822',
    name: 'Jeans Effect',
    description: 'Мягкая натуральная кожа.',
    attributes: { material: 'Овчина', color: 'Синий', thickness: '0.8-0.9' },
  }, { categoryName: 'Одежная кожа' })

  assert.notEqual(first.title, second.title)
  assert.notEqual(first.description, second.description)
  assert.match(first.description, /Материал: Овчина, Цвет: Синий, Толщина: 0\.8-0\.9\./)
  assert.ok(first.description.length <= 160)
})
