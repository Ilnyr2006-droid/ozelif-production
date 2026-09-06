// @vitest-environment jsdom
import { beforeEach, expect, it, vi } from 'vitest'
import { cartProducts, goal, purchase } from './metrika'
beforeEach(() => { localStorage.clear(); Object.assign(window, { ym: vi.fn(), dataLayer: [] }) })
it('does not count a request as a paid purchase', () => {
  expect(purchase({ order_id: '1', revenue: 100, products: [], status: 'new' })).toBe(false)
})
it('deduplicates purchases and whitelists product fields', () => {
  const order = { order_id: '1', revenue: 100, status: 'paid', products: [{ id: 'v1', name: 'Наппа', category: 'Кожа', price: 100, quantity: 1, email: 'private@example.ru' }] }
  expect(purchase(order)).toBe(true)
  expect(purchase(order)).toBe(false)
  const payload = JSON.stringify((window as unknown as { dataLayer: unknown[] }).dataLayer)
  expect(payload).not.toContain('private')
  expect(payload).toContain('RUB')
})
it('unknown price stays unknown and goals contain no details', () => {
  expect(cartProducts([{ productId: 'p', variantId: 'v', quantity: 2, addedAt: '', product: { title: 'Кожа', category: 'Кожа', categorySlug: 'odejnayakozha', image: null, href: '/' }, variant: null }])[0]).not.toHaveProperty('price')
  goal('click_phone')
  expect((window as unknown as { ym: unknown }).ym).toHaveBeenCalledWith(112275551, 'reachGoal', 'click_phone')
})
