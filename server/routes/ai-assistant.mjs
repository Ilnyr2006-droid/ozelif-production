import { buildOzelifAssistantInstructions } from '../lib/ai-system-prompt.mjs'
import express from 'express'
import { findLiveProductCandidates } from '../lib/ai-product-retrieval.mjs'
import {
  assistantProductContext,
  cleanAssistantMessages,
  deterministicCatalogReply,
  extractResponseText,
  latestUserText,
  productActions,
  sanitizeUnverifiedStockClaims,
} from '../lib/ai-assistant-format.mjs'
import {
  sanitizeSalesReply,
} from '../lib/ai-sales-quality.mjs'
import {
  CUSTOMER_PROFILE_TOOL,
  extractCustomerProfileToolCalls,
} from '../lib/ai-customer-profile.mjs'
import {
  ORDER_DRAFT_TOOL,
  extractOrderDraftToolCalls,
  formatOrderDraftContext,
} from '../lib/ai-order-draft.mjs'
import {
  formatChatOrderHistoryContext,
} from '../lib/chat-order.mjs'
import {
  routeAssistantConversation,
} from '../lib/ai-request-routing.mjs'
import {
  mergeOpenAiUsage,
  responseIncompleteReason,
  retryOutputTokenLimit,
  shouldRetryIncompleteResponse,
} from '../lib/ai-response-runtime.mjs'
import { query } from '../lib/db.mjs'
import {
  publishedPromptIdentity,
  recordAiRuntimeEvent,
} from '../lib/ai-runtime-monitoring.mjs'
import {
  buildAiRateLimitPlan,
  enforceAiRateLimit,
  requestAiRateLimitIp,
} from '../lib/ai-rate-limit.mjs'

function asyncRoute(handler) {
  return (request, response, next) => {
    Promise.resolve(handler(request, response, next)).catch(next)
  }
}

async function rateLimit(
  request,
  response,
  next,
) {
  const ip =
    requestAiRateLimitIp(
      request,
    )

  const plan =
    buildAiRateLimitPlan({
      conversationId:
        request.body?.conversationId,
      ip,
      evalRequest:
        request.get(
          'X-Ozelif-Eval',
        ) === '1',
    })

  const result =
    await enforceAiRateLimit(
      query,
      plan,
    )

  if (!result.allowed) {
    response.setHeader(
      'Retry-After',
      String(
        result.retryAfterSeconds,
      ),
    )

    response.status(429).json({
      error:
        'Слишком много сообщений. Попробуйте ещё раз через несколько минут.',
      rateLimit: {
        blockedBy:
          result.blockedBy,
        retryAfterSeconds:
          result.retryAfterSeconds,
      },
    })

    return
  }

  next()
}

function conversationText(messages) {
  return messages
    .slice(-10)
    .map(message => (
      `${message.role === 'assistant' ? 'Консультант' : 'Покупатель'}: `
      + message.content
    ))
    .join('\n')
}

function removeProductNavigationPromises(value) {
  const text = String(value ?? '').trim()
  if (!text) return ''

  const forbiddenPatterns = [
    /\b(?:могу|можем|готов(?:а|ы)?|хотите|хотели\s+бы|давайте|позвольте)\b[^.!?]{0,220}\b(?:открыть|открою|перейти)\b/iu,
    /\b(?:показать|посмотреть)\b[^.!?]{0,180}\b(?:карточк\w*|страниц\w*|товар\w*)\b/iu,
    /\bоткройте\b[^.!?]{0,180}\b(?:кнопк\w*|товар\w*|карточк\w*)\b/iu,
  ]

  return text
    .split(/(?<=[.!?])\s+/u)
    .filter(sentence => (
      !forbiddenPatterns.some(pattern => pattern.test(sentence))
    ))
    .join(' ')
    .trim()
}

async function requestOpenAiResponse({
  apiKey,
  controller,
  payload,
}) {
  const response = await fetch(
    'https://api.openai.com/v1/responses',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      signal: controller.signal,
      body: JSON.stringify(payload),
    },
  )

  const body = await response.json().catch(() => null)

  if (!response.ok) {
    throw new Error(
      body?.error?.message
        ?? `OpenAI Responses API HTTP ${response.status}`,
    )
  }

  return body
}

async function requestOpenAiResponseWithRetry({
  apiKey,
  controller,
  payload,
  usageParts,
  runtime,
}) {
  let body = await requestOpenAiResponse({
    apiKey,
    controller,
    payload,
  })

  if (body?.usage) {
    usageParts.push(body.usage)
  }

  if (!shouldRetryIncompleteResponse(body)) {
    return body
  }

  const reason =
    responseIncompleteReason(body)

  runtime.incompleteRetries += 1

  console.warn(
    '[ai-assistant] retry incomplete OpenAI response:',
    reason,
  )

  const retryPayload = {
    ...payload,
    max_output_tokens:
      retryOutputTokenLimit(
        payload.max_output_tokens,
      ),
  }

  body = await requestOpenAiResponse({
    apiKey,
    controller,
    payload: retryPayload,
  })

  if (body?.usage) {
    usageParts.push(body.usage)
  }

  if (shouldRetryIncompleteResponse(body)) {
    throw new Error(
      `OpenAI response incomplete after retry: ${
        responseIncompleteReason(body)
      }`,
    )
  }

  return body
}

async function createAssistantReply({
  messages,
  latestMessage,
  pathname,
  products,
  needsProducts = false,
  intentType = null,
  allowProfileCapture = false,
  currentProfile = {},
  allowOrderDraftUpdate = false,
  currentOrderDraft = null,
  orderHistory = [],
}) {
  const apiKey = String(
    process.env.OPENAI_API_KEY ?? '',
  ).trim()

  if (!apiKey) {
    throw new Error('OPENAI_API_KEY is not configured')
  }

  const model = String(
    process.env.OPENAI_ASSISTANT_MODEL
      ?? process.env.OPENAI_MODEL
      ?? 'gpt-5-mini',
  ).trim()

  const controller = new AbortController()
  const timeout = setTimeout(
    () => controller.abort(),
    35_000,
  )

  try {
    const instructions = [
      await buildOzelifAssistantInstructions({
        pathname,
        intentType,
      }),
      '',
      'ПРАВИЛО РЕКОМЕНДАЦИЙ: если товары найдены, рекомендуй '
        + 'не более 3 позиций. Для каждой назови товар и одним коротким '
        + 'фактом объясни, почему он подходит, используя только '
        + 'ПРОВЕРЕННЫЕ ТОВАРЫ. Не перечисляй технические поля без '
        + 'пользы для покупателя.',
      '',
      'КРИТИЧЕСКОЕ ПРАВИЛО ИНТЕРФЕЙСА: никогда не обещай '
        + 'открыть, показать или перейти в карточку товара. '
        + 'Не спрашивай разрешения открыть карточку. Если товары '
        + 'найдены, просто рекомендуй их — интерфейс автоматически '
        + 'покажет кнопки под ответом.',
      '',
      'КОНТАКТЫ ПОКУПАТЕЛЯ:',
      `Имя уже сохранено: ${currentProfile.hasName ? 'да' : 'нет'}.`,
      `Телефон уже сохранён: ${currentProfile.hasPhone ? 'да' : 'нет'}.`,
      'Если покупатель явно сообщил своё имя и/или свой телефон, '
        + 'вызови capture_customer_profile.',
      'LIVE-CHAT CAPABILITY: если capture_customer_profile успешно принял телефон, '
        + 'не говори, что передать запрос менеджеру из этого чата невозможно. '
        + 'В рабочем live-chat backend сохраняет контакт и помечает этот диалог '
        + 'для менеджера. Можно сказать, что контакт принят и менеджер увидит '
        + 'запрос в этом чате; не обещай время ответа.',
      'ТОЧНОСТЬ НАЗВАНИЙ: названия товаров копируй дословно из блока '
        + 'ПРОВЕРЕННЫЕ ТОВАРЫ, без смешивания кириллицы и латиницы.',
      'Не вызывай инструмент для размера одежды, цены, количества, '
        + 'артикула, номера заказа, названия товара или контакта '
        + 'другого человека.',
      'Не угадывай отсутствующие данные.',
      'Если покупатель проигнорировал вопрос о контактах, не повторяй '
        + 'его и продолжай консультацию.',
      'Не повторяй полный телефон в своём текстовом ответе.',
      '',
      'ЗАКАЗ ЧЕРЕЗ ЧАТ:',
      'Если покупатель хочет заказать, добавить/убрать товар, изменить количество или оформить заказ — используй update_chat_order_draft.',
      'В одном заказе может быть несколько разных товаров. Для каждого товара количество хранится отдельно.',
      'Если товар назван, но количество ещё не сказано — добавь его с quantity=null и спроси количество.',
      'СЕМАНТИЧЕСКОЕ СОПОСТАВЛЕНИЕ ПОЗИЦИЙ: именно ты понимаешь человеческий язык. Пользователь может сокращать название, писать его кириллицей, с опечаткой, разговорно или ссылаться как «первый/второй». Сопоставляй это с ТЕКУЩИМ ЧЕРНОВИКОМ и возвращай точный PRODUCT_ID.',
      'Для уже существующей позиции ставь target=draft. Для нового товара ставь target=catalog и используй только PRODUCT_ID из ПРОВЕРЕННЫХ ТОВАРОВ.',
      'Любая операция с quantity должна иметь quantityResolution=resolved и quantityEvidence — короткую ДОСЛОВНУЮ цитату из ПОСЛЕДНЕГО сообщения покупателя, где есть понятная ссылка на эту позицию и соответствующее число. Не перефразируй evidence.',
      'Если при нескольких позициях пользователь дал числа, но непонятно, какое число к какой позиции относится, ставь quantityResolution=ambiguous, НЕ назначай quantity и задай один короткий уточняющий вопрос.',
      'Когда пользователь сообщает количества для текущего заказа, всегда вызывай update_chat_order_draft — resolved или ambiguous. Не оставляй решение только в обычном тексте.',
      'Backend проверит, что PRODUCT_ID действительно разрешён, quantity положительный, а quantityEvidence дословно присутствует в сообщении. Не пытайся обходить эту проверку.',
      'Когда все данные собраны, покажи заказ для проверки. Не заставляй покупателя переписывать состав; если всё верно, он может ответить «всё верно».',
      'При deliveryMethod=courier обязательно собери deliveryCity и deliveryAddress. Пока город и адрес не известны, не проси подтверждение заказа.',
      'Если покупатель пишет город/адрес доставки, сохрани их через update_chat_order_draft.',
      'confirm=true ставь только когда покупатель явно подтвердил уже показанный итог заказа: например «всё верно», «верно», «подтверждаю», «оформляй» или однозначный эквивалент.',
      'Никогда не утверждай, что заказ создан: update_chat_order_draft меняет только черновик. Факт создания сообщает только сервер.',
      'Не показывай PRODUCT_ID или VARIANT_ID покупателю.',
      'ИСТОРИЯ ЗАКАЗОВ доступна только для справки и уже сохранена в PostgreSQL/CRM. Не изменяй её и не называй заказ созданным, если его нет в этой истории.',
      'Если покупатель спрашивает о прошлых заказах, отвечай только по ИСТОРИИ ЗАКАЗОВ ЭТОГО ЧАТА. Не подменяй её текущим черновиком.',
    ].join('\n')

    const input = [
      {
        role: 'user',
        content: [
          {
            type: 'input_text',
            text: [
              'ИСТОРИЯ ДИАЛОГА:',
              conversationText(messages),
              '',
              'ПОСЛЕДНЕЕ СООБЩЕНИЕ ПОКУПАТЕЛЯ — ДОСЛОВНО:',
              String(
                latestMessage
                ?? latestUserText(
                  messages,
                  '',
                )
                ?? '',
              ),
              '',
              'ПРАВИЛО КОНТЕКСТА:',
              'Последнее сообщение покупателя и история диалога — источник '
                + 'его намерения и уже сообщённых условий. Не спрашивай '
                + 'повторно то, что покупатель уже написал. Если информации '
                + 'действительно недостаточно для полезного ответа, сам задай '
                + 'один наиболее полезный уточняющий вопрос.',
              '',
              needsProducts
                ? 'ПРОВЕРЕННЫЕ ТОВАРЫ:'
                : 'КОНТЕКСТ ТОВАРОВ:',
              assistantProductContext(
                products,
                needsProducts,
              ),
              '',
              'ТЕКУЩИЙ ЧЕРНОВИК ЗАКАЗА:',
              formatOrderDraftContext(
                currentOrderDraft,
              ),
              '',
              'ИСТОРИЯ ЗАКАЗОВ ЭТОГО ЧАТА:',
              formatChatOrderHistoryContext(
                orderHistory,
              ),
              '',
              'Ответь на последнее сообщение покупателя, учитывая весь '
                + 'предыдущий диалог и только проверенные данные backend.',
            ].join('\n'),
          },
        ],
      },
    ]

    const usageParts = []
    const runtime = {
      incompleteRetries: 0,
      emptyRetries: 0,
    }

    const firstPayload = {
      model,
      store: false,
      instructions,
      input,
      reasoning: {
        effort: 'low',
      },
      text: {
        verbosity: 'low',
      },
      max_output_tokens:
        allowOrderDraftUpdate
          ? 760
          : 620,
      ...(
        allowProfileCapture
        || allowOrderDraftUpdate
          ? {
              tools: [
                ...(allowProfileCapture
                  ? [CUSTOMER_PROFILE_TOOL]
                  : []),
                ...(allowOrderDraftUpdate
                  ? [ORDER_DRAFT_TOOL]
                  : []),
              ],
              tool_choice: 'auto',
              parallel_tool_calls: false,
            }
          : {}
      ),
    }

    let body = await requestOpenAiResponseWithRetry({
      apiKey,
      controller,
      payload: firstPayload,
      usageParts,
      runtime,
    })

    let profileUpdate = null
    let orderDraftUpdate = null

    const profileExtracted = allowProfileCapture
      ? extractCustomerProfileToolCalls(body)
      : {
          update: null,
          functionOutputs: [],
        }

    const orderExtracted = allowOrderDraftUpdate
      ? extractOrderDraftToolCalls(body)
      : {
          update: null,
          functionOutputs: [],
        }

    profileUpdate = profileExtracted.update
    orderDraftUpdate = orderExtracted.update

    const functionOutputs = [
      ...profileExtracted.functionOutputs,
      ...orderExtracted.functionOutputs,
    ]

    let finalPayload = firstPayload

    if (functionOutputs.length) {
      finalPayload = {
        model,
        store: false,
        instructions,
        input: [
          ...input,
          ...(Array.isArray(body?.output)
            ? body.output
            : []),
          ...functionOutputs,
        ],
        tools: [
          ...(allowProfileCapture
            ? [CUSTOMER_PROFILE_TOOL]
            : []),
          ...(allowOrderDraftUpdate
            ? [ORDER_DRAFT_TOOL]
            : []),
        ],
        tool_choice: 'none',
        parallel_tool_calls: false,
        reasoning: {
          effort: 'low',
        },
        text: {
          verbosity: 'low',
        },
        max_output_tokens: 760,
      }

      body = await requestOpenAiResponseWithRetry({
        apiKey,
        controller,
        payload: finalPayload,
        usageParts,
        runtime,
      })
    }

    let text = removeProductNavigationPromises(
      extractResponseText(body),
    )

    if (!text) {
      runtime.emptyRetries += 1

      console.warn(
        '[ai-assistant] retry completed OpenAI response with empty text',
      )

      const emptyRetryPayload = {
        ...finalPayload,
        tool_choice:
          functionOutputs.length
            ? 'none'
            : (
                Array.isArray(finalPayload.tools)
                && finalPayload.tools.length
                  ? 'none'
                  : finalPayload.tool_choice
              ),
        max_output_tokens:
          retryOutputTokenLimit(
            finalPayload.max_output_tokens,
            960,
          ),
      }

      body = await requestOpenAiResponseWithRetry({
        apiKey,
        controller,
        payload: emptyRetryPayload,
        usageParts,
        runtime,
      })

      text = removeProductNavigationPromises(
        extractResponseText(body),
      )
    }

    if (!text) {
      throw new Error(
        `OpenAI returned empty output; status=${
          body?.status ?? 'unknown'
        }; incomplete=${
          responseIncompleteReason(body) ?? 'none'
        }`,
      )
    }

    return {
      text,
      profileUpdate,
      orderDraftUpdate,
      model: body?.model ?? model,
      responseId: body?.id ?? null,
      usage: mergeOpenAiUsage(usageParts),
      runtime,
    }
  } finally {
    clearTimeout(timeout)
  }
}

export function createAiAssistantRouter() {
  const router = express.Router()
  router.use(
    asyncRoute(rateLimit),
  )

  router.post('/', asyncRoute(async (request, response) => {
    const startedAt = performance.now()
    const messages = cleanAssistantMessages(request.body?.messages)
    const message = latestUserText(
      messages,
      request.body?.message,
    ).slice(0, 1400)
    const pathname = String(
      request.body?.path
        ?? request.body?.pathname
        ?? '/',
    ).slice(0, 300)

    const allowProfileCapture = (
      request.get('X-Ozelif-Live-Chat') === '1'
    )

    const conversationId = String(
      request.body?.conversationId ?? '',
    ).trim() || null

    const channel = (
      request.get('X-Ozelif-Eval') === '1'
        ? 'eval'
        : String(
            request.body?.channel
            ?? (
              request.body?.path === 'telegram'
                ? 'telegram'
                : 'web'
            ),
          )
    ).slice(0, 40)

    const currentProfile = {
      hasName: Boolean(
        request.body?.profile?.visitorName,
      ),
      hasPhone: Boolean(
        request.body?.profile?.visitorPhone,
      ),
    }

    const currentOrderDraft = (
      request.body?.orderDraft
      && typeof request.body.orderDraft === 'object'
      && !Array.isArray(request.body.orderDraft)
    )
      ? request.body.orderDraft
      : null

    const orderHistory = Array.isArray(
      request.body?.orderHistory,
    )
      ? request.body.orderHistory.slice(0, 10)
      : []

    if (!message) {
      response.status(400).json({
        error: 'Сообщение не должно быть пустым.',
      })
      return
    }

    /*
     * This lightweight route controls only prompt context and whether catalog
     * retrieval is needed. The model still decides the wording and sales
     * response. Non-product turns must not pay the catalog-search/token cost.
     */
    const requestRoute =
      routeAssistantConversation(
        messages,
        message,
      )

    const retrievalQuery =
      requestRoute.retrievalQuery
      || message

    const promptIdentity =
      await publishedPromptIdentity(query)

    const retrieval =
      requestRoute.needsProducts
        ? await findLiveProductCandidates(
            retrievalQuery,
            { limit: 3 },
          )
        : {
            products: [],
            semantic: {
              available: false,
              matches: [],
            },
            lexical: {
              count: 0,
            },
            constraints: null,
            clarificationQuestion: null,
          }

    const products = retrieval.products
    const actions = requestRoute.needsProducts
      ? productActions(products)
      : []

    try {
      const generated = await createAssistantReply({
        messages: messages.length
          ? messages
          : [{ role: 'user', content: message }],
        latestMessage: message,
        pathname,
        products,
        needsProducts:
          requestRoute.needsProducts,
        intentType:
          requestRoute.intent,
        allowProfileCapture,
        currentProfile,
        allowOrderDraftUpdate: allowProfileCapture,
        currentOrderDraft,
        orderHistory,
      })

      const reply = sanitizeSalesReply(
        sanitizeUnverifiedStockClaims(
          generated.text,
          products,
        ),
      )

      const latencyMs =
        Math.round(
          performance.now() - startedAt,
        )

      await recordAiRuntimeEvent(
        query,
        {
          conversationId,
          channel,
          model:
            generated.model,
          prompt:
            promptIdentity,
          responseId:
            generated.responseId,
          intent:
            requestRoute.intent,
          catalogSearch:
            requestRoute.needsProducts,
          latencyMs,
          usage:
            generated.usage,
          fallback:
            false,
          emptyRetryCount:
            generated.runtime
              ?.emptyRetries ?? 0,
          incompleteRetryCount:
            generated.runtime
              ?.incompleteRetries ?? 0,
          recommendationCount:
            products.slice(0, 3).length,
          metadata: {
            source:
              retrieval.semantic.available
                ? 'product_index+postgresql'
                : 'postgresql_fallback',
            contextualCatalogSearch:
              Boolean(
                requestRoute
                  .contextualCatalogSearch,
              ),
          },
        },
      )

      response.setHeader('Cache-Control', 'no-store')
      response.json({
        reply,
        profileUpdate: generated.profileUpdate ?? null,
        orderDraftUpdate:
          generated.orderDraftUpdate ?? null,
        actions,
        products: products.slice(0, 3),
        meta: {
          source: retrieval.semantic.available
            ? 'product_index+postgresql'
            : 'postgresql_fallback',
          model: generated.model,
          promptVersion:
            promptIdentity.version,
          responseId: generated.responseId,
          usage: generated.usage,
          latencyMs,
          emptyRetryCount:
            generated.runtime
              ?.emptyRetries ?? 0,
          incompleteRetryCount:
            generated.runtime
              ?.incompleteRetries ?? 0,
          intent:
            requestRoute.intent,
          catalogSearch:
            requestRoute.needsProducts,
          contextualCatalogSearch:
            Boolean(
              requestRoute
                .contextualCatalogSearch,
            ),
          semanticMatches: retrieval.semantic.matches.length,
          lexicalMatches: retrieval.lexical.count,
          constraints: retrieval.constraints ?? null,
          clarificationQuestion: null,
        },
      })
    } catch (error) {
      console.error(
        '[ai-assistant]',
        error instanceof Error ? error.message : error,
      )

      const latencyMs =
        Math.round(
          performance.now() - startedAt,
        )

      await recordAiRuntimeEvent(
        query,
        {
          conversationId,
          channel,
          model:
            process.env.OPENAI_ASSISTANT_MODEL
            ?? process.env.OPENAI_MODEL
            ?? null,
          prompt:
            promptIdentity,
          intent:
            requestRoute.intent,
          catalogSearch:
            requestRoute.needsProducts,
          latencyMs,
          usage:
            null,
          fallback:
            true,
          recommendationCount:
            products.slice(0, 3).length,
          errorText:
            error instanceof Error
              ? error.message
              : String(error),
          metadata: {
            source:
              'deterministic_live_catalog_fallback',
          },
        },
      )

      const fallbackReply = requestRoute.needsProducts
        ? sanitizeSalesReply(
            sanitizeUnverifiedStockClaims(
              deterministicCatalogReply(
                products,
              ),
              products,
            ),
          )
        : 'Сейчас не удалось получить ответ консультанта. Попробуйте отправить сообщение ещё раз.'

      response.setHeader('Cache-Control', 'no-store')
      response.json({
        reply: fallbackReply,
        profileUpdate: null,
        orderDraftUpdate: null,
        actions,
        products: products.slice(0, 3),
        meta: {
          source: 'deterministic_live_catalog_fallback',
          model:
            process.env.OPENAI_ASSISTANT_MODEL
            ?? process.env.OPENAI_MODEL
            ?? null,
          promptVersion:
            promptIdentity.version,
          latencyMs,
          fallback: true,
          intent:
            requestRoute.intent,
          catalogSearch:
            requestRoute.needsProducts,
          contextualCatalogSearch:
            Boolean(
              requestRoute
                .contextualCatalogSearch,
            ),
          semanticMatches: retrieval.semantic.matches.length,
          lexicalMatches: retrieval.lexical.count,
          constraints: retrieval.constraints ?? null,
          clarificationQuestion: null,
        },
      })
    }
  }))

  return router
}
