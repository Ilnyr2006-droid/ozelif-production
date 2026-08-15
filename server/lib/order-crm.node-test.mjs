import assert from 'node:assert/strict'
import test from 'node:test'
import { ORDER_STATUS_LABELS, createLinkToken, hashLinkToken, isOrderStatus, normalizePhone } from './order-crm.mjs'

test('normalizes Russian phone formats to one customer key', () => {
  assert.equal(normalizePhone('+7 (903) 370-78-54'), '+79033707854')
  assert.equal(normalizePhone('8 903 370 78 54'), '+79033707854')
  assert.equal(normalizePhone('9033707854'), '+79033707854')
  assert.equal(normalizePhone('123'), null)
})

test('order statuses have a validated public Russian label', () => {
  assert.equal(isOrderStatus('in_transit'), true)
  assert.equal(isOrderStatus('made_up'), false)
  assert.equal(ORDER_STATUS_LABELS.cancelled, 'Отменён')
})

test('telegram links use opaque random hashable tokens', () => {
  const token = createLinkToken()
  assert.match(token, /^[A-Za-z0-9_-]{40,}$/)
  assert.equal(hashLinkToken(token).length, 64)
  assert.notEqual(hashLinkToken(token), hashLinkToken(createLinkToken()))
})
