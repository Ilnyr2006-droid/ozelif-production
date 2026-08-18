import assert from 'node:assert/strict'
import test from 'node:test'

import {
  formatAmbiguousQuantityReply,
  formatChatOrderDraftReply,
  guardAmbiguousMultiItemQuantities,
  orderDraftMissingFields,
  parseExplicitMultiItemQuantities,
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

  assert.match(reply, /^Проверьте заказ:/u)
  assert.match(reply, /Получение: Самовывоз\./u)
  assert.match(
    reply,
    /Если всё верно — напишите «всё верно»\./u,
  )
  assert.doesNotMatch(reply, /Оформить этот заказ\?/u)
})

test('blocks unlabeled quantities for several products', () => {
  const draft = {
    status: 'collecting',
    revision: 1,
    items: [
      {
        productId: 'vegetale',
        productName: 'Vegetale Visky',
        variantId: 'v1',
        quantity: null,
        unit: 'фут²',
      },
      {
        productId: 'nappa',
        productName: 'Nappa Visky',
        variantId: 'v2',
        quantity: null,
        unit: 'фут²',
      },
    ],
  }

  const guarded = guardAmbiguousMultiItemQuantities(
    draft,
    {
      startNewOrder: false,
      cancel: false,
      confirm: false,
      deliveryMethod: null,
      deliveryCity: null,
      deliveryAddress: null,
      operations: [
        {
          operation: 'upsert',
          productId: 'vegetale',
          productName: 'Vegetale Visky',
          variantId: 'v1',
          quantity: 80,
          unit: 'фут²',
        },
        {
          operation: 'upsert',
          productId: 'nappa',
          productName: 'Nappa Visky',
          variantId: 'v2',
          quantity: 20,
          unit: 'фут²',
        },
      ],
    },
    '80 и 20 футов',
  )

  assert.equal(guarded.ambiguous, true)
  assert.equal(guarded.update.operations[0].quantity, null)
  assert.equal(guarded.update.operations[1].quantity, null)

  const reply = formatAmbiguousQuantityReply(draft)

  assert.match(reply, /Vegetale Visky/u)
  assert.match(reply, /Nappa Visky/u)
  assert.match(reply, /не буду угадывать/u)
  assert.match(
    reply,
    /Напишите количество рядом с названием:/u,
  )
  assert.doesNotMatch(reply, /Vegetale Visky — 80 фут²/u)
  assert.doesNotMatch(reply, /Nappa Visky — 20 фут²/u)
})

test('allows quantities explicitly attached to product names', () => {
  const draft = {
    status: 'collecting',
    revision: 1,
    items: [
      {
        productId: 'vegetale',
        productName: 'Vegetale Visky',
        quantity: null,
      },
      {
        productId: 'nappa',
        productName: 'Nappa Visky',
        quantity: null,
      },
    ],
  }

  const update = {
    startNewOrder: false,
    cancel: false,
    confirm: false,
    deliveryMethod: null,
    deliveryCity: null,
    deliveryAddress: null,
    operations: [
      {
        operation: 'upsert',
        productId: 'vegetale',
        productName: 'Vegetale Visky',
        quantity: 80,
      },
      {
        operation: 'upsert',
        productId: 'nappa',
        productName: 'Nappa Visky',
        quantity: 20,
      },
    ],
  }

  const guarded = guardAmbiguousMultiItemQuantities(
    draft,
    update,
    'Vegetale 80 футов, Nappa 20 футов',
  )

  assert.equal(guarded.ambiguous, false)
  assert.equal(guarded.update.operations[0].quantity, 80)
  assert.equal(guarded.update.operations[1].quantity, 20)
})

test('courier order requires both city and address', () => {
  const reply = formatChatOrderDraftReply({
    ...readyDraft,
    deliveryMethod: 'courier',
    deliveryCity: null,
    deliveryAddress: null,
    status: 'collecting',
  })

  assert.match(reply, /Для доставки укажите город и адрес\./u)
  assert.doesNotMatch(reply, /Оформить этот заказ\?/u)
})

test('courier order asks only address when city is known', () => {
  const reply = formatChatOrderDraftReply({
    ...readyDraft,
    deliveryMethod: 'courier',
    deliveryCity: 'Москва',
    deliveryAddress: null,
    status: 'collecting',
  })

  assert.match(reply, /Укажите адрес доставки\./u)
})

test('courier summary shows city and address when complete', () => {
  const reply = formatChatOrderDraftReply({
    ...readyDraft,
    deliveryMethod: 'courier',
    deliveryCity: 'Москва',
    deliveryAddress: 'ул. Тверская, 10',
    status: 'awaiting_confirmation',
  })

  assert.match(reply, /^Проверьте заказ:/u)
  assert.match(reply, /Доставка: Москва, ул\. Тверская, 10\./u)
  assert.match(
    reply,
    /Если всё верно — напишите «всё верно»\./u,
  )
  assert.doesNotMatch(reply, /Оформить этот заказ\?/u)
})

test('order summary hides duplicated technical variant name', () => {
  const reply = formatChatOrderDraftReply({
    ...readyDraft,
    items: [{
      ...readyDraft.items[0],
      productName: 'Nappa Visky',
      variantName:
        'Nappa Visky - фут2 - Оттенок коричневого',
    }],
  })

  assert.match(reply, /• Nappa Visky — 8 фут²/u)
  assert.doesNotMatch(reply, /Nappa Visky - фут2 - Оттенок/u)
})

test('accepts shortened aliases with explicit quantities', () => {
  const draft = {
    status: 'collecting',
    items: [
      { productId: 'vegetale', productName: 'Full Vegetale Chestnut', variantId: 'v1', quantity: null, unit: 'фут²' },
      { productId: 'napato', productName: 'Napato Black', variantId: 'v2', quantity: null, unit: 'фут²' },
    ],
  }

  const update = parseExplicitMultiItemQuantities(
    draft,
    'вегетел 40 футов напато 50',
  )

  assert.ok(update)
  const values = Object.fromEntries(
    update.operations.map(item => [item.productName, item.quantity]),
  )
  assert.equal(values['Full Vegetale Chestnut'], 40)
  assert.equal(values['Napato Black'], 50)
})

test('bare quantities remain ambiguous', () => {
  const draft = {
    items: [
      { productId: 'vegetale', productName: 'Full Vegetale Chestnut', variantId: 'v1', quantity: null, unit: 'фут²' },
      { productId: 'napato', productName: 'Napato Black', variantId: 'v2', quantity: null, unit: 'фут²' },
    ],
  }
  assert.equal(
    parseExplicitMultiItemQuantities(draft, '40 и 50 футов'),
    null,
  )
})

test('names followed by ambiguous number tail are not guessed', () => {
  const draft = {
    items: [
      { productId: 'vegetale', productName: 'Full Vegetale Chestnut', variantId: 'v1', quantity: null, unit: 'фут²' },
      { productId: 'napato', productName: 'Napato Black', variantId: 'v2', quantity: null, unit: 'фут²' },
    ],
  }
  assert.equal(
    parseExplicitMultiItemQuantities(draft, 'Vegetale и Napato 40 и 50'),
    null,
  )
})

test('complete order asks user to review instead of formal confirmation', () => {
  const reply = formatChatOrderDraftReply({
    ...readyDraft,
    deliveryMethod: 'pickup',
    status: 'awaiting_confirmation',
  })
  assert.match(reply, /^Проверьте заказ:/u)
  assert.match(reply, /Если всё верно — напишите «всё верно»\./u)
  assert.doesNotMatch(reply, /Оформить этот заказ\?/u)
})

test('ambiguous quantity prompt does not invent example values', () => {
  const reply = formatAmbiguousQuantityReply({
    items: [
      { productName: 'Full Vegetale Chestnut', quantity: null, unit: 'фут²' },
      { productName: 'Napato Black', quantity: null, unit: 'фут²' },
    ],
  })
  assert.match(reply, /не буду угадывать/u)
  assert.doesNotMatch(reply, /80|20/u)
})
