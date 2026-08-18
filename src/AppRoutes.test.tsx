// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { App } from './App'
import { shearlingProducts } from './data/shearlingProducts'
import { stubPublicCatalogApi } from './test/publicCatalogFixture'

beforeAll(() => vi.stubGlobal('IntersectionObserver', class { observe() {} unobserve() {} disconnect() {} }))
beforeAll(() => vi.stubGlobal('scrollTo', vi.fn()))
beforeEach(() => {
  window.localStorage.clear()
  window.sessionStorage.clear()
  window.history.replaceState(null, '', '/')
  stubPublicCatalogApi('dublyonka', shearlingProducts)
})
afterEach(cleanup)

describe('application routes', () => {
  it('renders a newly published API category and its UUID product URL without a route-specific frontend change', async () => {
    const product = {
      id: '123e4567-e89b-12d3-a456-426614174000',
      slug: 'novyi-material',
      title: 'Новый материал',
      image: '/images/hero-leather.jpg',
      subtype: 'Новинка',
      variants: [{ id: 'variant-1', title: 'Основной вариант', unit: 'шт.', shade: null, shadeHex: null, priceRub: 1000, oldPriceRub: null, currency: 'RUB' as const }],
    }
    stubPublicCatalogApi('novaya-kategoriya', [product], { name: 'Новая категория', description: 'Материалы новой категории' })
    window.history.replaceState(null, '', '/novaya-kategoriya')
    const { unmount } = render(<App />)
    await waitFor(() => expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Новая категория'), { timeout: 10_000 })
    unmount()
    cleanup()

    window.history.replaceState(null, '', `/novaya-kategoriya/tproduct/${product.id}-${product.slug}`)
    render(<App />)
    await waitFor(() => expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Новый материал'), { timeout: 10_000 })
    cleanup()
  })

  it.each([
    ['/', /Натуральная кожа.*Москве/],
    ['/kozhaozelif', /Натуральная кожа.*2011 года/],
    ['/kozhaoptom', /Натуральная кожа.*брендов и производств/],
    ['/production', /Швейное производство.*Москве/],
    ['/odejnayakozha', /Одежная кожа/],
    ['/odejnayakozha/tproduct/814535079882-vegetale-visky', /Загружаем товар/],
    ['/dublyonka', /Дублёночный материал/],
    ['/galantereynayakozha', /Натуральная галантерейная кожа/],
    [`/dublyonka/tproduct/${shearlingProducts[0].id}-${shearlingProducts[0].slug}`, new RegExp(shearlingProducts[0].title)],
    ['/sale', /Товары.*скидкой/],
    ['/delivery', /Доставка.*оплата/],
    ['/info', /Доставка.*оплата/],
    ['/contacts', /Контакты.*шоурум/],
  ])('renders %s', async (path, heading) => {
    window.history.replaceState(null, '', path)
    render(<App />)
    await waitFor(() => expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(heading))
  })
})
