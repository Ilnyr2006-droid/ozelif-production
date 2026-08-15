// @vitest-environment jsdom

import { render, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AdminTrafficAnalytics } from './AdminTrafficAnalytics'
import { adminApiV2 } from './adminApiV2'

vi.mock('./adminApiV2', () => ({
  adminApiV2: {
    trafficAnalytics: vi.fn(),
  },
}))

describe('AdminTrafficAnalytics', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    vi.mocked(adminApiV2.trafficAnalytics).mockResolvedValue({
      summary: {
        online_now: 3,
        visitors_today: 12,
        page_views_today: 31,
        visitors_7d: 48,
        page_views_7d: 140,
      },
      daily: [
        {
          date: '2026-07-26',
          visitors: 8,
          page_views: 20,
        },
        {
          date: '2026-07-27',
          visitors: 12,
          page_views: 31,
        },
      ],
      funnel: [
        { stage: 'Просмотр сайта', position: 1, sessions: 12 },
        { stage: 'Просмотр товара', position: 2, sessions: 8 },
        { stage: 'Добавление в корзину', position: 3, sessions: 4 },
        { stage: 'Начало оформления', position: 4, sessions: 2 },
        { stage: 'Заявка сохранена', position: 5, sessions: 1 },
      ],
      generatedAt: '2026-07-27T10:00:00.000Z',
    })
  })

  it('shows online, daily and seven-day traffic', async () => {
    const { container } = render(<AdminTrafficAnalytics />)

    await waitFor(() => {
      expect(adminApiV2.trafficAnalytics).toHaveBeenCalled()
    })

    const metricCards = Array.from(
      container.querySelectorAll<HTMLElement>(
        '.admin-traffic-metrics article',
      ),
    )

    await waitFor(() => {
      expect(metricCards).toHaveLength(4)
    })

    expect(metricCards[0]?.textContent).toContain('Сейчас на сайте')
    expect(metricCards[0]?.textContent).toContain('3')

    expect(metricCards[1]?.textContent).toContain('Посетители сегодня')
    expect(metricCards[1]?.textContent).toContain('12')

    expect(metricCards[2]?.textContent).toContain('Просмотры сегодня')
    expect(metricCards[2]?.textContent).toContain('31')

    expect(metricCards[3]?.textContent).toContain('Посетители за 7 дней')
    expect(metricCards[3]?.textContent).toContain('48')
    expect(metricCards[3]?.textContent).toContain('140 просмотров')

    const chart = container.querySelector<HTMLElement>(
      '.admin-traffic-chart',
    )

    expect(chart).not.toBeNull()
    expect(chart?.textContent).toContain('Посетители и просмотры')
    expect(chart?.textContent).toContain('20')
    expect(chart?.textContent).toContain('31')

    const funnel = container.querySelector<HTMLElement>('.admin-traffic-funnel')
    expect(funnel?.textContent).toContain('Воронка заявки')
    expect(funnel?.textContent).toContain('Заявка сохранена')
    expect(funnel?.textContent).toContain('8% от просмотров сайта')
  })
})
