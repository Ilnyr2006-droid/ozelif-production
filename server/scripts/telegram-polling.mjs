import { env } from '../lib/env.mjs'
import {
  handleTelegramUpdate,
  processTelegramOutbox,
  telegramEnabled,
} from '../lib/telegram-bot.mjs'

if (!telegramEnabled()) {
  throw new Error(
    'Укажите TELEGRAM_BOT_TOKEN и TELEGRAM_BOT_USERNAME в .env.admin',
  )
}

const api = `https://api.telegram.org/bot${env.telegramBotToken}`
let offset = 0
let stopped = false

const sleep = milliseconds =>
  new Promise(resolve => setTimeout(resolve, milliseconds))

async function telegram(method, body = {}) {
  const response = await fetch(`${api}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(40_000),
  })

  const payload = await response.json()

  if (!response.ok || !payload.ok) {
    throw new Error(
      `${method}: ${payload.description ?? response.statusText}`,
    )
  }

  return payload.result
}

async function main() {
  const bot = await telegram('getMe')

  console.log(`Telegram bot: @${bot.username}`)

  // Long polling не работает одновременно с webhook.
  await telegram('deleteWebhook', {
    drop_pending_updates: false,
  })

  console.log('Webhook отключён, long polling запущен')

  while (!stopped) {
    try {
      const updates = await telegram('getUpdates', {
        offset,
        timeout: 25,
        allowed_updates: ['message'],
      })

      for (const update of updates) {
        offset = Math.max(offset, Number(update.update_id) + 1)

        try {
          await handleTelegramUpdate(update)
        } catch (error) {
          console.error(
            'Ошибка обработки Telegram update:',
            error,
          )
        }
      }

      await processTelegramOutbox()
    } catch (error) {
      if (stopped) break

      console.error('Telegram polling error:', error)
      await sleep(5000)
    }
  }
}

process.on('SIGTERM', () => {
  stopped = true
})

process.on('SIGINT', () => {
  stopped = true
})

await main()
