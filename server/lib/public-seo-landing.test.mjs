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
})
