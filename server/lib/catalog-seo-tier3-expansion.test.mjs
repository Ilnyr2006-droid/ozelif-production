import { describe, expect, it } from 'vitest'
import {
  getCatalogSeoLandingByPath,
  matchesCatalogSeoLandingProduct,
} from './catalog-seo-landings.mjs'

describe('Tier-3 smooth suede SEO cluster', () => {
  it('registers the historical /zamsha/gladkaya route', () => {
    const landing = getCatalogSeoLandingByPath('/zamsha/gladkaya')

    expect(landing).toMatchObject({
      categorySlug: 'zamsha',
      parentPath: '/zamsha',
      title: 'Гладкая натуральная замша',
    })
  })

  it('matches smooth suede from subtype', () => {
    const landing = getCatalogSeoLandingByPath('/zamsha/gladkaya')

    expect(matchesCatalogSeoLandingProduct({
      name: 'Suede Purple',
      slug: 'suede-purple',
      description: null,
      attributes: { subtype: ['Гладкая'] },
    }, landing)).toBe(true)

    expect(matchesCatalogSeoLandingProduct({
      name: 'Suede Texture',
      slug: 'suede-texture',
      description: null,
      attributes: { subtype: ['Фактурная'] },
    }, landing)).toBe(false)
  })

  it('does not match description-only mentions', () => {
    const landing = getCatalogSeoLandingByPath('/zamsha/gladkaya')

    expect(matchesCatalogSeoLandingProduct({
      name: 'Suede Texture',
      slug: 'suede-texture',
      description: 'Гладкая натуральная замша',
      attributes: { subtype: ['Фактурная'] },
    }, landing)).toBe(false)
  })
})
