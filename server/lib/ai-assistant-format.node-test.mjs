
import assert from 'node:assert/strict'
import test from 'node:test'
import {
  compactProductContext,
  deterministicCatalogReply,
  productActions,
} from './ai-assistant-format.mjs'

const product = {
  id: '11111111-1111-4111-8111-111111111111',
  name: 'Napato Black',
  category: 'Одежная кожа',
  productUrl: '/odejnayakozha/tproduct/1-napato-black',
  description: 'Мягкая натуральная кожа.',
  attributes: {
    Цвет: 'Чёрный',
    Толщина: '0,8 мм',
    __managed: true,
  },
  variants: [
    { priceRub: 430, unit: 'фут²' },
    { priceRub: 47, unit: 'дм²' },
  ],
}

test('builds compact verified product context', () => {
  const context = compactProductContext([product])

  assert.match(context, /PRODUCT_ID=/)
  assert.match(context, /Napato Black/)
  assert.match(context, /430 ₽ за фут²/)
  assert.match(context, /47 ₽ за дм²/)
  assert.doesNotMatch(context, /__managed/)
})

test('returns existing widget actions', () => {
  assert.deepEqual(productActions([product]), [{
    label: 'Открыть Napato Black',
    href: '/odejnayakozha/tproduct/1-napato-black',
  }])
})

test('fallback uses only live product data', () => {
  const reply = deterministicCatalogReply([product])

  assert.match(reply, /Napato Black/)
  assert.match(reply, /430 ₽ за фут²/)
})
