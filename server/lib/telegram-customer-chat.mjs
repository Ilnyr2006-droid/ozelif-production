import { env } from './env.mjs'

function clean(value, max = 4_000) {
  return String(value ?? '')
    .trim()
    .slice(0, max)
}

function apiBase(token) {
  return `https://api.telegram.org/bot${token}`
}

export function telegramInlineReplyMarkup(
  inlineKeyboard,
) {
  const rows = (
    Array.isArray(inlineKeyboard)
      ? inlineKeyboard
      : []
  )
    .map(row => (
      Array.isArray(row)
        ? row
          .map(button => {
            const text =
              clean(
                button?.text,
                64,
              )

            if (!text) return null

            const url =
              clean(
                button?.url,
                1_000,
              )

            if (
              url
              && /^https?:\/\//iu.test(url)
            ) {
              return {
                text,
                url,
              }
            }

            const callbackData =
              clean(
                button?.callbackData,
                64,
              )

            if (callbackData) {
              return {
                text,
                callback_data:
                  callbackData,
              }
            }

            return null
          })
          .filter(Boolean)
        : []
    ))
    .filter(row => row.length)

  return rows.length
    ? {
        reply_markup: {
          inline_keyboard:
            rows,
        },
      }
    : {}
}

async function telegramResult(
  response,
  method,
) {
  const payload =
    await response
      .json()
      .catch(() => null)

  if (
    !response.ok
    || payload?.ok !== true
  ) {
    throw new Error(
      `Telegram ${method}: ${
        payload?.description
        || response.statusText
        || `HTTP ${response.status}`
      }`,
    )
  }

  return payload.result ?? {}
}

export function createTelegramCustomerChat({
  token = env.telegramBotToken,
  fetchImpl = fetch,
} = {}) {
  const botToken =
    clean(token, 512)

  async function sendText(
    chatId,
    text,
    {
      inlineKeyboard = [],
    } = {},
  ) {
    if (!botToken) {
      throw new Error(
        'telegram_not_configured',
      )
    }

    const content =
      clean(text)

    if (!content) {
      throw new Error(
        'message_required',
      )
    }

    const response =
      await fetchImpl(
        `${apiBase(botToken)}/sendMessage`,
        {
          method: 'POST',
          headers: {
            'Content-Type':
              'application/json',
          },
          body:
            JSON.stringify({
              chat_id:
                String(chatId),
              text:
                content,
              disable_web_page_preview:
                true,
              ...telegramInlineReplyMarkup(
                inlineKeyboard,
              ),
            }),
          signal:
            AbortSignal.timeout(10_000),
        },
      )

    const result =
      await telegramResult(
        response,
        'sendMessage',
      )

    return {
      messageId:
        result.message_id
        ?? null,
    }
  }

  async function sendPhoto(
    chatId,
    {
      buffer,
      mimeType,
      filename,
      caption = '',
    },
  ) {
    if (!botToken) {
      throw new Error(
        'telegram_not_configured',
      )
    }

    if (
      !Buffer.isBuffer(buffer)
      || !buffer.length
    ) {
      throw new Error(
        'photo_required',
      )
    }

    const form =
      new FormData()

    form.set(
      'chat_id',
      String(chatId),
    )

    form.set(
      'photo',
      new Blob(
        [buffer],
        {
          type:
            clean(
              mimeType,
              120,
            )
            || 'application/octet-stream',
        },
      ),
      clean(
        filename,
        240,
      )
      || 'photo.jpg',
    )

    const normalizedCaption =
      clean(
        caption,
        1_024,
      )

    if (normalizedCaption) {
      form.set(
        'caption',
        normalizedCaption,
      )
    }

    const response =
      await fetchImpl(
        `${apiBase(botToken)}/sendPhoto`,
        {
          method: 'POST',
          body: form,
          signal:
            AbortSignal.timeout(20_000),
        },
      )

    const result =
      await telegramResult(
        response,
        'sendPhoto',
      )

    return {
      messageId:
        result.message_id
        ?? null,
    }
  }

  async function sendPhotoUrl(
    chatId,
    {
      url,
      caption = '',
      inlineKeyboard = [],
    },
  ) {
    if (!botToken) {
      throw new Error(
        'telegram_not_configured',
      )
    }

    const photo = clean(url, 1_000)
    if (!/^https?:\/\//iu.test(photo)) {
      throw new Error(
        'photo_url_required',
      )
    }

    const response =
      await fetchImpl(
        `${apiBase(botToken)}/sendPhoto`,
        {
          method: 'POST',
          headers: {
            'Content-Type':
              'application/json',
          },
          body:
            JSON.stringify({
              chat_id:
                String(chatId),
              photo,
              caption:
                clean(caption, 1_024),
              ...telegramInlineReplyMarkup(
                inlineKeyboard,
              ),
            }),
          signal:
            AbortSignal.timeout(20_000),
        },
      )

    const result =
      await telegramResult(
        response,
        'sendPhoto',
      )

    return {
      messageId:
        result.message_id
        ?? null,
    }
  }

  return {
    sendText,
    sendPhoto,
    sendPhotoUrl,
  }
}

export const telegramCustomerChat =
  createTelegramCustomerChat()
