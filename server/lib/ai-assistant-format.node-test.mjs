
import assert from 'node:assert/strict'
import test from 'node:test'
import {
  assistantProductContext,
  compactProductContext,
  deterministicCatalogReply,
  enforceCriticalIntentFacts,
  productActions,
  sanitizeUnverifiedStockClaims,
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

test('informational intents do not receive a failed-product-search message', () => {
  assert.equal(
    assistantProductContext([], false),
    'Для этого запроса товарный поиск не требуется.',
  )

  assert.equal(
    assistantProductContext([], true),
    'Подходящих опубликованных товаров не найдено.',
  )
})

test('production reply receives missing verified facts', () => {
  const reply = enforceCriticalIntentFacts(
    'Да, такой тираж можно обсудить. Уточните модель и материал.',
    'production',
  )

  assert.match(reply, /10 изделий одной модели/)
  assert.match(reply, /первый образец/)
})

test('production facts are not duplicated', () => {
  const source = (
    'Минимальный заказ — от 10 изделий одной модели. '
    + 'Для новой модели обязателен первый образец.'
  )

  const reply = enforceCriticalIntentFacts(
    source,
    'production',
  )

  assert.equal(
    (reply.match(/10 изделий одной модели/g) ?? []).length,
    1,
  )

  assert.equal(
    (reply.match(/первый образец/g) ?? []).length,
    1,
  )
})

test('non-production reply is not altered', () => {
  const source = 'Размер оптовой скидки обсуждается индивидуально.'

  assert.equal(
    enforceCriticalIntentFacts(source, 'wholesale'),
    source,
  )
})

test('normalizes Grade to Russian Сорт in verified context', () => {
  const context = compactProductContext([{
    ...product,
    stockQuantity: null,
    attributes: {
      Grade: '1',
      Color: 'Black',
    },
  }])

  assert.match(context, /Сорт: 1/)
  assert.doesNotMatch(context, /Grade:/)
  assert.match(context, /Остаток: не опубликован/)
})

test('removes affirmative stock claim when any candidate stock is unpublished', () => {
  const reply = sanitizeUnverifiedStockClaims(
    'Товар доступен. Цена указана в каталоге.',
    [{
      ...product,
      stockQuantity: null,
      variants: product.variants.map(item => ({
        ...item,
        stockQuantity: null,
      })),
    }],
  )

  assert.match(reply, /товар опубликован в каталоге/i)
  assert.doesNotMatch(reply, /товар доступен/i)
})

test('keeps confirmed stock wording when every candidate has stock data', () => {
  const reply = sanitizeUnverifiedStockClaims(
    'Товар доступен.',
    [{
      ...product,
      stockQuantity: 12,
    }],
  )

  assert.equal(reply, 'Товар доступен.')
})
