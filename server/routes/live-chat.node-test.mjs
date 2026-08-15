import assert from 'node:assert/strict'
import test from 'node:test'
import { normalizeClientMessageId, readPublicToken } from '../lib/live-chat-auth.mjs'

test('live chat token prefers the header and preserves temporary query compatibility', () => {
  const withHeader = { get: name => name === 'X-Ozelif-Live-Chat-Token' ? 'header-token' : null, body: { token: 'body-token' }, query: { token: 'query-token' } }
  assert.equal(readPublicToken(withHeader), 'header-token')
  assert.equal(readPublicToken({ get: () => null, body: undefined, query: { token: 'query-token' } }), 'query-token')
})

test('client message ids have a bounded safe format for a unique database key', () => {
  assert.equal(normalizeClientMessageId('a1b2c3d4-5678'), 'a1b2c3d4-5678')
  assert.equal(normalizeClientMessageId('bad id'), null)
  assert.equal(normalizeClientMessageId('short'), null)
})
