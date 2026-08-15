import { describe, expect, it } from 'vitest'
import {
  getCatalogSeoLandingByPath,
  matchesCatalogSeoLandingProduct,
} from './catalog-seo-landings.mjs'

describe('Tier-2 commercial SEO cluster expansion', () => {
  it.each([
    ['/odejnayakozha/gladkaya', 'Гладкая натуральная кожа'],
    ['/odejnayakozha/fakturnaya', 'Фактурная натуральная кожа'],
  ])('registers %s', (path, title) => {
    expect(getCatalogSeoLandingByPath(path)?.title).toBe(title)
  })

  it('keeps smooth and textured subtype intent separate', () => {
    const smooth = getCatalogSeoLandingByPath(
      '/odejnayakozha/gladkaya',
    )
    const textured = getCatalogSeoLandingByPath(
      '/odejnayakozha/fakturnaya',
    )

    const smoothProduct = {
      name: 'Smooth Test',
      slug: 'smooth-test',
      attributes: { subtype: ['Гладкая'] },
    }

    const texturedProduct = {
      name: 'Texture Test',
      slug: 'texture-test',
      attributes: { subtype: ['Фактурная'] },
    }

    expect(
      matchesCatalogSeoLandingProduct(smoothProduct, smooth),
    ).toBe(true)
    expect(
      matchesCatalogSeoLandingProduct(smoothProduct, textured),
    ).toBe(false)

    expect(
      matchesCatalogSeoLandingProduct(texturedProduct, textured),
    ).toBe(true)
    expect(
      matchesCatalogSeoLandingProduct(texturedProduct, smooth),
    ).toBe(false)
  })

  it('does not match generic description text', () => {
    const smooth = getCatalogSeoLandingByPath(
      '/odejnayakozha/gladkaya',
    )

    expect(matchesCatalogSeoLandingProduct({
      name: 'Test',
      slug: 'test',
      description: 'Гладкая натуральная кожа',
      attributes: { subtype: ['Винтажная'] },
    }, smooth)).toBe(false)
  })
})
