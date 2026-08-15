// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ClothingLeatherCatalogPage, ClothingLeatherProductPage } from './components/ClothingLeatherCatalogPage'
import { CartProvider } from './cart/CartProvider'
import { clothingLeatherProducts } from './data/clothingLeatherProducts'

const fixture = clothingLeatherProducts[0]
const fixtureVariant = fixture.variants[0]
const toApiProduct = (product: typeof fixture) => ({
  id: product.id,
  slug: product.slug,
  name: product.title,
  description: null,
  article: product.article,
  price: null,
  oldPrice: null,
  currency: 'RUB',
  unit: product.unit,
  minOrder: product.minimumOrder,
  attributes: {
    subtype: product.subtype,
    material: product.material,
    color: product.color,
    normalizedColor: product.normalizedColor,
    thickness: product.thickness,
    grade: product.grade,
    hideSize: product.hideSize,
    coating: product.coating,
    origin: product.origin,
    country: product.country,
    portion: product.portion,
  },
  primaryImage: product.image ? { url: product.image.card.src, alt: product.image.alt, sortOrder: 0 } : null,
  images: product.images.map((image, index) => ({ url: image.card.src, alt: image.alt, sortOrder: index })),
  variants: product.variants.map(variant => ({
    id: variant.id,
    legacyId: variant.id,
    name: variant.title,
    sku: variant.externalId,
    price: variant.priceRub,
    oldPrice: variant.oldPriceRub,
    currency: variant.currency,
    unit: variant.unit,
    attributes: { shade: variant.shade, shadeHex: variant.shadeHex },
    isActive: true,
  })),
})
const fixtureProducts = clothingLeatherProducts.map(toApiProduct)

function mockCatalogApi() {
  return vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input)
    if (url.endsWith('/api/public/catalog/v1/categories')) {
      return new Response(JSON.stringify({ items: [] }), { status: 200 })
    }
    const detailId = url.match(/\/products\/([^?]+)/)?.[1]
    if (detailId) {
      const item = fixtureProducts.find(product => product.id === decodeURIComponent(detailId))
      return new Response(JSON.stringify(item ? { item } : {}), { status: item ? 200 : 404 })
    }
    if (url.includes('/api/public/catalog/v1/categories/odejnayakozha/products')) {
      const parsed = new URL(url, window.location.origin)
      const limit = Number(parsed.searchParams.get('limit') ?? 24)
      const offset = Number(parsed.searchParams.get('offset') ?? 0)
      return new Response(JSON.stringify({
        category: { slug: 'odejnayakozha', name: 'Одежная кожа' },
        pagination: { limit, offset, total: fixtureProducts.length, hasMore: offset + limit < fixtureProducts.length },
        items: fixtureProducts.slice(offset, offset + limit),
      }), { status: 200 })
    }
    return new Response('{}', { status: 404 })
  })
}

beforeEach(() => {
  vi.stubGlobal('IntersectionObserver', class { observe() {} unobserve() {} disconnect() {} })
  window.history.replaceState(null, '', '/odejnayakozha')
  window.localStorage.clear()
  vi.stubGlobal('fetch', mockCatalogApi())
})
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('clothing leather catalog public API', () => {
  it('loads cards and prices from the Public Catalog API', async () => {
    render(<ClothingLeatherCatalogPage/>)

    expect(screen.getByText('Загружаем каталог')).toBeInTheDocument()
    expect(await screen.findByRole('link', { name: `Подробнее: ${fixture.title}` })).toHaveAttribute('href', `/odejnayakozha/tproduct/${fixture.id}-${fixture.slug}`)
    expect(screen.getByText('88 из 88 товаров')).toBeInTheDocument()
    expect(screen.getAllByText(/от 431,2 ₽ за фут²/).length).toBeGreaterThan(0)
    expect(fetch).toHaveBeenCalledWith(expect.stringContaining('/api/public/catalog/v1/categories/odejnayakozha/products?limit=48&offset=0'), expect.any(Object))
  })

  it('shows confirmed supplier facts without the obsolete manufacturing claim', async () => {
    render(<ClothingLeatherCatalogPage/>)

    expect(await screen.findByRole('heading', { name: /Одежная кожа для пошива/ })).toBeInTheDocument()
    expect(screen.getAllByText(/Овчина/).length).toBeGreaterThan(0)
    expect(screen.getByText(/От 0,5 до 1 мм по данным карточек каталога/)).toBeInTheDocument()
    expect(document.body).toHaveTextContent('OZELIF поставляет натуральную одежную кожу')
    expect(document.body).not.toHaveTextContent('Мы производим кожу')
    expect(document.body).not.toHaveTextContent('шкур коз')
  })

  it('loads all 88 products and 176 active variants from paginated API fixtures', async () => {
    const { container } = render(<ClothingLeatherCatalogPage/>)

    await screen.findByRole('link', { name: `Подробнее: ${fixture.title}` })
    expect(fixtureProducts).toHaveLength(88)
    expect(fixtureProducts.flatMap(product => product.variants)).toHaveLength(176)
    expect(container.querySelectorAll('article.product-card')).toHaveLength(16)
    expect(fetch).toHaveBeenCalledWith(expect.stringContaining('limit=48&offset=48'), expect.any(Object))
  })

  it('keeps filters in the legacy catalog URL', async () => {
    render(<ClothingLeatherCatalogPage/>)
    await screen.findByRole('link', { name: `Подробнее: ${fixture.title}` })

    fireEvent.change(screen.getByPlaceholderText('Поиск по названию или артикулу'), { target: { value: fixture.title } })
    expect(window.location.search).toContain('q=')
  })

  it('filters by color and subtype and can reset API-loaded results', async () => {
    render(<ClothingLeatherCatalogPage/>)
    await screen.findByRole('link', { name: `Подробнее: ${fixture.title}` })

    fireEvent.change(screen.getByLabelText('Цвет'), { target: { value: 'Чёрный' } })
    expect(screen.getAllByText(/Найдено/)[0]).toHaveTextContent('22')
    fireEvent.change(screen.getByLabelText('Подкатегория'), { target: { value: 'Перфорированная' } })
    expect(window.location.search).toContain('subtype=')
    fireEvent.click(screen.getByRole('button', { name: 'Сбросить фильтры' }))
    expect(screen.getByText('88 из 88 товаров')).toBeInTheDocument()
    expect(window.location.search).toBe('')
  })

  it('opens and closes the accessible mobile filter drawer', async () => {
    render(<ClothingLeatherCatalogPage/>)
    await screen.findByRole('link', { name: `Подробнее: ${fixture.title}` })

    fireEvent.click(screen.getByRole('button', { name: 'Фильтры' }))
    expect(screen.getByRole('dialog', { name: 'Фильтры каталога' })).toBeInTheDocument()
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(screen.queryByRole('dialog', { name: 'Фильтры каталога' })).not.toBeInTheDocument()
  })

  it('uses local image URLs and keeps responsive srcset data in the API fixture audit source', async () => {
    render(<ClothingLeatherCatalogPage/>)
    const image = await screen.findByAltText('Vegetale Visky — натуральная одежная кожа')

    expect(image).toHaveAttribute('src', '/images/catalog/clothing-leather/814535079882/w480-v2.webp')
    expect(image.getAttribute('src')).not.toContain('tildacdn')
    expect(image.getAttribute('srcset')).toContain('/images/catalog/clothing-leather/814535079882/w720-v2.webp 720w')
    expect(fixture.image?.card.srcSet).toContain('/images/catalog/clothing-leather/814535079882/w720-v2.webp 720w')
  })

  it('shows an error state and retries the API request', async () => {
    const success = mockCatalogApi()
    let failCatalogOnce = true
    const failing = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url.includes('/api/public/catalog/v1/categories/odejnayakozha/products') && !url.match(/\/products\/[^?]+$/) && failCatalogOnce) {
        failCatalogOnce = false
        return new Response('{}', { status: 503 })
      }
      return success(input)
    })
    vi.stubGlobal('fetch', failing)
    render(<ClothingLeatherCatalogPage/>)

    expect(await screen.findByRole('alert')).toHaveTextContent('Не удалось загрузить каталог')
    fireEvent.click(screen.getByRole('button', { name: 'Повторить' }))
    expect(await screen.findByRole('link', { name: `Подробнее: ${fixture.title}` })).toBeInTheDocument()
  })
})

describe('clothing leather product page public API', () => {
  it('loads the old product URL and displays the API variant price', async () => {
    window.history.replaceState(null, '', `/odejnayakozha/tproduct/${fixture.id}-${fixture.slug}`)
    const { container } = render(<ClothingLeatherProductPage/>)

    expect(await screen.findByRole('heading', { name: fixture.title })).toBeInTheDocument()
    expect(container.querySelector('.product-page-price')).toHaveTextContent('431 ₽ за фут²')
    expect(fetch).toHaveBeenCalledWith(expect.stringContaining(`/products/${fixture.id}`), expect.any(Object))
  })

  it('switches API variants and publishes a confirmed RUB JSON-LD Offer', async () => {
    window.history.replaceState(null, '', `/odejnayakozha/tproduct/${fixture.id}-${fixture.slug}`)
    const { container } = render(<ClothingLeatherProductPage/>)

    await screen.findByRole('heading', { name: fixture.title })
    expect(container.querySelector('.product-page-price')).toHaveTextContent('431 ₽ за фут²')
    fireEvent.click(screen.getByRole('button', { name: /дм² · Оттенок коричневого/i }))
    expect(container.querySelector('.product-page-price')).toHaveTextContent('45,7 ₽ за дм²')
    const schemas = [...container.querySelectorAll('script[type="application/ld+json"]')].map(node => JSON.parse(node.textContent ?? '{}'))
    expect(schemas.some(schema => schema.offers?.priceCurrency === 'RUB' && schema.offers.price === 45.7)).toBe(true)
  })

  it('adds an API-loaded legacy product and variant to the existing localStorage cart', async () => {
    window.history.replaceState(null, '', `/odejnayakozha/tproduct/${fixture.id}-${fixture.slug}`)
    render(<CartProvider><ClothingLeatherProductPage/></CartProvider>)

    await screen.findByRole('heading', { name: fixture.title })
    fireEvent.click(screen.getByRole('button', { name: 'Добавить в корзину' }))
    await waitFor(() => expect(screen.getByRole('button', { name: 'В корзине' })).toBeInTheDocument())
    expect(window.localStorage.getItem('ozelif-cart-v1')).toContain(fixture.id)
    expect(window.localStorage.getItem('ozelif-cart-v1')).toContain(fixtureVariant.id)
  })
})
