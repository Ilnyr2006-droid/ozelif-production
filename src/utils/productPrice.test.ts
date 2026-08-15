import { describe, expect, it } from 'vitest'
import { formatProductPrice, getProductPriceDisplay, getSourcePrice } from './productPrice'

describe('catalog product price display', () => {
  it('uses the valid main price when a product has no variants', () => {
    expect(formatProductPrice({ priceRub: 3500, currency: 'RUB' })).toBe('3 500 ₽')
  })

  it('uses a single valid variant price when the main price is missing', () => {
    expect(formatProductPrice({ variants: [{ priceRub: 3500, currency: 'RUB' }] })).toBe('3 500 ₽')
  })

  it('shows an exact price when all available variants have the same price', () => {
    expect(formatProductPrice({ variants: [{ priceRub: 3500 }, { price: '3500' }] })).toBe('3 500 ₽')
  })

  it('shows the lowest valid price with the from prefix for different variants', () => {
    expect(formatProductPrice({ variants: [{ priceRub: 4900 }, { priceRub: 3500 }] })).toBe('от 3 500 ₽')
  })

  it('uses the request label only when no valid price exists', () => {
    expect(formatProductPrice({ variants: [{ priceRub: null }, { price: '' }] })).toBe('Цена по запросу')
  })

  it('normalizes numeric strings and rejects zero, negative and invalid values', () => {
    expect(getSourcePrice({ price: '3 500,5' })).toBe(3500.5)
    expect(getSourcePrice({ price: 0 })).toBeNull()
    expect(getSourcePrice({ price: '-10' })).toBeNull()
    expect(getSourcePrice({ price: 'нет цены' })).toBeNull()
  })

  it('uses a priced variant when another variant has no price', () => {
    expect(formatProductPrice({ variants: [{ priceRub: null }, { priceRub: 3500 }] })).toBe('3 500 ₽')
  })

  it('does not use hidden, deleted or inactive variants', () => {
    expect(formatProductPrice({ variants: [{ priceRub: 1000, hidden: true }, { priceRub: 2000, active: false }, { priceRub: 3500 }] })).toBe('3 500 ₽')
  })

  it('lets an explicit request-only flag override calculated prices', () => {
    expect(getProductPriceDisplay({ price_on_request: true, variants: [{ priceRub: 3500 }] })).toEqual({ kind: 'on-request', price: null, unit: null })
  })

  it('recalculates the label when a loader supplies variant data', () => {
    let payload = { variants: [{ priceRub: null as number | null }] }
    expect(formatProductPrice(payload)).toBe('Цена по запросу')

    payload = { variants: [{ priceRub: 3500 }] }
    expect(formatProductPrice(payload)).toBe('3 500 ₽')
  })
})
