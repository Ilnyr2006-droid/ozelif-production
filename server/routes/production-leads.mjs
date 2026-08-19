import { Router } from 'express'
import { query } from '../lib/db.mjs'
import { normalizePhone } from '../lib/phone.mjs'
import { safeEnqueueAdminNotification } from '../lib/admin-notifications.mjs'

const attempts = new Map()

function asyncRoute(handler) {
  return (request, response, next) => {
    Promise.resolve(
      handler(request, response, next),
    ).catch(next)
  }
}

function text(value, maxLength = 500) {
  const normalized = String(value ?? '').trim()

  return normalized
    ? normalized.slice(0, maxLength)
    : null
}

function clientIp(request) {
  const forwarded = String(
    request.headers['x-forwarded-for'] ?? '',
  )
    .split(',')[0]
    .trim()

  return (
    forwarded
    || request.socket.remoteAddress
    || null
  )
}

function allowed(request) {
  const key = clientIp(request) || 'unknown'
  const now = Date.now()

  const item = attempts.get(key) ?? {
    count: 0,
    resetAt: now + 15 * 60_000,
  }

  if (now > item.resetAt) {
    item.count = 0
    item.resetAt = now + 15 * 60_000
  }

  item.count += 1
  attempts.set(key, item)

  return item.count <= 8
}

export function createProductionLeadsRouter() {
  const router = Router()

  router.post(
    '/',
    asyncRoute(async (request, response) => {
      if (!allowed(request)) {
        return response.status(429).json({
          error: 'Слишком много заявок. Попробуйте позже.',
        })
      }

      const name = text(
        request.body?.name,
        160,
      )

      const phone = text(
        request.body?.phone,
        80,
      )

      const normalizedPhone =
        normalizePhone(phone)

      if (!name) {
        return response.status(400).json({
          error: 'Укажите имя.',
        })
      }

      if (
        !normalizedPhone
      ) {
        return response.status(400).json({
          error: 'Проверьте номер телефона.',
        })
      }

      const result = await query(
        `
          INSERT INTO production_leads (
            name,
            phone,
            normalized_phone,
            product_type,
            quantity,
            comment,
            ip_address,
            user_agent,
            page_path
          )
          VALUES (
            $1,
            $2,
            $3,
            $4,
            $5,
            $6,
            $7,
            $8,
            $9
          )
          RETURNING
            id,
            status,
            created_at
        `,
        [
          name,
          phone,
          normalizedPhone,
          text(request.body?.productType, 300),
          text(request.body?.quantity, 240),
          text(request.body?.comment, 4_000),
          clientIp(request),
          text(
            request.headers['user-agent'],
            1_000,
          ),
          text(request.body?.pagePath, 500),
        ],
      )

      await safeEnqueueAdminNotification(
        query,
        {
          eventType: 'production.created',
          aggregateType: 'production_lead',
          aggregateId: result.rows[0].id,
          payload: {
            name,
            phone,
            productType: text(request.body?.productType, 300),
            quantity: text(request.body?.quantity, 240),
            comment: text(request.body?.comment, 4_000),
          },
        },
      )

      return response.status(201).json({
        ok: true,
        lead: {
          status: result.rows[0].status,
          createdAt:
            result.rows[0].created_at,
        },
      })
    }),
  )

  return router
}
