import { query, transaction } from './db.mjs'
import { env } from './env.mjs'
import { hashLinkToken, ORDER_STATUS_LABELS } from './order-crm.mjs'

const telegramApi = () => `https://api.telegram.org/bot${env.telegramBotToken}`
export const telegramEnabled = () => Boolean(env.telegramBotToken && env.telegramBotUsername)
async function send(chatId, text) { if (!telegramEnabled()) return false; const response = await fetch(`${telegramApi()}/sendMessage`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ chat_id: chatId, text, disable_web_page_preview: true }), signal: AbortSignal.timeout(10_000) }); return response.ok }
async function customerOrders(customerId) { return (await query(`SELECT public_number,status,total_amount,currency,delivery_method,delivery_company,tracking_number,updated_at FROM orders WHERE customer_id=$1 ORDER BY created_at DESC LIMIT 20`, [customerId])).rows }
function orderText(row) { return `Заказ №${row.public_number}\nСтатус: ${ORDER_STATUS_LABELS[row.status] ?? row.status}\nСумма: ${Number(row.total_amount).toLocaleString('ru-RU')} ${row.currency}\nДоставка: ${row.delivery_method ?? 'уточняется'}${row.delivery_company ? ` (${row.delivery_company})` : ''}${row.tracking_number ? `\nТрек: ${row.tracking_number}` : ''}\nОбновлён: ${new Date(row.updated_at).toLocaleString('ru-RU')}` }

export async function handleTelegramUpdate(update) {
  const message = update?.message
  const userId = message?.from?.id; const chatId = message?.chat?.id
  if (!userId || !chatId) return { ignored: true }
  const text = String(message.text ?? '').trim()
  const start = text.match(/^\/start(?:\s+order_([A-Za-z0-9_-]+))?/)
  if (start?.[1]) {
    const token = hashLinkToken(start[1])
    const linked = await transaction(async client => {
      const found = await client.query(`SELECT * FROM telegram_link_tokens WHERE token_hash=$1 AND expires_at>now() FOR UPDATE`, [token])
      const row = found.rows[0]
      if (!row || row.used_at) return null
      await client.query(`INSERT INTO telegram_customer_links (customer_id,telegram_user_id,telegram_chat_id,telegram_username) VALUES ($1,$2,$3,$4) ON CONFLICT (telegram_user_id) DO UPDATE SET customer_id=EXCLUDED.customer_id,telegram_chat_id=EXCLUDED.telegram_chat_id,telegram_username=EXCLUDED.telegram_username,verified_at=now(),revoked_at=NULL,updated_at=now()`, [row.customer_id, userId, chatId, message.from?.username ?? null])
      await client.query(`UPDATE telegram_link_tokens SET used_at=now() WHERE id=$1`, [row.id])
      return row.customer_id
    })
    if (!linked) { await send(chatId, 'Ссылка недействительна или уже использована. Оформите новую заявку на сайте.'); return { linked: false } }
    await send(chatId, 'Telegram привязан. Теперь здесь доступны только ваши заказы.'); const orders = await customerOrders(linked); if (orders.length) await send(chatId, orders.map(orderText).join('\n\n')); return { linked: true }
  }
  const link = await query(`SELECT customer_id FROM telegram_customer_links WHERE telegram_user_id=$1 AND telegram_chat_id=$2 AND revoked_at IS NULL LIMIT 1`, [userId, chatId])
  if (!link.rowCount) { await send(chatId, 'Для доступа к заказам откройте одноразовую ссылку из подтверждения заявки.'); return { linked: false } }
  if (/^(\/start|мои заказы|текущий заказ|история заказа)$/iu.test(text)) { const orders = await customerOrders(link.rows[0].customer_id); await send(chatId, orders.length ? orders.map(orderText).join('\n\n') : 'Заказов пока нет.'); return { linked: true } }
  if (/^(связаться с менеджером|задать вопрос)$/iu.test(text)) { await send(chatId, 'Передал запрос менеджеру. Он ответит в рабочее время.'); return { linked: true, managerRequest: true } }
  if (/^отвязать аккаунт$/iu.test(text)) { await query(`UPDATE telegram_customer_links SET revoked_at=now(),updated_at=now() WHERE telegram_user_id=$1`, [userId]); await send(chatId, 'Аккаунт Telegram отвязан.'); return { unlinked: true } }
  await send(chatId, 'Доступные команды: Мои заказы, Текущий заказ, История заказа, Задать вопрос, Связаться с менеджером, Отвязать аккаунт.'); return { linked: true }
}

export async function processTelegramOutbox() {
  if (!telegramEnabled()) return { processed: 0, disabled: true }
  const result = await query(`SELECT * FROM notification_outbox WHERE channel='telegram' AND status='pending' AND next_attempt_at<=now() ORDER BY created_at LIMIT 20`)
  let processed = 0
  for (const item of result.rows) {
    const claim = await query(`UPDATE notification_outbox SET status='processing',attempts=attempts+1 WHERE id=$1 AND status='pending' RETURNING *`, [item.id]); if (!claim.rowCount) continue
    const payload = claim.rows[0].payload
    const text = `Заказ №${payload.publicNumber}\n${payload.statusLabel ?? 'Статус обновлён.'}${payload.deliveryCompany ? `\nДоставка: ${payload.deliveryCompany}` : ''}${payload.trackingNumber ? `\nТрек: ${payload.trackingNumber}` : ''}`
    try { const delivered = await send(claim.rows[0].recipient, text); await query(`UPDATE notification_outbox SET status=$2,processed_at=now(),last_error=NULL WHERE id=$1`, [item.id, delivered ? 'sent' : 'skipped']); processed += 1 } catch (error) { await query(`UPDATE notification_outbox SET status=CASE WHEN attempts>=5 THEN 'failed' ELSE 'pending' END,next_attempt_at=now() + (least(attempts,5) * interval '5 minutes'),last_error=$2 WHERE id=$1`, [item.id, String(error?.message ?? error).slice(0, 500)]) }
  }
  return { processed }
}
