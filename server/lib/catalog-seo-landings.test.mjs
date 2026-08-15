import { describe, expect, it } from 'vitest'
import {
  getCatalogSeoLandingByPath,
  matchesCatalogSeoLandingProduct,
} from './catalog-seo-landings.mjs'

describe('catalog SEO landing matcher', () => {
  it('matches subtype, name and slug but never generic description text', () => {
    const kerli = getCatalogSeoLandingByPath('/dublyonka/kerli')

    expect(matchesCatalogSeoLandingProduct({
      name: 'Merinos Black',
      slug: 'merinos-black',
      description: 'Меринос, Тоскана, Кёрли и другие виды',
      attributes: { subtype: ['Меринос'] },
    }, kerli)).toBe(false)

    expect(matchesCatalogSeoLandingProduct({
      name: 'Kyorli Brown',
      slug: 'kyorli-brown',
      attributes: { subtype: [] },
    }, kerli)).toBe(true)
  })

  it('normalizes ё and matches KRS by structured subtype', () => {
    const krs = getCatalogSeoLandingByPath('/odejnayakozha/krs')
    const kerli = getCatalogSeoLandingByPath('/dublyonka/kerli')

    expect(matchesCatalogSeoLandingProduct({
      name: 'Corea',
      slug: 'corea',
      attributes: { subtype: ['КРС'] },
    }, krs)).toBe(true)

    expect(matchesCatalogSeoLandingProduct({
      name: 'Овчина Керли',
      slug: 'ovchina-kerli',
      attributes: { subtype: [] },
    }, kerli)).toBe(true)
  })
})
