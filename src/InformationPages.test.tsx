// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { App } from './App'

beforeAll(() => vi.stubGlobal('IntersectionObserver', class { observe() {} unobserve() {} disconnect() {} }))
beforeEach(() => window.history.replaceState(null, '', '/'))
afterEach(cleanup)

describe('information pages', () => {
  it('renders the local contacts route and keeps its footer link local', async () => {
    window.history.replaceState(null, '', '/contacts')
    render(<App />)

    await waitFor(() => expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(/Контакты.*шоурум/))
    expect(screen.getByRole('link', { name: 'Построить маршрут' })).toHaveAttribute('href', expect.stringContaining('yandex.ru/maps'))
    expect(screen.getAllByRole('link', { name: 'Контакты' }).at(-1)).toHaveAttribute('href', '/contacts')
    expect(screen.getByRole('link', { name: /Подобрать материал/i })).toHaveAttribute('href', '#contacts-team')
  })

  it('renders delivery on its new route and preserves the legacy info route', async () => {
    window.history.replaceState(null, '', '/delivery')
    const { unmount } = render(<App />)

    await waitFor(() => expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(/Доставка.*оплата/))
    expect(screen.getAllByRole('link', { name: 'Доставка и оплата' }).at(-1)).toHaveAttribute('href', '/delivery')
    unmount()

    window.history.replaceState(null, '', '/info')
    render(<App />)
    await waitFor(() => expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(/Доставка.*оплата/))
  })
})
