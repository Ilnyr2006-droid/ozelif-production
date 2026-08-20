import { query, transaction } from './db.mjs'
import { env } from './env.mjs'
import { hashLinkToken, ORDER_STATUS_LABELS } from './order-crm.mjs'
import { adminTelegramRecipients } from './admin-telegram-recipients.mjs'

const telegramApi = () => `https://api.telegram.org/bot${env.telegramBotToken}`
export const telegramEnabled = () => Boolean(env.telegramBotToken && env.telegramBotUsername)

function clean(value, limit = 900) {
  const text = String(value ?? '').trim()
  return text ? text.slice(0, limit) : null
}

function money(value) {
  const number = Number(value)
  if (!Number.isFinite(number)) return null
  return `${number.toLocaleString('ru-RU')} ₽`
}

function fulfillment(value) {
  const method = String(value ?? '').trim()
  if (method === 'pickup') return 'Самовывоз'
  if (method === 'courier') return 'Доставка'
  return clean(method, 120)
}

async function send(chatId, text) {
  if (!telegramEnabled()) return false
  const response = await fetch(`${telegramApi()}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text: String(text ?? '').slice(0, 4_000),
      disable_web_page_preview: true,
    }),
    signal: AbortSignal.timeout(10_000),
  })
  if (!response.ok) {
    let description = response.statusText
    try {
      const payload = await response.json()
      description = payload.description ?? description
    } catch {}
    throw new Error(`Telegram sendMessage: ${description}`)
  }
  return true
}

async function customerOrders(customerId) {
  return (await query(
    `SELECT public_number,status,total_amount,currency,delivery_method,
            delivery_company,tracking_number,updated_at
     FROM orders WHERE customer_id=$1 ORDER BY created_at DESC LIMIT 20`,
    [customerId],
  )).rows
}

function orderText(row) {
  return `Заказ №${row.public_number}\nСтатус: ${ORDER_STATUS_LABELS[row.status] ?? row.status}\nСумма: ${Number(row.total_amount).toLocaleString('ru-RU')} ${row.currency}\nДоставка: ${row.delivery_method ?? 'уточняется'}${row.delivery_company ? ` (${row.delivery_company})` : ''}${row.tracking_number ? `\nТрек: ${row.tracking_number}` : ''}\nОбновлён: ${new Date(row.updated_at).toLocaleString('ru-RU')}`
}

function addLine(lines, label, value) {
  const normalized = clean(value)
  if (normalized) lines.push(`${label}: ${normalized}`)
}

function itemLines(items) {
  if (!Array.isArray(items)) return []
  return items.slice(0, 8).flatMap(item => {
    const name = clean(item?.name, 240)
    if (!name) return []
    const quantity = Number(item?.quantity)
    const unit = clean(item?.unit, 40)
    return [`• ${name}${Number.isFinite(quantity) ? ` — ${quantity.toLocaleString('ru-RU')}${unit ? ` ${unit}` : ''}` : ''}`]
  })
}

export function formatAdminNotificationText(item, { siteUrl = env.siteUrl } = {}) {
  const payload = item?.payload && typeof item.payload === 'object' && !Array.isArray(item.payload)
    ? item.payload
    : {}
  const lines = []

  switch (item?.event_type) {
    case 'order.created': {
      lines.push('🛒 Новый заказ')
      addLine(lines, 'Клиент', payload.name)
      addLine(lines, 'Телефон', payload.phone)
      const products = itemLines(payload.items)
      if (products.length) lines.push('', 'Товары:', ...products)
      const total = money(payload.total)
      if (total) lines.push('', `Сумма: ${total}`)
      addLine(lines, 'Получение', fulfillment(payload.deliveryMethod))
      addLine(lines, 'Город', payload.city)
      addLine(lines, 'Адрес', payload.deliveryAddress)
      addLine(lines, 'Комментарий', payload.comment)
      break
    }
    case 'wholesale.created':
      lines.push('📦 Новая оптовая заявка')
      addLine(lines, 'Клиент', payload.name)
      addLine(lines, 'Телефон', payload.phone)
      addLine(lines, 'Компания', payload.company)
      addLine(lines, 'Город', payload.city)
      addLine(lines, 'Категория', payload.category)
      addLine(lines, 'Объём', payload.volume)
      addLine(lines, 'Комментарий', payload.comment)
      break
    case 'production.created':
      lines.push('🧵 Новая заявка на производство')
      addLine(lines, 'Клиент', payload.name)
      addLine(lines, 'Телефон', payload.phone)
      addLine(lines, 'Изделие', payload.productType)
      addLine(lines, 'Количество', payload.quantity)
      addLine(lines, 'Комментарий', payload.comment)
      break
    case 'manager_lead.created':
      lines.push('📞 Новый запрос менеджеру')
      addLine(lines, 'Клиент', payload.name)
      addLine(lines, 'Телефон', payload.phone)
      addLine(lines, 'Комментарий', payload.comment)
      break
    case 'chat.manager_requested':
      lines.push('💬 Клиент просит менеджера')
      addLine(lines, 'Клиент', payload.name ?? 'Не представился')
      addLine(lines, 'Телефон', payload.phone ?? 'Ещё не указан')
      addLine(lines, 'Страница', payload.pagePath)
      addLine(lines, 'Сообщение', payload.message)
      break
    default:
      lines.push('🔔 Новое событие OZELIF')
      addLine(lines, 'Тип', item?.event_type)
  }

  if (siteUrl) lines.push('', `Админка: ${siteUrl}/admin/`)
  return lines.join('\n').slice(0, 4_000)
}

async function activeAdminSubscription(userId, chatId) {
  const result = await query(
    `SELECT id,admin_user_id,telegram_user_id,telegram_chat_id
     FROM telegram_admin_subscriptions
     WHERE telegram_user_id=$1 AND telegram_chat_id=$2
       AND is_active=true AND revoked_at IS NULL LIMIT 1`,
    [userId, chatId],
  )
  return result.rows[0] ?? null
}

async function handleAdminStart(message, rawToken) {
  const userId = message?.from?.id
  const chatId = message?.chat?.id
  const chatType = String(message?.chat?.type ?? '')
  if (!userId || !chatId || !rawToken) return { linked: false }
  if (chatType !== 'private') {
    await send(
      chatId,
      'Доступ к служебным уведомлениям OZELIF можно подключить только в личном чате с ботом.',
    )
    return { linked: false, privateChatRequired: true }
  }
  const tokenHash = hashLinkToken(rawToken)
  const linked = await transaction(async client => {
    const found = await client.query(
      `SELECT * FROM telegram_admin_link_tokens
       WHERE token_hash=$1 AND expires_at>now() AND used_at IS NULL FOR UPDATE`,
      [tokenHash],
    )
    const token = found.rows[0]
    if (!token) return null
    await client.query(
      `INSERT INTO telegram_admin_subscriptions (
         admin_user_id,telegram_user_id,telegram_chat_id,telegram_username,
         is_active,verified_at,revoked_at,updated_at
       ) VALUES ($1,$2,$3,$4,true,now(),null,now())
       ON CONFLICT (telegram_user_id) DO UPDATE SET
         admin_user_id=EXCLUDED.admin_user_id,
         telegram_chat_id=EXCLUDED.telegram_chat_id,
         telegram_username=EXCLUDED.telegram_username,
         is_active=true,verified_at=now(),revoked_at=null,updated_at=now()`,
      [token.admin_user_id, userId, chatId, message.from?.username ?? null],
    )
    await client.query(`UPDATE telegram_admin_link_tokens SET used_at=now() WHERE id=$1`, [token.id])
    return token.admin_user_id
  })
  if (!linked) {
    await send(chatId, 'Ссылка для уведомлений недействительна или уже использована. Создайте новую.')
    return { linked: false }
  }
  await send(
    chatId,
    '✅ Уведомления OZELIF для менеджера включены.\n\nНа этот телефон будут приходить новые заказы, оптовые заявки, заявки на производство, запросы менеджеру и просьбы позвать менеджера из AI-чата.\n\nКоманда: /notifications',
  )
  return { linked: true, admin: true }
}

export async function handleTelegramUpdate(update) {
  const message = update?.message
  const userId = message?.from?.id
  const chatId = message?.chat?.id
  if (!userId || !chatId) return { ignored: true }
  const text = String(message.text ?? '').trim()

  const adminStart = text.match(/^\/start(?:@\w+)?\s+admin_([A-Za-z0-9_-]+)$/u)
  if (adminStart?.[1]) return handleAdminStart(message, adminStart[1])

  const adminSubscription = await activeAdminSubscription(userId, chatId)
  if (adminSubscription && /^(\/notifications|уведомления)$/iu.test(text)) {
    await send(chatId, '✅ Уведомления менеджера включены.\nДля отключения: /stop_notifications')
    return { admin: true, notifications: true }
  }
  if (adminSubscription && /^(\/stop_notifications|отключить уведомления)$/iu.test(text)) {
    await query(
      `UPDATE telegram_admin_subscriptions SET is_active=false,revoked_at=now(),updated_at=now() WHERE telegram_user_id=$1`,
      [userId],
    )
    await send(chatId, 'Уведомления менеджера отключены.')
    return { admin: true, notifications: false }
  }

  const start = text.match(/^\/start(?:@\w+)?(?:\s+order_([A-Za-z0-9_-]+))?/u)
  if (start?.[1]) {
    const token = hashLinkToken(start[1])
    const linked = await transaction(async client => {
      const found = await client.query(
        `SELECT * FROM telegram_link_tokens WHERE token_hash=$1 AND expires_at>now() FOR UPDATE`,
        [token],
      )
      const row = found.rows[0]
      if (!row || row.used_at) return null
      await client.query(
        `INSERT INTO telegram_customer_links (customer_id,telegram_user_id,telegram_chat_id,telegram_username)
         VALUES ($1,$2,$3,$4)
         ON CONFLICT (telegram_user_id) DO UPDATE SET customer_id=EXCLUDED.customer_id,
           telegram_chat_id=EXCLUDED.telegram_chat_id,telegram_username=EXCLUDED.telegram_username,
           verified_at=now(),revoked_at=NULL,updated_at=now()`,
        [row.customer_id, userId, chatId, message.from?.username ?? null],
      )
      await client.query(`UPDATE telegram_link_tokens SET used_at=now() WHERE id=$1`, [row.id])
      return row.customer_id
    })
    if (!linked) {
      await send(chatId, 'Ссылка недействительна или уже использована. Оформите новую заявку на сайте.')
      return { linked: false }
    }
    await send(chatId, 'Telegram привязан. Теперь здесь доступны только ваши заказы.')
    const orders = await customerOrders(linked)
    if (orders.length) await send(chatId, orders.map(orderText).join('\n\n'))
    return { linked: true }
  }

  const link = await query(
    `SELECT customer_id FROM telegram_customer_links
     WHERE telegram_user_id=$1 AND telegram_chat_id=$2 AND revoked_at IS NULL LIMIT 1`,
    [userId, chatId],
  )
  if (!link.rowCount) {
    if (adminSubscription) {
      await send(chatId, 'Уведомления менеджера активны.\nКоманда: /notifications')
      return { admin: true }
    }
    await send(chatId, 'Для доступа к заказам откройте одноразовую ссылку из подтверждения заявки.')
    return { linked: false }
  }
  if (/^(\/start|мои заказы|текущий заказ|история заказа)$/iu.test(text)) {
    const orders = await customerOrders(link.rows[0].customer_id)
    await send(chatId, orders.length ? orders.map(orderText).join('\n\n') : 'Заказов пока нет.')
    return { linked: true }
  }
  if (/^(связаться с менеджером|задать вопрос)$/iu.test(text)) {
    await send(chatId, 'Передал запрос менеджеру. Он ответит в рабочее время.')
    return { linked: true, managerRequest: true }
  }
  if (/^отвязать аккаунт$/iu.test(text)) {
    await query(`UPDATE telegram_customer_links SET revoked_at=now(),updated_at=now() WHERE telegram_user_id=$1`, [userId])
    await send(chatId, 'Аккаунт Telegram отвязан.')
    return { unlinked: true }
  }
  await send(chatId, 'Доступные команды: Мои заказы, Текущий заказ, История заказа, Задать вопрос, Связаться с менеджером, Отвязать аккаунт.')
  return { linked: true }
}

async function pendingAdminSubscriptions() {
  const subscriptions = (await query(
    `SELECT telegram_chat_id::text AS chat_id
     FROM telegram_admin_subscriptions
     WHERE is_active=true AND revoked_at IS NULL ORDER BY verified_at`,
  )).rows

  return adminTelegramRecipients(
    subscriptions,
    env.telegramAdminChatId,
  )
}

async function claimOutbox(id) {
  const result = await query(
    `UPDATE notification_outbox SET status='processing',attempts=attempts+1
     WHERE id=$1 AND status='pending' RETURNING *`,
    [id],
  )
  return result.rows[0] ?? null
}

async function markOutboxSent(id) {
  await query(`UPDATE notification_outbox SET status='sent',processed_at=now(),last_error=NULL WHERE id=$1`, [id])
}

async function retryOutbox(item, error) {
  await query(
    `UPDATE notification_outbox SET
       status=CASE WHEN attempts>=5 THEN 'failed' ELSE 'pending' END,
       next_attempt_at=now() + (LEAST(attempts,5) * interval '1 minute'),
       last_error=$2
     WHERE id=$1`,
    [item.id, String(error?.message ?? error).slice(0, 500)],
  )
}

export async function processTelegramOutbox() {
  if (!telegramEnabled()) return { processed: 0, disabled: true }
  const [items, admins] = await Promise.all([
    query(
      `SELECT * FROM notification_outbox
       WHERE channel IN ('telegram','admin') AND status='pending'
         AND next_attempt_at<=now() ORDER BY created_at LIMIT 40`,
    ),
    pendingAdminSubscriptions(),
  ])
  let processed = 0
  for (const queued of items.rows) {
    if (queued.channel === 'admin' && !admins.length) continue
    const item = await claimOutbox(queued.id)
    if (!item) continue
    try {
      if (item.channel === 'admin') {
        const text = formatAdminNotificationText(item)
        for (const admin of admins) await send(admin.chat_id, text)
      } else {
        const payload = item.payload ?? {}
        const text = `Заказ №${payload.publicNumber}\n${payload.statusLabel ?? 'Статус обновлён.'}${payload.deliveryCompany ? `\nДоставка: ${payload.deliveryCompany}` : ''}${payload.trackingNumber ? `\nТрек: ${payload.trackingNumber}` : ''}`
        await send(item.recipient, text)
      }
      await markOutboxSent(item.id)
      processed += 1
    } catch (error) {
      await retryOutbox(item, error)
    }
  }
  return { processed, adminSubscribers: admins.length }
}
