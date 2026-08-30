import assert from 'node:assert/strict'
import test from 'node:test'

import {
  formatAmbiguousQuantityReply,
  formatChatOrderHistoryContext,
  formatChatOrderDraftReply,
  implicitFulfillmentChoice,
  loadChatOrderHistory,
  orderDraftMissingFields,
  parseChatCartCommand,
  validateModelOrderDraftUpdate,
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

test('loads only saved CRM orders created by the current chat', async () => {
  const calls = []
  const history = await loadChatOrderHistory(
    '11111111-1111-4111-8111-111111111111',
    {
      query: async (sql, params) => {
        calls.push({ sql, params })
        return {
          rows: [{
            publicNumber: '1042',
            status: 'new',
            totalAmount: '874.10',
            deliveryMethod: 'pickup',
            deliveryCity: null,
            createdAt: new Date('2026-08-24T12:00:00Z'),
            items: [{
              productName: 'Napato Black',
              quantity: '2',
              unit: 'FOT',
            }],
          }],
        }
      },
    },
  )

  assert.match(calls[0].sql, /o\.source = 'ai_chat'/u)
  assert.match(calls[0].sql, /left\(o\.idempotency_key/u)
  assert.equal(
    calls[0].params[0],
    'ai-chat:11111111-1111-4111-8111-111111111111:',
  )
  assert.equal(history[0].publicNumber, '1042')
  assert.equal(history[0].items[0].productName, 'Napato Black')
})

test('formats saved chat order history for the assistant context', () => {
  const context = formatChatOrderHistoryContext([{
    publicNumber: '1042',
    status: 'new',
    totalAmount: 874.1,
    items: [{
      productName: 'Napato Black',
      quantity: 2,
      unit: 'FOT',
    }],
  }])

  assert.match(context, /Заказ №1042 — Новый/u)
  assert.match(context, /Napato Black — 2 фут²/u)
  assert.match(context, /874,1 ₽/u)
})

test('checkout asks for confirmation instead of confirming implicitly', () => {
  const command = parseChatCartCommand(
    'Оформить заказ из корзины',
    readyDraft,
  )

  assert.equal(command.kind, 'checkout')
  assert.equal(command.update, undefined)
})

test('only an explicit order phrase confirms the current draft', () => {
  assert.equal(
    parseChatCartCommand('да', readyDraft),
    null,
  )

  const command = parseChatCartCommand(
    'Подтверждаю заказ',
    readyDraft,
  )

  assert.equal(command.kind, 'confirm')
  assert.equal(command.update.confirm, true)
})

test('cart command removes an item by its catalog name', () => {
  const command = parseChatCartCommand(
    'удали Chelsea Grey',
    readyDraft,
  )

  assert.equal(command.kind, 'remove')
  assert.equal(command.update.operations[0].productId, 'p1')
})

test('cart command changes quantity with a Cyrillic square unit', () => {
  const command = parseChatCartCommand(
    'у второго товара 12 дм²',
    readyDraft,
  )

  assert.equal(command.kind, 'quantity')
  assert.equal(command.update.operations[0].productId, 'p2')
  assert.equal(command.update.operations[0].quantity, 12)
  assert.equal(command.update.operations[0].unit, 'DM2')
})

test('product selection for a jacket is not mistaken for a cart command', () => {
  assert.equal(
    parseChatCartCommand(
      'Привет подбери пожалуйста кожу для куртки',
      { items: [] },
    ),
    null,
  )

  assert.equal(
    parseChatCartCommand(
      'Подбери кожу для куртки',
      readyDraft,
    ),
    null,
  )
})

test('quantity with a named draft product remains deterministic', () => {
  const command = parseChatCartCommand(
    'для Chelsea Grey 10 фут²',
    readyDraft,
  )

  assert.equal(command.kind, 'quantity')
  assert.equal(command.update.operations[0].productId, 'p1')
  assert.equal(command.update.operations[0].quantity, 10)
})

test('adding another named product does not overwrite the only cart item', () => {
  const command = parseChatCartCommand(
    'добавь в заказ новый материал 60 футов',
    {
      ...readyDraft,
      items: [readyDraft.items[0]],
    },
  )

  assert.equal(command, null)
})

test('an explicit quantity command can still target the only cart item', () => {
  const command = parseChatCartCommand(
    'поставь количество 25 футов',
    {
      ...readyDraft,
      items: [readyDraft.items[0]],
    },
  )

  assert.equal(command.kind, 'quantity')
  assert.equal(command.update.operations[0].productId, 'p1')
  assert.equal(command.update.operations[0].quantity, 25)
})

test('ambiguous remove and quantity commands ask for a product', () => {
  const remove = parseChatCartCommand(
    'удали товар из корзины',
    readyDraft,
  )
  const quantity = parseChatCartCommand(
    'измени количество товара в корзине',
    readyDraft,
  )

  assert.equal(remove.kind, 'prompt')
  assert.match(remove.reply, /1\. Chelsea Grey/u)
  assert.equal(quantity.kind, 'prompt')
  assert.match(quantity.reply, /2\. Amazon Black/u)
})

test('clear cart command removes all draft items', () => {
  const command = parseChatCartCommand(
    'Очистить корзину полностью',
    readyDraft,
  )

  assert.equal(command.kind, 'clear')
  assert.equal(command.update.clearItems, true)
})

test('multi-item order keeps quantity per product', () => {
  const reply = formatChatOrderDraftReply(readyDraft)

  assert.match(reply, /1\. Chelsea Grey\n   8 фут² · 3 496,8 ₽/u)
  assert.match(reply, /2\. Amazon Black\n   5 фут² · 2 185,5 ₽/u)
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

  assert.match(reply, /^✅ Заявка создана\./u)
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
    /Как получить заказ: доставка или самовывоз\?/u,
  )
  assert.doesNotMatch(reply, /Оформить этот заказ\?/u)
})

test('ready order summary shows selected pickup method', () => {
  const reply = formatChatOrderDraftReply(readyDraft)

  assert.match(reply, /^🧾 Проверьте заявку/u)
  assert.match(reply, /Получение: Самовывоз\./u)
  assert.match(
    reply,
    /Если всё верно — напишите «всё верно»\./u,
  )
  assert.doesNotMatch(reply, /Оформить этот заказ\?/u)
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

  assert.match(reply, /^🧾 Проверьте заявку/u)
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

  assert.match(reply, /1\. Nappa Visky\n   8 фут² · 3 496,8 ₽/u)
  assert.doesNotMatch(reply, /Nappa Visky - фут2 - Оттенок/u)
})

test('complete order asks user to review instead of formal confirmation', () => {
  const reply = formatChatOrderDraftReply({
    ...readyDraft,
    deliveryMethod: 'pickup',
    status: 'awaiting_confirmation',
  })
  assert.match(reply, /^🧾 Проверьте заявку/u)
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

test('accepts model semantic mapping to exact draft ids with verbatim evidence', () => {
  const draft = {
    items: [
      { productId: 'vegetale-id', productName: 'Full Vegetale Chestnut', variantId: 'v1', quantity: null, unit: 'фут²' },
      { productId: 'napato-id', productName: 'Napato Black', variantId: 'v2', quantity: null, unit: 'фут²' },
    ],
  }

  const validation = validateModelOrderDraftUpdate({
    draft,
    message: 'вегетел 40 футов напато 50',
    update: {
      startNewOrder: false,
      cancel: false,
      confirm: false,
      quantityResolution: 'resolved',
      deliveryMethod: null,
      deliveryCity: null,
      deliveryAddress: null,
      operations: [
        { operation: 'upsert', target: 'draft', productId: 'vegetale-id', productName: 'Full Vegetale Chestnut', variantId: 'v1', quantity: 40, unit: 'фут²', quantityEvidence: 'вегетел 40 футов' },
        { operation: 'upsert', target: 'draft', productId: 'napato-id', productName: 'Napato Black', variantId: 'v2', quantity: 50, unit: 'фут²', quantityEvidence: 'напато 50' },
      ],
    },
  })

  assert.equal(validation.ambiguous, false)
  assert.equal(validation.rejected.length, 0)

  const byId = Object.fromEntries(
    validation.update.operations.map(item => [item.productId, item.quantity]),
  )
  assert.equal(byId['vegetale-id'], 40)
  assert.equal(byId['napato-id'], 50)
})

test('accepts completely different product names without backend aliases', () => {
  const draft = {
    items: [
      { productId: 'chelsea-id', productName: 'Chelsea Grey', variantId: 'v1', quantity: null, unit: 'фут²' },
      { productId: 'amazon-id', productName: 'Amazon Black', variantId: 'v2', quantity: null, unit: 'фут²' },
    ],
  }

  const validation = validateModelOrderDraftUpdate({
    draft,
    message: 'челси 15 футов амазон 30',
    update: {
      startNewOrder: false,
      cancel: false,
      confirm: false,
      quantityResolution: 'resolved',
      deliveryMethod: null,
      deliveryCity: null,
      deliveryAddress: null,
      operations: [
        { operation: 'upsert', target: 'draft', productId: 'chelsea-id', productName: 'Chelsea Grey', variantId: 'v1', quantity: 15, unit: 'фут²', quantityEvidence: 'челси 15 футов' },
        { operation: 'upsert', target: 'draft', productId: 'amazon-id', productName: 'Amazon Black', variantId: 'v2', quantity: 30, unit: 'фут²', quantityEvidence: 'амазон 30' },
      ],
    },
  })

  assert.equal(validation.ambiguous, false)
  assert.equal(validation.rejected.length, 0)
  assert.deepEqual(
    validation.update.operations.map(item => item.quantity),
    [15, 30],
  )
})

test('rejects hallucinated draft product id', () => {
  const validation = validateModelOrderDraftUpdate({
    draft: {
      items: [
        { productId: 'real-id', productName: 'Chelsea Grey', variantId: 'v1', quantity: null, unit: 'фут²' },
      ],
    },
    message: 'челси 20',
    update: {
      startNewOrder: false,
      cancel: false,
      confirm: false,
      quantityResolution: 'resolved',
      deliveryMethod: null,
      deliveryCity: null,
      deliveryAddress: null,
      operations: [
        { operation: 'upsert', target: 'draft', productId: 'invented-id', productName: 'Chelsea Grey', variantId: 'v1', quantity: 20, unit: 'фут²', quantityEvidence: 'челси 20' },
      ],
    },
  })

  assert.equal(validation.ambiguous, true)
  assert.equal(validation.update.operations.length, 0)
  assert.equal(validation.rejected[0].reason, 'unknown_draft_product')
})

test('rejects quantity evidence invented by model', () => {
  const validation = validateModelOrderDraftUpdate({
    draft: {
      items: [
        { productId: 'chelsea-id', productName: 'Chelsea Grey', variantId: 'v1', quantity: null, unit: 'фут²' },
      ],
    },
    message: 'челси 20',
    update: {
      startNewOrder: false,
      cancel: false,
      confirm: false,
      quantityResolution: 'resolved',
      deliveryMethod: null,
      deliveryCity: null,
      deliveryAddress: null,
      operations: [
        { operation: 'upsert', target: 'draft', productId: 'chelsea-id', productName: 'Chelsea Grey', variantId: 'v1', quantity: 20, unit: 'фут²', quantityEvidence: 'Chelsea Grey 20 футов' },
      ],
    },
  })

  assert.equal(validation.ambiguous, true)
  assert.equal(validation.update.operations.length, 0)
})

test('rejects bare multi-item numbers even if model tries to assign them', () => {
  const validation = validateModelOrderDraftUpdate({
    draft: {
      items: [
        { productId: 'a', productName: 'Chelsea Grey', variantId: 'v1', quantity: null, unit: 'фут²' },
        { productId: 'b', productName: 'Amazon Black', variantId: 'v2', quantity: null, unit: 'фут²' },
      ],
    },
    message: '20 и 40 футов',
    update: {
      startNewOrder: false,
      cancel: false,
      confirm: false,
      quantityResolution: 'resolved',
      deliveryMethod: null,
      deliveryCity: null,
      deliveryAddress: null,
      operations: [
        { operation: 'upsert', target: 'draft', productId: 'a', productName: 'Chelsea Grey', variantId: 'v1', quantity: 20, unit: 'фут²', quantityEvidence: '20' },
        { operation: 'upsert', target: 'draft', productId: 'b', productName: 'Amazon Black', variantId: 'v2', quantity: 40, unit: 'фут²', quantityEvidence: '40 футов' },
      ],
    },
  })

  assert.equal(validation.ambiguous, true)
  assert.equal(
    validation.update.operations.filter(item => Number(item.quantity) > 0).length,
    0,
  )
})

test('allows a new product only from server-approved catalog ids', () => {
  const baseUpdate = {
    startNewOrder: false,
    cancel: false,
    confirm: false,
    quantityResolution: 'none',
    deliveryMethod: null,
    deliveryCity: null,
    deliveryAddress: null,
    operations: [
      { operation: 'upsert', target: 'catalog', productId: 'catalog-ok', productName: 'Amazon Black', variantId: null, quantity: null, unit: null, quantityEvidence: null },
    ],
  }

  const accepted = validateModelOrderDraftUpdate({
    draft: { items: [] },
    update: baseUpdate,
    message: 'добавь Amazon Black',
    allowedCatalogProductIds: ['catalog-ok'],
  })
  assert.equal(accepted.ambiguous, false)
  assert.equal(accepted.update.operations.length, 1)

  const rejected = validateModelOrderDraftUpdate({
    draft: { items: [] },
    update: {
      ...baseUpdate,
      operations: [
        { ...baseUpdate.operations[0], productId: 'invented-catalog-id' },
      ],
    },
    message: 'добавь Amazon Black',
    allowedCatalogProductIds: ['catalog-ok'],
  })
  assert.equal(rejected.update.operations.length, 0)
  assert.equal(rejected.rejected[0].reason, 'catalog_product_not_allowed')
})

test('model can explicitly mark a quantity message ambiguous', () => {
  const validation = validateModelOrderDraftUpdate({
    draft: {
      items: [
        { productId: 'a', productName: 'Chelsea Grey', quantity: null },
        { productId: 'b', productName: 'Amazon Black', quantity: null },
      ],
    },
    message: '20 и 40',
    update: {
      startNewOrder: false,
      cancel: false,
      confirm: false,
      quantityResolution: 'ambiguous',
      deliveryMethod: null,
      deliveryCity: null,
      deliveryAddress: null,
      operations: [],
    },
  })

  assert.equal(validation.ambiguous, true)
  assert.equal(validation.update.operations.length, 0)
})


test(
  'delivery pricing question does not mutate an empty order draft',
  () => {
    assert.equal(
      implicitFulfillmentChoice(
        'Сколько стоит доставка СДЭК в Казань?',
        {
          status: 'collecting',
          items: [],
          deliveryMethod: null,
        },
      ),
      null,
    )
  },
)

test(
  'delivery pricing question does not mutate an existing order',
  () => {
    assert.equal(
      implicitFulfillmentChoice(
        'Сколько стоит доставка СДЭК в Казань?',
        {
          ...readyDraft,
          deliveryMethod: null,
        },
      ),
      null,
    )
  },
)

test(
  'short delivery answer selects courier for an active order',
  () => {
    assert.equal(
      implicitFulfillmentChoice(
        'доставка',
        {
          ...readyDraft,
          deliveryMethod: null,
        },
      ),
      'courier',
    )

    assert.equal(
      implicitFulfillmentChoice(
        'хочу доставку',
        {
          ...readyDraft,
          deliveryMethod: null,
        },
      ),
      'courier',
    )
  },
)

test(
  'short pickup answer selects pickup for an active order',
  () => {
    assert.equal(
      implicitFulfillmentChoice(
        'самовывоз',
        {
          ...readyDraft,
          deliveryMethod: null,
        },
      ),
      'pickup',
    )
  },
)

test(
  'general delivery information does not change fulfillment',
  () => {
    for (const message of [
      'Какие у вас условия доставки?',
      'Есть ли доставка в Казань?',
      'Как осуществляется доставка?',
      'Срок доставки в Казань какой?',
    ]) {
      assert.equal(
        implicitFulfillmentChoice(
          message,
          {
            ...readyDraft,
            deliveryMethod: null,
          },
        ),
        null,
        message,
      )
    }
  },
)
