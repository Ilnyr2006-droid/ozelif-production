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

      if (sql.includes('generate_series')) return {
        rows: [
          { date: '2026-07-26', visitors: 8, page_views: 20 },
          { date: '2026-07-27', visitors: 12, page_views: 31 },
        ],
      }

      if (sql.includes('WITH stages')) return {
        rows: [
          { event_name: 'page_view', label: 'Посетили сайт', sessions: 12 },
          { event_name: 'product_view', label: 'Открыли товар', sessions: 8 },
          { event_name: 'add_to_cart', label: 'Добавили в корзину', sessions: 4 },
          { event_name: 'checkout_start', label: 'Начали оформление', sessions: 2 },
          { event_name: 'checkout_success', label: 'Заявка сохранена', sessions: 1 },
        ],
      }

      if (sql.includes('WITH event_totals')) return {
        rows: [{
          product_id: '814535079882',
          product_name: 'Cosmos Visky',
          category_name: 'Одежная кожа',
          category_slug: 'odejnayakozha',
          views: 18,
          viewers: 11,
          cart_adds: 4,
          requests: 0,
        }],
      }

      if (sql.includes('AS category_name')) return {
        rows: [{
          category_name: 'Одежная кожа',
          category_slug: 'odejnayakozha',
          views: 18,
          viewers: 11,
        }],
      }

      if (sql.includes("event_name = 'catalog_filter'")) return {
        rows: [{
          category_slug: 'odejnayakozha',
          filter: 'color',
          value: 'Коричневый',
          uses: 5,
          users: 3,
        }],
      }

      if (sql.includes("event_name = 'search_no_results'")) return {
        rows: [{
          category_slug: 'odejnayakozha',
          query: 'фиолетовая кожа',
          searches: 2,
          users: 2,
        }],
      }

      if (sql.includes("event_name = 'contact_click'")) return {
        rows: [{ channel: 'whatsapp', clicks: 7, users: 4 }],
      }

      return { rows: [] }
    },
  })

  const result = await repository.getTrafficAnalytics()

  assert.equal(result.summary.online_now, 3)
  assert.equal(result.summary.visitors_today, 12)
  assert.equal(result.daily.length, 2)
  assert.equal(result.funnel.length, 5)
  assert.equal(result.funnel[4].sessions, 1)
  assert.equal(result.demand.products[0].product_name, 'Cosmos Visky')
  assert.equal(result.demand.products[0].requests, 0)
  assert.equal(result.demand.categories[0].views, 18)
  assert.equal(result.demand.filters[0].filter, 'color')
  assert.equal(result.demand.emptySearches[0].searches, 2)
  assert.equal(result.demand.contacts[0].channel, 'whatsapp')
  assert.equal(calls.length, 8)
  assert.match(calls[0].sql, /90 seconds/)
  assert.match(calls[1].sql, /generate_series/)
  assert.deepEqual(calls[0].params, ['Europe/Moscow'])
  assert.deepEqual(calls[1].params, ['Europe/Moscow'])
  assert.deepEqual(calls[2].params, ['Europe/Moscow'])
  assert.match(calls[3].sql, /order_items/)
  assert.match(calls[3].sql, /products\.legacy_id/)
  assert.ok(result.generatedAt)
})
