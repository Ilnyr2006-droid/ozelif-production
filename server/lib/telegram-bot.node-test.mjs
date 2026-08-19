import assert from 'node:assert/strict'
import test from 'node:test'
import { formatAdminNotificationText } from './telegram-bot.mjs'

test('formats a new order for manager without order number', () => {
  const text = formatAdminNotificationText(
    {
      event_type: 'order.created',
      payload: {
        name: 'Ильнур',
        phone: '89990000000',
        total: 43705,
        deliveryMethod: 'courier',
        city: 'Казань',
        items: [{ name: 'Napato Black', quantity: 20, unit: 'фут²' }],
      },
    },
    { siteUrl: 'https://example.test' },
  )
  assert.match(text, /Новый заказ/u)
  assert.match(text, /Ильнур/u)
  assert.match(text, /Napato Black/u)
  assert.match(text, /43.?705 ₽/u)
  assert.match(text, /Доставка/u)
  assert.doesNotMatch(text, /Заказ №/u)
})

test('formats explicit chat manager request', () => {
  const text = formatAdminNotificationText(
    {
      event_type: 'chat.manager_requested',
      payload: {
        name: 'Рон',
        phone: '+747728477733',
        pagePath: '/odejnayakozha',
        message: 'Позовите менеджера, хочу поговорить.',
      },
    },
    { siteUrl: 'https://example.test' },
  )
  assert.match(text, /Клиент просит менеджера/u)
  assert.match(text, /Позовите менеджера/u)
})
