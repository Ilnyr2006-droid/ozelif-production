
import dotenv from 'dotenv'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
const dir = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(dir, '../..')
dotenv.config({ path: path.join(root, '.env.admin') })
const required = name => {
  const value = process.env[name]
  if (!value) throw new Error(`Missing environment variable: ${name}`)
  return value
}
export const env = {
  port: Number(process.env.ADMIN_API_PORT ?? 8093),
  databaseUrl: required('DATABASE_URL'),
  sessionSecret: required('ADMIN_SESSION_SECRET'),
  sessionDays: Number(process.env.ADMIN_SESSION_DAYS ?? 14),
  cookieSecure: process.env.ADMIN_COOKIE_SECURE === 'true',
  uploadDir: path.resolve(process.env.ADMIN_UPLOAD_DIR ?? path.join(root, 'uploads')),
  frontendRoot: path.resolve(process.env.OZELIF_FRONTEND_ROOT ?? '/var/www/ozelif-8091'),
  siteUrl: String(process.env.OZELIF_SITE_URL ?? 'https://ozelifkoja.ru').replace(/\/$/, ''),
  yandexReviewsSourceUrl: String(process.env.YANDEX_REVIEWS_SOURCE_URL ?? '').trim(),
  telegramBotToken: String(process.env.TELEGRAM_BOT_TOKEN ?? '').trim(),
  telegramBotUsername: String(process.env.TELEGRAM_BOT_USERNAME ?? '').replace(/^@/, '').trim(),
  telegramAdminChatId: String(process.env.TELEGRAM_ADMIN_CHAT_ID ?? '').trim(),
  telegramWebhookSecret: String(process.env.TELEGRAM_WEBHOOK_SECRET ?? '').trim(),
}
