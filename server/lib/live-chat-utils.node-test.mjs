import assert from 'node:assert/strict'
import test from 'node:test'
import {
  assistantHistory,
  createPublicChatToken,
  hashPublicChatToken,
  messagesAfterContextReset,
  normalizeChatContent,
} from './live-chat-utils.mjs'

test('creates non-reversible public conversation token', () => {
  const token = createPublicChatToken()
  const hash = hashPublicChatToken(token)

  assert.ok(token.length >= 32)
  assert.equal(hash.length, 64)
  assert.notEqual(hash, token)
})

test('keeps only messages written after the latest context reset', () => {
  assert.deepEqual(messagesAfterContextReset([
    { role: 'user', content: 'Старый вопрос' },
    { role: 'assistant', content: 'Старый ответ' },
    { role: 'system', content: 'Сброс', metadata: { type: 'context_reset' } },
    { role: 'user', content: 'Новый вопрос' },
  ]), [
    { role: 'user', content: 'Новый вопрос' },
  ])
})

test('normalizes and limits chat content', () => {
  assert.equal(normalizeChatContent('  привет  '), 'привет')
  assert.equal(normalizeChatContent('x'.repeat(5_000)).length, 4_000)
})

test('maps manager messages to assistant history', () => {
  assert.deepEqual(
    assistantHistory([
      { role: 'system', content: 'hidden' },
      { role: 'user', content: 'Здравствуйте' },
      { role: 'manager', content: 'Добрый день' },
    ]),
    [
      { role: 'user', content: 'Здравствуйте' },
      { role: 'assistant', content: 'Добрый день' },
    ],
  )
})
