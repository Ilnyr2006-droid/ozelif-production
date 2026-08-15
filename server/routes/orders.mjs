import express from 'express'
import crypto from 'node:crypto'
import { query } from '../lib/db.mjs'
import { env } from '../lib/env.mjs'
import { hashPublicChatToken } from '../lib/live-chat-utils.mjs'
import { createOrder, hashLinkToken, normalizePhone } from '../lib/order-crm.mjs'

const attempts = new Map()
const SESSION_COOKIE = 'ozelif_order_access'
const SESSION_TTL = 20 * 60 * 1000

function asyncRoute(handler) { return (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next) }
function parseCookies(request) { return Object.fromEntries(String(request.headers.cookie ?? '').split(';').map(part => part.trim()).filter(Boolean).map(part => { const index = part.indexOf('='); return index < 0 ? [part, ''] : [part.slice(0, index), decodeURIComponent(part.slice(index + 1))] })) }
function sessionHash(token) { return crypto.createHmac('sha256', env.sessionSecret).update(token).digest('hex') }
function accessCookie(token) { return [`${SESSION_COOKIE}=${encodeURIComponent(token)}`, 'Path=/', 'HttpOnly', 'SameSite=Lax', `Max-Age=${Math.floor(SESSION_TTL / 1000)}`, ...(env.cookieSecure ? ['Secure'] : [])].join('; ') }
function publicOrder(row) { return { number: String(row.public_number), date: row.created_at, status: row.status, totalAmount: row.total_amount, currency: row.currency, deliveryMethod: row.delivery_method, deliveryCompany: row.delivery_company, trackingNumber: row.tracking_number, updatedAt: row.updated_at } }
async function orderWithHistory(orderId) { const [order, history] = await Promise.all([query(`SELECT * FROM orders WHERE id=$1`, [orderId]), query(`SELECT new_status AS status, created_at AS "createdAt" FROM order_status_history WHERE order_id=$1 ORDER BY created_at,id`, [orderId])]); return order.rows[0] ? { ...publicOrder(order.rows[0]), history: history.rows } : null }
function limit(request) { const key = `${request.ip}:${String(request.body?.number ?? '')}`; const now = Date.now(); const item = attempts.get(key) ?? { count: 0, until: 0 }; if (item.until > now) return false; item.count += 1; if (item.count > 6) { item.until = now + 15 * 60_000; item.count = 0 } attempts.set(key, item); return true }

async function linkCheckoutConversation(body, result) {
  const conversationId = String(
    body?.liveChat?.conversationId ?? '',
  ).trim()

  const token = String(
    body?.liveChat?.token ?? '',
  ).trim()

  if (!conversationId || !token) return false

  let customerId = result.customer?.id ?? null

  if (!customerId && result.order?.id) {
    const order = await query(
      `SELECT customer_id
       FROM orders
       WHERE id = $1
       LIMIT 1`,
      [result.order.id],
    )

    customerId = order.rows[0]?.customer_id ?? null
  }

  if (!customerId) return false

  const linked = await query(
    `UPDATE live_chat_conversations
     SET
       customer_id = $3,
       visitor_name = COALESCE(visitor_name, $4),
       visitor_phone = COALESCE(visitor_phone, $5),
       updated_at = now()
     WHERE id = $1
       AND public_token_hash = $2
     RETURNING id`,
    [
      conversationId,
      hashPublicChatToken(token),
      customerId,
      String(body?.name ?? '').trim() || null,
      String(body?.phone ?? '').trim() || null,
    ],
  )

  return linked.rowCount > 0
}

export function createOrdersRouter() {
  const router = express.Router()
  router.post('/checkout', asyncRoute(async (request, response) => {
    const result = await createOrder(request.body, {
      telegramEnabled: Boolean(env.telegramBotToken),
      telegramUsername: env.telegramBotUsername,
    })

    await linkCheckoutConversation(
      request.body,
      result,
    )

    response.status(result.duplicate ? 200 : 201).json({
      ok: true,
      duplicate: Boolean(result.duplicate),
      publicNumber: String(result.order.public_number),
      telegramDeepLink: result.deepLink,
    })
  }))
  router.post('/lookup', asyncRoute(async (request, response) => {
    if (!limit(request)) return response.status(429).json({ error: 'Попробуйте ещё раз позже.' })
    const number = String(request.body?.number ?? '').replace(/\D/g, '')
    const phone = normalizePhone(request.body?.phone)
    if (!number || !phone) return response.status(400).json({ error: 'Укажите номер заказа и телефон.' })
    const result = await query(`SELECT o.id FROM orders o JOIN customers c ON c.id=o.customer_id WHERE o.public_number::text=$1 AND c.normalized_phone=$2 AND c.deleted_at IS NULL LIMIT 1`, [number, phone])
    if (!result.rowCount) return response.status(404).json({ error: 'Не удалось найти заказ по указанным данным. Проверьте номер заказа и телефон.' })
    const token = crypto.randomBytes(32).toString('base64url')
    const expiresAt = new Date(Date.now() + SESSION_TTL).toISOString()
    await query(`INSERT INTO order_access_sessions (token_hash, order_id, expires_at) VALUES ($1,$2,$3)`, [sessionHash(token), result.rows[0].id, expiresAt])
    response.setHeader('Set-Cookie', accessCookie(token))
    response.json({ ok: true, order: await orderWithHistory(result.rows[0].id) })
  }))
  router.get('/:number', asyncRoute(async (request, response) => {
    const token = parseCookies(request)[SESSION_COOKIE]
    if (!token) return response.status(401).json({ error: 'order_access_required' })
    const session = await query(`SELECT order_id FROM order_access_sessions WHERE token_hash=$1 AND expires_at > now() AND revoked_at IS NULL LIMIT 1`, [sessionHash(token)])
    if (!session.rowCount) return response.status(401).json({ error: 'order_access_expired' })
    const number = String(request.params.number).replace(/\D/g, '')
    const order = await query(`SELECT o.id FROM orders o WHERE o.public_number::text=$1 AND o.id=$2 LIMIT 1`, [number, session.rows[0].order_id])
    if (!order.rowCount) return response.status(404).json({ error: 'not_found' })
    response.json({ ok: true, order: await orderWithHistory(order.rows[0].id) })
  }))
  return router
}
