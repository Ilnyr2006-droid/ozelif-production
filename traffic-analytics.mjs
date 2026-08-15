export function createTrafficAnalyticsRepository({
  query,
  timezone = 'Europe/Moscow',
}) {
  if (typeof query !== 'function') {
    throw new TypeError('query must be a function')
  }

  async function getTrafficAnalytics() {
    const [summaryResult, dailyResult, funnelResult] = await Promise.all([
      query(
        `
          SELECT
            (
              SELECT count(*)::int
              FROM visitor_sessions
              WHERE last_seen_at >= now() - interval '90 seconds'
            ) AS online_now,

            (
              SELECT count(DISTINCT session_id)::int
              FROM analytics_events
              WHERE event_name = 'page_view'
                AND (created_at AT TIME ZONE $1)::date
                  = (now() AT TIME ZONE $1)::date
            ) AS visitors_today,

            (
              SELECT count(*)::int
              FROM analytics_events
              WHERE event_name = 'page_view'
                AND (created_at AT TIME ZONE $1)::date
                  = (now() AT TIME ZONE $1)::date
            ) AS page_views_today,

            (
              SELECT count(DISTINCT session_id)::int
              FROM analytics_events
              WHERE event_name = 'page_view'
                AND created_at >= now() - interval '7 days'
            ) AS visitors_7d,

            (
              SELECT count(*)::int
              FROM analytics_events
              WHERE event_name = 'page_view'
                AND created_at >= now() - interval '7 days'
            ) AS page_views_7d
        `,
        [timezone],
      ),

      query(
        `
          WITH days AS (
            SELECT generate_series(
              (now() AT TIME ZONE $1)::date - 6,
              (now() AT TIME ZONE $1)::date,
              interval '1 day'
            )::date AS day
          ),
          page_events AS (
            SELECT
              session_id,
              (created_at AT TIME ZONE $1)::date AS day
            FROM analytics_events
            WHERE event_name = 'page_view'
              AND created_at >= now() - interval '8 days'
          )
          SELECT
            to_char(days.day, 'YYYY-MM-DD') AS date,
            count(DISTINCT page_events.session_id)::int AS visitors,
            count(page_events.session_id)::int AS page_views
          FROM days
          LEFT JOIN page_events ON page_events.day = days.day
          GROUP BY days.day
          ORDER BY days.day
        `,
        [timezone],
      ),

      query(
        `
          WITH stages(event_name, stage, position) AS (
            VALUES
              ('page_view', 'Просмотр сайта', 1),
              ('product_view', 'Просмотр товара', 2),
              ('add_to_cart', 'Добавление в корзину', 3),
              ('checkout_start', 'Начало оформления', 4),
              ('checkout_success', 'Заявка сохранена', 5)
          )
          SELECT
            stages.stage,
            stages.position,
            count(DISTINCT analytics_events.session_id)::int AS sessions
          FROM stages
          LEFT JOIN analytics_events
            ON analytics_events.event_name = stages.event_name
           AND (analytics_events.created_at AT TIME ZONE $1)::date
             = (now() AT TIME ZONE $1)::date
          GROUP BY stages.stage, stages.position
          ORDER BY stages.position
        `,
        [timezone],
      ),
    ])

    return {
      summary: summaryResult.rows[0] ?? {
        online_now: 0,
        visitors_today: 0,
        page_views_today: 0,
        visitors_7d: 0,
        page_views_7d: 0,
      },
      daily: dailyResult.rows,
      funnel: funnelResult.rows,
      generatedAt: new Date().toISOString(),
    }
  }

  return {
    getTrafficAnalytics,
  }
}
