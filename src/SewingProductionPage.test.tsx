// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import { beforeAll, describe, expect, it, vi } from 'vitest'
import { SewingProductionPage } from './components/SewingProductionPage'

beforeAll(() => vi.stubGlobal('IntersectionObserver', class { observe() {} unobserve() {} disconnect() {} }))

describe('sewing production page', () => {
  it('renders verified conditions, active navigation and form validation', () => {
    render(<SewingProductionPage/>)
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Швейное производство в Москве')
    expect(screen.getByText(/Минимальный объём — 10 изделий/i)).toBeInTheDocument()
    expect(screen.getByText(/индивидуальные заказы и единичные изделия/i)).toBeInTheDocument()
    expect(screen.getAllByRole('link', { name: 'Швейное производство' })[0]).toHaveAttribute('aria-current', 'page')
    expect(screen.getAllByRole('link', { name: '+7 (903) 370-78-54' })[0]).toHaveAttribute('href', 'tel:+79033707854')

    fireEvent.submit(screen.getByRole('button', { name: 'Обсудить производство' }).closest('form')!)
    expect(screen.getByText('Укажите имя.')).toBeInTheDocument()
    expect(screen.getByText('Укажите телефон.')).toBeInTheDocument()
  })
})
