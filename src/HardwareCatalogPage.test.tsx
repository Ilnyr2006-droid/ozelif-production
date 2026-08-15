
// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { App } from './App'
import { CartProvider } from './cart/CartProvider'
import {
  hardwareImportStatistics,
  hardwareProducts,
} from './data/hardwareProducts'
import { HardwareCatalogPage } from './components/HardwareCatalogPage'
import { stubPublicCatalogApi } from './test/publicCatalogFixture'

beforeAll(() => {
  vi.stubGlobal('IntersectionObserver', class {
    observe() {}
    unobserve() {}
    disconnect() {}
  })
})

beforeEach(() => {
  window.localStorage.clear()
  window.sessionStorage.clear()
  window.history.replaceState(null, '', '/furnitura')
  stubPublicCatalogApi('furnitura', hardwareProducts)
})

afterEach(cleanup)

describe('hardware catalog', () => {
  it('imports the complete source subset without lost products or variants', () => {
    expect(hardwareImportStatistics).toEqual({
      rows: 32,
      products: 16,
      variants: 16,
    })
    expect(hardwareProducts).toHaveLength(16)
    expect(hardwareProducts.every(product => product.image)).toBe(true)
    expect(hardwareProducts.every(product => product.variants.length === 1)).toBe(true)
  })

  it('renders products and filters buttons separately from zippers', async () => {
    render(
      <CartProvider>
        <HardwareCatalogPage />
      </CartProvider>,
    )

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Фурнитура')
    await waitFor(() => expect(document.querySelectorAll('.product-card > a')).toHaveLength(16))

    fireEvent.change(screen.getByLabelText('Тип'), {
      target: { value: 'Кнопки' },
    })

    expect(document.querySelectorAll('.product-card > a')).toHaveLength(1)
    expect(screen.getByRole('link', {
      name: /Кнопки YKK округленные/,
    })).toBeInTheDocument()
  })

  it('opens a local product route and adds its variant to the shared cart', async () => {
    const product = hardwareProducts[0]
    window.history.replaceState(
      null,
      '',
      `/furnitura/tproduct/${product.id}-${product.slug}`,
    )

    render(<App />)

    await waitFor(() => expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(product.title))

    fireEvent.click(screen.getByRole('button', { name: 'Добавить в корзину' }))

    expect(screen.getByRole('button', {
      name: 'Открыть корзину, товаров: 1',
    })).toBeInTheDocument()
  })
})
