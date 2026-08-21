// @vitest-environment jsdom

import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('./adminApiV2', () => ({
  adminApiV2: {
    session: vi.fn().mockResolvedValue({
      user: {
        id: 'admin-1',
        email: 'admin@example.test',
        name: 'Администратор',
        role: 'owner',
      },
    }),
    catalogs: vi.fn().mockResolvedValue({ items: [] }),
    products: vi.fn().mockResolvedValue({ items: [] }),
    pricing: vi.fn().mockResolvedValue({ settings: null }),
    crmOrders: vi.fn().mockResolvedValue({
      items: [{
        id: 'order-1',
        public_number: '1048',
        status: 'new',
        total_amount: '431',
        currency: 'RUB',
        delivery_city: 'Москва',
        delivery_address: null,
        desired_delivery_date: null,
        customer_email_snapshot: null,
        customer_email: null,
        customer_comment: 'Позвонить перед подтверждением',
        source: 'website_cart',
        items_summary: 'Cosmos Visky — 1 фут²',
        delivery_method: 'pickup',
        delivery_company: null,
        tracking_number: null,
        created_at: '2026-08-21T10:00:00.000Z',
        updated_at: '2026-08-21T10:00:00.000Z',
        customer_name: 'Ильнур',
        original_phone: '+7 999 000-00-00',
      }],
      total: 1,
    }),
    crmCustomers: vi.fn().mockResolvedValue({ items: [] }),
    logout: vi.fn().mockResolvedValue(undefined),
  },
}))

import { AdminPageV2 } from './AdminPageV2'

afterEach(() => vi.clearAllMocks())

describe('AdminPageV2 mobile-friendly controls', () => {
  it('exposes an accessible drawer and labelled CRM order card fields', async () => {
    render(<AdminPageV2 />)

    const menu = await screen.findByRole('button', {
      name: 'Открыть меню',
    })

    fireEvent.click(menu)
    expect(menu.getAttribute('aria-expanded')).toBe('true')
    expect(screen.getByRole('button', {
      name: 'Закрыть меню',
    })).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Заказы' }))

    await waitFor(() => {
      expect(screen.getByText('№1048')).toBeTruthy()
    })

    expect(screen.getByText('Позвонить перед подтверждением')).toBeTruthy()
    expect(screen.getByRole('link', {
      name: '+7 999 000-00-00',
    }).getAttribute('href')).toBe('tel:+7 999 000-00-00')
    expect(document.querySelector('[data-label="Номер заказа"]')).toBeTruthy()
    expect(document.body.style.overflow).toBe('')
  })
})
