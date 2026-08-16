import { describe, expect, it } from 'vitest'
import { renderCatalogSeoLandingPage } from './public-seo-landing.mjs'
import { getCatalogSeoLandingByPath } from './catalog-seo-landings.mjs'

const template = `<!doctype html><html><head><title>Test</title><link rel="canonical" href="https://example.invalid/test"><script type="application/ld+json">{"old":true}</script></head><body><div id="root"><main><article><h1>КРС</h1></article></main></div></body></html>`

describe('dynamic SEO landing renderer', () => {
  it('renders crawlable product links and fresh structured data', () => {
    const landing = getCatalogSeoLandingByPath('/odejnayakozha/krs')
    const html = renderCatalogSeoLandingPage(template, landing, [{
      name: 'КРС Cracklet',
      slug: 'krs-cracklet',
      url: '/odejnayakozha/tproduct/123-krs-cracklet',
      attributes: { subtype: ['КРС'], color: 'Black', thickness: '0.8 мм' },
      variants: [{ isActive: true, price: 120, currency: 'RUB', unit: 'дм²' }],
    }])

    expect(html).toContain('<a href="/odejnayakozha/tproduct/123-krs-cracklet">КРС Cracklet</a>')
    expect(html).toContain('BreadcrumbList')
    expect(html).toContain('CollectionPage')
    expect(html).toContain('ItemList')
    expect(html).not.toContain('noindex,follow')
  })

  it('marks an empty landing noindex,follow', () => {
    const landing = getCatalogSeoLandingByPath('/odejnayakozha/krs')
    const html = renderCatalogSeoLandingPage(template, landing, [])
    expect(html).toContain('<meta name="robots" content="noindex,follow" />')
  })
  it('gives a fallback dynamic landing one H1 and unique SEO metadata', () => {
    const fallbackTemplate = `<!doctype html><html><head><title>Homepage fallback</title><meta name="description" content="Homepage"><meta property="og:title" content="Homepage"><meta property="og:description" content="Homepage"><meta property="og:url" content="https://ozelifkoja.ru/"><link rel="canonical" href="https://ozelifkoja.ru/"></head><body><div id="root"></div></body></html>`
    const landing = getCatalogSeoLandingByPath('/odejnayakozha/vintazhnaya')
    const html = renderCatalogSeoLandingPage(fallbackTemplate, landing, [{
      name: 'Vintage Test',
      slug: 'vintage-test',
      url: '/odejnayakozha/tproduct/999-vintage-test',
      attributes: { subtype: ['Винтажная'], color: 'Brown' },
      variants: [{ isActive: true, price: 150, currency: 'RUB', unit: 'дм²' }],
    }])

    expect(html.match(/<h1\b/gi)).toHaveLength(1)
    expect(html).toContain('<h1>Винтажная натуральная кожа</h1>')
    expect(html).toContain('<title>Купить винтажную натуральную кожу в Москве | OZELIF</title>')
    expect(html.match(/<meta name="description"/gi)).toHaveLength(1)
    expect(html).toContain('<meta property="og:url" content="https://ozelifkoja.ru/odejnayakozha/vintazhnaya" />')
    expect(html).toContain('<a href="/odejnayakozha/tproduct/999-vintage-test">Vintage Test</a>')
  })

})
