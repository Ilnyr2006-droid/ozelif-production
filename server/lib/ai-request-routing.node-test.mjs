import assert from 'node:assert/strict'
import test from 'node:test'

import {
  routeAssistantRequest,
} from './ai-request-routing.mjs'

test('does not search catalog for greeting', () => {
  assert.deepEqual(
    routeAssistantRequest('Привет'),
    {
      intent: 'general',
      needsProducts: false,
    },
  )
})

test('does not search catalog for contacts and delivery', () => {
  assert.deepEqual(
    routeAssistantRequest('Где находится ваш шоурум?'),
    {
      intent: 'contacts',
      needsProducts: false,
    },
  )

  assert.deepEqual(
    routeAssistantRequest('Покажите адрес магазина и склада'),
    {
      intent: 'contacts',
      needsProducts: false,
    },
  )

  assert.deepEqual(
    routeAssistantRequest('Сколько стоит доставка СДЭК?'),
    {
      intent: 'delivery',
      needsProducts: false,
    },
  )
})

test('does not search catalog for pure wholesale or production info', () => {
  assert.deepEqual(
    routeAssistantRequest('Какие у вас оптовые условия?'),
    {
      intent: 'wholesale',
      needsProducts: false,
    },
  )

  assert.deepEqual(
    routeAssistantRequest('Какой минимальный тираж на швейном производстве?'),
    {
      intent: 'production',
      needsProducts: false,
    },
  )
})

test('searches catalog for real product requests', () => {
  assert.deepEqual(
    routeAssistantRequest('Подбери черную кожу толщиной 0.8 мм'),
    {
      intent: 'product',
      needsProducts: true,
    },
  )

  assert.deepEqual(
    routeAssistantRequest('Сколько стоит Napato Black?'),
    {
      intent: 'product',
      needsProducts: true,
    },
  )
})

test('cart changes retain product context', () => {
  assert.deepEqual(
    routeAssistantRequest('добавь товар в корзину'),
    {
      intent: 'product',
      needsProducts: true,
    },
  )
})
