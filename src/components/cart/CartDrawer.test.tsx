// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { CartProvider, useCart } from '../../cart/CartProvider'
import { getAllProducts } from '../../data/catalogIndex'
import { Header } from '../Header'
import { CartDrawer } from './CartDrawer'

const [product] = getAllProducts()
const [variant] = product.variants

function Fixture() {
  const { addItem } = useCart()
  const snapshot = { product: { title: product.title, href: product.href, category: product.category, categorySlug: 'odejnayakozha' as const, image: product.image }, variant: { title: variant.title, shade: variant.shade, unit: variant.unit, priceRub: variant.priceRub, oldPriceRub: variant.oldPriceRub, currency: variant.currency, priceSource: variant.priceSource } }
  return <>
    <button type="button" onClick={() => addItem({ productId: product.id, variantId: variant.id, snapshot })}>Добавить тестовый товар</button>
    <Header />
    <CartDrawer />
  </>
}

function renderCartUi() {
  return render(<CartProvider><Fixture /></CartProvider>)
}

beforeEach(() => {
  window.localStorage.clear()
  vi.spyOn(window, 'open').mockImplementation(() => null)
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ ok: true, publicNumber: '1048', telegramDeepLink: null }) }))
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('Cart drawer UI', () => {
  it('shows a header badge and opens the drawer', () => {
    renderCartUi()
    fireEvent.click(screen.getByText('Добавить тестовый товар'))
    const cartButton = screen.getByRole('button', { name: 'Открыть корзину, товаров: 1' })
    expect(cartButton).toHaveTextContent('1')
    fireEvent.click(cartButton)
    expect(screen.getByRole('dialog', { name: 'Корзина' })).toBeInTheDocument()
  })

  it('closes on Escape and restores focus to the opener', () => {
    renderCartUi()
    const cartButton = screen.getByRole('button', { name: 'Открыть корзину, товаров: 0' })
    cartButton.focus()
    fireEvent.click(cartButton)
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(cartButton).toHaveFocus()
  })

  it('updates quantity and removes a cart item', () => {
    renderCartUi()
    fireEvent.click(screen.getByText('Добавить тестовый товар'))
    fireEvent.click(screen.getByRole('button', { name: 'Открыть корзину, товаров: 1' }))
    fireEvent.click(screen.getByRole('button', { name: 'Увеличить количество' }))
    expect(screen.getByLabelText(`Количество: ${product.title}`)).toHaveValue(2)
    fireEvent.click(screen.getByRole('button', { name: `Удалить ${product.title} из корзины` }))
    expect(screen.getByText('Корзина пока пуста')).toBeInTheDocument()
  })

  it('builds an encoded WhatsApp request and only opens Telegram after a click', async () => {
    renderCartUi()
    fireEvent.click(screen.getByText('Добавить тестовый товар'))
    fireEvent.click(screen.getByRole('button', { name: 'Открыть корзину, товаров: 1' }))
    fireEvent.change(screen.getByLabelText('Телефон'), { target: { value: '+7 999 000-00-00' } })
    fireEvent.click(screen.getByRole('checkbox', { name: /Я согласен на обработку/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Оформить заявку' }))
    await screen.findByText('Заявка принята')
    const whatsappLink = screen.getByRole('link', { name: 'Отправить в WhatsApp' })
    expect(whatsappLink.getAttribute('href')).toContain(encodeURIComponent('Здравствуйте! Хочу уточнить наличие и оформить заказ.'))
    expect(window.open).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Открыть Telegram' }))
    await waitFor(() => expect(window.open).toHaveBeenCalledTimes(1))
    expect(screen.getByRole('status')).toHaveTextContent('Текст заявки скопирован')
  })

  it('keeps the cart and reports an API error without marking the request sent', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, json: async () => ({ error: 'Материал временно недоступен' }) }))
    renderCartUi()
    fireEvent.click(screen.getByText('Добавить тестовый товар'))
    fireEvent.click(screen.getByRole('button', { name: 'Открыть корзину, товаров: 1' }))
    fireEvent.change(screen.getByLabelText('Телефон'), { target: { value: '+7 999 000-00-00' } })
    fireEvent.click(screen.getByRole('checkbox', { name: /Я согласен на обработку/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Оформить заявку' }))
    await screen.findByRole('alert')
    expect(screen.getByRole('alert')).toHaveTextContent('Материал временно недоступен')
    expect(screen.getByText(product.title)).toBeInTheDocument()
    expect(screen.queryByText('Заявка принята')).not.toBeInTheDocument()
  })

  it('submits when crypto.randomUUID is unavailable', async () => {
    vi.stubGlobal('crypto', {
      getRandomValues: (bytes: Uint8Array) => {
        bytes.fill(1)
        return bytes
      },
    })
    renderCartUi()
    fireEvent.click(screen.getByText('Добавить тестовый товар'))
    fireEvent.click(screen.getByRole('button', { name: 'Открыть корзину, товаров: 1' }))
    fireEvent.change(screen.getByLabelText('Телефон'), { target: { value: '+7 999 000-00-00' } })
    fireEvent.click(screen.getByRole('checkbox', { name: /Я согласен на обработку/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Оформить заявку' }))
    await screen.findByText('Заявка принята')
    const checkoutCall = (fetch as unknown as ReturnType<typeof vi.fn>).mock.calls.find(([url]) => url === '/api/orders/checkout')
    expect(checkoutCall).toBeTruthy()
    expect(JSON.parse(checkoutCall![1].body).idempotencyKey).toMatch(/^[0-9a-f-]{36}$/)
  })

  it('reuses one idempotency key after a network retry and clears only after 2xx', async () => {
    let checkoutAttempts = 0
    const request = vi.fn((...args: [string, RequestInit?]) => {
      const [url] = args
      if (url !== '/api/orders/checkout') return Promise.resolve({ ok: true, json: async () => ({}) })
      checkoutAttempts += 1
      if (checkoutAttempts === 1) return Promise.reject(new Error('Сеть недоступна'))
      return Promise.resolve({ ok: true, json: async () => ({ ok: true, publicNumber: '1048', telegramDeepLink: null }) })
    })
    vi.stubGlobal('fetch', request)
    renderCartUi()
    fireEvent.click(screen.getByText('Добавить тестовый товар'))
    fireEvent.click(screen.getByRole('button', { name: 'Открыть корзину, товаров: 1' }))
    fireEvent.change(screen.getByLabelText('Телефон'), { target: { value: '+7 999 000-00-00' } })
    fireEvent.click(screen.getByRole('checkbox', { name: /Я согласен на обработку/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Оформить заявку' }))
    await screen.findByRole('alert')
    expect(screen.getByText(product.title)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Оформить заявку' }))
    await screen.findByText('Заявка принята')
    const checkoutBodies = request.mock.calls
      .filter(([url]) => url === '/api/orders/checkout')
      .map(([, init]) => JSON.parse((init as RequestInit).body as string))
    expect(checkoutBodies).toHaveLength(2)
    expect(checkoutBodies[0].idempotencyKey).toBe(checkoutBodies[1].idempotencyKey)
  })
})
