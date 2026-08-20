import assert from 'node:assert/strict'
import test from 'node:test'
process.env.DATABASE_URL ??= 'postgres://example:example@127.0.0.1:5432/example'
process.env.ADMIN_SESSION_SECRET ??= 'order-status-test-secret'
const { findLatestOrderStatusByPhone } = await import('./customer-order-status.mjs')

test('normalizes Russian phone and returns status', async () => {
  let received = null
  const order = await findLatestOrderStatusByPhone(async (_sql, values) => {
    received = values[0]
    return { rows: [{ public_number: 16, status: 'assembling' }] }
  }, '8 (996) 828-84-05')
  assert.equal(received, '+79968288405')
  assert.deepEqual(order, { publicNumber: 16, status: 'assembling', statusLabel: 'Собирается' })
})

test('returns null when order is absent', async () => {
  assert.equal(await findLatestOrderStatusByPhone(async () => ({ rows: [] }), '+7 999 111-22-33'), null)
})

test('rejects invalid phone', async () => {
  await assert.rejects(() => findLatestOrderStatusByPhone(async () => ({ rows: [] }), '12345'), /корректный номер/u)
})
