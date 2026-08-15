// @vitest-environment jsdom
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { getAllProducts } from '../data/catalogIndex'
import { CartProvider, getCartConfirmedSubtotal, getCartSummary, getCartUnpricedItemsCount, useCart } from './CartProvider'

const [product] = getAllProducts()
const [firstVariant, secondVariant] = product.variants

function Controls() {
  const cart = useCart()
  const snapshotFor = (variant: typeof firstVariant) => ({ product: { title: product.title, href: product.href, category: product.category, categorySlug: 'odejnayakozha' as const, image: product.image }, variant: { title: variant.title, shade: variant.shade, unit: variant.unit, priceRub: variant.priceRub, oldPriceRub: variant.oldPriceRub, currency: variant.currency, priceSource: variant.priceSource } })
  return <><output data-testid="items">{JSON.stringify(cart.items)}</output><output data-testid="count">{cart.itemCount}</output><button onClick={() => cart.addItem({ productId: product.id, variantId: firstVariant.id, snapshot: snapshotFor(firstVariant) })}>add</button><button onClick={() => cart.addItem({ productId: product.id, variantId: secondVariant.id, snapshot: snapshotFor(secondVariant) })}>add-other</button><button onClick={() => cart.addItem({ productId: 'missing', variantId: 'missing' })}>add-invalid</button><button onClick={() => cart.updateQuantity(product.id, firstVariant.id, 5000)}>max</button><button onClick={() => cart.removeItem(product.id, firstVariant.id)}>remove</button><button onClick={cart.clearCart}>clear</button></>
}
const renderCart = () => render(<CartProvider><Controls/></CartProvider>)

beforeEach(() => window.localStorage.clear())
afterEach(cleanup)

describe('CartProvider', () => {
  it('starts empty and rejects unknown product ids', () => {
    renderCart()
    expect(screen.getByTestId('count')).toHaveTextContent('0')
    fireEvent.click(screen.getByText('add-invalid'))
    expect(screen.getByTestId('count')).toHaveTextContent('0')
  })
  it('adds items, merges equal variants and keeps different variants separate', () => {
    renderCart(); fireEvent.click(screen.getByText('add')); fireEvent.click(screen.getByText('add'))
    expect(screen.getByTestId('count')).toHaveTextContent('2')
    fireEvent.click(screen.getByText('add-other'))
    expect(JSON.parse(screen.getByTestId('items').textContent ?? '[]')).toHaveLength(2)
  })
  it('limits and updates quantity, removes and clears positions', () => {
    renderCart(); fireEvent.click(screen.getByText('add')); fireEvent.click(screen.getByText('max'))
    expect(screen.getByTestId('count')).toHaveTextContent('999')
    fireEvent.click(screen.getByText('remove')); expect(screen.getByTestId('count')).toHaveTextContent('0')
    fireEvent.click(screen.getByText('add-other')); fireEvent.click(screen.getByText('clear')); expect(screen.getByTestId('count')).toHaveTextContent('0')
  })
  it('persists valid positions and drops corrupted storage', () => {
    const first = renderCart(); fireEvent.click(screen.getByText('add')); first.unmount()
    renderCart(); expect(screen.getByTestId('count')).toHaveTextContent('1')
    cleanup(); window.localStorage.setItem('ozelif-cart-v1', '{broken')
    renderCart(); expect(screen.getByTestId('count')).toHaveTextContent('0')
  })
  it('counts only confirmed current prices', () => {
    const priced = product.variants.find(variant => variant.priceRub !== null && variant.currency === 'RUB' && variant.priceSource !== 'unverified')!
    const snapshot = { product: { title: product.title, href: product.href, category: product.category, categorySlug: 'odejnayakozha', image: product.image }, variant: { title: priced.title, shade: priced.shade, unit: priced.unit, priceRub: priced.priceRub, oldPriceRub: priced.oldPriceRub, currency: priced.currency, priceSource: priced.priceSource } }
    const items = [{ productId: product.id, variantId: priced.id, quantity: 2, addedAt: '', ...snapshot }, { productId: product.id, variantId: 'unknown-variant', quantity: 1, addedAt: '', product: snapshot.product, variant: { ...snapshot.variant, priceRub: null, priceSource: 'unverified' } }]
    expect(getCartConfirmedSubtotal(items)).toBe(priced.priceRub! * 2)
    expect(getCartUnpricedItemsCount(items)).toBe(1)
    expect(getCartSummary(items).itemCount).toBe(3)
  })
})
