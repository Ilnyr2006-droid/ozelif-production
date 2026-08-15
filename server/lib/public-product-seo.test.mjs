import { describe, expect, it } from 'vitest'
import { renderProductSeoPage } from './public-product-seo.mjs'

const template = `<!doctype html><html><head><title>Old</title><meta name="description" content="old"><link rel="canonical" href="https://example.test/old"><meta property="og:type" content="website"><meta property="og:url" content="https://example.test/old"><meta property="og:title" content="Old"><meta property="og:description" content="Old"></head><body><div id="root"></div></body></html>`

describe('public product structured data', () => {
  it('publishes a confirmed price without inventing an InStock status', () => {
    const html = renderProductSeoPage(template, {
      id: 'product-1',
      name: 'Vegetale Visky',
      url: '/odejnayakozha/tproduct/product-1-vegetale-visky',
      category: { slug: 'odejnayakozha', name: 'Одежная кожа' },
      attributes: { material: 'Овчина', color: 'Коричневый', thickness: '0,7' },
      variants: [{ id: 'variant-1', price: 431.2, currency: 'RUB', unit: 'фут²', isActive: true }],
      images: [],
    }, { categoryName: 'Одежная кожа' })

    expect(html).toContain('"price":"431.2"')
    expect(html).toContain('"priceCurrency":"RUB"')
    expect(html).not.toContain('https://schema.org/InStock')
    expect(html).toContain('Уточнить наличие у менеджера')
  })
})
