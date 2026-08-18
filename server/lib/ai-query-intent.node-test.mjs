import assert from 'node:assert/strict'
import test from 'node:test'
import {
  buildInformationFallback,
  classifyAssistantIntent,
} from './ai-query-intent.mjs'

test('routes contact questions without product retrieval', () => {
  assert.deepEqual(
    classifyAssistantIntent(
      'Где находится магазин и как связаться с менеджером?',
    ),
    {
      type: 'contacts',
      needsProducts: false,
      isInformation: true,
      productSignal: false,
    },
  )
})

test('routes production questions without product retrieval', () => {
  const result = classifyAssistantIntent(
    'Какой минимальный тираж на швейном производстве?',
  )

  assert.equal(result.type, 'production')
  assert.equal(result.needsProducts, false)
  assert.equal(result.isInformation, true)
})

test('routes delivery questions without product retrieval', () => {
  const result = classifyAssistantIntent(
    'Как работает доставка СДЭК и какая предоплата?',
  )

  assert.equal(result.type, 'delivery')
  assert.equal(result.needsProducts, false)
})

test('routes wholesale questions without product retrieval', () => {
  const result = classifyAssistantIntent(
    'Хотим заказать кожу оптом по своему образцу',
  )

  assert.equal(result.type, 'wholesale')
  assert.equal(result.needsProducts, false)
})

test('keeps real product selection on hybrid retrieval', () => {
  const result = classifyAssistantIntent(
    'Подберите мягкую черную кожу для сумки',
  )

  assert.equal(result.type, 'product')
  assert.equal(result.needsProducts, true)
  assert.equal(result.isInformation, false)
})

test('explicit selection remains product even when manager is mentioned', () => {
  const result = classifyAssistantIntent(
    'Подберите черную кожу для сумки и потом дайте контакт менеджера',
  )

  assert.equal(result.type, 'product')
  assert.equal(result.needsProducts, true)
})

test('provides safe informational fallback', () => {
  assert.match(
    buildInformationFallback({ type: 'contacts' }),
    /Краснобогатырская улица, 24/,
  )
})

test('treats exact product price and characteristics as product retrieval', () => {
  const result = classifyAssistantIntent(
    'Сколько стоит Amazon Black и какие у него характеристики?',
  )

  assert.equal(result.type, 'product')
  assert.equal(result.needsProducts, true)
})

test('treats product stock question as product retrieval', () => {
  const result = classifyAssistantIntent(
    'Amazon Black точно сейчас есть в наличии? Сколько шкур осталось?',
  )

  assert.equal(result.type, 'product')
  assert.equal(result.needsProducts, true)
})

test('keeps wholesale intent when leather is needed for production', () => {
  const result = classifyAssistantIntent(
    'Мне нужно 1500 дм² кожи для производства. Какие условия опта?',
  )

  assert.equal(result.type, 'wholesale')
  assert.equal(result.needsProducts, false)
})

test('delivery price question remains delivery, not product', () => {
  const result = classifyAssistantIntent(
    'Сколько стоит доставка в Санкт-Петербург?',
  )

  assert.equal(result.type, 'delivery')
  assert.equal(result.needsProducts, false)
})

test('routes short inflected leather browsing request as product', () => {
  const result = classifyAssistantIntent(
    'Покажи черную кожу',
  )

  assert.equal(result.type, 'product')
  assert.equal(result.needsProducts, true)
  assert.equal(result.isInformation, false)
  assert.equal(result.productSignal, true)
})
