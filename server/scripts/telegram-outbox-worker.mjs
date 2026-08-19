import { processTelegramOutbox, telegramEnabled } from '../lib/telegram-bot.mjs'
if (!telegramEnabled()) throw new Error('Telegram bot is not configured.')
let stopped = false
const sleep = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds))
process.on('SIGTERM', () => { stopped = true })
process.on('SIGINT', () => { stopped = true })
console.log('OZELIF Telegram outbox worker started')
while (!stopped) {
  try {
    const result = await processTelegramOutbox()
    if (result.processed > 0) console.log(`Telegram outbox processed: ${result.processed}`)
  } catch (error) {
    console.error('Telegram outbox worker error:', error)
  }
  await sleep(5_000)
}
