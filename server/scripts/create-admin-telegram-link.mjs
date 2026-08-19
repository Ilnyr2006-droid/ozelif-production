import { createLinkToken, hashLinkToken } from '../lib/order-crm.mjs'
import { query } from '../lib/db.mjs'
import { env } from '../lib/env.mjs'
import { telegramEnabled } from '../lib/telegram-bot.mjs'

if (!telegramEnabled()) throw new Error('Telegram bot is not configured.')

const identifier = String(process.argv[2] ?? '').trim().toLowerCase()
const admin = (
  identifier
    ? await query(
      `SELECT id,username,email,name FROM admin_users
       WHERE is_active=true AND (lower(username)=$1 OR lower(email)=$1) LIMIT 1`,
      [identifier],
    )
    : await query(
      `SELECT id,username,email,name FROM admin_users
       WHERE is_active=true ORDER BY created_at LIMIT 1`,
    )
).rows[0]
if (!admin) throw new Error(identifier ? `Admin not found: ${identifier}` : 'No active admin user found.')

const token = createLinkToken()
await query(
  `INSERT INTO telegram_admin_link_tokens (token_hash,admin_user_id,expires_at)
   VALUES ($1,$2,now() + interval '30 minutes')`,
  [hashLinkToken(token), admin.id],
)
console.log(`ADMIN=${admin.username ?? admin.email ?? admin.name}`)
console.log(`LINK=https://t.me/${env.telegramBotUsername}?start=admin_${token}`)
console.log('EXPIRES=30 minutes')
