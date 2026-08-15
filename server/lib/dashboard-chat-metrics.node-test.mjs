import assert from 'node:assert/strict'
import test from 'node:test'
import {
  createDashboardChatMetricsRepository,
  DASHBOARD_CHAT_METRICS_SQL,
} from './dashboard-chat-metrics.mjs'

test('builds dashboard chat metrics from live conversations and messages in one query', async () => {
  const calls = []
  const repository = createDashboardChatMetricsRepository({
    query: async (sql, params) => {
      calls.push({ sql, params })
      return {
        rows: [{
          chat_conversations_total: 12,
          active_chats: 9,
          open_chats: 7,
          handed_off_chats: 2,
          ai_enabled_chats: 8,
          ai_disabled_chats: 4,
          unread_chat_messages: 3,
          new_chats_today: 5,
        }],
      }
    },
  })

  assert.deepEqual(await repository.getMetrics(), {
    chat_conversations_total: 12,
    active_chats: 9,
    open_chats: 7,
    handed_off_chats: 2,
    ai_enabled_chats: 8,
    ai_disabled_chats: 4,
    unread_chat_messages: 3,
    new_chats_today: 5,
  })
  assert.equal(calls.length, 1)
  assert.equal(calls[0].params, undefined)
  assert.match(calls[0].sql, /live_chat_conversations/)
  assert.match(calls[0].sql, /live_chat_messages/)
  assert.match(calls[0].sql, /WHERE EXISTS/)
  assert.match(calls[0].sql, /status IN \('open', 'human'\)/)
  assert.match(calls[0].sql, /status = 'human'/)
  assert.match(calls[0].sql, /ai_enabled = true/)
  assert.match(calls[0].sql, /last_read_by_admin_at/)
  assert.doesNotMatch(calls[0].sql, /chat_sessions/)
})

test('documents that empty live-chat sessions are excluded from conversation metrics', () => {
  assert.match(DASHBOARD_CHAT_METRICS_SQL, /WHERE EXISTS \([\s\S]*live_chat_messages/)
})
