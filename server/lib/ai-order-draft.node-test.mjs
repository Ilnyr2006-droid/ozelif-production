import assert from 'node:assert/strict'
import test from 'node:test'

import {
  formatOrderDraftContext,
  normalizeOrderDraftUpdate,
} from './ai-order-draft.mjs'

test('normalizes several products in one draft update', () => {
  const result = normalizeOrderDraftUpdate({
    startNewOrder: false,
    cancel: false,
    confirm: false,
    deliveryMethod: null,
    deliveryCity: null,
    deliveryAddress: null,
    operations: [
      {
        operation: 'upsert',
        productId: 'p1',
        productName: 'Chelsea Grey',
        variantId: null,
        quantity: 8,
        unit: 'фут²',
      },
      {
        operation: 'upsert',
        productId: 'p2',
        productName: 'Amazon Black',
        variantId: null,
        quantity: 5,
        unit: 'фут²',
      },
    ],
  })

  assert.equal(result.operations.length, 2)
  assert.equal(result.operations[0].quantity, 8)
  assert.equal(result.operations[1].quantity, 5)
})

test('draft context preserves separate quantities', () => {
  const text = formatOrderDraftContext({
    status: 'awaiting_confirmation',
    revision: 3,
    deliveryMethod: 'pickup',
    items: [
      {
        productId: 'p1',
        productName: 'Chelsea Grey',
        variantId: 'v1',
        quantity: 8,
        unit: 'фут²',
      },
      {
        productId: 'p2',
        productName: 'Amazon Black',
        variantId: 'v2',
        quantity: 5,
        unit: 'фут²',
      },
    ],
  })

  assert.match(text, /Chelsea Grey/)
  assert.match(text, /количество=8/)
  assert.match(text, /Amazon Black/)
  assert.match(text, /количество=5/)
})

test('normalizes delivery and pickup method', () => {
  const pickup = normalizeOrderDraftUpdate({
    startNewOrder: false,
    cancel: false,
    confirm: false,
    deliveryMethod: 'pickup',
    operations: [],
  })

  const courier = normalizeOrderDraftUpdate({
    startNewOrder: false,
    cancel: false,
    confirm: false,
    deliveryMethod: 'courier',
    operations: [],
  })

  assert.equal(pickup.deliveryMethod, 'pickup')
  assert.equal(courier.deliveryMethod, 'courier')
})

test('draft context exposes fulfillment choice to model', () => {
  const text = formatOrderDraftContext({
    status: 'awaiting_confirmation',
    revision: 1,
    deliveryMethod: 'courier',
    items: [{
      productId: 'p1',
      productName: 'Chelsea Grey',
      variantId: 'v1',
      quantity: 2,
      unit: 'фут²',
    }],
  })

  assert.match(text, /Получение=ДОСТАВКА/u)
})

test('normalizes delivery city and address', () => {
  const result = normalizeOrderDraftUpdate({
    startNewOrder: false,
    cancel: false,
    confirm: false,
    deliveryMethod: 'courier',
    deliveryCity: 'Москва',
    deliveryAddress: 'ул. Тверская, 10',
    operations: [],
  })

  assert.equal(result.deliveryMethod, 'courier')
  assert.equal(result.deliveryCity, 'Москва')
  assert.equal(result.deliveryAddress, 'ул. Тверская, 10')
})

test('draft context exposes missing delivery address fields', () => {
  const text = formatOrderDraftContext({
    status: 'collecting',
    revision: 2,
    deliveryMethod: 'courier',
    deliveryCity: 'Москва',
    deliveryAddress: null,
    items: [{
      productId: 'p1',
      productName: 'Chelsea Grey',
      variantId: 'v1',
      quantity: 2,
      unit: 'фут²',
    }],
  })

  assert.match(text, /Город доставки=Москва/u)
  assert.match(text, /Адрес доставки=НЕ УКАЗАН/u)
})

test('preserves semantic resolution metadata from tool update', () => {
  const result = normalizeOrderDraftUpdate({
    startNewOrder: false,
    cancel: false,
    confirm: false,
    quantityResolution: 'resolved',
    deliveryMethod: null,
    deliveryCity: null,
    deliveryAddress: null,
    operations: [{
      operation: 'upsert',
      target: 'draft',
      productId: 'draft-product-id',
      productName: 'Chelsea Grey',
      variantId: 'variant-id',
      quantity: 12,
      unit: 'фут²',
      quantityEvidence: 'челси 12 футов',
    }],
  })

  assert.equal(result.quantityResolution, 'resolved')
  assert.equal(result.operations[0].target, 'draft')
  assert.equal(result.operations[0].quantityEvidence, 'челси 12 футов')
})

test('ambiguous semantic resolution survives with zero operations', () => {
  const result = normalizeOrderDraftUpdate({
    startNewOrder: false,
    cancel: false,
    confirm: false,
    quantityResolution: 'ambiguous',
    deliveryMethod: null,
    deliveryCity: null,
    deliveryAddress: null,
    operations: [],
  })

  assert.ok(result)
  assert.equal(result.quantityResolution, 'ambiguous')
  assert.equal(result.operations.length, 0)
})
