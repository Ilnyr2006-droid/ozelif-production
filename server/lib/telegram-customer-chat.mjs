import { env } from './env.mjs'

function clean(value, max = 4_000) {
  return String(value ?? '')
    .trim()
    .slice(0, max)
}

function apiBase(token) {
  return `https://api.telegram.org/bot${token}`
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

  return {
    sendText,
    sendPhoto,
  }
}

export const telegramCustomerChat =
  createTelegramCustomerChat()
