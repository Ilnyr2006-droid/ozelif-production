import { describe, expect, it } from 'vitest'
import {
  classifyContactLink,
  sanitizeCatalogQuery,
} from './track'

describe('catalog analytics privacy helpers', () => {
  it('keeps a normal catalog query and normalizes whitespace', () => {
    expect(sanitizeCatalogQuery('  коричневая   замша  '))
      .toBe('коричневая замша')
  })

  it('does not collect phone numbers, email addresses or URLs', () => {
    expect(sanitizeCatalogQuery('+7 (999) 123-45-67')).toBeNull()
    expect(sanitizeCatalogQuery('client@example.com')).toBeNull()
    expect(sanitizeCatalogQuery('https://example.com')).toBeNull()
  })

  it('classifies only supported contact actions', () => {
    expect(classifyContactLink('https://wa.me/79990000000')).toBe('whatsapp')
    expect(classifyContactLink('https://t.me/ozelif')).toBe('telegram')
    expect(classifyContactLink('tel:+79990000000')).toBe('phone')
    expect(classifyContactLink('https://yandex.ru/maps/213/moscow', 'Построить маршрут')).toBe('route')
    expect(classifyContactLink('/catalog', 'Каталог')).toBeNull()
  })
})
