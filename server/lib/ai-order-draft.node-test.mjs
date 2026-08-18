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
