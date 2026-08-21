import crypto from 'node:crypto'
import { query } from './db.mjs'
import { env } from './env.mjs'
import {
  hashPublicChatToken,
  normalizeChatContent,
} from './live-chat-utils.mjs'

function clean(value, max = 4_000) {
  return String(value ?? '').trim().slice(0, max)
}

export function telegramLiveChatToken(
  chatId,
  secret = env.sessionSecret,
) {
  return crypto
    .createHmac('sha256', String(secret))
    .update(`telegram-live-chat:${clean(chatId, 128)}`)
    .digest('base64url')
}

function telegramClientMessageId(chatId, messageId) {
  const raw = `tg_${clean(chatId, 64)}_${clean(messageId, 64)}`
  return raw.replace(/[^A-Za-z0-9_-]/gu, '_').slice(0, 160)
}

function visitorName(message) {
  return [
    clean(message?.from?.first_name, 120),
    clean(message?.from?.last_name, 120),
  ].filter(Boolean).join(' ').slice(0, 240)
}

function absoluteUrl(value, siteUrl) {
  const href = clean(value, 1_000)
  if (!href) return ''
  try {
    return new URL(href, `${siteUrl}/`).toString()
  } catch {
    return ''
  }
}

function absoluteHttpUrl(value, siteUrl) {
  const url = absoluteUrl(value, siteUrl)
  return /^https?:\/\//iu.test(url) ? url : ''
}

function productAttribute(product, ...keys) {
  const attributes = product?.attributes
  if (!attributes || typeof attributes !== 'object') return ''

  for (const key of keys) {
    const value = attributes[key]
    if (Array.isArray(value)) {
      const text = value.map(item => clean(item, 120)).filter(Boolean).join(', ')
      if (text) return text
    } else {
      const text = clean(value, 180)
      if (text) return text
    }
  }
  return ''
}

function telegramProductPrices(product) {
  const variants = Array.isArray(product?.variants)
    ? product.variants
    : []
  const byUnit = new Map()

  for (const variant of variants) {
    const price = Number(variant?.priceRub)
    const unit = clean(variant?.unit, 40)
    if (!Number.isFinite(price) || price <= 0 || !unit) continue
    const current = byUnit.get(unit)
    if (current === undefined || price < current) byUnit.set(unit, price)
  }

  return [...byUnit.entries()]
    .slice(0, 2)
    .map(([unit, price]) => (
      `${price.toLocaleString('ru-RU', {
        minimumFractionDigits: Number.isInteger(price) ? 0 : 2,
        maximumFractionDigits: 2,
      })} ₽ / ${unit}`
    ))
    .join(' · ')
}

export function telegramProductCaption(product) {
  const name = clean(product?.name, 180)
  const subtype = productAttribute(product, 'subtype', 'type', 'leatherType')
  const category = [clean(product?.category, 120), subtype]
    .filter((value, index, values) => value && values.indexOf(value) === index)
    .join(' / ')
  const rows = [
    name,
    telegramProductPrices(product) && `Цена: ${telegramProductPrices(product)}`,
    category && `Категория: ${category}`,
    productAttribute(product, 'color', 'normalizedColor')
      && `Цвет: ${productAttribute(product, 'color', 'normalizedColor')}`,
    productAttribute(product, 'purpose', 'application', 'use')
      && `Назначение: ${productAttribute(product, 'purpose', 'application', 'use')}`,
    productAttribute(product, 'material', 'rawMaterial')
      && `Сырьё: ${productAttribute(product, 'material', 'rawMaterial')}`,
    productAttribute(product, 'coating')
      && `Покрытие: ${productAttribute(product, 'coating')}`,
    productAttribute(product, 'origin', 'country')
      && `Производство: ${productAttribute(product, 'origin', 'country')}`,
    productAttribute(product, 'hideSize')
      && `Размер шкуры: ${productAttribute(product, 'hideSize')}`,
  ]

  return rows.filter(Boolean).join('\n').slice(0, 1_024)
}

export function telegramProductPhotos(
  assistant,
  { siteUrl = env.siteUrl } = {},
) {
  const products = Array.isArray(assistant?.products)
    ? assistant.products
    : []
  const seen = new Set()

  return products
    .map(product => {
      const photoUrl = absoluteHttpUrl(product?.image, siteUrl)
      const productUrl = absoluteHttpUrl(product?.productUrl, siteUrl)
      const name = clean(product?.name, 180)

      if (!photoUrl || seen.has(photoUrl)) return null
      seen.add(photoUrl)

      return {
        photoUrl,
        caption: telegramProductCaption(product)
          || name
          || productUrl,
      }
    })
    .filter(Boolean)
    .slice(0, 3)
}

export function telegramPhotoRequested(value) {
  return /(?:фото(?:граф(?:ию|ии|ий|ия|ии)?|чк[ауи])?|покаж\p{L}*\s+(?:товар|материал|кож))/iu
    .test(clean(value, 1_000))
}

export function formatTelegramAssistantReply(
  assistant,
  { siteUrl = env.siteUrl } = {},
) {
  const rawContent = normalizeChatContent(
    assistant?.message?.content,
  )

  if (!rawContent) return ''

  const actions = Array.isArray(assistant?.actions)
    ? assistant.actions
    : []

  const hasProductCard = actions.some(action => (
    /\/tproduct\//u.test(clean(action?.href, 1_000))
  )) || (Array.isArray(assistant?.products) && assistant.products.some(product => (
    /\/tproduct\//u.test(clean(product?.productUrl, 1_000))
  )))

  let content = rawContent

  if (
    hasProductCard
    && /(?:нет возможности|не могу|не умею)\s+(?:отправ|предостав|присл)\p{L}*\s+фотограф\p{L}*/iu.test(content)
  ) {
    content = 'Да, отправляю фотографии подходящих вариантов ниже.'
  }

  content = content
    .replace(/^\s*-\s*Толщина:\s*Подходит[^\n]*\n?/gimu, '')
    .replace(/\*\*([^*\n]+)\*\*/gu, '$1')
    .replace(/`([^`\n]+)`/gu, '$1')
    .trim()

  const links = actions
    .slice(0, 3)
    .map(action => ({
      label: clean(action?.label, 120)
        .replace(/\*\*/gu, '')
        .replace(/`/gu, ''),
      url: absoluteUrl(action?.href, siteUrl),
    }))
    .filter(action => (
      action.label
      && action.url
      && !content.includes(action.url)
    ))

  return [
    content,
    links.length
      ? links.map(action => `${action.label}: ${action.url}`).join('\n')
      : '',
  ].filter(Boolean).join('\n\n').slice(0, 4_000)
}

async function linkedCustomer(queryFn, userId, chatId) {
  const result = await queryFn(
    `SELECT
       l.customer_id AS "customerId",
       c.name,
       c.original_phone AS "phone"
     FROM telegram_customer_links l
     JOIN customers c ON c.id = l.customer_id
     WHERE l.telegram_user_id = $1
       AND l.telegram_chat_id = $2
       AND l.revoked_at IS NULL
       AND c.deleted_at IS NULL
     LIMIT 1`,
    [userId, chatId],
  )

  return result.rows[0] ?? null
}

export async function ensureTelegramLiveChat({
  message,
  queryFn = query,
  sessionSecret = env.sessionSecret,
} = {}) {
  const chatId = clean(message?.chat?.id, 128)
  const userId = clean(message?.from?.id, 128)

  if (!chatId || !userId) {
    throw new Error('telegram_identity_required')
  }

  const linked = await linkedCustomer(
    queryFn,
    userId,
    chatId,
  )
  const token = telegramLiveChatToken(
    chatId,
    sessionSecret,
  )
  const name = linked?.name || visitorName(message)
  const username = clean(
    message?.from?.username,
    128,
  ).replace(/^@+/u, '')
  const telegramUrl = username
    ? `https://t.me/${username}`
    : null

  const result = await queryFn(
    `INSERT INTO live_chat_conversations (
       public_token_hash,
       visitor_id,
       visitor_name,
       visitor_phone,
       customer_id,
       page_path,
       user_agent,
       status,
       ai_enabled,
       channel,
       external_chat_id,
       telegram_user_id,
       telegram_chat_id,
       telegram_username,
       telegram_url,
       last_message_at
     )
     VALUES (
       $1,$2,NULLIF($3,''),NULLIF($4,''),$5,
       'telegram','Telegram Bot API','open',true,
       'telegram',$6,$7,$6,NULLIF($8,''),$9,now()
     )
     ON CONFLICT (channel, external_chat_id)
       WHERE external_chat_id IS NOT NULL
     DO UPDATE SET
       public_token_hash = EXCLUDED.public_token_hash,
       visitor_id = EXCLUDED.visitor_id,
       visitor_name = COALESCE(
         EXCLUDED.visitor_name,
         live_chat_conversations.visitor_name
       ),
       visitor_phone = COALESCE(
         EXCLUDED.visitor_phone,
         live_chat_conversations.visitor_phone
       ),
       customer_id = COALESCE(
         EXCLUDED.customer_id,
         live_chat_conversations.customer_id
       ),
       telegram_user_id = EXCLUDED.telegram_user_id,
       telegram_chat_id = EXCLUDED.telegram_chat_id,
       telegram_username = COALESCE(
         EXCLUDED.telegram_username,
         live_chat_conversations.telegram_username
       ),
       telegram_url = COALESCE(
         EXCLUDED.telegram_url,
         live_chat_conversations.telegram_url
       ),
       status = CASE
         WHEN live_chat_conversations.status = 'closed' THEN 'open'
         ELSE live_chat_conversations.status
       END,
       ai_enabled = CASE
         WHEN live_chat_conversations.status = 'closed' THEN true
         ELSE live_chat_conversations.ai_enabled
       END,
       updated_at = now()
     RETURNING id`,
    [
      hashPublicChatToken(token),
      `telegram:${userId}`,
      name,
      linked?.phone ?? null,
      linked?.customerId ?? null,
      chatId,
      userId,
      username,
      telegramUrl,
    ],
  )

  return {
    conversationId: result.rows[0].id,
    token,
    chatId,
    userId,
  }
}

async function enqueueReply(
  queryFn,
  {
    conversationId,
    chatId,
    eventId,
    text,
    photos = [],
  },
) {
  if (!text) return false

  const entries = [
    {
      eventType: `chat.ai_reply.${clean(eventId, 80)}`,
      payload: { type: 'text', text },
    },
    ...photos.map((photo, index) => ({
      eventType: `chat.ai_photo.${clean(eventId, 80)}.${index + 1}`,
      payload: {
        type: 'photo',
        photoUrl: photo.photoUrl,
        caption: photo.caption,
      },
    })),
  ]
  let queued = false

  for (const entry of entries) {
    const result = await queryFn(
      `INSERT INTO notification_outbox (
         event_type,
         aggregate_type,
         aggregate_id,
         channel,
         recipient,
         payload
       )
       VALUES ($1,'live_chat',$2,'telegram',$3,$4::jsonb)
       ON CONFLICT DO NOTHING
       RETURNING id`,
      [
        entry.eventType,
        conversationId,
        chatId,
        JSON.stringify(entry.payload),
      ],
    )
    queued ||= Boolean(result.rowCount)
  }

  return queued
}

async function latestRecommendedProducts(queryFn, conversationId) {
  const result = await queryFn(
    `SELECT metadata->'products' AS products
     FROM live_chat_messages
     WHERE conversation_id=$1
       AND role='assistant'
       AND jsonb_typeof(metadata->'products')='array'
       AND jsonb_array_length(metadata->'products')>0
     ORDER BY id DESC
     LIMIT 1`,
    [conversationId],
  )

  return Array.isArray(result.rows[0]?.products)
    ? result.rows[0].products
    : []
}

export function createTelegramLiveChatBridge({
  queryFn = query,
  fetchImpl = fetch,
  port = env.port,
  sessionSecret = env.sessionSecret,
  siteUrl = env.siteUrl,
} = {}) {
  return async function processTelegramLiveChatMessage({
    message,
    text,
  } = {}) {
    const content = normalizeChatContent(text)

    if (!content) return { ignored: true }

    const identity = await ensureTelegramLiveChat({
      message,
      queryFn,
      sessionSecret,
    })
    const requestMessageId = telegramClientMessageId(
      identity.chatId,
      message?.message_id,
    )

    let body = null
    let assistantError = null

    try {
      const response = await fetchImpl(
        `http://127.0.0.1:${port}/api/live-chat/conversations/${identity.conversationId}/messages`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Ozelif-Live-Chat-Token': identity.token,
          },
          body: JSON.stringify({
            content,
            path: 'telegram',
            clientMessageId: requestMessageId,
          }),
          signal: AbortSignal.timeout(60_000),
        },
      )

      const responseText = await response.text()
      body = responseText ? JSON.parse(responseText) : {}

      if (!response.ok || body?.ok !== true) {
        throw new Error(
          `Live chat HTTP ${response.status}`,
        )
      }
    } catch (error) {
      assistantError = error instanceof Error
        ? error.message
        : String(error)
    }

    const photoRequested = telegramPhotoRequested(content)
    let assistantForTelegram = body?.assistant
    // Product recommendations must be useful without an additional turn:
    // after the AI's summary, Telegram receives one visual catalog card per
    // recommended material. An explicit photo request keeps the same behavior
    // and can additionally fall back to the previous recommendation.
    let photos = telegramProductPhotos(assistantForTelegram, { siteUrl })

    if (photoRequested && !photos.length && !assistantError) {
      const products = await latestRecommendedProducts(
        queryFn,
        identity.conversationId,
      )
      if (products.length) {
        assistantForTelegram = {
          ...assistantForTelegram,
          products,
        }
        photos = telegramProductPhotos(assistantForTelegram, { siteUrl })
      }
    }

    const reply = formatTelegramAssistantReply(
      assistantForTelegram,
      { siteUrl },
    )
    const fallback = assistantError
      ? 'AI-консультант временно недоступен. Попробуйте ещё раз немного позже или напишите «Связаться с менеджером».'
      : ''
    const eventId = body?.assistant?.message?.id
      ?? body?.userMessage?.id
      ?? requestMessageId

    const queued = await enqueueReply(
      queryFn,
      {
        conversationId: identity.conversationId,
        chatId: identity.chatId,
        eventId,
        text: reply || fallback,
        photos: assistantError ? [] : photos,
      },
    )

    return {
      ok: !assistantError,
      conversationId: identity.conversationId,
      duplicate: Boolean(body?.duplicate),
      queued,
      managerRequested:
        body?.conversion?.type === 'handoff',
      assistantError,
    }
  }
}

export const processTelegramLiveChatMessage =
  createTelegramLiveChatBridge()
