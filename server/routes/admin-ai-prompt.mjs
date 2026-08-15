import express from 'express'
import { query } from '../lib/db.mjs'
import { requireAdmin, requirePermission } from '../lib/admin-auth.mjs'
import {
  createAiPromptDraft,
  getPublishedAiPrompt,
  listAiPromptVersions,
  publishAiPromptContent,
  publishAiPromptVersion,
  rollbackAiPromptVersion,
} from '../lib/ai-prompt-store.mjs'
import {
  getProtectedAiPromptCore,
} from '../lib/ai-system-prompt.mjs'

function asyncRoute(handler) {
  return (request, response, next) => {
    Promise.resolve(handler(request, response, next)).catch(next)
  }
}

function actorFromRequest(request) {
  return (
    request.admin?.email
    ?? request.admin?.name
    ?? request.ip
    ?? 'admin'
  )
}

export function createAdminAiPromptRouter() {
  const router = express.Router()

  router.use(requireAdmin)
  router.use(requirePermission('prompt:read'))

  router.use((_request, response, next) => {
    response.setHeader('Cache-Control', 'no-store')
    next()
  })

  router.get('/', asyncRoute(async (_request, response) => {
    const [published, versions] = await Promise.all([
      getPublishedAiPrompt({ force: true }),
      listAiPromptVersions(40),
    ])

    response.json({
      ok: true,
      published,
      versions,
      protectedCore: getProtectedAiPromptCore(),
      limits: {
        minCharacters: 500,
        maxCharacters: 60_000,
      },
    })
  }))

  router.post('/draft', requirePermission('prompt:draft'), asyncRoute(async (request, response) => {
    const draft = await createAiPromptDraft({
      content: request.body?.content,
      notes: request.body?.notes,
      actor: actorFromRequest(request),
    })

    response.status(201).json({ ok: true, draft })
  }))

  router.post('/publish', requirePermission('prompt:publish'), asyncRoute(async (request, response) => {
    const published = await publishAiPromptContent({
      content: request.body?.content,
      notes: request.body?.notes,
      actor: actorFromRequest(request),
    })

    response.status(201).json({ ok: true, published })
  }))

  router.post(
    '/versions/:id/publish',
    requirePermission('prompt:publish'),
    asyncRoute(async (request, response) => {
      const published = await publishAiPromptVersion({
        versionId: request.params.id,
        actor: actorFromRequest(request),
      })

      response.json({ ok: true, published })
    }),
  )

  router.post(
    '/versions/:id/rollback',
    requirePermission('prompt:publish'),
    asyncRoute(async (request, response) => {
      const published = await rollbackAiPromptVersion({
        versionId: request.params.id,
        actor: actorFromRequest(request),
      })

      response.status(201).json({ ok: true, published })
    }),
  )

  return router
}
