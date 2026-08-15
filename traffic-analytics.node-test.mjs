import test from 'node:test'
import assert from 'node:assert/strict'
import { createTrafficAnalyticsRepository } from './traffic-analytics.mjs'

test('returns current, daily and seven-day traffic metrics', async () => {
  const calls = []

  const repository = createTrafficAnalyticsRepository({
    query: async (sql, params) => {
      calls.push({ sql, params })

      if (calls.length === 1) {
        return {
          rows: [{
            online_now: 3,
            visitors_today: 12,
            page_views_today: 31,
            visitors_7d: 48,
            page_views_7d: 140,
          }],
        }
      }

      if (calls.length === 2) return {
        rows: [
          { date: '2026-07-26', visitors: 8, page_views: 20 },
          { date: '2026-07-27', visitors: 12, page_views: 31 },
        ],
      }

      return {
        rows: [
          { stage: 'Просмотр сайта', position: 1, sessions: 12 },
          { stage: 'Просмотр товара', position: 2, sessions: 8 },
          { stage: 'Добавление в корзину', position: 3, sessions: 4 },
          { stage: 'Начало оформления', position: 4, sessions: 2 },
          { stage: 'Заявка сохранена', position: 5, sessions: 1 },
        ],
      }
    },
  })

  const result = await repository.getTrafficAnalytics()

  assert.equal(result.summary.online_now, 3)
  assert.equal(result.summary.visitors_today, 12)
  assert.equal(result.daily.length, 2)
  assert.equal(result.funnel.length, 5)
  assert.equal(result.funnel[4].stage, 'Заявка сохранена')
  assert.match(calls[0].sql, /90 seconds/)
  assert.match(calls[1].sql, /generate_series/)
  assert.match(calls[2].sql, /checkout_success/)
  assert.deepEqual(calls[0].params, ['Europe/Moscow'])
  assert.deepEqual(calls[1].params, ['Europe/Moscow'])
  assert.deepEqual(calls[2].params, ['Europe/Moscow'])
  assert.ok(result.generatedAt)
})
