import express from 'express'
import { query } from '../lib/db.mjs'
import {
  assistantHistory,
  createPublicChatToken,
  hashPublicChatToken,
  normalizeChatContent,
} from '../lib/live-chat-utils.mjs'
import { normalizeClientMessageId, readPublicToken } from '../lib/live-chat-auth.mjs'
import { normalizeCustomerProfileUpdate } from '../lib/ai-customer-profile.mjs'
import { syncCustomerFromLiveChatContact } from '../lib/customer-contact.mjs'
import { classifyAssistantIntent } from '../lib/ai-query-intent.mjs'
import { buildConversionDecision } from '../lib/ai-conversion.mjs'

function asyncRoute(handler) {
  return (request, response, next) => {
    Promise.resolve(handler(request, response, next)).catch(next)
  }
}

function safePath(value) {
  return String(value ?? '/').slice(0, 500)
}

function clientIp(request) {
  const forwarded = String(request.headers['x-forwarded-for'] ?? '')
    .split(',')[0]
    .trim()

  return forwarded || request.socket.remoteAddress || null
}

async function findConversation(id, token) {
  if (!id || !token) return null

  const result = await query(
    `SELECT
       id,
       visitor_id AS "visitorId",
       visitor_name AS "visitorName",
       visitor_phone AS "visitorPhone",
       customer_id AS "customerId",
       page_path AS "pagePath",
       status,
       ai_enabled AS "aiEnabled",
       manager_requested_at AS "managerRequestedAt",
       manager_request_reason AS "managerRequestReason",
       lead_intent AS "leadIntent",
       lead_score AS "leadScore",
       contact_offer_shown_at AS "contactOfferShownAt",
       contact_captured_at AS "contactCapturedAt",
       last_message_at AS "lastMessageAt",
       created_at AS "createdAt"
     FROM live_chat_conversations
     WHERE id = $1
       AND public_token_hash = $2
     LIMIT 1`,
    [id, hashPublicChatToken(token)],
  )

  return result.rows[0] ?? null
}

async function conversationMessages(conversationId, afterId = 0) {
  const result = await query(
    `SELECT
       id::text,
       role,
       content,
       metadata,
       created_at AS "createdAt"
     FROM live_chat_messages
     WHERE conversation_id = $1
       AND id > $2
     ORDER BY id ASC
     LIMIT 250`,
    [conversationId, Number(afterId) || 0],
  )

  return result.rows
}

async function recordLeadSignal(
  conversationId,
  {
    intentType,
    score,
    contactOfferShown = false,
    productInterest = false,
  },
) {
  await query(
    `UPDATE live_chat_conversations
     SET
       lead_intent = COALESCE($2, lead_intent),
       lead_score = GREATEST(lead_score, $3),
       contact_offer_shown_at = CASE
         WHEN $4::boolean
           THEN COALESCE(contact_offer_shown_at, now())
         ELSE contact_offer_shown_at
       END,
       product_interest_at = CASE
         WHEN $5::boolean
           THEN COALESCE(product_interest_at, now())
         ELSE product_interest_at
       END,
       updated_at = now()
     WHERE id = $1`,
    [
      conversationId,
      intentType || null,
      Math.max(0, Math.min(100, Number(score) || 0)),
      Boolean(contactOfferShown),
      Boolean(productInterest),
    ],
  )
}

async function requestManager(
  conversationId,
  {
    intentType,
    score,
    reason,
    disableAi = false,
  },
) {
  await query(
    `UPDATE live_chat_conversations
     SET
       manager_requested_at = COALESCE(manager_requested_at, now()),
       manager_request_reason = COALESCE($2, manager_request_reason),
       lead_intent = COALESCE($3, lead_intent),
       lead_score = GREATEST(lead_score, $4),
       status = CASE
         WHEN $5::boolean THEN 'human'
         ELSE status
       END,
       ai_enabled = CASE
         WHEN $5::boolean THEN false
         ELSE ai_enabled
       END,
       updated_at = now()
     WHERE id = $1`,
    [
      conversationId,
      reason || 'high_intent',
      intentType || null,
      Math.max(0, Math.min(100, Number(score) || 0)),
      Boolean(disableAi),
    ],
  )
}

async function markContactCaptured(conversationId) {
  await query(
    `UPDATE live_chat_conversations
     SET
       contact_captured_at = COALESCE(contact_captured_at, now()),
       manager_requested_at = COALESCE(manager_requested_at, now()),
       manager_request_reason = COALESCE(
         manager_request_reason,
         'contact_captured'
       ),
       lead_score = GREATEST(lead_score, 80),
       updated_at = now()
     WHERE id = $1`,
    [conversationId],
  )
}

async function createManagerHandoffMessage(conversationId) {
  const saved = await query(
    `INSERT INTO live_chat_messages (
       conversation_id,
       role,
       content,
       metadata
     )
     VALUES (
       $1,
       'system',
       $2,
       $3::jsonb
     )
     RETURNING
       id::text,
       role,
       content,
       metadata,
       created_at AS "createdAt"`,
    [
      conversationId,
      'Запрос передан менеджеру. Он увидит переписку и подключится к этому чату. Вы можете продолжать писать здесь.',
      JSON.stringify({
        type: 'manager_handoff',
      }),
    ],
  )

  return saved.rows[0]
}

async function callAssistant(
  assistantRequest,
  messages,
  pathname,
  profile,
  requestIp,
) {
  const port = Number(process.env.PORT ?? 8093)

  const payload = (
    assistantRequest
    && typeof assistantRequest === 'object'
    && !Array.isArray(assistantRequest)
  )
    ? { ...assistantRequest }
    : { messages, path: pathname }

  if (
    !('path' in payload)
    && !('pathname' in payload)
    && !('currentPage' in payload)
  ) {
    payload.path = pathname
  }

  payload.profile = {
    visitorName: profile?.visitorName ?? null,
    visitorPhone: profile?.visitorPhone ?? null,
  }

  const response = await fetch(
    `http://127.0.0.1:${port}/api/assistant`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Ozelif-Live-Chat': '1',
        ...(requestIp ? { 'X-Forwarded-For': requestIp } : {}),
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(55_000),
    },
  )

  const text = await response.text()

  if (!response.ok) {
    throw new Error(
      `Assistant HTTP ${response.status}: ${text.slice(0, 500)}`,
    )
  }

  const body = JSON.parse(text)

  const reply = (
    body.reply
    ?? body.answer
    ?? body.text
    ?? body.content
    ?? body.response
    ?? body.data?.reply
    ?? body.data?.answer
    ?? body.data?.text
    ?? body.data?.content
  )

  if (typeof reply !== 'string' || !reply.trim()) {
    throw new Error('Assistant returned an empty reply')
  }

  return {
    ...body,
    reply: reply.trim(),
  }
}

export function createLiveChatRouter() {
  const router = express.Router()

  router.use((_request, response, next) => {
    response.setHeader('Cache-Control', 'no-store')
    next()
  })

  router.post('/session', asyncRoute(async (request, response) => {
    const current = await findConversation(
      request.body?.conversationId,
      readPublicToken(request),
    )

    if (current) {
      response.json({
        ok: true,
        conversation: current,
        conversationId: current.id,
        token: readPublicToken(request),
      })
      return
    }

    const token = createPublicChatToken()
    const result = await query(
      `INSERT INTO live_chat_conversations (
         public_token_hash,
         visitor_id,
         page_path,
         user_agent,
         ip_address
       )
       VALUES ($1, $2, $3, $4, $5)
       RETURNING
         id,
         visitor_id AS "visitorId",
         page_path AS "pagePath",
         visitor_name AS "visitorName",
         visitor_phone AS "visitorPhone",
         customer_id AS "customerId",
         status,
         ai_enabled AS "aiEnabled",
         manager_requested_at AS "managerRequestedAt",
         lead_intent AS "leadIntent",
         lead_score AS "leadScore",
         created_at AS "createdAt"`,
      [
        hashPublicChatToken(token),
        String(request.body?.visitorId ?? '').slice(0, 240) || null,
        safePath(request.body?.path),
        String(request.headers['user-agent'] ?? '').slice(0, 1_000) || null,
        clientIp(request),
      ],
    )

    response.status(201).json({
      ok: true,
      conversation: result.rows[0],
      conversationId: result.rows[0].id,
      token,
    })
  }))

  router.get(
    '/conversations/:id/messages',
    asyncRoute(async (request, response) => {
      const conversation = await findConversation(
        request.params.id,
        readPublicToken(request),
      )

      if (!conversation) {
        response.status(404).json({ error: 'conversation_not_found' })
        return
      }

      const messages = await conversationMessages(
        conversation.id,
        request.query.after,
      )

      response.json({
        ok: true,
        conversation,
        messages,
      })
    }),
  )

  router.post(
    '/conversations/:id/profile',
    asyncRoute(async (request, response) => {
      const conversation = await findConversation(
        request.params.id,
        readPublicToken(request),
      )

      if (!conversation) {
        response.status(404).json({ error: 'conversation_not_found' })
        return
      }

      const profile = normalizeCustomerProfileUpdate(request.body)
      if (profile?.phone) {
        await syncCustomerFromLiveChatContact({
          conversationId: conversation.id,
          name: profile.name,
          phone: String(request.body?.phone ?? profile.phone),
        })

        await markContactCaptured(conversation.id)

        response.json({
          ok: true,
          profile: await findConversation(
            conversation.id,
            readPublicToken(request),
          ),
          managerRequested: true,
        })
        return
      }

      const result = await query(
        `UPDATE live_chat_conversations
         SET visitor_name = COALESCE($2, visitor_name), updated_at = now()
         WHERE id = $1
         RETURNING visitor_name AS "visitorName", visitor_phone AS "visitorPhone", customer_id AS "customerId"`,
        [conversation.id, profile?.name ?? null],
      )
      response.json({ ok: true, profile: result.rows[0] })
    }),
  )

  router.post(
    '/conversations/:id/messages',
    asyncRoute(async (request, response) => {
      const conversation = await findConversation(
        request.params.id,
        readPublicToken(request),
      )

      if (!conversation) {
        response.status(404).json({ error: 'conversation_not_found' })
        return
      }

      const content = normalizeChatContent(request.body?.content)

      if (!content) {
        response.status(400).json({ error: 'message_required' })
        return
      }

      const requestMessageId = normalizeClientMessageId(request.body?.clientMessageId)
      const userMessage = await query(
        `INSERT INTO live_chat_messages (
           conversation_id,
           role,
           content,
           metadata,
           client_message_id
         )
         VALUES ($1, 'user', $2, $3::jsonb, $4)
         ON CONFLICT (conversation_id, client_message_id) WHERE client_message_id IS NOT NULL DO NOTHING
         RETURNING
           id::text,
           role,
           content,
           metadata,
           created_at AS "createdAt"`,
        [
          conversation.id,
          content,
          JSON.stringify({
            path: safePath(request.body?.path),
          }),
          requestMessageId,
        ],
      )

      if (!userMessage.rows[0] && requestMessageId) {
        const [existing, reply] = await Promise.all([
          query(`SELECT id::text, role, content, metadata, created_at AS "createdAt" FROM live_chat_messages WHERE conversation_id = $1 AND client_message_id = $2 LIMIT 1`, [conversation.id, requestMessageId]),
          query(`SELECT id::text, role, content, metadata, created_at AS "createdAt" FROM live_chat_messages WHERE conversation_id = $1 AND role = 'assistant' AND metadata->>'replyToClientMessageId' = $2 ORDER BY id DESC LIMIT 1`, [conversation.id, requestMessageId]),
        ])
        response.json({ ok: true, duplicate: true, conversation, userMessage: existing.rows[0], assistant: reply.rows[0] ? { message: reply.rows[0] } : null, assistantError: null })
        return
      }

      await query(
        `UPDATE live_chat_conversations
         SET
           page_path = $2,
           chat_started_at = COALESCE(
             chat_started_at,
             now()
           ),
           last_message_at = now(),
           updated_at = now(),
           status = CASE
             WHEN status = 'closed' THEN 'open'
             ELSE status
           END
         WHERE id = $1`,
        [conversation.id, safePath(request.body?.path)],
      )

      let freshConversation = await findConversation(
        conversation.id,
        readPublicToken(request),
      )

      const localIntent = classifyAssistantIntent(content)
      const initialConversion = buildConversionDecision({
        message: content,
        intentType: localIntent.type,
        hasPhone: Boolean(freshConversation?.visitorPhone),
        offerAlreadyShown: Boolean(
          freshConversation?.contactOfferShownAt,
        ),
      })

      await recordLeadSignal(
        conversation.id,
        {
          intentType: localIntent.type,
          score: initialConversion.score,
          contactOfferShown:
            initialConversion.shouldOfferContact,
          productInterest: [
            'product',
            'wholesale',
            'production',
          ].includes(localIntent.type),
        },
      )

      if (initialConversion.explicitManagerRequest) {
        await requestManager(
          conversation.id,
          {
            intentType: localIntent.type,
            score: initialConversion.score,
            reason: 'explicit_customer_request',
            disableAi: true,
          },
        )

        const systemMessage = await createManagerHandoffMessage(
          conversation.id,
        )

        freshConversation = await findConversation(
          conversation.id,
          readPublicToken(request),
        )

        response.status(201).json({
          ok: true,
          conversation: freshConversation,
          userMessage: userMessage.rows[0],
          assistant: {
            message: systemMessage,
          },
          assistantError: null,
          conversion: {
            type: 'handoff',
            status: 'requested',
            message:
              'Менеджер увидит ваш запрос в этом диалоге.',
          },
        })
        return
      }

      let assistant = null
      let assistantError = null
      let responseConversation = freshConversation
      let conversion = initialConversion.offer

      if (freshConversation?.aiEnabled) {
        const historyResult = await query(
          `SELECT role, content
           FROM live_chat_messages
           WHERE conversation_id = $1
           ORDER BY id DESC
           LIMIT 24`,
          [conversation.id],
        )

        const history = assistantHistory(
          [...historyResult.rows].reverse(),
        )

        try {
          const generated = await callAssistant(
            request.body?.assistantRequest,
            history,
            safePath(request.body?.path),
            freshConversation,
            clientIp(request),
          )

          const profileUpdate = normalizeCustomerProfileUpdate(
            generated.profileUpdate,
          )

          if (profileUpdate) {
            if (profileUpdate.phone) {
              const synced = await syncCustomerFromLiveChatContact({
                conversationId: conversation.id,
                name: profileUpdate.name,
                phone: profileUpdate.phone,
              })
              responseConversation = {
                ...responseConversation,
                ...synced?.conversation,
              }

              await markContactCaptured(
                conversation.id,
              )

              conversion = {
                type: 'handoff',
                status: 'requested',
                message:
                  'Контакт сохранён. Менеджер увидит запрос, а AI пока продолжит помогать в чате.',
              }
            } else {
              const updatedProfile = await query(
                `UPDATE live_chat_conversations
                 SET visitor_name = COALESCE($2, visitor_name), updated_at = now()
                 WHERE id = $1
                 RETURNING visitor_name AS "visitorName", visitor_phone AS "visitorPhone", customer_id AS "customerId"`,
                [conversation.id, profileUpdate.name ?? null],
              )
              responseConversation = { ...responseConversation, ...updatedProfile.rows[0] }
            }
          }

          const afterProfileDecision = buildConversionDecision({
            message: content,
            intentType: localIntent.type,
            hasPhone: Boolean(
              responseConversation?.visitorPhone,
            ),
            offerAlreadyShown: true,
          })

          if (
            !profileUpdate?.phone
            && afterProfileDecision.shouldRequestManager
          ) {
            await requestManager(
              conversation.id,
              {
                intentType: localIntent.type,
                score: afterProfileDecision.score,
                reason: 'high_intent_with_contact',
                disableAi: false,
              },
            )

            conversion = {
              type: 'handoff',
              status: 'requested',
              message:
                'Менеджер увидит запрос. AI пока продолжит помогать в чате.',
            }
          }

          responseConversation = await findConversation(
            conversation.id,
            readPublicToken(request),
          )

          const saved = await query(
            `INSERT INTO live_chat_messages (
               conversation_id,
               role,
               content,
               metadata
             )
             VALUES ($1, 'assistant', $2, $3::jsonb)
             RETURNING
               id::text,
               role,
               content,
               metadata,
               created_at AS "createdAt"`,
            [
              conversation.id,
              generated.reply.trim(),
              JSON.stringify({
                products: generated.products ?? [],
                actions: generated.actions ?? [],
                meta: generated.meta ?? {},
                conversion,
                replyToClientMessageId: requestMessageId,
              }),
            ],
          )

          const assistantPayload = {
            ...generated,
          }

          delete assistantPayload.profileUpdate

          assistant = {
            ...assistantPayload,
            message: saved.rows[0],
          }

          await query(
            `UPDATE live_chat_conversations
             SET
               last_message_at = now(),
               updated_at = now()
             WHERE id = $1`,
            [conversation.id],
          )
        } catch (error) {
          assistantError = error instanceof Error
            ? error.message
            : String(error)

          console.error('[live-chat assistant]', assistantError)
        }
      }

      response.status(201).json({
        ok: true,
        conversation: responseConversation,
        userMessage: userMessage.rows[0],
        assistant,
        assistantError,
        conversion,
      })
    }),
  )

  return router
}
