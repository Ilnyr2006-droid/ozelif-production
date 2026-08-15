
import { describe, expect, it } from 'vitest'
import { getProductCardPriceLines } from './productPrice'

const normalizeUnit = (value: string | null | undefined) => value ?? null

describe('catalog card dual prices', () => {
  it('shows square foot above square decimeter', () => {
    expect(getProductCardPriceLines({ variants: [
      { priceRub: 429.17, unit: 'фут²', currency: 'RUB', priceSource: 'admin' },
    ] }, normalizeUnit, { categorySlug: 'odejnayakozha' })).toEqual([
      'от 429,2 ₽ за фут²',
      'от 46,2 ₽ за дм²',
    ])
  })

  it('uses per piece for hardware with an empty unit', () => {
    expect(getProductCardPriceLines({ variants: [
      { priceRub: 1207.4, unit: null, currency: 'RUB', priceSource: 'admin' },
    ] }, normalizeUnit, { categorySlug: 'furnitura' })).toEqual([
      'от 1 207,4 ₽ за шт.',
    ])
  })
})
