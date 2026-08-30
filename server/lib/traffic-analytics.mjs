export function createTrafficAnalyticsRepository({
  query,
  timezone = 'Europe/Moscow',
}) {
  if (typeof query !== 'function') {
    throw new TypeError('query must be a function')
  }

  async function getTrafficAnalytics() {
    const [
      summaryResult,
      dailyResult,
      funnelResult,
      productDemandResult,
      categoryDemandResult,
      filterDemandResult,
      emptySearchResult,
      contactClickResult,
    ] = await Promise.all([
      query(
        `
          SELECT
            (
              SELECT count(*)::int
              FROM visitor_sessions
              WHERE last_seen_at >= now() - interval '90 seconds'
                AND NOT analytics_is_bot_user_agent(
                  user_agent
                )
            ) AS online_now,

            (
              SELECT count(DISTINCT session_id)::int
              FROM analytics_events
              JOIN visitor_sessions analytics_session
                ON analytics_session.id = analytics_events.session_id
              WHERE event_name = 'page_view'
                AND NOT analytics_is_bot_user_agent(
                  analytics_session.user_agent
                )
                AND (created_at AT TIME ZONE $1)::date
                  = (now() AT TIME ZONE $1)::date
            ) AS visitors_today,

            (
              SELECT count(*)::int
              FROM analytics_events
              JOIN visitor_sessions analytics_session
                ON analytics_session.id = analytics_events.session_id
              WHERE event_name = 'page_view'
                AND NOT analytics_is_bot_user_agent(
                  analytics_session.user_agent
                )
                AND (created_at AT TIME ZONE $1)::date
                  = (now() AT TIME ZONE $1)::date
            ) AS page_views_today,

            (
              SELECT count(DISTINCT session_id)::int
              FROM analytics_events
              JOIN visitor_sessions analytics_session
                ON analytics_session.id = analytics_events.session_id
              WHERE event_name = 'page_view'
                AND NOT analytics_is_bot_user_agent(
                  analytics_session.user_agent
                )
                AND created_at >= now() - interval '7 days'
            ) AS visitors_7d,

            (
              SELECT count(*)::int
              FROM analytics_events
              JOIN visitor_sessions analytics_session
                ON analytics_session.id = analytics_events.session_id
              WHERE event_name = 'page_view'
                AND NOT analytics_is_bot_user_agent(
                  analytics_session.user_agent
                )
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
            JOIN visitor_sessions analytics_session
              ON analytics_session.id = analytics_events.session_id
            WHERE event_name = 'page_view'
              AND NOT analytics_is_bot_user_agent(
                analytics_session.user_agent
              )
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
          WITH stages(event_name, position, label) AS (
            VALUES
              ('page_view', 1, 'Посетили сайт'),
              ('product_view', 2, 'Открыли товар'),
              ('add_to_cart', 3, 'Добавили в корзину'),
              ('checkout_start', 4, 'Начали оформление'),
              ('checkout_success', 5, 'Заявка сохранена')
          )
          SELECT
            stages.event_name,
            stages.label,
            count(DISTINCT analytics_events.session_id)::int AS sessions
          FROM stages
          LEFT JOIN analytics_events
            ON analytics_events.event_name = stages.event_name
           AND (analytics_events.created_at AT TIME ZONE $1)::date
             = (now() AT TIME ZONE $1)::date
           AND EXISTS (
             SELECT 1
             FROM visitor_sessions analytics_session
             WHERE analytics_session.id = analytics_events.session_id
               AND NOT analytics_is_bot_user_agent(
                 analytics_session.user_agent
               )
           )
          GROUP BY stages.event_name, stages.position, stages.label
          ORDER BY stages.position
        `,
        [timezone],
      ),

      query(
        `
          WITH event_totals AS (
            SELECT
              entity_id,
              count(*) FILTER (
                WHERE event_name = 'product_view'
              )::int AS views,
              count(DISTINCT session_id) FILTER (
                WHERE event_name = 'product_view'
              )::int AS viewers,
              count(*) FILTER (
                WHERE event_name = 'add_to_cart'
              )::int AS cart_adds
            FROM analytics_events
            JOIN visitor_sessions analytics_session
              ON analytics_session.id = analytics_events.session_id
            WHERE event_name IN ('product_view', 'add_to_cart')
              AND NOT analytics_is_bot_user_agent(
                analytics_session.user_agent
              )
              AND created_at >= now() - interval '30 days'
              AND entity_id IS NOT NULL
            GROUP BY entity_id
          ),
          order_totals AS (
            SELECT
              order_items.product_id,
              count(DISTINCT order_items.order_id)::int AS requests
            FROM order_items
            JOIN orders ON orders.id = order_items.order_id
            WHERE orders.created_at >= now() - interval '30 days'
            GROUP BY order_items.product_id
          )
          SELECT
            coalesce(products.legacy_id, products.id::text) AS product_id,
            products.name AS product_name,
            categories.name AS category_name,
            categories.slug AS category_slug,
            sum(event_totals.views)::int AS views,
            sum(event_totals.viewers)::int AS viewers,
            sum(event_totals.cart_adds)::int AS cart_adds,
            coalesce(order_totals.requests, 0)::int AS requests
          FROM event_totals
          JOIN products
            ON products.id::text = event_totals.entity_id
            OR products.legacy_id = event_totals.entity_id
          JOIN categories ON categories.id = products.category_id
          LEFT JOIN order_totals ON order_totals.product_id = products.id
          WHERE products.is_published = true
          GROUP BY
            products.id,
            products.legacy_id,
            products.name,
            categories.name,
            categories.slug,
            order_totals.requests
          ORDER BY views DESC, cart_adds DESC, products.name
          LIMIT 20
        `,
      ),

      query(
        `
          SELECT
            coalesce(categories.name, analytics_events.metadata->>'category')
              AS category_name,
            analytics_events.metadata->>'category' AS category_slug,
            count(*)::int AS views,
            count(DISTINCT analytics_events.session_id)::int AS viewers
          FROM analytics_events
          JOIN visitor_sessions analytics_session
            ON analytics_session.id = analytics_events.session_id
          LEFT JOIN categories
            ON categories.slug = analytics_events.metadata->>'category'
          WHERE analytics_events.event_name = 'product_view'
            AND NOT analytics_is_bot_user_agent(
              analytics_session.user_agent
            )
            AND analytics_events.created_at >= now() - interval '30 days'
            AND analytics_events.metadata->>'category' IS NOT NULL
          GROUP BY
            categories.name,
            analytics_events.metadata->>'category'
          ORDER BY views DESC, category_name
          LIMIT 12
        `,
      ),

      query(
        `
          SELECT
            metadata->>'category' AS category_slug,
            metadata->>'filter' AS filter,
            metadata->>'value' AS value,
            count(*)::int AS uses,
            count(DISTINCT session_id)::int AS users
          FROM analytics_events
          JOIN visitor_sessions analytics_session
            ON analytics_session.id = analytics_events.session_id
          WHERE event_name = 'catalog_filter'
            AND NOT analytics_is_bot_user_agent(
              analytics_session.user_agent
            )
            AND created_at >= now() - interval '30 days'
            AND metadata->>'filter' IS NOT NULL
            AND metadata->>'value' IS NOT NULL
          GROUP BY
            metadata->>'category',
            metadata->>'filter',
            metadata->>'value'
          ORDER BY uses DESC, value
          LIMIT 20
        `,
      ),

      query(
        `
          SELECT
            metadata->>'category' AS category_slug,
            metadata->>'query' AS query,
            count(*)::int AS searches,
            count(DISTINCT session_id)::int AS users
          FROM analytics_events
          JOIN visitor_sessions analytics_session
            ON analytics_session.id = analytics_events.session_id
          WHERE event_name = 'search_no_results'
            AND NOT analytics_is_bot_user_agent(
              analytics_session.user_agent
            )
            AND created_at >= now() - interval '30 days'
            AND metadata->>'query' IS NOT NULL
          GROUP BY metadata->>'category', metadata->>'query'
          ORDER BY searches DESC, query
          LIMIT 20
        `,
      ),

      query(
        `
          SELECT
            metadata->>'channel' AS channel,
            count(*)::int AS clicks,
            count(DISTINCT session_id)::int AS users
          FROM analytics_events
          JOIN visitor_sessions analytics_session
            ON analytics_session.id = analytics_events.session_id
          WHERE event_name = 'contact_click'
            AND NOT analytics_is_bot_user_agent(
              analytics_session.user_agent
            )
            AND created_at >= now() - interval '30 days'
            AND metadata->>'channel' IS NOT NULL
          GROUP BY metadata->>'channel'
          ORDER BY clicks DESC, channel
        `,
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
      demand: {
        products: productDemandResult.rows,
        categories: categoryDemandResult.rows,
        filters: filterDemandResult.rows,
        emptySearches: emptySearchResult.rows,
        contacts: contactClickResult.rows,
      },
      generatedAt: new Date().toISOString(),
    }
  }

  return {
    getTrafficAnalytics,
  }
}
