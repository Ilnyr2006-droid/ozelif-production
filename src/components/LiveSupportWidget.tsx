import {
  FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import './live-support-widget.css'
import { createClientId } from '../utils/clientId'

type LiveMessage = {
  id: string
  role: 'user' | 'assistant' | 'manager' | 'system'
  content: string
  metadata?: {
    actions?: Array<{
      label: string
      href: string
      productId?: string
      reason?: string | null
    }>
    products?: Array<{
      id: string
      name: string
      recommendationReason?: string | null
    }>
  }
  createdAt: string
}

type Conversation = {
  id: string
  status: 'open' | 'human' | 'closed'
  aiEnabled: boolean
  visitorName?: string | null
  visitorPhone?: string | null
  customerId?: string | null
  managerRequestedAt?: string | null
}

type Conversion = {
  type: 'contact' | 'handoff'
  title?: string
  text?: string
  status?: string
  message?: string
}

type OrderFlow = {
  type: 'order'
  status:
    | 'collecting'
    | 'awaiting_confirmation'
    | 'awaiting_contact'
    | 'created'
    | 'cancelled'
  created: boolean
}

const STORAGE_ID = 'ozelif_live_chat_id'
const STORAGE_TOKEN = 'ozelif_live_chat_token'
const STORAGE_VISITOR = 'ozelif_live_chat_visitor'

function visitorId() {
  const existing = localStorage.getItem(STORAGE_VISITOR)
  if (existing) return existing

  const created = createClientId()
  localStorage.setItem(STORAGE_VISITOR, created)
  return created
}

async function jsonRequest<T>(
  url: string,
  options?: RequestInit,
): Promise<T> {
  const response = await fetch(url, {
    headers: {
      'Content-Type': 'application/json',
      ...(options?.headers ?? {}),
    },
    ...options,
  })

  const body = await response.json().catch(() => null)

  if (!response.ok) {
    throw new Error(body?.error ?? `HTTP ${response.status}`)
  }

  return body as T
}

export function LiveSupportWidget() {
  const [open, setOpen] = useState(false)
  const [conversation, setConversation] = useState<Conversation | null>(null)
  const [token, setToken] = useState('')
  const [messages, setMessages] = useState<LiveMessage[]>([])
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const [conversion, setConversion] = useState<Conversion | null>(null)
  const [orderFlow, setOrderFlow] = useState<OrderFlow | null>(null)
  const [contactName, setContactName] = useState('')
  const [contactPhone, setContactPhone] = useState('')
  const [contactSending, setContactSending] = useState(false)
  const [contactSaved, setContactSaved] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const lastId = useMemo(
    () => Number(messages.at(-1)?.id ?? 0),
    [messages],
  )

  const mergeMessages = useCallback((incoming: LiveMessage[]) => {
    setMessages(current => {
      const map = new Map(current.map(item => [item.id, item]))

      for (const item of incoming) {
        map.set(item.id, item)
      }

      return [...map.values()].sort(
        (left, right) => Number(left.id) - Number(right.id),
      )
    })
  }, [])

  const ensureSession = useCallback(async () => {
    const savedId = localStorage.getItem(STORAGE_ID)
    const savedToken = localStorage.getItem(STORAGE_TOKEN)

    const result = await jsonRequest<{
      conversation: Conversation
      conversationId: string
      token: string
    }>('/api/live-chat/session', {
      method: 'POST',
      body: JSON.stringify({
        conversationId: savedId,
        token: savedToken,
        visitorId: visitorId(),
        path: window.location.pathname,
      }),
    })

    localStorage.setItem(STORAGE_ID, result.conversationId)
    localStorage.setItem(STORAGE_TOKEN, result.token)
    setConversation(result.conversation)
    setToken(result.token)

    return {
      conversation: result.conversation,
      token: result.token,
    }
  }, [])

  const poll = useCallback(async () => {
    const current = conversation ?? (await ensureSession()).conversation
    const currentToken = token || localStorage.getItem(STORAGE_TOKEN) || ''

    if (!current?.id || !currentToken) return

    const result = await jsonRequest<{
      conversation: Conversation
      messages: LiveMessage[]
    }>(
      `/api/live-chat/conversations/${current.id}/messages`
      + `?token=${encodeURIComponent(currentToken)}`
      + `&after=${lastId}`,
    )

    setConversation(result.conversation)
    mergeMessages(result.messages)
  }, [conversation, ensureSession, lastId, mergeMessages, token])

  useEffect(() => {
    if (!open) return

    void poll().catch(reason => {
      setError(reason instanceof Error ? reason.message : 'Ошибка чата')
    })

    const timer = window.setInterval(() => {
      void poll().catch(() => undefined)
    }, 3_000)

    return () => window.clearInterval(timer)
  }, [open, poll])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, open])

  async function send(event: FormEvent) {
    event.preventDefault()
    const content = draft.trim()

    if (!content || sending) return

    setSending(true)
    setError('')
    setDraft('')

    try {
      const session = conversation
        ? { conversation, token }
        : await ensureSession()

      const result = await jsonRequest<{
        conversation: Conversation
        userMessage: LiveMessage
        assistant: null | {
          message: LiveMessage
        }
        assistantError?: string | null
        conversion?: Conversion | null
        orderFlow?: OrderFlow | null
      }>(
        `/api/live-chat/conversations/${session.conversation.id}/messages`,
        {
          method: 'POST',
          body: JSON.stringify({
            token: session.token,
            content,
            path: window.location.pathname,
          }),
        },
      )

      setConversation(result.conversation)
      setConversion(result.conversion ?? null)
      setOrderFlow(result.orderFlow ?? null)
      mergeMessages([
        result.userMessage,
        ...(result.assistant?.message ? [result.assistant.message] : []),
      ])

      if (result.assistantError) {
        setError(
          'Сообщение сохранено. Консультант подключится к диалогу.',
        )
      }
    } catch (reason) {
      setDraft(content)
      setError(
        reason instanceof Error
          ? reason.message
          : 'Не удалось отправить сообщение.',
      )
    } finally {
      setSending(false)
    }
  }

  async function submitContact(event: FormEvent) {
    event.preventDefault()

    const phone = contactPhone.trim()
    if (!phone || contactSending) return

    setContactSending(true)
    setError('')

    try {
      const session = conversation
        ? {
            conversation,
            token:
              token
              || localStorage.getItem(STORAGE_TOKEN)
              || '',
          }
        : await ensureSession()

      const result = await jsonRequest<{
        profile: Partial<Conversation> | null
        managerRequested?: boolean
        assistant?: null | {
          message: LiveMessage
        }
        orderFlow?: OrderFlow | null
      }>(
        `/api/live-chat/conversations/${session.conversation.id}/profile`
        + `?token=${encodeURIComponent(session.token)}`,
        {
          method: 'POST',
          body: JSON.stringify({
            name: contactName.trim() || null,
            phone,
          }),
        },
      )

      if (result.profile) {
        setConversation(current => (
          current
            ? { ...current, ...result.profile }
            : session.conversation
        ))
      }

      setOrderFlow(result.orderFlow ?? null)

      if (result.assistant?.message) {
        mergeMessages([
          result.assistant.message,
        ])
      }

      setContactSaved(true)
      setConversion({
        type: 'handoff',
        status: 'requested',
        message:
          'Контакт передан менеджеру. Пока вы ждёте, можно продолжить консультацию с AI.',
      })
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : 'Не удалось сохранить контакт.',
      )
    } finally {
      setContactSending(false)
    }
  }

  function trackRecommendationClick(
    messageId: string,
    action: {
      href: string
      productId?: string
    },
  ) {
    const conversationId = conversation?.id
    const currentToken =
      token
      || localStorage.getItem(STORAGE_TOKEN)
      || ''

    if (
      !conversationId
      || !currentToken
      || !action.productId
    ) {
      return
    }

    void fetch(
      `/api/live-chat/conversations/${conversationId}/recommendation-click`,
      {
        method: 'POST',
        keepalive: true,
        headers: {
          'Content-Type': 'application/json',
          'X-Ozelif-Live-Chat-Token': currentToken,
        },
        body: JSON.stringify({
          messageId,
          productId: action.productId,
          href: action.href,
        }),
      },
    ).catch(() => undefined)
  }

  const humanMode = conversation && !conversation.aiEnabled

  return (
    <div className="live-support">
      {open ? (
        <section className="live-support-panel" aria-label="Чат OZELIF">
          <header>
            <div>
              <strong>Консультант OZELIF</strong>
              <span>
                {humanMode
                  ? 'В диалоге менеджер'
                  : 'AI отвечает сразу, менеджер видит переписку'}
              </span>
            </div>

            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Закрыть чат"
            >
              ×
            </button>
          </header>

          <div className="live-support-messages">
            {!messages.length ? (
              <div className="live-support-welcome">
                Расскажите, что хотите изготовить. Поможем подобрать кожу,
                замшу, дублёночный материал или фурнитуру.
              </div>
            ) : null}

            {messages.map(message => (
              <article
                className={`live-support-message role-${message.role}`}
                key={message.id}
              >
                <span>
                  {message.role === 'user'
                    ? 'Вы'
                    : message.role === 'manager'
                      ? 'Менеджер'
                      : 'OZELIF'}
                </span>
                <p>{message.content}</p>

                {message.metadata?.actions?.length ? (
                  <div className="live-support-actions">
                    {message.metadata.actions.slice(0, 3).map(action => (
                      <a
                        href={action.href}
                        key={`${action.href}-${action.productId ?? ''}`}
                        onClick={() => {
                          trackRecommendationClick(
                            message.id,
                            action,
                          )
                        }}
                      >
                        {action.label}
                      </a>
                    ))}
                  </div>
                ) : null}
              </article>
            ))}

            <div ref={bottomRef} />
          </div>

          {(conversion?.type === 'contact'
              || orderFlow?.status === 'awaiting_contact')
            && !conversation?.visitorPhone ? (
            <section className="live-support-contact-card">
              <strong>
                {conversion?.title
                  ?? (
                    orderFlow?.status === 'awaiting_contact'
                      ? 'Контакт для заказа'
                      : 'Контакт'
                  )}
              </strong>
              <p>
                {conversion?.text
                  ?? (
                    orderFlow?.status === 'awaiting_contact'
                      ? 'Укажите имя и телефон, чтобы создать заказ.'
                      : 'Оставьте контакт, и менеджер увидит ваш запрос.'
                  )}
              </p>

              <form onSubmit={submitContact}>
                <input
                  value={contactName}
                  onChange={event => setContactName(event.target.value)}
                  placeholder={
                    orderFlow?.status === 'awaiting_contact'
                      ? 'Имя'
                      : 'Имя (необязательно)'
                  }
                  maxLength={160}
                  required={
                    orderFlow?.status === 'awaiting_contact'
                  }
                />
                <input
                  value={contactPhone}
                  onChange={event => setContactPhone(event.target.value)}
                  placeholder="+7 999 000-00-00"
                  inputMode="tel"
                  autoComplete="tel"
                  maxLength={80}
                  required
                />
                <button
                  type="submit"
                  disabled={
                    !contactPhone.trim()
                    || contactSending
                    || (
                      orderFlow?.status === 'awaiting_contact'
                      && !contactName.trim()
                    )
                  }
                >
                  {contactSending ? 'Сохраняем…' : 'Передать менеджеру'}
                </button>
              </form>
            </section>
          ) : null}

          {conversion?.type === 'handoff' || contactSaved ? (
            <div className="live-support-handoff">
              {conversion?.message
                || 'Менеджер увидит ваш запрос в этом чате.'}
            </div>
          ) : null}

          {error ? <div className="live-support-error">{error}</div> : null}

          <form className="live-support-message-form" onSubmit={send}>
            <textarea
              value={draft}
              onChange={event => setDraft(event.target.value)}
              placeholder="Напишите сообщение…"
              rows={2}
              maxLength={4_000}
            />
            <button type="submit" disabled={!draft.trim() || sending}>
              {sending ? 'Отправляем…' : 'Отправить'}
            </button>
          </form>
        </section>
      ) : null}

      <button
        className="live-support-launcher"
        type="button"
        onClick={() => setOpen(value => !value)}
        aria-label="Открыть чат"
      >
        <span>Чат</span>
      </button>
    </div>
  )
}
