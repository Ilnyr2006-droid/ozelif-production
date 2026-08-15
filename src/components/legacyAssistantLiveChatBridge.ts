import { createClientId } from '../utils/clientId'

export const OZELIF_LEGACY_CHAT_BRIDGE_V2 =
  'OZELIF_LEGACY_CHAT_BRIDGE_V2'

const CHAT_ID_KEY = 'ozelif_live_chat_id'
const CHAT_TOKEN_KEY = 'ozelif_live_chat_token'
const VISITOR_KEY = 'ozelif_live_chat_visitor'
const LAST_MESSAGE_KEY = 'ozelif_live_chat_last_message_id'
const MANAGER_EVENT = 'ozelif:live-chat-manager-message'

const ASSISTANT_ENDPOINTS = new Set<string>(
  [
  "/api/assistant",
  "/api/ai-assistant",
  "/api/chat",
  "/api/ai/chat"
],
)

type JsonRecord = Record<string, unknown>

type LiveChatSession = {
  conversationId: string
  token: string
}

type LiveChatMessage = {
  id: string
  role: 'user' | 'assistant' | 'manager' | 'system'
  content: string
  metadata?: JsonRecord
  createdAt?: string
}

const nativeFetch = window.fetch.bind(window)

let activeSession: LiveChatSession | null = null
let sessionPromise: Promise<LiveChatSession> | null = null
let pollTimer: number | null = null
let polling = false

function visitorId() {
  const existing = window.localStorage.getItem(VISITOR_KEY)

  if (existing) return existing

  const created = createClientId()
  window.localStorage.setItem(VISITOR_KEY, created)
  return created
}

function lastMessageId() {
  return Number(
    window.localStorage.getItem(LAST_MESSAGE_KEY) ?? 0,
  ) || 0
}

function rememberMessageId(value: unknown) {
  const numeric = Number(value ?? 0)

  if (numeric > lastMessageId()) {
    window.localStorage.setItem(
      LAST_MESSAGE_KEY,
      String(numeric),
    )
  }
}

async function parseJson(response: Response) {
  const body = await response.json().catch(() => null)

  if (!response.ok) {
    throw new Error(
      body?.error
      ?? body?.message
      ?? `HTTP ${response.status}`,
    )
  }

  return body
}

async function ensureSession(): Promise<LiveChatSession> {
  if (activeSession) return activeSession
  if (sessionPromise) return sessionPromise

  sessionPromise = (async () => {
    const response = await nativeFetch('/api/live-chat/session', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        conversationId: window.localStorage.getItem(CHAT_ID_KEY),
        token: window.localStorage.getItem(CHAT_TOKEN_KEY),
        visitorId: visitorId(),
        path: window.location.pathname,
      }),
    })

    const body = await parseJson(response)

    const session = {
      conversationId: String(body.conversationId),
      token: String(body.token),
    }

    window.localStorage.setItem(
      CHAT_ID_KEY,
      session.conversationId,
    )
    window.localStorage.setItem(
      CHAT_TOKEN_KEY,
      session.token,
    )

    activeSession = session
    startPolling()

    return session
  })()

  try {
    return await sessionPromise
  } finally {
    sessionPromise = null
  }
}

function asText(value: unknown): string {
  if (typeof value === 'string') return value

  if (
    value
    && typeof value === 'object'
    && 'text' in value
  ) {
    return asText((value as JsonRecord).text)
  }

  if (Array.isArray(value)) {
    return value
      .map(asText)
      .filter(Boolean)
      .join('\n')
  }

  return ''
}

function latestUserMessage(body: JsonRecord): string {
  if (Array.isArray(body.messages)) {
    for (let index = body.messages.length - 1; index >= 0; index--) {
      const value = body.messages[index]

      if (!value || typeof value !== 'object') continue

      const message = value as JsonRecord
      const role = String(
        message.role
        ?? message.sender
        ?? message.author
        ?? '',
      ).toLowerCase()

      if (
        role
        && !['user', 'client', 'visitor', 'human'].includes(role)
      ) {
        continue
      }

      const text = asText(
        message.content
        ?? message.text
        ?? message.message,
      ).trim()

      if (text) return text
    }
  }

  for (const key of [
    'message',
    'query',
    'prompt',
    'text',
    'content',
    'input',
    'question',
  ]) {
    const text = asText(body[key]).trim()

    if (text) return text
  }

  function search(value: unknown, depth = 0): string {
    if (depth > 4 || value == null) return ''

    if (typeof value === 'string') {
      const text = value.trim()
      return text.length >= 1 && text.length <= 4_000
        ? text
        : ''
    }

    if (Array.isArray(value)) {
      for (let index = value.length - 1; index >= 0; index--) {
        const found = search(value[index], depth + 1)
        if (found) return found
      }
      return ''
    }

    if (typeof value === 'object') {
      const record = value as JsonRecord

      for (const key of [
        'message',
        'query',
        'prompt',
        'text',
        'content',
        'input',
        'question',
      ]) {
        const found = search(record[key], depth + 1)
        if (found) return found
      }
    }

    return ''
  }

  return search(body)
}

function requestPath(body: JsonRecord) {
  return String(
    body.path
    ?? body.pathname
    ?? body.currentPage
    ?? window.location.pathname,
  )
}

function assistantPayload(body: JsonRecord) {
  const assistant = (
    body.assistant
    && typeof body.assistant === 'object'
      ? body.assistant
      : {}
  ) as JsonRecord

  const savedMessage = (
    assistant.message
    && typeof assistant.message === 'object'
      ? assistant.message
      : null
  ) as LiveChatMessage | null

  const reply = String(
    savedMessage?.content
    ?? assistant.reply
    ?? assistant.answer
    ?? assistant.text
    ?? assistant.content
    ?? assistant.response
    ?? (
      body.conversation as JsonRecord | undefined
    )?.aiEnabled === false
      ? 'Сообщение передано менеджеру. Ответ появится в этом чате.'
      : 'Не удалось получить ответ. Попробуйте отправить вопрос ещё раз.',
  )

  rememberMessageId(body.userMessage && (
    body.userMessage as JsonRecord
  ).id)
  rememberMessageId(savedMessage?.id)

  const metadata = (
    savedMessage?.metadata
    && typeof savedMessage.metadata === 'object'
      ? savedMessage.metadata
      : {}
  ) as JsonRecord

  const products = (
    assistant.products
    ?? metadata.products
    ?? []
  )
  const actions = (
    assistant.actions
    ?? metadata.actions
    ?? []
  )

  const originalData = (
    assistant.data
    && typeof assistant.data === 'object'
      ? assistant.data
      : {}
  ) as JsonRecord

  return {
    ...assistant,
    reply,
    answer: assistant.answer ?? reply,
    text: assistant.text ?? reply,
    content: assistant.content ?? reply,
    response: assistant.response ?? reply,
    message: (
      typeof assistant.message === 'string'
        ? assistant.message
        : reply
    ),
    products,
    actions,
    data: {
      ...originalData,
      reply,
      answer: originalData.answer ?? reply,
      text: originalData.text ?? reply,
      content: originalData.content ?? reply,
      products: originalData.products ?? products,
      actions: originalData.actions ?? actions,
    },
    meta: {
      ...(
        assistant.meta
        && typeof assistant.meta === 'object'
          ? assistant.meta
          : {}
      ),
      liveChat: true,
      assistantError: body.assistantError ?? null,
    },
  }
}

async function requestBody(
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<JsonRecord | null> {
  try {
    if (typeof init?.body === 'string') {
      return JSON.parse(init.body)
    }

    if (input instanceof Request) {
      return await input.clone().json()
    }
  } catch {
    return null
  }

  return null
}

function isAssistantPost(
  input: RequestInfo | URL,
  init?: RequestInit,
) {
  const url = input instanceof Request
    ? new URL(input.url)
    : new URL(String(input), window.location.origin)

  const method = String(
    init?.method
    ?? (input instanceof Request ? input.method : 'GET'),
  ).toUpperCase()

  return (
    method === 'POST'
    && ASSISTANT_ENDPOINTS.has(url.pathname)
  )
}

async function handleAssistantRequest(
  input: RequestInfo | URL,
  init?: RequestInit,
) {
  const body = await requestBody(input, init)

  if (!body) return nativeFetch(input, init)

  const content = latestUserMessage(body)

  if (!content) return nativeFetch(input, init)

  try {
    const session = await ensureSession()

    const response = await nativeFetch(
      `/api/live-chat/conversations/`
      + `${session.conversationId}/messages`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          token: session.token,
          content,
          path: requestPath(body),
          assistantRequest: body,
        }),
      },
    )

    const liveBody = await parseJson(response)

    return new Response(
      JSON.stringify(assistantPayload(liveBody)),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-store',
        },
      },
    )
  } catch (error) {
    console.error('[OZELIF live-chat bridge]', error)

    // Резервный путь не ломает старый интерфейс при временной ошибке.
    return nativeFetch(input, init)
  }
}

async function pollManagerMessages() {
  if (polling) return
  polling = true

  try {
    const session = activeSession ?? await ensureSession()
    const after = lastMessageId()

    const response = await nativeFetch(
      `/api/live-chat/conversations/`
      + `${session.conversationId}/messages`
      + `?token=${encodeURIComponent(session.token)}`
      + `&after=${after}`,
      { cache: 'no-store' },
    )

    const body = await parseJson(response)
    const messages = (
      Array.isArray(body.messages)
        ? body.messages
        : []
    ) as LiveChatMessage[]

    for (const message of messages) {
      rememberMessageId(message.id)

      if (message.role !== 'manager') continue

      window.dispatchEvent(
        new CustomEvent(MANAGER_EVENT, {
          detail: {
            id: String(message.id),
            content: message.content,
            createdAt: message.createdAt,
          },
        }),
      )
    }
  } catch {
    // Polling не должен выводить техническую ошибку клиенту.
  } finally {
    polling = false
  }
}

function startPolling() {
  if (pollTimer !== null) return

  void pollManagerMessages()

  pollTimer = window.setInterval(() => {
    void pollManagerMessages()
  }, 3_000)
}

window.fetch = (
  input: RequestInfo | URL,
  init?: RequestInit,
) => (
  isAssistantPost(input, init)
    ? handleAssistantRequest(input, init)
    : nativeFetch(input, init)
)

if (
  window.localStorage.getItem(CHAT_ID_KEY)
  && window.localStorage.getItem(CHAT_TOKEN_KEY)
) {
  void ensureSession().catch(() => undefined)
}
Object.defineProperty(window, '__OZELIF_LEGACY_CHAT_BRIDGE_V2__', {
  configurable: true,
  value: true,
})
