import assert from 'node:assert/strict'
import test from 'node:test'
import { syncCustomerFromLiveChatContact } from './customer-contact.mjs'

function createTransactionHarness() {
  const calls = []
  const client = {
    async query(sql, values = []) {
      calls.push({ sql, values })
      if (sql.includes('FROM live_chat_conversations') && sql.includes('FOR UPDATE')) {
        return { rowCount: 1, rows: [{ id: 'chat-1', visitor_name: 'Старое имя', visitor_phone: '+7 903 370-78-54' }] }
      }
      if (sql.includes('INSERT INTO customers')) {
        return { rowCount: 1, rows: [{ id: 'customer-1', name: 'Старое имя', original_phone: '+7 903 370-78-54', normalized_phone: '+79033707854', source: 'ai_chat' }] }
      }
      if (sql.includes('UPDATE live_chat_conversations')) {
        return { rowCount: 1, rows: [{ id: 'chat-1', visitorName: 'Старое имя', visitorPhone: '+7 903 370-78-54', customerId: 'customer-1' }] }
      }
      throw new Error(`Unexpected SQL: ${sql}`)
    },
  }
  return { calls, transactionImpl: callback => callback(client) }
}

test('AI chat contact creates or reuses one customer and links the chat without an order', async () => {
  const harness = createTransactionHarness()
  const result = await syncCustomerFromLiveChatContact({
    conversationId: 'chat-1',
    name: 'Иван',
    phone: '8 (903) 370-78-54',
  }, harness)

  assert.equal(result.customer.id, 'customer-1')
  assert.equal(result.conversation.customerId, 'customer-1')
  const upsert = harness.calls.find(call => call.sql.includes('INSERT INTO customers'))
  assert.deepEqual(upsert.values, ['Иван', '8 (903) 370-78-54', '+79033707854'])
  assert.match(upsert.sql, /ON CONFLICT \(normalized_phone\)/)
  assert.equal(harness.calls.some(call => /INSERT INTO orders|INSERT INTO order_items/.test(call.sql)), false)
})

test('empty AI name does not replace a saved customer name', async () => {
  const harness = createTransactionHarness()
  await syncCustomerFromLiveChatContact({
    conversationId: 'chat-1',
    name: '',
    phone: '+7 903 370-78-54',
  }, harness)

  const upsert = harness.calls.find(call => call.sql.includes('INSERT INTO customers'))
  assert.equal(upsert.values[0], 'Старое имя')
  assert.match(upsert.sql, /WHEN customers\.name IS NULL OR btrim\(customers\.name\) = ''/)
  const chatUpdate = harness.calls.find(call => call.sql.includes('UPDATE live_chat_conversations'))
  assert.equal(chatUpdate.values[1], null)
})

test('invalid AI chat phone does not create a customer or an order', async () => {
  const harness = createTransactionHarness()
  const result = await syncCustomerFromLiveChatContact({ conversationId: 'chat-1', name: 'Иван', phone: '51' }, harness)
  assert.equal(result, null)
  assert.equal(harness.calls.length, 0)
})
