import crypto from 'node:crypto'
import express from 'express'

import { requireAdmin } from '../lib/admin-auth.mjs'

function base64Url(value) {
  return Buffer
    .from(value)
    .toString('base64url')
}

function signJwt(payload, secret) {
  const header = {
    alg: 'HS256',
    typ: 'JWT',
  }

  const encodedHeader = base64Url(
    JSON.stringify(header),
  )

  const encodedPayload = base64Url(
    JSON.stringify(payload),
  )

  const unsignedToken =
    `${encodedHeader}.${encodedPayload}`

  const signature = crypto
    .createHmac('sha256', secret)
    .update(unsignedToken)
    .digest('base64url')

  return `${unsignedToken}.${signature}`
}

function requiredEnvironment(name) {
  const value = String(
    process.env[name] ?? '',
  ).trim()

  if (!value) {
    throw new Error(
      `${name} is not configured`,
    )
  }

  return value
}

function normalizedSiteUrl(value) {
  return value.replace(/\/+$/, '')
}

export function createAdminMetabaseRouter() {
  const router = express.Router()

  router.use(requireAdmin)

  router.get('/embed', (request, response) => {
    const siteUrl = normalizedSiteUrl(
      requiredEnvironment(
        'METABASE_SITE_URL',
      ),
    )

    const secret = requiredEnvironment(
      'METABASE_EMBED_SECRET',
    )

    const dashboardId =
      requiredEnvironment(
        'METABASE_DASHBOARD_ID',
      )

    const now = Math.floor(
      Date.now() / 1000,
    )

    const token = signJwt(
      {
        resource: {
          dashboard: Number.isFinite(
            Number(dashboardId),
          )
            ? Number(dashboardId)
            : dashboardId,
        },

        params: {},

        iat: now,

        // Ссылка живёт 10 минут.
        exp: now + 600,
      },
      secret,
    )

    const url =
      `${siteUrl}/embed/dashboard/${token}`
      + '#bordered=false'
      + '&titled=false'
      + '&theme=transparent'
      + '&refresh=60'

    response.setHeader(
      'Cache-Control',
      'no-store, private',
    )

    response.json({
      url,
      expiresAt:
        new Date(
          (now + 600) * 1000,
        ).toISOString(),
    })
  })

  return router
}
