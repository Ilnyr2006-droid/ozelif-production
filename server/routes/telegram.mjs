import crypto from 'node:crypto'
import express from 'express'
import { env } from '../lib/env.mjs'
import { query } from '../lib/db.mjs'
import { findLatestOrderStatusByPhone } from '../lib/customer-order-status.mjs'
import { requirePermission } from '../lib/admin-auth.mjs'
import {
  handleTelegramUpdate,
  processTelegramOutbox,
  telegramEnabled,
} from '../lib/telegram-bot.mjs'

function asyncRoute(handler) {
  return (request, response, next) => {
    Promise.resolve(handler(request, response, next)).catch(next)
  }
}

function clean(value, max = 4000) {
  return String(value ?? '').trim().slice(0, max)
}

function allowed(request) {
  return Boolean(
    env.telegramWebhookSecret
    && request.get('X-Telegram-Bot-Api-Secret-Token')
      === env.telegramWebhookSecret,
  )
}

function tgUrl(username) {
  const value = clean(username, 128).replace(/^@+/, '')
  return value ? `https://t.me/${value}` : ''
}

async function syncChat(queryFn, payload) {
  const direction =
    payload?.direction === 'outbound' ? 'outbound' : 'inbound'
  const role = direction === 'outbound' ? 'assistant' : 'user'
  const chatId = clean(payload?.telegramChatId, 128)
  const text = clean(payload?.text)

  if (!chatId || Number(chatId) <= 0) {
    const error = new Error('telegram_chat_id_required')
    error.status = 400
    throw error
  }

  if (!text) {
    const error = new Error('message_required')
    error.status = 400
    throw error
  }

  const userId = clean(payload?.telegramUserId, 128)
  const username = clean(payload?.telegramUsername, 128).replace(/^@+/, '')
  const name = [
    clean(payload?.firstName, 160),
    clean(payload?.lastName, 160),
  ].filter(Boolean).join(' ').slice(0, 240)
  const phone = clean(payload?.phone, 128)
  const url = tgUrl(username)

  const date = payload?.occurredAt
    ? new Date(payload.occurredAt)
    : new Date()
  const timestamp = Number.isNaN(date.getTime()) ? new Date() : date

  const existing = await queryFn(
    `SELECT id
     FROM live_chat_conversations
     WHERE channel = 'telegram'
       AND external_chat_id = $1
     LIMIT 1`,
    [chatId],
  )

  let conversationId

  if (existing.rowCount) {
    conversationId = existing.rows[0].id

    await queryFn(
      `UPDATE live_chat_conversations
       SET
         visitor_id = $2,
         visitor_name = COALESCE(NULLIF($3, ''), visitor_name),
         visitor_phone = COALESCE(NULLIF($4, ''), visitor_phone),
         page_path = 'telegram',
         user_agent = 'Telegram Bot API',
         telegram_user_id = COALESCE(NULLIF($5, ''), telegram_user_id),
         telegram_chat_id = $1,
         telegram_username = COALESCE(NULLIF($6, ''), telegram_username),
         telegram_url = COALESCE(NULLIF($7, ''), telegram_url),
         status = CASE
           WHEN $8 = 'inbound' AND status = 'closed' THEN 'open'
           ELSE status
         END,
         ai_enabled = CASE
           WHEN $8 = 'inbound' AND status = 'closed' THEN true
           ELSE ai_enabled
         END,
         contact_captured_at = CASE
           WHEN NULLIF($4, '') IS NOT NULL
             THEN COALESCE(contact_captured_at, $9)
           ELSE contact_captured_at
         END,
         last_message_at = $9,
         updated_at = now()
       WHERE id = $10`,
      [
        chatId,
        `telegram:${userId || chatId}`,
        name,
        phone,
        userId,
        username,
        url,
        direction,
        timestamp,
        conversationId,
      ],
    )
  } else {
    conversationId = crypto.randomUUID()

    const tokenHash = crypto
      .createHash('sha256')
      .update(`telegram:${chatId}`)
      .digest('hex')

    await queryFn(
      `INSERT INTO live_chat_conversations (
         id,
         public_token_hash,
         visitor_id,
         visitor_name,
         visitor_phone,
         page_path,
         user_agent,
         status,
         ai_enabled,
         last_message_at,
         contact_captured_at,
         created_at,
         updated_at,
         channel,
         external_chat_id,
         telegram_user_id,
         telegram_chat_id,
         telegram_username,
         telegram_url
       )
       VALUES (
         $1,$2,$3,NULLIF($4,''),NULLIF($5,''),
         'telegram','Telegram Bot API','open',true,
         $6::timestamptz,
         CASE
           WHEN NULLIF($5,'') IS NOT NULL
             THEN $7::timestamptz
           ELSE NULL::timestamptz
         END,
         $8::timestamptz,
         now(),
         'telegram',
         $9,
         NULLIF($10,''),
         $9,
         NULLIF($11,''),
         NULLIF($12,'')
       )`,
      [
        conversationId,
        tokenHash,
        `telegram:${userId || chatId}`,
        name,
        phone,
        timestamp,
        timestamp,
        timestamp,
        chatId,
        userId,
        username,
        url,
      ],
    )
  }

  const messageId = clean(payload?.messageId, 160)
  const clientMessageId = messageId
    ? `telegram:${direction}:${chatId}:${messageId}`
    : ''

  if (clientMessageId) {
    const duplicate = await queryFn(
      `SELECT 1
       FROM live_chat_messages
       WHERE client_message_id = $1
       LIMIT 1`,
      [clientMessageId],
    )

    if (duplicate.rowCount) {
      return { conversationId, duplicate: true }
    }
  }

  await queryFn(
    `INSERT INTO live_chat_messages (
       conversation_id,
       role,
       content,
       metadata,
       created_at,
       client_message_id
     )
     VALUES ($1,$2,$3,$4::jsonb,$5,NULLIF($6,''))`,
    [
      conversationId,
      role,
      text,
      JSON.stringify({
        channel: 'telegram',
        direction,
        telegramChatId: chatId,
        telegramUserId: userId || null,
        telegramUsername: username || null,
      }),
      timestamp,
      clientMessageId,
    ],
  )

  return { conversationId, duplicate: false }
}

export function createTelegramRouter({
  processOutbox = processTelegramOutbox,
  lookupOrderStatus = findLatestOrderStatusByPhone,
  queryFn = query,
} = {}) {
  const router = express.Router()

  router.get('/health', (_request, response) => {
    response.json({ ok: true, enabled: telegramEnabled() })
  })

  router.post('/order-status', asyncRoute(async (request, response) => {
    if (!allowed(request)) {
      response.status(401).json({ error: 'unauthorized' })
      return
    }

    const order = await lookupOrderStatus(queryFn, request.body?.phone)
    response.json({ found: Boolean(order), order })
  }))

  router.post('/chat-sync', asyncRoute(async (request, response) => {
    if (!allowed(request)) {
      response.status(401).json({ error: 'unauthorized' })
      return
    }

    response.json({
      ok: true,
      ...(await syncChat(queryFn, request.body)),
    })
  }))

  router.post('/webhook', asyncRoute(async (request, response) => {
    if (!telegramEnabled()) {
      response.status(503).json({ error: 'telegram_not_configured' })
      return
    }

    if (!allowed(request)) {
      response.status(401).json({ error: 'unauthorized' })
      return
    }

    await handleTelegramUpdate(request.body)
    response.status(204).end()
  }))

  router.post(
    '/outbox/process',
    requirePermission('crm:write'),
    asyncRoute(async (_request, response) => {
      response.json(await processOutbox())
    }),
  )

  return router
}
