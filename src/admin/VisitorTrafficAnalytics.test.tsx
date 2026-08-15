// @vitest-environment jsdom

import { render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('./adminApiV2', () => ({
  adminApiV2: {
    trafficAnalytics: vi.fn().mockResolvedValue({
      summary: {
        online_now: 1,
        visitors_today: 12,
        page_views_today: 24,
        visitors_7d: 40,
        page_views_7d: 96,
      },
      daily: [],
      funnel: [],
      demand: {
        products: [{
          product_id: '814535079882',
          product_name: 'Cosmos Visky',
          category_name: 'Одежная кожа',
          category_slug: 'odejnayakozha',
          views: 18,
          viewers: 11,
          cart_adds: 4,
          requests: 0,
        }],
        categories: [{
          category_name: 'Одежная кожа',
          category_slug: 'odejnayakozha',
          views: 18,
          viewers: 11,
        }],
        filters: [{
          category_slug: 'odejnayakozha',
          filter: 'color',
          value: 'Коричневый',
          uses: 5,
          users: 3,
        }],
        emptySearches: [{
          category_slug: 'odejnayakozha',
          query: 'фиолетовая кожа',
          searches: 2,
          users: 2,
        }],
        contacts: [{
          channel: 'whatsapp',
          clicks: 7,
          users: 4,
        }],
      },
      generatedAt: '2026-08-12T10:00:00.000Z',
    }),
  },
}))

import { VisitorTrafficAnalytics } from './VisitorTrafficAnalytics'

afterEach(() => vi.clearAllMocks())

describe('VisitorTrafficAnalytics demand section', () => {
  it('shows catalog demand without treating a click as an order', async () => {
    const view = render(<VisitorTrafficAnalytics />)

    expect(await screen.findByText('Спрос на каталог')).toBeTruthy()
    expect(screen.getAllByText('Cosmos Visky').length).toBeGreaterThan(0)
    expect(screen.getByText('Без заявок')).toBeTruthy()
    expect(screen.getByText('Смотрят, но не оформляют')).toBeTruthy()
    expect(screen.getByText('Коричневый', { exact: false })).toBeTruthy()
    expect(screen.getByText('«фиолетовая кожа»')).toBeTruthy()
    expect(screen.getByText('WhatsApp')).toBeTruthy()

    view.unmount()
  })
})
