
import { describe, expect, it } from 'vitest'
import { getProductCardPriceLines } from './productPrice'

const normalizeUnit = (value: string | null | undefined) => value ?? null

describe('explicit dual unit prices', () => {
  it('uses both independently entered prices without conversion', () => {
    expect(getProductCardPriceLines({
      variants: [
        { priceRub: 430, unit: 'фут²', currency: 'RUB', priceSource: 'admin' },
        { priceRub: 47, unit: 'дм²', currency: 'RUB', priceSource: 'admin' },
      ],
    }, normalizeUnit, { categorySlug: 'odejnayakozha' })).toEqual([
      'от 430 ₽ за фут²',
      'от 47 ₽ за дм²',
    ])
  })

  it('keeps one line when the second price is absent', () => {
    expect(getProductCardPriceLines({
      variants: [
        { priceRub: 430, unit: 'фут²', currency: 'RUB', priceSource: 'admin' },
      ],
    }, normalizeUnit, { categorySlug: 'odejnayakozha' })).toEqual([
      'от 430 ₽ за фут²',
      'от 46,3 ₽ за дм²',
    ])
  })
})
