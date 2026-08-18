// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import { beforeAll, describe, expect, it, vi } from 'vitest'
import { WholesalePage } from './components/WholesalePage'

beforeAll(() => vi.stubGlobal('IntersectionObserver', class { observe() {} unobserve() {} disconnect() {} }))

describe('wholesale page', () => {
  it('renders verified conditions, active navigation and accessible form validation', () => {
    render(<WholesalePage/>)
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Натуральная кожа оптом в Москве')
    expect(screen.getAllByText('1000 дм²').length).toBeGreaterThan(0)
    expect(screen.getByText(/одной пачки \/ 1000 дм²/i)).toBeInTheDocument()
    expect(screen.getAllByRole('link', { name: 'Оптовикам' })[0]).toHaveAttribute('aria-current', 'page')
    expect(screen.getAllByRole('link', { name: '+7 (960) 881-87-25' })[0]).toHaveAttribute('href', 'tel:+79608818725')

    fireEvent.submit(screen.getByRole('button', { name: 'Получить оптовые условия' }).closest('form')!)
    expect(screen.getByText('Укажите имя.')).toBeInTheDocument()
    expect(screen.getByText('Укажите телефон.')).toBeInTheDocument()
  })
})
