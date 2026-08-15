// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { ShearlingCatalogPage, ShearlingProductPage } from './components/ShearlingCatalogPage'
import { shearlingProducts } from './data/shearlingProducts'
import { formatProductPrice } from './utils/productPrice'
import { stubPublicCatalogApi } from './test/publicCatalogFixture'

const normalizedText = (value: string | null | undefined) => String(value ?? '').replace(/\s+/g, ' ').trim()

beforeAll(() => vi.stubGlobal('IntersectionObserver', class { observe() {} unobserve() {} disconnect() {} }))
beforeEach(() => { window.history.replaceState(null, '', '/dublyonka'); stubPublicCatalogApi('dublyonka', shearlingProducts) })
afterEach(cleanup)

describe('shearling catalog pricing', () => {
  it('uses the nested variant prices returned by the catalog API without per-card requests', async () => {
    const { container } = render(<ShearlingCatalogPage />)
    const firstProduct = shearlingProducts[0]

    expect(firstProduct.variants.some(variant => variant.priceRub !== null)).toBe(true)
    await waitFor(() => expect(container.querySelector('article.product-card')).not.toBeNull())
    const firstCard = container.querySelector('article.product-card')

    expect(
      Array.from(
        firstCard?.querySelectorAll('.product-card-price > span') ?? [],
      ).map(node => normalizedText(node.textContent)),
    ).toEqual([
      'от 1 207,4 ₽ за фут²',
      'от 130 ₽ за дм²',
    ])
    expect(container.querySelectorAll('article.product-card .product-card-price')).not.toHaveLength(0)
  })

  it('renders real variant prices in the catalog rather than the request-only label', async () => {
    render(<ShearlingCatalogPage />)
    const firstProduct = shearlingProducts[0]
    const title = await screen.findByRole('heading', { name: firstProduct.title })
    const productLink = title.closest('a')
    expect(productLink).toBeInTheDocument()
    expect(normalizedText(productLink?.textContent)).toContain('от')
    expect(formatProductPrice(firstProduct)).not.toBe('Цена по запросу')
  })

  it('keeps the corresponding product page price intact', async () => {
    const product = shearlingProducts.find(item => item.variants.some(variant => variant.priceRub !== null))!
    window.history.replaceState(null, '', `/dublyonka/tproduct/${product.id}-${product.slug}`)
    const { container } = render(<ShearlingProductPage />)
    await waitFor(() => expect(container.querySelector('.product-page-price')).not.toBeNull())
    expect(normalizedText(container.querySelector('.product-page-price')?.textContent)).toContain('₽')
  })
})
