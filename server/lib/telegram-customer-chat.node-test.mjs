import assert from 'node:assert/strict'
import test from 'node:test'
import {
  createTelegramCustomerChat,
} from './telegram-customer-chat.mjs'

function okResult(messageId) {
  return new Response(
    JSON.stringify({
      ok: true,
      result: {
        message_id:
          messageId,
      },
    }),
    {
      status: 200,
      headers: {
        'Content-Type':
          'application/json',
      },
    },
  )
}

test(
  'sends text through sendMessage',
  async () => {
    let captured

    const client =
      createTelegramCustomerChat({
        token: 'test-token',
        fetchImpl:
          async (url, options) => {
            captured = {
              url,
              options,
            }

            return okResult(101)
          },
      })

    const result =
      await client.sendText(
        123,
        'Здравствуйте',
      )

    assert.equal(
      result.messageId,
      101,
    )

    assert.match(
      captured.url,
      /sendMessage$/,
    )

    const body =
      JSON.parse(
        captured.options.body,
      )

    assert.equal(
      body.chat_id,
      '123',
    )

    assert.equal(
      body.text,
      'Здравствуйте',
    )
  },
)

test(
  'sends JPG through sendPhoto',
  async () => {
    let captured

    const client =
      createTelegramCustomerChat({
        token: 'test-token',
        fetchImpl:
          async (url, options) => {
            captured = {
              url,
              options,
            }

            return okResult(202)
          },
      })

    const result =
      await client.sendPhoto(
        456,
        {
          buffer:
            Buffer.from([
              0xff,
              0xd8,
              0xff,
              0xdb,
            ]),
          mimeType:
            'image/jpeg',
          filename:
            'photo.jpg',
          caption:
            'Фото товара',
        },
      )

    assert.equal(
      result.messageId,
      202,
    )

    assert.match(
      captured.url,
      /sendPhoto$/,
    )

    assert.ok(
      captured.options.body
      instanceof FormData,
    )

    assert.equal(
      captured.options.body
        .get('chat_id'),
      '456',
    )

    assert.equal(
      captured.options.body
        .get('caption'),
      'Фото товара',
    )
  },
)

test(
  'sends a trusted catalog URL through sendPhoto',
  async () => {
    let captured
    const client = createTelegramCustomerChat({
      token: 'test-token',
      fetchImpl: async (url, options) => {
        captured = { url, options }
        return okResult(303)
      },
    })

    const result = await client.sendPhotoUrl(
      789,
      {
        url: 'https://example.test/images/product.webp',
        caption: 'Фото Black&Silky',
      },
    )

    assert.equal(result.messageId, 303)
    assert.match(captured.url, /sendPhoto$/u)
    const body = JSON.parse(captured.options.body)
    assert.equal(body.chat_id, '789')
    assert.equal(body.photo, 'https://example.test/images/product.webp')
    assert.equal(body.caption, 'Фото Black&Silky')
  },
)
