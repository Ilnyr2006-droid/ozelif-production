import crypto from 'node:crypto'
import { transaction } from './db.mjs'
import { normalizePhone } from './phone.mjs'
import { enqueueAdminNotification } from './admin-notifications.mjs'

export const ORDER_STATUSES = Object.freeze(['new', 'confirmed', 'awaiting_payment', 'paid', 'assembling', 'handed_to_delivery', 'in_transit', 'ready_for_pickup', 'completed', 'cancelled'])
export const ORDER_STATUS_LABELS = Object.freeze({ new: 'Новый', confirmed: 'Подтверждён', awaiting_payment: 'Ожидает оплаты', paid: 'Оплачен', assembling: 'Собирается', handed_to_delivery: 'Передан в доставку', in_transit: 'В пути', ready_for_pickup: 'Готов к выдаче', completed: 'Завершён', cancelled: 'Отменён' })

export { normalizePhone } from './phone.mjs'

export function isOrderStatus(value) { return ORDER_STATUSES.includes(value) }
export function createLinkToken() { return crypto.randomBytes(32).toString('base64url') }
export function hashLinkToken(token) { return crypto.createHash('sha256').update(String(token)).digest('hex') }

function decimal(value) { const result = Number(value); return Number.isFinite(result) && result > 0 ? result : null }
function clean(value, limit = 1000) { const text = String(value ?? '').trim(); return text ? text.slice(0, limit) : null }
function dateOnly(value) {
  const text = clean(value, 10)
  if (!text) return null
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text) || Number.isNaN(Date.parse(`${text}T00:00:00Z`))) {
    const error = new Error('Некорректная желаемая дата доставки')
    error.status = 400
    throw error
  }
  return text
}

async function resolveLine(client, item) {
  const productId = clean(item?.productId, 180)
  const variantId = clean(item?.variantId, 180)
  const quantity = decimal(item?.quantity)
  if (!productId || !variantId || !quantity) { const error = new Error('Некорректный состав заказа'); error.status = 400; throw error }
  const result = await client.query(`SELECT p.id AS product_id, p.name AS product_name, p.sku AS product_sku, p.unit AS product_unit, c.name AS category_name, v.id AS variant_id, v.name AS variant_name, v.sku AS variant_sku, v.price, v.unit, v.attributes
    FROM products p JOIN categories c ON c.id=p.category_id JOIN product_variants v ON v.product_id = p.id
    WHERE (p.legacy_id = $1 OR p.id::text = $1) AND (v.legacy_id = $2 OR v.id::text = $2) AND p.is_published = true AND v.is_active = true LIMIT 1`, [productId, variantId])
  const row = result.rows[0]
  if (!row) { const error = new Error('Один из материалов больше недоступен'); error.status = 409; throw error }
  const price = decimal(row.price)
  return { productId: row.product_id, variantId: row.variant_id, productName: row.product_name, categoryName: row.category_name, sku: row.variant_sku ?? row.product_sku, price, quantity, unit: row.unit ?? row.product_unit, lineTotal: price ? Math.round(price * quantity * 100) / 100 : 0, selectedOptions: row.attributes ?? {} }
}

export async function createOrderWithClient(
  client,
  input,
  {
    telegramEnabled = false,
    telegramUsername = '',
  } = {},
) {
  const phone = normalizePhone(input?.phone)
  const name = clean(input?.name, 160)
  const idempotencyKey = clean(input?.idempotencyKey, 160)
  const source = (
    input?.source === 'ai_chat'
      ? 'ai_chat'
      : 'website_cart'
  )
  const items = Array.isArray(input?.items) ? input.items : []
  if (!phone || !items.length) { const error = new Error('Укажите телефон и хотя бы один материал'); error.status = 400; throw error }
  if (!idempotencyKey) { const error = new Error('Не удалось защитить заявку от повторной отправки'); error.status = 400; throw error }
  if (input?.privacyConsent !== true) { const error = new Error('Подтвердите согласие на обработку персональных данных'); error.status = 400; throw error }
  if (idempotencyKey) {
      const existing = await client.query(
        `SELECT *
         FROM orders
         WHERE source = $2
           AND idempotency_key = $1
         FOR UPDATE`,
        [idempotencyKey, source],
      )
      if (existing.rowCount) return { order: existing.rows[0], customer: null, deepLink: null, duplicate: true }
    }
    const customer = await client.query(`INSERT INTO customers (name, original_phone, normalized_phone, email) VALUES ($1,$2,$3,$4)
      ON CONFLICT (normalized_phone) DO UPDATE SET name = COALESCE(EXCLUDED.name, customers.name), original_phone = EXCLUDED.original_phone, email = COALESCE(EXCLUDED.email, customers.email), updated_at = now(),
         deleted_at = NULL
      RETURNING *`, [name, clean(input.phone, 80), phone, clean(input?.email, 240)])
    const lines = []
    for (const item of items) lines.push(await resolveLine(client, item))
    const total = lines.reduce((sum, line) => sum + line.lineTotal, 0)
    const orderResult = await client.query(`INSERT INTO orders (customer_id, total_amount, customer_name_snapshot, customer_phone_snapshot, customer_email_snapshot, delivery_method, delivery_address, delivery_city, desired_delivery_date, customer_comment, privacy_consent_at, source, idempotency_key)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,now(),$11,$12) RETURNING *`, [customer.rows[0].id, total, name, phone, clean(input?.email, 240), clean(input?.deliveryMethod, 120), clean(input?.deliveryAddress, 1000), clean(input?.city, 160), dateOnly(input?.desiredDeliveryDate), clean(input?.comment, 2000), source, idempotencyKey])
    const order = orderResult.rows[0]
    for (const line of lines) await client.query(`INSERT INTO order_items (order_id, product_id, variant_id, product_name_snapshot, category_name_snapshot, sku_snapshot, price_snapshot, quantity, unit, line_total, selected_options)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`, [order.id, line.productId, line.variantId, line.productName, line.categoryName, line.sku, line.price, line.quantity, line.unit, line.lineTotal, line.selectedOptions])
    await client.query(
      `INSERT INTO order_status_history (
         order_id,
         new_status,
         source
       )
       VALUES ($1, 'new', $2)`,
      [order.id, source],
    )
    await enqueueAdminNotification(
      client,
      {
        eventType: 'order.created',
        aggregateType: 'order',
        aggregateId: order.id,
        payload: {
          name,
          phone: clean(input?.phone, 80) ?? phone,
          total,
          source,
          deliveryMethod: clean(input?.deliveryMethod, 120),
          city: clean(input?.city, 160),
          deliveryAddress: clean(input?.deliveryAddress, 1000),
          comment: clean(input?.comment, 2000),
          items: lines.map(line => ({
            name: line.productName,
            quantity: line.quantity,
            unit: line.unit,
          })),
        },
      },
    )
    let deepLink = null
    if (telegramEnabled && telegramUsername) {
      const token = createLinkToken()
      await client.query(`INSERT INTO telegram_link_tokens (token_hash, customer_id, order_id, expires_at) VALUES ($1,$2,$3,now() + interval '30 minutes')`, [hashLinkToken(token), customer.rows[0].id, order.id])
      deepLink = `https://t.me/${telegramUsername}?start=order_${token}`
    }
    return {
      order,
      customer: customer.rows[0],
      deepLink,
    }
}

export async function createOrder(
  input,
  options = {},
) {
  return transaction(
    client => createOrderWithClient(
      client,
      input,
      options,
    ),
  )
}

export async function changeOrderStatus(orderId, input, adminId, query) {
  const nextStatus = String(input?.status ?? '')
  if (!isOrderStatus(nextStatus)) { const error = new Error('Недопустимый статус заказа'); error.status = 400; throw error }
  if (nextStatus === 'cancelled' && !clean(input?.comment, 1000)) { const error = new Error('Укажите причину отмены'); error.status = 400; throw error }
  return transaction(async client => {
    const previous = await client.query('SELECT * FROM orders WHERE id = $1 FOR UPDATE', [orderId])
    if (!previous.rowCount) { const error = new Error('Заказ не найден'); error.status = 404; throw error }
    const order = previous.rows[0]
    const updated = await client.query(`UPDATE orders SET status=$2, delivery_company=COALESCE($3,delivery_company), tracking_number=COALESCE($4,tracking_number), manager_comment=COALESCE($5,manager_comment), responsible_admin_id=COALESCE($6,responsible_admin_id), updated_at=now(), cancelled_at=CASE WHEN $2='cancelled' THEN now() ELSE cancelled_at END, completed_at=CASE WHEN $2='completed' THEN now() ELSE completed_at END WHERE id=$1 RETURNING *`, [orderId, nextStatus, clean(input?.deliveryCompany,160), clean(input?.trackingNumber,240), clean(input?.managerComment,2000), adminId ?? null])
    await client.query(`INSERT INTO order_status_history (order_id, old_status, new_status, comment, changed_by_admin_id, source) VALUES ($1,$2,$3,$4,$5,'admin')`, [orderId, order.status, nextStatus, clean(input?.comment,1000), adminId ?? null])
    const links = await client.query(`SELECT telegram_chat_id::text FROM telegram_customer_links WHERE customer_id=$1 AND revoked_at IS NULL`, [order.customer_id])
    for (const link of links.rows) await client.query(`INSERT INTO notification_outbox (event_type,aggregate_type,aggregate_id,channel,recipient,payload) VALUES ($1,'order',$2,'telegram',$3,$4) ON CONFLICT DO NOTHING`, [`order.${nextStatus}`, orderId, link.telegram_chat_id, JSON.stringify({ publicNumber: order.public_number, status: nextStatus, statusLabel: ORDER_STATUS_LABELS[nextStatus], deliveryCompany: updated.rows[0].delivery_company, trackingNumber: updated.rows[0].tracking_number })])
    return updated.rows[0]
  })
}
