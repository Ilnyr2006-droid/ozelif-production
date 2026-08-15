
import crypto from 'node:crypto'
import { promisify } from 'node:util'
import { env } from './env.mjs'
const scrypt = promisify(crypto.scrypt)
const COOKIE = 'ozelif_admin_session'
export async function hashPassword(password) {
  if (password.length < 10) throw new Error('Пароль должен содержать минимум 10 символов')
  const salt = crypto.randomBytes(16).toString('hex')
  const hash = await scrypt(password, salt, 64)
  return `scrypt:${salt}:${Buffer.from(hash).toString('hex')}`
}
export async function verifyPassword(password, stored) {
  const [method, salt, expectedHex] = String(stored).split(':')
  if (method !== 'scrypt' || !salt || !expectedHex) return false
  const actual = Buffer.from(await scrypt(password, salt, 64))
  const expected = Buffer.from(expectedHex, 'hex')
  return actual.length === expected.length && crypto.timingSafeEqual(actual, expected)
}
export const createSessionToken = () => crypto.randomBytes(32).toString('base64url')
export const hashSessionToken = token => crypto.createHmac('sha256', env.sessionSecret).update(token).digest('hex')
export function readSessionToken(req) {
  const cookies = Object.fromEntries(String(req.headers.cookie ?? '').split(';').map(x => x.trim()).filter(Boolean).map(x => {
    const i = x.indexOf('=')
    return i < 0 ? [x, ''] : [x.slice(0, i), decodeURIComponent(x.slice(i + 1))]
  }))
  return cookies[COOKIE] ?? null
}
export function sessionCookie(token, seconds) {
  const parts = [`${COOKIE}=${encodeURIComponent(token)}`, 'Path=/', 'HttpOnly', 'SameSite=Lax', `Max-Age=${seconds}`]
  if (env.cookieSecure) parts.push('Secure')
  return parts.join('; ')
}
export function clearSessionCookie() {
  const parts = [`${COOKIE}=`, 'Path=/', 'HttpOnly', 'SameSite=Lax', 'Max-Age=0']
  if (env.cookieSecure) parts.push('Secure')
  return parts.join('; ')
}
