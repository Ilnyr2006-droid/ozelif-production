import assert from 'node:assert/strict'
import test from 'node:test'
import {
  createTelegramLiveChatBridge,
  formatTelegramAssistantReply,
  telegramLiveChatToken,
} from './telegram-live-chat.mjs'

const message = {
  message_id: 77,
  chat: { id: 12345 },
  from: {
    id: 67890,
    first_name: 'Ильнур',
    username: 'ilnur',
  },
}

function queryMock(calls) {
  return async (sql, params) => {
    calls.push({ sql, params })

    if (sql.includes('FROM telegram_customer_links')) {
      return { rowCount: 0, rows: [] }
    }

    if (sql.includes('INSERT INTO live_chat_conversations')) {
      return {
        rowCount: 1,
        rows: [{ id: '11111111-1111-4111-8111-111111111111' }],
      }
    }

    if (sql.includes('INSERT INTO notification_outbox')) {
      return {
        rowCount: 1,
        rows: [{ id: '22222222-2222-4222-8222-222222222222' }],
      }
    }

    throw new Error(`Unexpected SQL: ${sql}`)
  }
}

test('uses an opaque stable token instead of exposing Telegram identity', () => {
  const first = telegramLiveChatToken('12345', 'secret')
  const second = telegramLiveChatToken('12345', 'secret')

  assert.equal(first, second)
  assert.notEqual(first, 'telegram:12345')
  assert.doesNotMatch(first, /12345/u)
})

test('routes a Telegram message through the website live-chat pipeline', async () => {
  const calls = []
  let request = null
  const bridge = createTelegramLiveChatBridge({
    queryFn: queryMock(calls),
    sessionSecret: 'test-secret',
    siteUrl: 'https://example.test',
    port: 8093,
    fetchImpl: async (url, options) => {
      request = { url, options }
      return new Response(JSON.stringify({
        ok: true,
        userMessage: { id: '10' },
        assistant: {
          message: {
            id: '11',
            content: 'Подойдёт кожа Napato Black.',
          },
          actions: [{
            label: 'Открыть Napato Black',
            href: '/odejnayakozha/tproduct/1-napato-black',
          }],
        },
      }), {
        status: 201,
        headers: { 'Content-Type': 'application/json' },
      })
    },
  })

  const result = await bridge({
    message,
    text: 'Подбери чёрную кожу для куртки',
  })

  assert.equal(result.ok, true)
  assert.equal(result.queued, true)
  assert.match(request.url, /\/api\/live-chat\/conversations\//u)
  assert.ok(request.options.headers['X-Ozelif-Live-Chat-Token'])

  const body = JSON.parse(request.options.body)
  assert.equal(body.path, 'telegram')
  assert.equal(body.clientMessageId, 'tg_12345_77')

  const outbox = calls.find(call => (
    call.sql.includes('INSERT INTO notification_outbox')
  ))
  assert.equal(outbox.params[0], 'chat.ai_reply.11')
  assert.match(outbox.params[3], /Napato Black/u)
  assert.match(outbox.params[3], /https:\/\/example\.test\/odejnayakozha/u)
})

test('uses the same outbox identity when Telegram retries one update', async () => {
  const eventTypes = []
  const bridge = createTelegramLiveChatBridge({
    sessionSecret: 'test-secret',
    queryFn: async (sql, params) => {
      if (sql.includes('FROM telegram_customer_links')) {
        return { rowCount: 0, rows: [] }
      }
      if (sql.includes('INSERT INTO live_chat_conversations')) {
        return {
          rowCount: 1,
          rows: [{ id: '11111111-1111-4111-8111-111111111111' }],
        }
      }
      if (sql.includes('INSERT INTO notification_outbox')) {
        eventTypes.push(params[0])
        return {
          rowCount: eventTypes.length === 1 ? 1 : 0,
          rows: eventTypes.length === 1 ? [{ id: 'outbox' }] : [],
        }
      }
      throw new Error('Unexpected SQL')
    },
    fetchImpl: async () => new Response(JSON.stringify({
      ok: true,
      duplicate: true,
      userMessage: { id: '10' },
      assistant: {
        message: { id: '11', content: 'Один ответ' },
      },
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }),
  })

  const first = await bridge({ message, text: 'Повтор' })
  const second = await bridge({ message, text: 'Повтор' })

  assert.equal(first.queued, true)
  assert.equal(second.queued, false)
  assert.deepEqual(eventTypes, [
    'chat.ai_reply.11',
    'chat.ai_reply.11',
  ])
})

test('queues a safe fallback when the common AI endpoint is unavailable', async () => {
  const calls = []
  const bridge = createTelegramLiveChatBridge({
    queryFn: queryMock(calls),
    sessionSecret: 'test-secret',
    fetchImpl: async () => {
      throw new Error('offline')
    },
  })

  const result = await bridge({ message, text: 'Есть замша?' })
  const outbox = calls.find(call => (
    call.sql.includes('INSERT INTO notification_outbox')
  ))

  assert.equal(result.ok, false)
  assert.equal(result.queued, true)
  assert.match(outbox.params[3], /временно недоступен/u)
})

test('formats product actions as public OZELIF links', () => {
  const text = formatTelegramAssistantReply({
    message: { content: 'Нашёл вариант.' },
    actions: [{ label: 'Открыть товар', href: '/catalog/product' }],
  }, { siteUrl: 'https://ozelifkoja.ru' })

  assert.match(text, /Нашёл вариант/u)
  assert.match(text, /https:\/\/ozelifkoja\.ru\/catalog\/product/u)
})
