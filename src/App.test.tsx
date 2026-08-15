// @vitest-environment jsdom
import { render, screen } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import { beforeAll, describe, expect, it, vi} from 'vitest'
import { App } from './App'

beforeAll(() => vi.stubGlobal('IntersectionObserver', class { observe() {} unobserve() {} disconnect() {} }))

describe('homepage', () => {
  it('renders the core offer, catalogue action and verified reviews fallback', async () => {
    render(<App/>)


    await vi.dynamicImportSettled()

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Кожа, которая')
    expect(screen.getAllByRole('link', { name: 'О компании' })[0]).toHaveAttribute('href', '/kozhaozelif')
    expect(screen.getAllByRole('link', { name: 'О компании' }).at(-1)).toHaveAttribute('href', '/kozhaozelif')
    expect(screen.getAllByRole('link', { name: 'Оптовикам' })[0]).toHaveAttribute('href', '/kozhaoptom')
    expect(screen.getByRole('link', { name: /Условия для опта/i })).toHaveAttribute('href', '/kozhaoptom')
    expect(screen.getAllByRole('link', { name: /Перейти в каталог/i }).length).toBeGreaterThan(0)
    const excerpt = await screen.findByText('«Очень хороший магазин, отзывчивые и профессиональные сотрудники.»')
    expect(excerpt).toBeInTheDocument()
    expect(excerpt.closest('a')).toHaveAttribute('href', 'https://yandex.ru/maps/org/ozelif_kozha/242632009920/reviews/')
  })
})
