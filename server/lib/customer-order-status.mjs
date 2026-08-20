import { ORDER_STATUS_LABELS } from './order-crm.mjs'
import { normalizePhone } from './phone.mjs'

export async function findLatestOrderStatusByPhone(query, phone) {
  const normalizedPhone = normalizePhone(phone)
  if (!normalizedPhone) {
    const error = new Error('Укажите корректный номер телефона')
    error.status = 400
    error.code = 'invalid_phone'
    throw error
  }

  const result = await query(
    `SELECT o.public_number, o.status
     FROM orders o
     JOIN customers c ON c.id = o.customer_id
     WHERE c.normalized_phone = $1
     ORDER BY o.created_at DESC
     LIMIT 1`,
    [normalizedPhone],
  )

  const order = result.rows[0]
  if (!order) return null

  return {
    publicNumber: order.public_number,
    status: order.status,
    statusLabel: ORDER_STATUS_LABELS[order.status] ?? String(order.status ?? ''),
  }
}
