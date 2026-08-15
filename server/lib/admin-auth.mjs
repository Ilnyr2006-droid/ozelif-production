import { query } from './db.mjs'
import { hashSessionToken, readSessionToken } from './security.mjs'
import { hasPermission } from './admin-permissions.mjs'

export async function currentAdmin(request) {
  const token = readSessionToken(request)

  if (!token) return null

  const result = await query(
    `SELECT u.id, u.email, u.name, u.role
       FROM admin_sessions s
       JOIN admin_users u ON u.id = s.user_id
      WHERE s.token_hash = $1
        AND s.expires_at > now()
        AND u.is_active = true
      LIMIT 1`,
    [hashSessionToken(token)],
  )

  return result.rows[0] ?? null
}

export async function requireAdmin(request, response, next) {
  const admin = await currentAdmin(request)

  if (!admin) {
    response.status(401).json({ error: 'unauthorized' })
    return
  }

  request.admin = admin
  next()
}

export function requirePermission(permission) {
  return async (request, response, next) => {
    const admin = request.admin ?? await currentAdmin(request)

    if (!admin) {
      response.status(401).json({ error: 'unauthorized' })
      return
    }

    if (!hasPermission(admin.role, permission)) {
      response.status(403).json({ error: 'forbidden' })
      return
    }

    request.admin = admin
    next()
  }
}
