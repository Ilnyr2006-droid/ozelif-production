import { describe, expect, it } from 'vitest'
import {
  getCatalogSeoLandingByPath,
  matchesCatalogSeoLandingProduct,
} from './catalog-seo-landings.mjs'

describe('Tier-1 commercial SEO cluster expansion', () => {
  it.each([
    ['/odejnayakozha/vintazhnaya', 'Винтажная натуральная кожа'],
    ['/odejnayakozha/nappa', 'Натуральная кожа Наппа'],
    ['/dublyonka/merinos', 'Дублёночный материал Меринос'],
    ['/dublyonka/tigrado', 'Дублёночный материал Тиградо'],
    ['/furnitura/ykk', 'Молнии YKK'],
  ])('registers %s', (path, title) => {
    expect(getCatalogSeoLandingByPath(path)?.title).toBe(title)
  })

  it('matches Nappa by coating without matching generic descriptions', () => {
    const landing = getCatalogSeoLandingByPath('/odejnayakozha/nappa')

    expect(matchesCatalogSeoLandingProduct({
      name: 'Naturel',
      slug: 'naturel',
      description: 'Общий текст про Наппа',
      attributes: { subtype: ['Гладкая'], coating: 'Наппа' },
    }, landing)).toBe(true)

    expect(matchesCatalogSeoLandingProduct({
      name: 'Naturel',
      slug: 'naturel',
      description: 'Общий текст про Наппа',
      attributes: { subtype: ['Гладкая'], coating: 'Матовый' },
    }, landing)).toBe(false)
  })

  it('matches YKK by structured brand', () => {
    const landing = getCatalogSeoLandingByPath('/furnitura/ykk')

    expect(matchesCatalogSeoLandingProduct({
      name: 'Молния 60 см',
      slug: 'molniya-60-sm',
      attributes: { subtype: ['Молнии'], brand: 'YKK' },
    }, landing)).toBe(true)

    expect(matchesCatalogSeoLandingProduct({
      name: 'Молния 60 см',
      slug: 'molniya-60-sm',
      attributes: { subtype: ['Молнии'], brand: 'Inox' },
    }, landing)).toBe(false)
  })
})
