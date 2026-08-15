const DASHBOARD_CHAT_METRICS_SQL = `
  WITH conversations AS (
    SELECT c.*
    FROM live_chat_conversations c
    WHERE EXISTS (
      SELECT 1
      FROM live_chat_messages message
      WHERE message.conversation_id = c.id
    )
  ),
  unread AS (
    SELECT count(*)::int AS count
    FROM live_chat_messages message
    JOIN conversations c ON c.id = message.conversation_id
    WHERE message.role = 'user'
      AND message.created_at > COALESCE(
        c.last_read_by_admin_at,
        '-infinity'::timestamptz
      )
  )
  SELECT
    count(*)::int AS chat_conversations_total,
    count(*) FILTER (WHERE status IN ('open', 'human'))::int AS active_chats,
    count(*) FILTER (WHERE status = 'open')::int AS open_chats,
    count(*) FILTER (WHERE status = 'human')::int AS handed_off_chats,
    count(*) FILTER (WHERE ai_enabled = true)::int AS ai_enabled_chats,
    count(*) FILTER (WHERE ai_enabled = false)::int AS ai_disabled_chats,
    count(*) FILTER (WHERE created_at >= current_date)::int AS new_chats_today,
    (SELECT count FROM unread)::int AS unread_chat_messages
  FROM conversations
`

export function createDashboardChatMetricsRepository({ query } = {}) {
  if (typeof query !== 'function') {
    throw new TypeError('A query function is required for dashboard chat metrics')
  }

  return {
    async getMetrics() {
      const result = await query(DASHBOARD_CHAT_METRICS_SQL)
      return result.rows[0]
    },
  }
}

export { DASHBOARD_CHAT_METRICS_SQL }
