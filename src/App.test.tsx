// @vitest-environment jsdom
import { fireEvent, render, screen, within } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import { beforeAll, describe, expect, it, vi } from 'vitest'
import { App } from './App'

beforeAll(() => {
  vi.stubGlobal(
    'IntersectionObserver',
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
      takeRecords() { return [] }
      root = null
      rootMargin = '0px'
      thresholds = [0]
    },
  )
})

describe('homepage initial render', () => {
  it('renders the above-the-fold offer and navigation without requiring deferred content', async () => {
    render(<App/>)

    await vi.dynamicImportSettled()

    expect(
      screen.getByRole('heading', { level: 1 }),
    ).toHaveTextContent('Натуральная кожа')

    expect(
      screen.getAllByRole('link', { name: 'О компании' })[0],
    ).toHaveAttribute('href', '/kozhaozelif')

    expect(
      screen.getAllByRole('link', { name: 'О компании' }).at(-1),
    ).toHaveAttribute('href', '/kozhaozelif')

    expect(
      screen.getAllByRole('link', { name: 'Оптовикам' })[0],
    ).toHaveAttribute('href', '/kozhaoptom')

    expect(
      screen.getAllByRole('link', { name: /Смотреть каталог и цены/i }).length,
    ).toBeGreaterThan(0)

    // Business/reviews/contact are intentionally deferred below the fold.
    expect(
      screen.queryByRole('link', { name: /Условия для опта/i }),
    ).not.toBeInTheDocument()
  })

  it('does not duplicate the hero when the production prerender hero is already present', async () => {
    const prerenderHero = document.createElement('section')
    prerenderHero.dataset.homePrerenderHero = 'true'
    document.body.prepend(prerenderHero)

    try {
      const { container } = render(<App/>)
      await vi.dynamicImportSettled()

      expect(
        within(container).queryByRole('heading', { level: 1 }),
      ).not.toBeInTheDocument()
    } finally {
      prerenderHero.remove()
    }
  })
  it('removes the persistent homepage hero when SPA navigation leaves the homepage', async () => {
    window.history.replaceState(null, '', '/')

    const prerenderHero = document.createElement('section')
    prerenderHero.dataset.homePrerenderHero = 'true'
    document.body.prepend(prerenderHero)

    try {
      render(<App/>)
      await vi.dynamicImportSettled()

      expect(prerenderHero).toBeInTheDocument()

      fireEvent.click(
        screen.getAllByRole('link', { name: 'Оптовикам' })[0],
      )

      expect(window.location.pathname).toBe('/kozhaoptom')
      expect(prerenderHero).not.toBeInTheDocument()
    } finally {
      prerenderHero.remove()
      window.history.replaceState(null, '', '/')
    }
  })

})
