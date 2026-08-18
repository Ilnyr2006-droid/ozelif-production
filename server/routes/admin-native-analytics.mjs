import express from 'express'

import { requireAdmin } from '../lib/admin-auth.mjs'
import { query } from '../lib/db.mjs'

function number(value) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

function normalizeDays(value) {
  const parsed = Number(value)

  if (!Number.isFinite(parsed)) {
    return 30
  }

  return Math.min(
    365,
    Math.max(7, Math.floor(parsed)),
  )
}

export function createAdminNativeAnalyticsRouter() {
  const router = express.Router()

  router.use(requireAdmin)

  router.get('/', async (request, response, next) => {
    try {
      const days = normalizeDays(
        request.query.days,
      )

      const [
        summaryResult,
        salesByDayResult,
        customersByDayResult,
        statusResult,
        deliveryResult,
        topProductsResult,
        chatFunnelResult,
      ] = await Promise.all([
        query(`
          SELECT
            COUNT(*) FILTER (
              WHERE created_at >= CURRENT_DATE
                AND status <> 'cancelled'
            )::int AS orders_today,

            COALESCE(
              SUM(total_amount) FILTER (
                WHERE created_at >= CURRENT_DATE
                  AND status <> 'cancelled'
              ),
              0
            ) AS revenue_today,

            COALESCE(
              AVG(total_amount) FILTER (
                WHERE created_at >= CURRENT_DATE
                  AND status <> 'cancelled'
              ),
              0
            ) AS average_order_value_today,

            COUNT(*) FILTER (
              WHERE created_at >= date_trunc(
                'month',
                CURRENT_DATE
              )
                AND status <> 'cancelled'
            )::int AS orders_month,

            COALESCE(
              SUM(total_amount) FILTER (
                WHERE created_at >= date_trunc(
                  'month',
                  CURRENT_DATE
                )
                  AND status <> 'cancelled'
              ),
              0
            ) AS revenue_month
          FROM orders
        `),

        query(`
          WITH dates AS (
            SELECT generate_series(
              CURRENT_DATE - ($1::int - 1),
              CURRENT_DATE,
              interval '1 day'
            )::date AS day
          ),
          totals AS (
            SELECT
              created_at::date AS day,
              COUNT(*)::int AS orders_count,
              COALESCE(
                SUM(total_amount),
                0
              ) AS revenue
            FROM orders
            WHERE created_at >=
              CURRENT_DATE - ($1::int - 1)
              AND status <> 'cancelled'
            GROUP BY created_at::date
          )
          SELECT
            dates.day,
            COALESCE(
              totals.orders_count,
              0
            )::int AS orders_count,
            COALESCE(
              totals.revenue,
              0
            ) AS revenue
          FROM dates
          LEFT JOIN totals
            ON totals.day = dates.day
          ORDER BY dates.day
        `, [days]),

        query(`
          WITH dates AS (
            SELECT generate_series(
              CURRENT_DATE - ($1::int - 1),
              CURRENT_DATE,
              interval '1 day'
            )::date AS day
          ),
          totals AS (
            SELECT
              created_at::date AS day,
              COUNT(*)::int AS customer_count
            FROM customers
            WHERE created_at >=
              CURRENT_DATE - ($1::int - 1)
            GROUP BY created_at::date
          )
          SELECT
            dates.day,
            COALESCE(
              totals.customer_count,
              0
            )::int AS customer_count
          FROM dates
          LEFT JOIN totals
            ON totals.day = dates.day
          ORDER BY dates.day
        `, [days]),

        query(`
          SELECT
            status,
            COUNT(*)::int AS orders_count
          FROM orders
          GROUP BY status
          ORDER BY orders_count DESC
        `),

        query(`
          SELECT
            COALESCE(
              NULLIF(delivery_method, ''),
              'unknown'
            ) AS delivery_method,
            COUNT(*)::int AS orders_count
          FROM orders
          WHERE status <> 'cancelled'
          GROUP BY 1
          ORDER BY orders_count DESC
        `),

        query(`
          SELECT
            item.product_name_snapshot
              AS product_name,
            SUM(item.quantity)::numeric
              AS quantity,
            COALESCE(
              SUM(item.line_total),
              0
            ) AS revenue
          FROM order_items item
          JOIN orders order_row
            ON order_row.id = item.order_id
          WHERE order_row.status <> 'cancelled'
          GROUP BY item.product_name_snapshot
          ORDER BY revenue DESC
          LIMIT 10
        `),
,

        query(`
          WITH cohort AS (
            SELECT *
            FROM live_chat_conversations
            WHERE chat_started_at >=
              CURRENT_DATE - ($1::int - 1)
          )
          SELECT
            COUNT(*)::int AS chat_started,

            COUNT(*) FILTER (
              WHERE product_interest_at IS NOT NULL
            )::int AS product_interest,

            COUNT(*) FILTER (
              WHERE contact_offer_shown_at IS NOT NULL
            )::int AS contact_offer,

            COUNT(*) FILTER (
              WHERE contact_captured_at IS NOT NULL
            )::int AS phone_captured,

            COUNT(*) FILTER (
              WHERE manager_requested_at IS NOT NULL
            )::int AS manager_requested,

            COUNT(*) FILTER (
              WHERE manager_takeover_at IS NOT NULL
            )::int AS manager_takeover
          FROM cohort
        `, [days])
      ])

      const summaryRow =
        summaryResult.rows[0] ?? {}

      response.setHeader(
        'Cache-Control',
        'no-store, private',
      )

      response.json({
        periodDays: days,

        summary: {
          ordersToday:
            number(summaryRow.orders_today),

          revenueToday:
            number(summaryRow.revenue_today),

          averageOrderValueToday:
            number(
              summaryRow
                .average_order_value_today,
            ),

          ordersMonth:
            number(summaryRow.orders_month),

          revenueMonth:
            number(summaryRow.revenue_month),
        },

        salesByDay:
          salesByDayResult.rows.map(row => ({
            date: row.day,
            orders:
              number(row.orders_count),
            revenue:
              number(row.revenue),
          })),

        customersByDay:
          customersByDayResult.rows.map(
            row => ({
              date: row.day,
              customers:
                number(row.customer_count),
            }),
          ),

        statuses:
          statusResult.rows.map(row => ({
            status: row.status,
            orders:
              number(row.orders_count),
          })),

        delivery:
          deliveryResult.rows.map(row => ({
            method:
              row.delivery_method,
            orders:
              number(row.orders_count),
          })),

        chatFunnel: (() => {
          const row =
            chatFunnelResult.rows[0] ?? {}

          return [
            {
              key: 'chat_started',
              label: 'Начали чат',
              count: number(row.chat_started),
            },
            {
              key: 'product_interest',
              label: 'Коммерческий интерес',
              count: number(row.product_interest),
            },
            {
              key: 'contact_offer',
              label: 'Показали форму контакта',
              count: number(row.contact_offer),
            },
            {
              key: 'phone_captured',
              label: 'Оставили телефон',
              count: number(row.phone_captured),
            },
            {
              key: 'manager_requested',
              label: 'Запрошен менеджер',
              count: number(row.manager_requested),
            },
            {
              key: 'manager_takeover',
              label: 'Менеджер подключился',
              count: number(row.manager_takeover),
            },
          ]
        })(),

        topProducts:
          topProductsResult.rows.map(
            row => ({
              name:
                row.product_name,
              quantity:
                number(row.quantity),
              revenue:
                number(row.revenue),
            }),
          ),
      })
    } catch (error) {
      next(error)
    }
  })

  return router
}
