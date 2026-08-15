// @vitest-environment jsdom
import { render, screen, within } from '@testing-library/react'
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
    ).toHaveTextContent('Кожа, которая')

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
      screen.getAllByRole('link', { name: /Перейти в каталог/i }).length,
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
})
