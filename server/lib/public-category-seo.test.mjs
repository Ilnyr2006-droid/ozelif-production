import { describe, expect, it } from 'vitest'
import { renderCategorySeoPage } from './public-category-seo.mjs'

const template = `<!doctype html><html><head><title>Old</title><meta name="description" content="old"><link rel="canonical" href="https://example.test/old"><meta property="og:type" content="website"><meta property="og:url" content="https://example.test/old"><meta property="og:title" content="Old"><meta property="og:description" content="Old"></head><body><div id="root"></div></body></html>`

const category = {
  slug: 'odejnayakozha',
  name: 'Одежная кожа',
  coverImage: '/images/catalog/clothing-leather/catalog-hero.webp',
}

const products = [{
  id: 'product-1',
  name: 'Vegetale Visky',
  url: '/odejnayakozha/tproduct/product-1-vegetale-visky',
  attributes: {
    subtype: ['КРС'],
    material: 'Овчина',
    color: 'Коричневый',
    normalizedColor: 'Коричневый',
    thickness: '0,7',
    coating: 'Винтаж',
    country: 'Италия',
  },
  variants: [{
    id: 'variant-1',
    price: 431.2,
    currency: 'RUB',
    unit: 'фут²',
    isActive: true,
  }],
}]

describe('public clothing category commercial SEO', () => {
  it('renders buyer-focused text, useful links and real product facts in initial HTML', () => {
    const html = renderCategorySeoPage(template, category, { products })

    expect(html).toContain('<title>Одежная кожа купить в Москве — натуральная кожа для пошива | OZELIF</title>')
    expect(html).toContain('<h1>Одежная кожа для пошива</h1>')
    expect(html).toContain('Купить одежную кожу в Москве — в розницу и оптом')
    expect(html).toContain('Каталог одежной кожи с ценами')
    expect(html).toContain('Vegetale Visky')
    expect(html).toContain('431')
    expect(html).toContain('Овчина · Коричневый · 0,7 мм · Винтаж · Италия')
    expect(html).toContain('href="/kozhaoptom"')
    expect(html).toContain('href="/delivery"')
    expect(html).toContain('href="/contacts"')
    expect(html).toContain('href="/odejnayakozha/krs"')
    expect(html).toContain('href="/odejnayakozha/perforirovannaya"')
    expect(html).not.toContain('Мы производим кожу')
    expect(html).not.toContain('шкур коз')
  })
})
