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
  slug: 'suede-product',
  category: null,
  title: 'Suede product',
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

describe('Tier-3 frontend smooth suede matcher', () => {
  it('matches smooth and excludes textured suede', () => {
    const config = getCatalogSeoLanding('/zamsha/gladkaya')

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
})
