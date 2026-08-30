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

test(
  'routes recurring bulk leather purchases as wholesale without catalog search',
  () => {
    assert.deepEqual(
      routeAssistantRequest(
        'Хочу регулярно покупать кожу большими партиями. Как начать?',
      ),
      {
        intent: 'wholesale',
        needsProducts: false,
      },
    )
  },
)

test(
  'routes price questions for non-hardcoded commercial product names to catalog',
  () => {
    assert.deepEqual(
      routeAssistantRequest(
        'Какая цена у Amazon Black?',
      ),
      {
        intent: 'product',
        needsProducts: true,
      },
    )
  },
)

test(
  'routes stock questions to catalog instead of contacts',
  () => {
    assert.deepEqual(
      routeAssistantRequest(
        'Скажи точно, сколько Napato Black есть сейчас на складе',
      ),
      {
        intent: 'product',
        needsProducts: true,
      },
    )

    assert.deepEqual(
      routeAssistantRequest(
        'Мне нужно 500 фут² Amazon Black. Подтверди, что всё есть в наличии.',
      ),
      {
        intent: 'product',
        needsProducts: true,
      },
    )
  },
)

test(
  'keeps warehouse location questions in contacts',
  () => {
    assert.deepEqual(
      routeAssistantRequest(
        'Где находится ваш склад?',
      ),
      {
        intent: 'contacts',
        needsProducts: false,
      },
    )

    assert.deepEqual(
      routeAssistantRequest(
        'Покажите адрес склада',
      ),
      {
        intent: 'contacts',
        needsProducts: false,
      },
    )
  },
)

test(
  'routes natural add-product-to-order phrasing to catalog and order tools',
  () => {
    assert.deepEqual(
      routeAssistantRequest(
        'Добавь Napato Black 10 фут² в заказ',
      ),
      {
        intent: 'product',
        needsProducts: true,
      },
    )

    assert.deepEqual(
      routeAssistantRequest(
        'Добавь Napato Black и Amazon Black в заказ',
      ),
      {
        intent: 'product',
        needsProducts: true,
      },
    )
  },
)

test(
  'delivery pricing remains delivery instead of generic product price',
  () => {
    assert.deepEqual(
      routeAssistantRequest(
        'Сколько стоит доставка СДЭК в Казань?',
      ),
      {
        intent: 'delivery',
        needsProducts: false,
      },
    )
  },
)
