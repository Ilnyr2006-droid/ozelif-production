import { transaction } from './db.mjs'
import { normalizePhone } from './phone.mjs'

function clean(value, limit) {
  const text = String(value ?? '').trim().replace(/\s+/gu, ' ')
  return text ? text.slice(0, limit) : null
}

/**
 * Persists a verified live-chat contact in the same customer record used by
 * checkout. This deliberately has no order side effects.
 */
export async function syncCustomerFromLiveChatContact(input, { transactionImpl = transaction } = {}) {
  const conversationId = clean(input?.conversationId, 80)
  const originalPhone = clean(input?.phone, 80)
  const normalizedPhone = normalizePhone(originalPhone)
  const name = clean(input?.name, 160)

  if (!conversationId || !normalizedPhone) return null

  return transactionImpl(async client => {
    const conversation = await client.query(
      `SELECT id, visitor_name, visitor_phone
       FROM live_chat_conversations
       WHERE id = $1
       FOR UPDATE`,
      [conversationId],
    )

    if (!conversation.rowCount) {
      const error = new Error('conversation_not_found')
      error.status = 404
      throw error
    }

    const customer = await client.query(
      `INSERT INTO customers (name, original_phone, normalized_phone, source)
       VALUES ($1, $2, $3, 'ai_chat')
       ON CONFLICT (normalized_phone) DO UPDATE SET
         name = CASE
           WHEN customers.name IS NULL OR btrim(customers.name) = ''
             THEN EXCLUDED.name
           ELSE customers.name
         END,
         original_phone = CASE
           WHEN customers.original_phone IS NULL OR btrim(customers.original_phone) = ''
             THEN EXCLUDED.original_phone
           ELSE customers.original_phone
         END,
         source = COALESCE(customers.source, EXCLUDED.source),
         updated_at = now(),
         deleted_at = NULL
       RETURNING id, name, original_phone, normalized_phone, source`,
      [name ?? conversation.rows[0].visitor_name ?? null, originalPhone, normalizedPhone],
    )

    const updatedConversation = await client.query(
      `UPDATE live_chat_conversations
       SET
         visitor_name = COALESCE($2, visitor_name),
         visitor_phone = COALESCE($3, visitor_phone),
         customer_id = $4,
         updated_at = now()
       WHERE id = $1
       RETURNING
         id,
         visitor_name AS "visitorName",
         visitor_phone AS "visitorPhone",
         customer_id AS "customerId"`,
      [conversationId, name, originalPhone, customer.rows[0].id],
    )

    return {
      customer: customer.rows[0],
      conversation: updatedConversation.rows[0],
    }
  })
}
