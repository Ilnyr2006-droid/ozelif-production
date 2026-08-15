// @vitest-environment jsdom
import { render, screen } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import { beforeAll, describe, expect, it, vi } from 'vitest'
import { AboutPage } from './components/AboutPage'

beforeAll(() => vi.stubGlobal('IntersectionObserver', class { observe() {} unobserve() {} disconnect() {} }))

describe('about page', () => {
  it('renders verified company facts, active navigation and contact details', async () => {
    render(<AboutPage/>)
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Работа с материалом')
    expect(screen.getAllByText(/с 2011/i).length).toBeGreaterThan(0)
    expect(screen.getByText('Краснобогатырская улица, 24')).toBeInTheDocument()
    expect(screen.getAllByRole('link', { name: 'О компании' })[0]).toHaveAttribute('aria-current', 'page')
    expect(screen.getByAltText('Натуральная кожа тёплых коричневых и бежевых оттенков')).toHaveAttribute('src', '/images/about-materials.webp')
    expect(screen.getByAltText('Натуральная кожа и дублёночный материал тёплых оттенков')).toHaveAttribute('src', '/images/about-supply.webp')
    expect(await screen.findByText('«Очень хороший магазин, отзывчивые и профессиональные сотрудники.»')).toBeInTheDocument()
  })
})
