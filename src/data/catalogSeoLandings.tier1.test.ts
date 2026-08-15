import { describe, expect, it } from 'vitest'
import type { PublicCatalogProduct } from '../api/publicCatalog'
import {
  getCatalogSeoLanding,
  matchesCatalogSeoLandingProduct,
} from './catalogSeoLandings'

const product = (
  patch: Partial<PublicCatalogProduct>,
): PublicCatalogProduct => ({
  id: 'p1',
  slug: 'product',
  category: null,
  title: 'Product',
  description: null,
  article: null,
  subtype: [],
  material: null,
  color: null,
  normalizedColor: null,
  thickness: null,
  grade: null,
  hideSize: null,
  country: null,
  coating: null,
  origin: null,
  minimumOrder: null,
  unit: null,
  portion: null,
  brand: null,
  tapeColor: null,
  metalColor: null,
  length: null,
  countryOfOrigin: null,
  image: null,
  gallery: [],
  variants: [],
  ...patch,
})

describe('Tier-1 frontend SEO cluster matchers', () => {
  it('matches Nappa from coating', () => {
    const config = getCatalogSeoLanding('/odejnayakozha/nappa')
    expect(config).not.toBeNull()
    expect(matchesCatalogSeoLandingProduct(
      product({ coating: 'Наппа' }),
      config!,
    )).toBe(true)
  })

  it('matches YKK from brand', () => {
    const config = getCatalogSeoLanding('/furnitura/ykk')
    expect(config).not.toBeNull()
    expect(matchesCatalogSeoLandingProduct(
      product({ brand: 'YKK' }),
      config!,
    )).toBe(true)
  })

  it('keeps Mеринос and Тиградо separate', () => {
    const merinos = getCatalogSeoLanding('/dublyonka/merinos')
    const tigrado = getCatalogSeoLanding('/dublyonka/tigrado')

    expect(matchesCatalogSeoLandingProduct(
      product({ subtype: ['Меринос'] }),
      merinos!,
    )).toBe(true)

    expect(matchesCatalogSeoLandingProduct(
      product({ subtype: ['Меринос'] }),
      tigrado!,
    )).toBe(false)
  })
})
