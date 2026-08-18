import assert from 'node:assert/strict'
import test from 'node:test'

import {
  formatChatOrderDraftReply,
  orderDraftMissingFields,
} from './chat-order.mjs'

const readyDraft = {
  status: 'awaiting_confirmation',
  revision: 2,
  confirmedRevision: null,
  deliveryMethod: 'pickup',
  items: [
    {
      productId: 'p1',
      productName: 'Chelsea Grey',
      variantId: 'v1',
      variantName: null,
      quantity: 8,
      unit: 'фут²',
      price: 437.1,
      lineTotal: 3496.8,
      variantOptions: [],
    },
    {
      productId: 'p2',
      productName: 'Amazon Black',
      variantId: 'v2',
      variantName: null,
      quantity: 5,
      unit: 'фут²',
      price: 437.1,
      lineTotal: 2185.5,
      variantOptions: [],
    },
  ],
}

test('multi-item order keeps quantity per product', () => {
  const reply = formatChatOrderDraftReply(readyDraft)

  assert.match(reply, /Chelsea Grey — 8 фут²/)
  assert.match(reply, /Amazon Black — 5 фут²/)
  assert.match(reply, /5 682,3 ₽/)
})

test('created reply never exposes order number', () => {
  const reply = formatChatOrderDraftReply(
    {
      ...readyDraft,
      status: 'created',
    },
    { created: true },
  )

  assert.match(reply, /^Заказ создан\./u)
  assert.doesNotMatch(reply, /номер заказ/iu)
  assert.doesNotMatch(reply, /№/u)
})

test('missing quantity is reported per product', () => {
  const draft = {
    ...readyDraft,
    items: [
      readyDraft.items[0],
      {
        ...readyDraft.items[1],
        quantity: null,
        lineTotal: null,
      },
    ],
  }

  const missing = orderDraftMissingFields(draft)

  assert.equal(missing.length, 1)
  assert.equal(
    missing[0].productName,
    'Amazon Black',
  )
})

test('ready items without fulfillment ask delivery or pickup', () => {
  const reply = formatChatOrderDraftReply({
    ...readyDraft,
    deliveryMethod: null,
    status: 'collecting',
  })

  assert.match(
    reply,
    /Как вы хотите получить заказ: доставка или самовывоз\?/u,
  )
  assert.doesNotMatch(reply, /Оформить этот заказ\?/u)
})

test('ready order summary shows selected pickup method', () => {
  const reply = formatChatOrderDraftReply(readyDraft)

  assert.match(reply, /Получение: Самовывоз\./u)
  assert.match(reply, /Оформить этот заказ\?/u)
})
