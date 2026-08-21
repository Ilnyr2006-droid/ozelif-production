import assert from 'node:assert/strict'
import test from 'node:test'
import { normalizeClientMessageId, readPublicToken } from '../lib/live-chat-auth.mjs'
import {
  telegramNamedProductOrderRequest,
  telegramSelectedProductOrderRequest,
  telegramSelectedProductRequest,
} from './live-chat.mjs'

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

test('accepts a selected product only from the Telegram bridge payload', () => {
  assert.deepEqual(telegramSelectedProductRequest({
    path: 'telegram',
    telegramSelection: {
      productName: 'Chelsea Pink',
      userMessage: 'Можно её заказать?',
    },
  }), {
    productName: 'Chelsea Pink',
    userMessage: 'Можно её заказать?',
  })
  assert.equal(telegramSelectedProductRequest({
    path: '/odejnayakozha',
    telegramSelection: { productName: 'Chelsea Pink', userMessage: 'Заказать' },
  }), null)
})

test('recognizes an order request made in response to a product card', () => {
  assert.equal(telegramSelectedProductOrderRequest('Можно её заказать?'), true)
  assert.equal(telegramSelectedProductOrderRequest('Расскажи подробнее'), false)
})

test('adds an exact published catalog product named in a Telegram order request', () => {
  const products = [
    { id: 'soft-white-black', name: 'Soft White-Black' },
    { id: 'chelsea-pink', name: 'Chelsea Pink' },
  ]

  assert.deepEqual(
    telegramNamedProductOrderRequest(
      'Добавь в заказ Soft White-Black',
      products,
    ),
    {
      id: 'soft-white-black',
      name: 'Soft White-Black',
      normalizedName: 'soft white black',
    },
  )
  assert.equal(
    telegramNamedProductOrderRequest('Расскажи про Soft White-Black', products),
    null,
  )
})
