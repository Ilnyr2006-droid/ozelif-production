import { describe, expect, it } from 'vitest'
import type { PublicCatalogProduct } from '../api/publicCatalog'
import {
  getCatalogSeoLanding,
  matchesCatalogSeoLandingProduct,
} from './catalogSeoLandings'

const product = (
  subtype: string,
): PublicCatalogProduct => ({
  id: `p-${subtype}`,
  slug: 'product',
  category: null,
  title: 'Product',
  description: null,
  article: null,
  subtype: [subtype],
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
})

describe('Tier-2 frontend SEO cluster matchers', () => {
  it('matches smooth leather from subtype', () => {
    const config = getCatalogSeoLanding(
      '/odejnayakozha/gladkaya',
    )

    expect(config).not.toBeNull()
    expect(
      matchesCatalogSeoLandingProduct(
        product('Гладкая'),
        config!,
      ),
    ).toBe(true)
    expect(
      matchesCatalogSeoLandingProduct(
        product('Фактурная'),
        config!,
      ),
    ).toBe(false)
  })

  it('matches textured leather from subtype', () => {
    const config = getCatalogSeoLanding(
      '/odejnayakozha/fakturnaya',
    )

    expect(config).not.toBeNull()
    expect(
      matchesCatalogSeoLandingProduct(
        product('Фактурная'),
        config!,
      ),
    ).toBe(true)
    expect(
      matchesCatalogSeoLandingProduct(
        product('Гладкая'),
        config!,
      ),
    ).toBe(false)
  })
})
