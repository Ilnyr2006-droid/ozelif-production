import assert from 'node:assert/strict'
import test from 'node:test'

import {
  adminTelegramRecipients,
} from './admin-telegram-recipients.mjs'

test('includes the configured static admin Telegram chat', () => {
  assert.deepEqual(
    adminTelegramRecipients([], '-5253539738'),
    [{ chat_id: '-5253539738' }],
  )
})

test('deduplicates static chat against verified subscriptions', () => {
  assert.deepEqual(
    adminTelegramRecipients(
      [
        { chat_id: '-5253539738' },
        { chat_id: '123456789' },
      ],
      '-5253539738',
    ),
    [
      { chat_id: '-5253539738' },
      { chat_id: '123456789' },
    ],
  )
})

test('ignores invalid static and database chat ids', () => {
  assert.deepEqual(
    adminTelegramRecipients(
      [
        { chat_id: '' },
        { chat_id: 'not-a-chat-id' },
        { chat_id: 123456789 },
      ],
      'invalid',
    ),
    [{ chat_id: '123456789' }],
  )
})
