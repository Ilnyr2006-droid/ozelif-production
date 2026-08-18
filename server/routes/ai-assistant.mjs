import { buildInformationFallback, classifyAssistantIntent, emptyRetrievalResult } from '../lib/ai-query-intent.mjs'
import { buildOzelifAssistantInstructions } from '../lib/ai-system-prompt.mjs'
import express from 'express'
import { findLiveProductCandidates } from '../lib/ai-product-retrieval.mjs'
import {
  assistantProductContext,
  cleanAssistantMessages,
  deterministicCatalogReply,
  enforceCriticalIntentFacts,
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

const WINDOW_MS = 10 * 60 * 1000
const MAX_REQUESTS_PER_WINDOW = 24
const requestsByAddress = new Map()

function asyncRoute(handler) {
  return (request, response, next) => {
    Promise.resolve(handler(request, response, next)).catch(next)
  }
}

function clientAddress(request) {
  return String(
    request.headers['x-forwarded-for']
      ?? request.socket?.remoteAddress
      ?? 'unknown',
  )
    .split(',')[0]
    .trim()
}

function rateLimit(request, response, next) {
  const now = Date.now()
  const address = clientAddress(request)
  const existing = requestsByAddress.get(address)

  if (!existing || now - existing.startedAt >= WINDOW_MS) {
    requestsByAddress.set(address, {
      startedAt: now,
      count: 1,
    })
    next()
    return
  }

  existing.count += 1

  if (existing.count > MAX_REQUESTS_PER_WINDOW) {
    response.status(429).json({
      error: 'Слишком много сообщений. Попробуйте ещё раз через несколько минут.',
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

async function createAssistantReply({
  messages,
  pathname,
  products,
  needsProducts = false,
  intentType = null,
  clarificationQuestion = null,
  allowProfileCapture = false,
  currentProfile = {},
  allowOrderDraftUpdate = false,
  currentOrderDraft = null,
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
      'Если покупатель сообщает количества сразу для нескольких товаров — передай несколько operations только когда каждое число явно связано с названием товара.',
      'Если при нескольких товарах покупатель пишет только числа вроде «80 и 20 футов» без названий — НЕ угадывай соответствие и НЕ присваивай количества; попроси подписать количество для каждого товара.',
      'При deliveryMethod=courier обязательно собери deliveryCity и deliveryAddress. Пока город и адрес не известны, не проси подтверждение заказа.',
      'Если покупатель пишет город/адрес доставки, сохрани их через update_chat_order_draft.',
      'confirm=true ставь только после явного «оформляй», «можешь», «подтверждаю», «да» на вопрос об оформлении или эквивалента.',
      'Никогда не утверждай, что заказ создан: update_chat_order_draft меняет только черновик. Факт создания сообщает только сервер.',
      'Не показывай PRODUCT_ID или VARIANT_ID покупателю.',
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
              'УТОЧНЯЮЩИЙ ВОПРОС:',
              clarificationQuestion
                ? (
                    clarificationQuestion
                    + ' Задай именно этот один вопрос в конце ответа '
                    + 'и не добавляй второй уточняющий вопрос.'
                  )
                : 'Не требуется.',
              '',
              'Ответь на последнее сообщение покупателя.',
            ].join('\n'),
          },
        ],
      },
    ]

    const firstPayload = {
      model,
      store: false,
      instructions,
      input,
      max_output_tokens: 520,
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

    let body = await requestOpenAiResponse({
      apiKey,
      controller,
      payload: firstPayload,
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

    if (functionOutputs.length) {
      body = await requestOpenAiResponse({
        apiKey,
        controller,
        payload: {
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
          max_output_tokens: 520,
        },
      })
    }

    const text = removeProductNavigationPromises(
      extractResponseText(body),
    )

    if (!text) {
      throw new Error('OpenAI returned empty output')
    }

    return {
      text,
      profileUpdate,
      orderDraftUpdate,
      model: body?.model ?? model,
      responseId: body?.id ?? null,
      usage: body?.usage ?? null,
    }
  } finally {
    clearTimeout(timeout)
  }
}

export function createAiAssistantRouter() {
  const router = express.Router()
  router.use(rateLimit)

  router.post('/', asyncRoute(async (request, response) => {
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

    if (!message) {
      response.status(400).json({
        error: 'Сообщение не должно быть пустым.',
      })
      return
    }

    const intent = classifyAssistantIntent(message)
    const retrieval = intent.needsProducts
      ? await findLiveProductCandidates(message, { limit: 3 })
      : emptyRetrievalResult()
    const products = retrieval.products
    const actions = productActions(products)

    try {
      const generated = await createAssistantReply({
        messages: messages.length
          ? messages
          : [{ role: 'user', content: message }],
        pathname,
        products,
        needsProducts: intent.needsProducts,
        intentType: intent.type,
        clarificationQuestion:
          retrieval.clarificationQuestion ?? null,
        allowProfileCapture,
        currentProfile,
        allowOrderDraftUpdate: allowProfileCapture,
        currentOrderDraft,
      })

      const reply = sanitizeSalesReply(
        sanitizeUnverifiedStockClaims(
          enforceCriticalIntentFacts(
            generated.text,
            intent.type,
          ),
          products,
        ),
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
          responseId: generated.responseId,
          usage: generated.usage,
          intent: intent.type,
          semanticMatches: retrieval.semantic.matches.length,
          lexicalMatches: retrieval.lexical.count,
          constraints: retrieval.constraints ?? null,
          clarificationQuestion:
            retrieval.clarificationQuestion ?? null,
        },
      })
    } catch (error) {
      console.error(
        '[ai-assistant]',
        error instanceof Error ? error.message : error,
      )

      const fallbackReply = sanitizeSalesReply(
        sanitizeUnverifiedStockClaims(
          enforceCriticalIntentFacts(
            intent.needsProducts
              ? deterministicCatalogReply(
                  products,
                  retrieval.clarificationQuestion ?? null,
                )
              : buildInformationFallback(intent),
            intent.type,
          ),
          products,
        ),
      )

      response.setHeader('Cache-Control', 'no-store')
      response.json({
        reply: fallbackReply,
        profileUpdate: null,
        orderDraftUpdate: null,
        actions,
        products: products.slice(0, 3),
        meta: {
          source: intent.needsProducts
            ? 'deterministic_live_catalog_fallback'
            : 'deterministic_information_fallback',
          intent: intent.type,
          semanticMatches: retrieval.semantic.matches.length,
          lexicalMatches: retrieval.lexical.count,
          constraints: retrieval.constraints ?? null,
          clarificationQuestion:
            retrieval.clarificationQuestion ?? null,
        },
      })
    }
  }))

  return router
}
