import assert from 'node:assert/strict'
import test from 'node:test'
import {
  formatAdminNotificationText,
  formatTelegramCustomerNotificationText,
  isTelegramResetCommand,
  unlinkedTelegramMessageMode,
} from './telegram-bot.mjs'

test('routes an ordinary manager-subscriber message to the shared assistant', () => {
  assert.equal(
    unlinkedTelegramMessageMode('можно фото Дублёночный материал Кёрли "Black&Silky"', {
      adminSubscription: true,
    }),
    'assistant',
  )
})

test('keeps a dedicated start greeting for a manager subscriber', () => {
  assert.equal(
    unlinkedTelegramMessageMode('/start', { adminSubscription: true }),
    'manager_greeting',
  )
})

test('recognizes reset as a server command instead of an AI message', () => {
  assert.equal(isTelegramResetCommand('/reset'), true)
  assert.equal(isTelegramResetCommand('/reset@Ozelif_bot'), true)
  assert.equal(isTelegramResetCommand('помоги сбросить заказ'), false)
})

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
        deliveryAddress: 'ул. Баумана, д. 15, кв. 24',
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
  assert.match(text, /Город: Казань/u)
  assert.match(text, /Адрес: ул\. Баумана, д\. 15, кв\. 24/u)
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

test('formats a queued common AI reply for Telegram', () => {
  const text = formatTelegramCustomerNotificationText({
    event_type: 'chat.ai_reply.42',
    payload: {
      text: 'Это ответ общего AI-консультанта.',
    },
  })

  assert.equal(text, 'Это ответ общего AI-консультанта.')
})

test('never formats a chat event as an order with an undefined number', () => {
  const text = formatTelegramCustomerNotificationText({
    event_type: 'chat.reset.42',
    payload: { type: 'text', text: 'Диалог сброшен.' },
  })

  assert.equal(text, 'Диалог сброшен.')
  assert.doesNotMatch(text, /Заказ №/u)
})

test('does not create an order notification without a public number', () => {
  assert.equal(formatTelegramCustomerNotificationText({
    event_type: 'order.confirmed',
    payload: { statusLabel: 'Подтверждён' },
  }), '')
})
