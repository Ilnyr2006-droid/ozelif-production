// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { App } from './App'
import { CartProvider } from './cart/CartProvider'
import { ShoeLeatherCatalogPage } from './components/ShoeLeatherCatalogPage'
import { shoeLeatherImportStatistics, shoeLeatherProducts } from './data/shoeLeatherProducts'
import { stubPublicCatalogApi } from './test/publicCatalogFixture'

beforeAll(() => vi.stubGlobal('IntersectionObserver', class { observe() {} unobserve() {} disconnect() {} }))
beforeEach(() => { window.localStorage.clear(); window.sessionStorage.clear(); window.history.replaceState(null, '', '/obuvnayakozha'); stubPublicCatalogApi('obuvnayakozha', shoeLeatherProducts) })
afterEach(cleanup)

describe('shoe leather catalog', () => {
  it('imports all source products and variants', () => {
    expect(shoeLeatherImportStatistics).toEqual({ rows: 4, products: 2, variants: 2 })
    expect(shoeLeatherProducts.every(product => product.image)).toBe(true)
  })

  it('renders and filters products by color', async () => {
    render(<CartProvider><ShoeLeatherCatalogPage /></CartProvider>)
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Натуральная кожа для пошива обуви')
    await waitFor(() => expect(document.querySelectorAll('.product-card > a')).toHaveLength(2))
    fireEvent.change(screen.getByLabelText('Цвет'), { target: { value: 'Красный' } })
    expect(document.querySelectorAll('.product-card > a')).toHaveLength(1)
  })

  it('opens a product route and adds its variant to cart', async () => {
    const product = shoeLeatherProducts[0]
    window.history.replaceState(null, '', `/obuvnayakozha/tproduct/${product.id}-${product.slug}`)
    render(<App />)
    await waitFor(() => expect(screen.getByRole('button', { name: 'Добавить в корзину' })).toBeInTheDocument())
    fireEvent.click(screen.getByRole('button', { name: 'Добавить в корзину' }))
    expect(screen.getByRole('button', { name: 'Открыть корзину, товаров: 1' })).toBeInTheDocument()
  })
})
