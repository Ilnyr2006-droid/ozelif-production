import express from 'express'
import { query } from '../lib/db.mjs'
import { requireAdmin, requirePermission } from '../lib/admin-auth.mjs'
import { normalizeChatContent } from '../lib/live-chat-utils.mjs'

function asyncRoute(handler) {
  return (request, response, next) => {
    Promise.resolve(handler(request, response, next)).catch(next)
  }
}

async function ensureConversation(id) {
  const result = await query(
    `SELECT
       id,
       visitor_id AS "visitorId",
       visitor_name AS "visitorName",
       visitor_phone AS "visitorPhone",
       page_path AS "pagePath",
       status,
       ai_enabled AS "aiEnabled",
       assigned_admin_id AS "assignedAdminId",
       last_message_at AS "lastMessageAt",
       last_read_by_admin_at AS "lastReadByAdminAt",
       created_at AS "createdAt"
     FROM live_chat_conversations
     WHERE id = $1
     LIMIT 1`,
    [id],
  )

  return result.rows[0] ?? null
}

export function createAdminLiveChatsRouter() {
  const router = express.Router()

  router.use(requireAdmin)
  router.use(requirePermission('chat:read'))
  router.use((_request, response, next) => {
    response.setHeader('Cache-Control', 'no-store')
    next()
  })

  router.get('/', asyncRoute(async (request, response) => {
    const status = String(request.query.status ?? 'active')

    const result = await query(
      `SELECT
         c.id,
         c.visitor_id AS "visitorId",
         c.visitor_name AS "visitorName",
         c.visitor_phone AS "visitorPhone",
         c.page_path AS "pagePath",
         c.status,
         c.ai_enabled AS "aiEnabled",
         c.assigned_admin_id AS "assignedAdminId",
         c.last_message_at AS "lastMessageAt",
         c.created_at AS "createdAt",
         COALESCE(last_message.content, '') AS "lastMessage",
         COALESCE(last_message.role, '') AS "lastRole",
         (
           SELECT count(*)::int
           FROM live_chat_messages unread
           WHERE unread.conversation_id = c.id
             AND unread.role = 'user'
             AND unread.created_at > COALESCE(
               c.last_read_by_admin_at,
               '-infinity'::timestamptz
             )
         ) AS "unreadCount"
       FROM live_chat_conversations c
       LEFT JOIN LATERAL (
         SELECT role, content
         FROM live_chat_messages
         WHERE conversation_id = c.id
         ORDER BY id DESC
         LIMIT 1
       ) last_message ON true
       WHERE EXISTS (
         SELECT 1
         FROM live_chat_messages any_message
         WHERE any_message.conversation_id = c.id
       )
       AND (
         $1 = 'all'
         OR ($1 = 'closed' AND c.status = 'closed')
         OR ($1 = 'active' AND c.status <> 'closed')
       )
       ORDER BY
         (COALESCE(last_message.role, '') = 'user') DESC,
         c.last_message_at DESC NULLS LAST,
         c.created_at DESC
       LIMIT 250`,
      [status],
    )

    response.json({
      ok: true,
      conversations: result.rows,
      unreadTotal: result.rows.reduce(
        (sum, item) => sum + Number(item.unreadCount ?? 0),
        0,
      ),
    })
  }))

  router.get('/:id', asyncRoute(async (request, response) => {
    const conversation = await ensureConversation(request.params.id)

    if (!conversation) {
      response.status(404).json({ error: 'conversation_not_found' })
      return
    }

    const messages = await query(
      `SELECT
         id::text,
         role,
         content,
         metadata,
         created_by_admin_id AS "createdByAdminId",
         created_at AS "createdAt"
       FROM live_chat_messages
       WHERE conversation_id = $1
       ORDER BY id ASC
       LIMIT 1_000`,
      [conversation.id],
    )

    await query(
      `UPDATE live_chat_conversations
       SET last_read_by_admin_at = now()
       WHERE id = $1`,
      [conversation.id],
    )

    response.json({
      ok: true,
      conversation,
      messages: messages.rows,
    })
  }))

  router.post('/:id/takeover', requirePermission('chat:write'), asyncRoute(async (request, response) => {
    const result = await query(
      `UPDATE live_chat_conversations
       SET
         status = 'human',
         ai_enabled = false,
         assigned_admin_id = $2,
         updated_at = now()
       WHERE id = $1
       RETURNING
         id,
         status,
         ai_enabled AS "aiEnabled",
         assigned_admin_id AS "assignedAdminId"`,
      [request.params.id, request.admin.id],
    )

    if (!result.rowCount) {
      response.status(404).json({ error: 'conversation_not_found' })
      return
    }

    response.json({ ok: true, conversation: result.rows[0] })
  }))

  router.post('/:id/enable-ai', requirePermission('chat:write'), asyncRoute(async (request, response) => {
    const result = await query(
      `UPDATE live_chat_conversations
       SET
         status = 'open',
         ai_enabled = true,
         assigned_admin_id = NULL,
         updated_at = now()
       WHERE id = $1
       RETURNING
         id,
         status,
         ai_enabled AS "aiEnabled",
         assigned_admin_id AS "assignedAdminId"`,
      [request.params.id],
    )

    if (!result.rowCount) {
      response.status(404).json({ error: 'conversation_not_found' })
      return
    }

    response.json({ ok: true, conversation: result.rows[0] })
  }))

  router.post('/:id/messages', requirePermission('chat:write'), asyncRoute(async (request, response) => {
    const content = normalizeChatContent(request.body?.content)

    if (!content) {
      response.status(400).json({ error: 'message_required' })
      return
    }

    const conversation = await ensureConversation(request.params.id)

    if (!conversation) {
      response.status(404).json({ error: 'conversation_not_found' })
      return
    }

    const result = await query(
      `INSERT INTO live_chat_messages (
         conversation_id,
         role,
         content,
         created_by_admin_id
       )
       VALUES ($1, 'manager', $2, $3)
       RETURNING
         id::text,
         role,
         content,
         metadata,
         created_by_admin_id AS "createdByAdminId",
         created_at AS "createdAt"`,
      [conversation.id, content, request.admin.id],
    )

    await query(
      `UPDATE live_chat_conversations
       SET
         status = 'human',
         ai_enabled = false,
         assigned_admin_id = $2,
         last_message_at = now(),
         updated_at = now()
       WHERE id = $1`,
      [conversation.id, request.admin.id],
    )

    response.status(201).json({ ok: true, message: result.rows[0] })
  }))

  router.post('/:id/close', requirePermission('chat:write'), asyncRoute(async (request, response) => {
    const result = await query(
      `UPDATE live_chat_conversations
       SET
         status = 'closed',
         ai_enabled = false,
         updated_at = now()
       WHERE id = $1
       RETURNING id, status, ai_enabled AS "aiEnabled"`,
      [request.params.id],
    )

    if (!result.rowCount) {
      response.status(404).json({ error: 'conversation_not_found' })
      return
    }

    response.json({ ok: true, conversation: result.rows[0] })
  }))

  router.post('/:id/reopen', requirePermission('chat:write'), asyncRoute(async (request, response) => {
    const result = await query(
      `UPDATE live_chat_conversations
       SET
         status = 'open',
         ai_enabled = true,
         assigned_admin_id = NULL,
         updated_at = now()
       WHERE id = $1
       RETURNING id, status, ai_enabled AS "aiEnabled"`,
      [request.params.id],
    )

    if (!result.rowCount) {
      response.status(404).json({ error: 'conversation_not_found' })
      return
    }

    response.json({ ok: true, conversation: result.rows[0] })
  }))

  return router
}
