import assert from 'node:assert/strict'
import test from 'node:test'
import {
  enqueueAdminNotification,
  safeEnqueueAdminNotification,
} from './admin-notifications.mjs'

test('queues one generic admin CRM outbox row', async () => {
  const calls = []
  await enqueueAdminNotification(
    async (...args) => {
      calls.push(args)
      return { rowCount: 1 }
    },
    {
      eventType: 'lead.created',
      aggregateType: 'lead',
      aggregateId: '11111111-1111-4111-8111-111111111111',
      payload: { name: 'Ильнур', phone: '+79990000000' },
    },
  )
  assert.equal(calls.length, 1)
  assert.match(calls[0][0], /channel/iu)
  assert.equal(calls[0][1][0], 'lead.created')
  assert.match(calls[0][1][3], /Ильнур/u)
})

test('safe queue never breaks customer request', async () => {
  const errors = []
  const ok = await safeEnqueueAdminNotification(
    async () => { throw new Error('db notification failure') },
    {
      eventType: 'lead.created',
      aggregateType: 'lead',
      aggregateId: '11111111-1111-4111-8111-111111111111',
    },
    { logger: { error: (...args) => errors.push(args) } },
  )
  assert.equal(ok, false)
  assert.equal(errors.length, 1)
})
