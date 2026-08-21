import assert from 'node:assert/strict'
import test from 'node:test'
import {
  createTelegramLiveChatBridge,
  formatTelegramAssistantReply,
  formatTelegramCart,
  telegramPhotoRequested,
  telegramMessageContent,
  telegramSelectedProduct,
  telegramProductCaption,
  telegramProductInlineKeyboard,
  telegramProductPhotos,
  telegramCartInlineKeyboard,
  telegramCartRequested,
  telegramLiveChatToken,
} from './telegram-live-chat.mjs'

const message = {
  message_id: 77,
  chat: { id: 12345 },
  from: {
    id: 67890,
    first_name: 'Ильнур',
    username: 'ilnur',
  },
}

function queryMock(calls) {
  return async (sql, params) => {
    calls.push({ sql, params })

    if (sql.includes('FROM telegram_customer_links')) {
      return { rowCount: 0, rows: [] }
    }

    if (sql.includes('INSERT INTO live_chat_conversations')) {
      return {
        rowCount: 1,
        rows: [{ id: '11111111-1111-4111-8111-111111111111' }],
      }
    }

    if (sql.includes('INSERT INTO notification_outbox')) {
      return {
        rowCount: 1,
        rows: [{ id: '22222222-2222-4222-8222-222222222222' }],
      }
    }

    throw new Error(`Unexpected SQL: ${sql}`)
  }
}

test('uses an opaque stable token instead of exposing Telegram identity', () => {
  const first = telegramLiveChatToken('12345', 'secret')
  const second = telegramLiveChatToken('12345', 'secret')

  assert.equal(first, second)
  assert.notEqual(first, 'telegram:12345')
  assert.doesNotMatch(first, /12345/u)
})

test('includes a selected Telegram product card with the new message', () => {
  const content = telegramMessageContent({
    reply_to_message: {
      caption: 'Chelsea Beige\nЦена: 437,05 ₽ / фут²\nЦвет: Бежевый',
    },
  }, 'Можно эту заказать?')

  assert.match(content, /Контекст сообщения/u)
  assert.match(content, /Chelsea Beige/u)
  assert.match(content, /Можно эту заказать/u)
})

test('recognizes only bot product cards as a Telegram selection', () => {
  assert.equal(telegramSelectedProduct({
    reply_to_message: {
      from: { is_bot: true },
      caption: 'Chelsea Beige\nЦена: 437,05 ₽ / фут²',
    },
  }), 'Chelsea Beige')
  assert.equal(telegramSelectedProduct({
    reply_to_message: {
      from: { is_bot: false },
      text: 'Chelsea Beige',
    },
  }), null)
})

test('routes a Telegram message through the website live-chat pipeline', async () => {
  const calls = []
  let request = null
  const bridge = createTelegramLiveChatBridge({
    queryFn: queryMock(calls),
    sessionSecret: 'test-secret',
    siteUrl: 'https://example.test',
    port: 8093,
    fetchImpl: async (url, options) => {
      request = { url, options }
      return new Response(JSON.stringify({
        ok: true,
        userMessage: { id: '10' },
        assistant: {
          message: {
            id: '11',
            content: 'Подойдёт кожа Napato Black.',
          },
          actions: [{
            label: 'Открыть Napato Black',
            href: '/odejnayakozha/tproduct/1-napato-black',
          }],
        },
      }), {
        status: 201,
        headers: { 'Content-Type': 'application/json' },
      })
    },
  })

  const result = await bridge({
    message,
    text: 'Подбери чёрную кожу для куртки',
  })

  assert.equal(result.ok, true)
  assert.equal(result.queued, true)
  assert.match(request.url, /\/api\/live-chat\/conversations\//u)
  assert.ok(request.options.headers['X-Ozelif-Live-Chat-Token'])

  const body = JSON.parse(request.options.body)
  assert.equal(body.path, 'telegram')
  assert.equal(body.clientMessageId, 'tg_12345_77')

  const outbox = calls.find(call => (
    call.sql.includes('INSERT INTO notification_outbox')
  ))
  assert.equal(outbox.params[0], 'chat.ai_reply.11')
  assert.match(outbox.params[3], /Napato Black/u)
  assert.match(outbox.params[3], /https:\/\/example\.test\/odejnayakozha/u)
})

test('forwards a selected product card to the shared AI conversation', async () => {
  const calls = []
  let request = null
  const bridge = createTelegramLiveChatBridge({
    queryFn: queryMock(calls),
    sessionSecret: 'test-secret',
    fetchImpl: async (_url, options) => {
      request = options
      return new Response(JSON.stringify({
        ok: true,
        assistant: { message: { id: 'quote-1', content: 'Добавлю материал в заявку.' } },
      }), { status: 201, headers: { 'Content-Type': 'application/json' } })
    },
  })

  await bridge({
    message: {
      ...message,
      reply_to_message: {
        from: { is_bot: true },
        caption: 'Chelsea Beige\nЦена: 437,05 ₽ / фут²',
      },
    },
    text: 'Можно эту заказать?',
  })

  const body = JSON.parse(request.body)
  assert.match(body.content, /Chelsea Beige/u)
  assert.match(body.content, /Можно эту заказать/u)
  assert.deepEqual(body.telegramSelection, {
    productName: 'Chelsea Beige',
    userMessage: 'Можно эту заказать?',
  })
})

test('uses the same outbox identity when Telegram retries one update', async () => {
  const eventTypes = []
  const bridge = createTelegramLiveChatBridge({
    sessionSecret: 'test-secret',
    queryFn: async (sql, params) => {
      if (sql.includes('FROM telegram_customer_links')) {
        return { rowCount: 0, rows: [] }
      }
      if (sql.includes('INSERT INTO live_chat_conversations')) {
        return {
          rowCount: 1,
          rows: [{ id: '11111111-1111-4111-8111-111111111111' }],
        }
      }
      if (sql.includes('INSERT INTO notification_outbox')) {
        eventTypes.push(params[0])
        return {
          rowCount: eventTypes.length === 1 ? 1 : 0,
          rows: eventTypes.length === 1 ? [{ id: 'outbox' }] : [],
        }
      }
      throw new Error('Unexpected SQL')
    },
    fetchImpl: async () => new Response(JSON.stringify({
      ok: true,
      duplicate: true,
      userMessage: { id: '10' },
      assistant: {
        message: { id: '11', content: 'Один ответ' },
      },
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }),
  })

  const first = await bridge({ message, text: 'Повтор' })
  const second = await bridge({ message, text: 'Повтор' })

  assert.equal(first.queued, true)
  assert.equal(second.queued, false)
  assert.deepEqual(eventTypes, [
    'chat.ai_reply.11',
    'chat.ai_reply.11',
  ])
})

test('queues a safe fallback when the common AI endpoint is unavailable', async () => {
  const calls = []
  const bridge = createTelegramLiveChatBridge({
    queryFn: queryMock(calls),
    sessionSecret: 'test-secret',
    fetchImpl: async () => {
      throw new Error('offline')
    },
  })

  const result = await bridge({ message, text: 'Есть замша?' })
  const outbox = calls.find(call => (
    call.sql.includes('INSERT INTO notification_outbox')
  ))

  assert.equal(result.ok, false)
  assert.equal(result.queued, true)
  assert.match(outbox.params[3], /временно недоступен/u)
})

test('formats product actions as public OZELIF links', () => {
  const text = formatTelegramAssistantReply({
    message: { content: 'Нашёл вариант.' },
    actions: [{ label: 'Открыть товар', href: '/catalog/product' }],
  }, { siteUrl: 'https://ozelifkoja.ru' })

  assert.match(text, /Нашёл вариант/u)
  assert.match(text, /https:\/\/ozelifkoja\.ru\/catalog\/product/u)
})

test('acknowledges product photos and removes unsupported Telegram markdown', () => {
  const text = formatTelegramAssistantReply({
    message: {
      content: [
        'К сожалению, у меня нет возможности предоставить фотографии.',
        '**Black&Silky**',
        '- Толщина: Подходит для одежды',
      ].join('\n'),
    },
    actions: [{
      label: '**Открыть товар**',
      href: '/dublyonka/tproduct/1-black-silky',
    }],
  }, { siteUrl: 'https://ozelifkoja.ru' })

  assert.match(text, /отправляю фотографии подходящих вариантов/u)
  assert.doesNotMatch(text, /нет возможности/u)
  assert.doesNotMatch(text, /\*\*/u)
  assert.doesNotMatch(text, /Толщина: Подходит/u)
  assert.match(text, /https:\/\/ozelifkoja\.ru\/dublyonka\/tproduct\/1-black-silky/u)
})

test('builds Telegram photo jobs from verified catalog products', () => {
  const photos = telegramProductPhotos({
    products: [{
      name: 'Дубленочный материал Кёрли "Black&Silky"',
      image: '/images/catalog/dublyonka/570274326502/w720.webp',
      productUrl: '/dublyonka/tproduct/570274326502-blackampsil',
    }],
  }, { siteUrl: 'https://ozelifkoja.ru' })

  assert.deepEqual(photos, [{
    photoUrl: 'https://ozelifkoja.ru/images/catalog/dublyonka/570274326502/w720.webp',
    caption: 'Дубленочный материал Кёрли "Black&Silky"',
    inlineKeyboard: [[
      {
        text: '🛒 Добавить в корзину',
        callbackData: 'oz:add',
      },
      {
        text: '🔗 Открыть товар',
        url: 'https://ozelifkoja.ru/dublyonka/tproduct/570274326502-blackampsil',
      },
    ]],
  }])
})

test('formats a verified product photo as a compact Telegram card', () => {
  const caption = telegramProductCaption({
    name: 'Дубленочный материал Кёрли "Black&Silky"',
    category: 'Дублёночный материал',
    stockQuantity: null,
    attributes: {
      subtype: ['Керли'],
      color: 'Чёрный',
      material: 'Овчина',
      coating: 'Кожа',
      origin: 'Испания',
      hideSize: '6-7 фут²',
    },
    variants: [
      { unit: 'фут²', priceRub: 1136.33 },
      { unit: 'дм²', priceRub: 122.37 },
    ],
  })

  assert.equal(caption, [
    'Дубленочный материал Кёрли "Black&Silky"',
    'Цена: 1 136,33 ₽ / фут² · 122,37 ₽ / дм²',
    'Категория: Дублёночный материал / Керли',
    'Цвет: Чёрный',
    'Сырьё: Овчина',
    'Покрытие: Кожа',
    'Производство: Испания',
    'Размер шкуры: 6-7 фут²',
  ].join('\n'))
})

test('recognizes an explicit request for product photos', () => {
  assert.equal(telegramPhotoRequested('Можно фотографии Black&Silky?'), true)
  assert.equal(telegramPhotoRequested('Расскажи характеристики Black&Silky'), false)
})

test('queues product photos separately from the idempotent text reply', async () => {
  const calls = []
  const bridge = createTelegramLiveChatBridge({
    queryFn: queryMock(calls),
    sessionSecret: 'test-secret',
    siteUrl: 'https://ozelifkoja.ru',
    fetchImpl: async () => new Response(JSON.stringify({
      ok: true,
      assistant: {
        message: { id: 'photo-reply', content: 'Вот фотография.' },
        products: [{
          name: 'Black&Silky',
          image: '/images/catalog/black-silky.webp',
          productUrl: '/dublyonka/tproduct/1-black-silky',
        }],
      },
    }), {
      status: 201,
      headers: { 'Content-Type': 'application/json' },
    }),
  })

  const result = await bridge({ message, text: 'Можно фото Black&Silky?' })
  const outbox = calls.filter(call => (
    call.sql.includes('INSERT INTO notification_outbox')
  ))

  assert.equal(result.queued, true)
  assert.equal(outbox.length, 2)
  assert.equal(outbox[0].params[0], 'chat.ai_reply.photo-reply')
  assert.equal(outbox[1].params[0], 'chat.ai_photo.photo-reply.1')
  assert.deepEqual(JSON.parse(outbox[1].params[3]), {
    type: 'photo',
    photoUrl: 'https://ozelifkoja.ru/images/catalog/black-silky.webp',
    caption: 'Black&Silky',
    inlineKeyboard: [[
      {
        text: '🛒 Добавить в корзину',
        callbackData: 'oz:add',
      },
      {
        text: '🔗 Открыть товар',
        url: 'https://ozelifkoja.ru/dublyonka/tproduct/1-black-silky',
      },
    ]],
  })
})

test('queues a separate catalog card for every recommended material', async () => {
  const calls = []
  const bridge = createTelegramLiveChatBridge({
    queryFn: queryMock(calls),
    sessionSecret: 'test-secret',
    siteUrl: 'https://ozelifkoja.ru',
    fetchImpl: async () => new Response(JSON.stringify({
      ok: true,
      assistant: {
        message: {
          id: 'recommendation-cards',
          content: 'Вот несколько подходящих вариантов.',
        },
        products: [
          {
            name: 'Full Vegetale G.Black',
            image: '/images/catalog/full-vegetale-black.webp',
            productUrl: '/odejnayakozha/tproduct/1-full-vegetale-gblack',
            variants: [{ unit: 'фут²', priceRub: 437.1 }],
          },
          {
            name: 'Soft White-Black',
            image: '/images/catalog/soft-white-black.webp',
            productUrl: '/odejnayakozha/tproduct/2-soft-white-black',
            variants: [{ unit: 'фут²', priceRub: 480.8 }],
          },
        ],
      },
    }), {
      status: 201,
      headers: { 'Content-Type': 'application/json' },
    }),
  })

  await bridge({ message, text: 'Подбери кожу для юбки' })
  const outbox = calls.filter(call => (
    call.sql.includes('INSERT INTO notification_outbox')
  ))

  assert.equal(outbox.length, 3)
  assert.equal(outbox[0].params[0], 'chat.ai_reply.recommendation-cards')
  assert.equal(outbox[1].params[0], 'chat.ai_photo.recommendation-cards.1')
  assert.equal(outbox[2].params[0], 'chat.ai_photo.recommendation-cards.2')
  assert.match(JSON.parse(outbox[1].params[3]).caption, /Full Vegetale/u)
  assert.match(JSON.parse(outbox[2].params[3]).caption, /Soft White-Black/u)
})

test('uses the previous recommendation for a follow-up photo request', async () => {
  const outbox = []
  const previousProduct = {
    name: 'Full Vegetale G.Black',
    image: '/images/catalog/full-vegetale-black.webp',
    productUrl: '/odejnayakozha/tproduct/463601248272-full-vegetale-gblack',
    category: 'Одежная кожа',
    attributes: { color: 'Чёрный' },
    variants: [{ unit: 'фут²', priceRub: 437.1 }],
  }
  const bridge = createTelegramLiveChatBridge({
    sessionSecret: 'test-secret',
    siteUrl: 'https://ozelifkoja.ru',
    queryFn: async (sql, params) => {
      if (sql.includes('FROM telegram_customer_links')) {
        return { rowCount: 0, rows: [] }
      }
      if (sql.includes('INSERT INTO live_chat_conversations')) {
        return { rowCount: 1, rows: [{ id: '11111111-1111-4111-8111-111111111111' }] }
      }
      if (sql.includes("metadata->'products' AS products")) {
        return { rowCount: 1, rows: [{ products: [previousProduct] }] }
      }
      if (sql.includes('INSERT INTO notification_outbox')) {
        outbox.push({ eventType: params[0], payload: JSON.parse(params[3]) })
        return { rowCount: 1, rows: [{ id: String(outbox.length) }] }
      }
      throw new Error(`Unexpected SQL: ${sql}`)
    },
    fetchImpl: async () => new Response(JSON.stringify({
      ok: true,
      assistant: {
        message: {
          id: 'follow-up-photo',
          content: 'К сожалению, я не могу прислать фотографии.',
        },
        products: [],
        actions: [],
      },
    }), {
      status: 201,
      headers: { 'Content-Type': 'application/json' },
    }),
  })

  await bridge({ message, text: 'Можно фотографии прислать?' })

  assert.equal(outbox.length, 2)
  assert.match(outbox[0].payload.text, /отправляю фотографии/u)
  assert.equal(
    outbox[1].payload.photoUrl,
    'https://ozelifkoja.ru/images/catalog/full-vegetale-black.webp',
  )
  assert.match(outbox[1].payload.caption, /Full Vegetale G\.Black/u)
  assert.match(outbox[1].payload.caption, /437,10 ₽ \/ фут²/u)
})


test('builds a compact inline keyboard for a product card', () => {
  assert.deepEqual(
    telegramProductInlineKeyboard(
      {
        productUrl:
          '/odejnayakozha/tproduct/1-napato-grey',
      },
      {
        siteUrl:
          'https://ozelifkoja.ru',
      },
    ),
    [[
      {
        text:
          '🛒 Добавить в корзину',
        callbackData:
          'oz:add',
      },
      {
        text:
          '🔗 Открыть товар',
        url:
          'https://ozelifkoja.ru/odejnayakozha/tproduct/1-napato-grey',
      },
    ]],
  )
})


test(
  'formats the Telegram cart as one compact message',
  () => {
    const draft = {
      items: [
        {
          productName:
            'Napato Black',
          quantity:
            2,
          unit:
            'фут²',
          price:
            437.05,
          lineTotal:
            874.10,
        },
        {
          productName:
            'Vegetale Black',
          quantity:
            1,
          unit:
            'фут²',
          price:
            450,
          lineTotal:
            450,
        },
      ],
    }

    const text =
      formatTelegramCart(
        draft,
      )

    assert.match(
      text,
      /🛒 Ваша корзина/u,
    )

    assert.match(
      text,
      /1\. Napato Black/u,
    )

    assert.match(
      text,
      /2 фут² × 437,05 ₽ = 874,1 ₽/u,
    )

    assert.match(
      text,
      /2\. Vegetale Black/u,
    )

    assert.match(
      text,
      /Итого: 1 324,1 ₽/u,
    )

    assert.match(
      text,
      /Товаров: 2 позиции/u,
    )

    assert.match(
      text,
      /Выберите действие/u,
    )
  },
)

test(
  'shows only add action for an empty Telegram cart',
  () => {
    assert.match(
      formatTelegramCart({
        items: [],
      }),
      /Корзина пока пуста/u,
    )

    assert.deepEqual(
      telegramCartInlineKeyboard({
        items: [],
      }),
      [[
        {
          text:
            '➕ Добавить товар',
          callbackData:
            'oz:add_more',
        },
      ]],
    )
  },
)

test(
  'builds four compact actions for a non-empty Telegram cart',
  () => {
    const keyboard =
      telegramCartInlineKeyboard({
        items: [{
          productName:
            'Napato Black',
        }],
      })

    assert.equal(
      keyboard.length,
      2,
    )

    assert.deepEqual(
      keyboard
        .flat()
        .map(button => (
          button.callbackData
        )),
      [
        'oz:add_more',
        'oz:change',
        'oz:remove',
        'oz:checkout',
      ],
    )
  },
)

test(
  'recognizes deterministic Telegram cart requests',
  () => {
    assert.equal(
      telegramCartRequested(
        'Покажи корзину',
      ),
      true,
    )

    assert.equal(
      telegramCartRequested(
        'корзина',
      ),
      true,
    )

    assert.equal(
      telegramCartRequested(
        'покажи товары',
      ),
      false,
    )
  },
)

test(
  'opens Telegram cart without calling the AI endpoint',
  async () => {
    const calls = []
    let fetchCalled =
      false

    const bridge =
      createTelegramLiveChatBridge({
        sessionSecret:
          'test-secret',
        queryFn:
          async (
            sql,
            params,
          ) => {
            calls.push({
              sql,
              params,
            })

            if (
              sql.includes(
                'FROM telegram_customer_links',
              )
            ) {
              return {
                rowCount: 0,
                rows: [],
              }
            }

            if (
              sql.includes(
                'INSERT INTO live_chat_conversations',
              )
            ) {
              return {
                rowCount: 1,
                rows: [{
                  id:
                    '11111111-1111-4111-8111-111111111111',
                }],
              }
            }

            if (
              sql.includes(
                'INSERT INTO live_chat_order_drafts',
              )
            ) {
              return {
                rowCount: 0,
                rows: [],
              }
            }

            if (
              sql.includes(
                'FROM live_chat_order_drafts',
              )
            ) {
              return {
                rowCount: 1,
                rows: [{
                  conversation_id:
                    '11111111-1111-4111-8111-111111111111',
                  status:
                    'collecting',
                  items: [{
                    productId:
                      'product-1',
                    productName:
                      'Napato Black',
                    quantity:
                      2,
                    unit:
                      'фут²',
                    price:
                      437.05,
                    lineTotal:
                      874.10,
                  }],
                  delivery_method:
                    null,
                  delivery_city:
                    null,
                  delivery_address:
                    null,
                  revision:
                    1,
                  confirmed_revision:
                    null,
                  confirmed_at:
                    null,
                  order_id:
                    null,
                  created_at:
                    new Date(),
                  updated_at:
                    new Date(),
                }],
              }
            }

            if (
              sql.includes(
                'INSERT INTO notification_outbox',
              )
            ) {
              return {
                rowCount: 1,
                rows: [{
                  id:
                    'outbox-cart',
                }],
              }
            }

            throw new Error(
              `Unexpected SQL: ${sql}`,
            )
          },
        fetchImpl:
          async () => {
            fetchCalled =
              true

            throw new Error(
              'AI should not be called',
            )
          },
      })

    const result =
      await bridge({
        message,
        text:
          'Покажи корзину',
      })

    assert.equal(
      fetchCalled,
      false,
    )

    assert.equal(
      result.cart,
      true,
    )

    const outbox =
      calls.find(call => (
        call.sql.includes(
          'INSERT INTO notification_outbox',
        )
      ))

    const payload =
      JSON.parse(
        outbox.params[3],
      )

    assert.match(
      payload.text,
      /Napato Black/u,
    )

    assert.equal(
      payload.inlineKeyboard
        .flat()
        .length,
      4,
    )
  },
)
