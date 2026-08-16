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
  it('renders a responsive initial product image and client bootstrap payload', () => {
    const html = renderProductSeoPage(template, {
      id: '629195419972',
      name: 'Amazon Black',
      slug: 'amazon-black',
      url: '/odejnayakozha/tproduct/629195419972-amazon-black',
      category: { slug: 'odejnayakozha', name: 'Одежная кожа' },
      attributes: { subtype: ['Гладкая'], color: 'Black' },
      primaryImage: {
        url: '/images/catalog/clothing-leather/629195419972/w1680-v2.webp',
        alt: 'Amazon Black',
        sortOrder: 0,
      },
      images: [],
      variants: [],
    }, {
      categoryName: 'Одежная кожа',
      modulePreloadHref: '/assets/ClothingLeatherCatalogPage-test.js',
    })

    expect(html).toContain('id="ozelif-product-bootstrap"')
    expect(html).toContain('rel="preload" as="image" type="image/webp" href="https://ozelifkoja.ru/images/catalog/clothing-leather/629195419972/w480-v2.webp" media="(max-width: 639px)" fetchpriority="high"')
    expect(html).toContain('rel="modulepreload" href="/assets/ClothingLeatherCatalogPage-test.js"')
    expect(html).toContain('src="https://ozelifkoja.ru/images/catalog/clothing-leather/629195419972/w720-v2.webp"')
    expect(html).toContain('media="(max-width: 639px)"')
    expect(html).toContain('srcset="https://ozelifkoja.ru/images/catalog/clothing-leather/629195419972/w480-v2.webp"')
    expect(html).toContain('w480-v2.webp 480w')
    expect(html).toContain('w720-v2.webp 720w')
    expect(html).toContain('w1680-v2.webp 1680w')
    expect(html).toContain('sizes="(min-width: 900px) 50vw, 100vw"')
    expect(html).toContain('fetchpriority="high"')
  })

})
