import {
  FormEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react'
import { AiPromptSettings } from './AiPromptSettings'
import './admin-live-chats.css'

type Conversation = {
  id: string
  visitorId: string | null
  visitorName: string | null
  visitorPhone: string | null
  pagePath: string | null
  channel?: 'web' | 'telegram'
  externalChatId?: string | null
  telegramUserId?: string | null
  telegramChatId?: string | null
  telegramUsername?: string | null
  telegramUrl?: string | null
  status: 'open' | 'human' | 'closed'
  aiEnabled: boolean
  managerRequestedAt?: string | null
  managerRequestReason?: string | null
  leadIntent?: string | null
  leadScore?: number
  contactCapturedAt?: string | null
  lastMessageAt: string | null
  lastMessage?: string
  lastRole?: string
  unreadCount?: number
  createdAt: string
}

type Message = {
  id: string
  role: 'user' | 'assistant' | 'manager' | 'system'
  content: string
  metadata?: {
    type?: string
    imageUrl?: string
    channel?: string
  } | null
  createdAt: string
}

async function requestJson<T>(
  url: string,
  options?: RequestInit,
): Promise<T> {
  const response = await fetch(url, {
    credentials: 'same-origin',
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

function time(value: string | null | undefined) {
  if (!value) return '—'

  return new Intl.DateTimeFormat('ru-RU', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(new Date(value))
}

export function AdminLiveChats({
  onClose,
  embedded = false,
}: {
  onClose?: () => void
  embedded?: boolean
}) {
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [selectedId, setSelectedId] = useState('')
  const [selected, setSelected] = useState<Conversation | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [draft, setDraft] = useState('')
  const [telegramPhoto, setTelegramPhoto] = useState<File | null>(null)
  const [filter, setFilter] = useState<'active' | 'closed' | 'all'>('active')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const promptHost = useRef<HTMLDivElement>(null)
  const bottomRef = useRef<HTMLDivElement>(null)

  const loadList = useCallback(async () => {
    const result = await requestJson<{
      conversations: Conversation[]
    }>(`/api/admin/live-chats?status=${filter}`)

    setConversations(result.conversations)

    if (
      selectedId
      && !result.conversations.some(item => item.id === selectedId)
    ) {
      setSelectedId('')
      setSelected(null)
      setMessages([])
    }
  }, [filter, selectedId])

  const loadConversation = useCallback(async (id: string) => {
    if (!id) return

    const result = await requestJson<{
      conversation: Conversation
      messages: Message[]
    }>(`/api/admin/live-chats/${id}`)

    setSelected(result.conversation)
    setMessages(result.messages)
  }, [])

  useEffect(() => {
    void loadList().catch(reason => {
      setError(reason instanceof Error ? reason.message : 'Ошибка загрузки')
    })

    const timer = window.setInterval(() => {
      void loadList().catch(() => undefined)
    }, 5_000)

    return () => window.clearInterval(timer)
  }, [loadList])

  useEffect(() => {
    if (!selectedId) return

    void loadConversation(selectedId).catch(() => undefined)

    const timer = window.setInterval(() => {
      void loadConversation(selectedId).catch(() => undefined)
    }, 3_000)

    return () => window.clearInterval(timer)
  }, [loadConversation, selectedId])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function action(
    name: 'takeover' | 'enable-ai' | 'close' | 'reopen',
  ) {
    if (!selectedId || loading) return

    setLoading(true)
    setError('')

    try {
      await requestJson(`/api/admin/live-chats/${selectedId}/${name}`, {
        method: 'POST',
        body: '{}',
      })
      await Promise.all([
        loadConversation(selectedId),
        loadList(),
      ])
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Ошибка действия')
    } finally {
      setLoading(false)
    }
  }

  async function send(event: FormEvent) {
    event.preventDefault()

    const content = draft.trim()
    const photo = telegramPhoto

    if (
      !selectedId
      || loading
      || (
        !content
        && !(
          selected?.channel === 'telegram'
          && photo
        )
      )
    ) {
      return
    }

    setLoading(true)
    setError('')

    try {
      if (
        selected?.channel === 'telegram'
        && photo
      ) {
        const form =
          new FormData()

        form.append(
          'photo',
          photo,
        )

        if (content) {
          form.append(
            'caption',
            content,
          )
        }

        const response =
          await fetch(
            `/api/admin/live-chats/${selectedId}/telegram-photo`,
            {
              method: 'POST',
              credentials:
                'same-origin',
              body: form,
            },
          )

        const body =
          await response
            .json()
            .catch(() => null)

        if (!response.ok) {
          throw new Error(
            body?.error
            ?? `HTTP ${response.status}`,
          )
        }
      } else {
        await requestJson(
          `/api/admin/live-chats/${selectedId}/messages`,
          {
            method: 'POST',
            body:
              JSON.stringify({
                content,
              }),
          },
        )
      }

      setDraft('')
      setTelegramPhoto(null)

      await Promise.all([
        loadConversation(selectedId),
        loadList(),
      ])
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : 'Ошибка отправки',
      )
    } finally {
      setLoading(false)
    }
  }

  function openPrompt() {
    promptHost.current
      ?.querySelector<HTMLButtonElement>('.ai-prompt-launcher')
      ?.click()
  }

  return (
    <div
      className={
        embedded
          ? 'admin-live-chats is-embedded'
          : 'admin-live-chats'
      }
    >
      <div ref={promptHost} className="admin-live-chats-prompt-host">
        <AiPromptSettings />
      </div>

      <header className="admin-live-chats-header">
        <div>
          <span>OZELIF ADMIN</span>
          <h1>Чаты</h1>
          <p>
            AI ведёт первичный диалог. В любой момент можно забрать чат
            менеджеру, написать клиенту и затем вернуть бота.
          </p>
        </div>

        <div>
          <button type="button" onClick={openPrompt}>
            AI-промпт
          </button>
          {onClose ? (
            <button type="button" onClick={onClose}>
              Закрыть
            </button>
          ) : null}
        </div>
      </header>

      {error ? <div className="admin-live-chats-error">{error}</div> : null}

      <div className="admin-live-chats-layout">
        <aside className="admin-live-chats-list">
          <div className="admin-live-chats-filters">
            {(['active', 'closed', 'all'] as const).map(item => (
              <button
                type="button"
                className={filter === item ? 'is-active' : ''}
                onClick={() => setFilter(item)}
                key={item}
              >
                {item === 'active'
                  ? 'Активные'
                  : item === 'closed'
                    ? 'Закрытые'
                    : 'Все'}
              </button>
            ))}
          </div>

          <div className="admin-live-chats-items">
            {conversations.map(conversation => (
              <button
                type="button"
                className={
                  selectedId === conversation.id
                    ? 'admin-live-chat-item is-selected'
                    : 'admin-live-chat-item'
                }
                onClick={() => setSelectedId(conversation.id)}
                key={conversation.id}
              >
                <div>
                  <strong>
                    {conversation.visitorName
                      || `Клиент ${conversation.id.slice(0, 6)}`}
                  </strong>

                  <div className="admin-live-chat-badges">
                    {conversation.channel === 'telegram' ? (
                      <span className="is-telegram">Telegram</span>
                    ) : null}

                    {conversation.managerRequestedAt ? (
                      <span className="is-lead">
                        Нужен менеджер
                      </span>
                    ) : null}

                    {Number(conversation.unreadCount ?? 0) > 0 ? (
                      <span>{conversation.unreadCount}</span>
                    ) : null}
                  </div>
                </div>

                <p>{conversation.lastMessage || 'Новый диалог'}</p>

                <small>
                  {conversation.channel === 'telegram'
                    ? 'Telegram'
                    : conversation.aiEnabled
                      ? 'AI'
                      : 'Менеджер'}
                  {' · '}
                  {time(conversation.lastMessageAt ?? conversation.createdAt)}
                </small>
              </button>
            ))}

            {!conversations.length ? (
              <div className="admin-live-chats-empty">
                Пока нет диалогов в этом разделе.
              </div>
            ) : null}
          </div>
        </aside>

        <main className="admin-live-chat-dialog">
          {selected ? (
            <>
              <header>
                <div>
                  <strong>
                    {selected.visitorName
                      || `Клиент ${selected.id.slice(0, 8)}`}
                  </strong>
                  <span>
                    {selected.visitorPhone || 'Телефон не указан'}
                    {selected.channel === 'telegram'
                      ? ''
                      : ` · ${selected.pagePath || '/'}`}
                  </span>

                  {selected.channel === 'telegram' ? (
                    <div className="admin-live-chat-telegram-meta">
                      <span>
                        {selected.telegramUsername
                          ? `@${selected.telegramUsername}`
                          : '@username не указан'}
                      </span>
                      {selected.telegramUserId ? (
                        <span>Telegram ID: {selected.telegramUserId}</span>
                      ) : null}
                      {selected.telegramUrl ? (
                        <a href={selected.telegramUrl} target="_blank" rel="noreferrer">
                          Открыть в Telegram
                        </a>
                      ) : null}
                    </div>
                  ) : null}

                  {selected.managerRequestedAt ? (
                    <span className="admin-live-chat-lead-status">
                      Нужен менеджер
                      {selected.leadIntent
                        ? ` · ${selected.leadIntent}`
                        : ''}
                      {Number(selected.leadScore ?? 0) > 0
                        ? ` · ${selected.leadScore}/100`
                        : ''}
                    </span>
                  ) : null}
                </div>

                <div className="admin-live-chat-controls">
                  {selected.status === 'closed' ? (
                    <button
                      type="button"
                      onClick={() => void action('reopen')}
                      disabled={loading}
                    >
                      Открыть чат
                    </button>
                  ) : selected.aiEnabled ? (
                    <button
                      type="button"
                      className="is-primary"
                      onClick={() => void action('takeover')}
                      disabled={loading}
                    >
                      Отключить AI и ответить
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => void action('enable-ai')}
                      disabled={loading}
                    >
                      Вернуть AI
                    </button>
                  )}

                  {selected.status !== 'closed' ? (
                    <button
                      type="button"
                      className="is-danger"
                      onClick={() => void action('close')}
                      disabled={loading}
                    >
                      Закрыть
                    </button>
                  ) : null}
                </div>
              </header>

              <div className="admin-live-chat-messages">
                {messages.map(message => (
                  <article
                    className={`role-${message.role}`}
                    key={message.id}
                  >
                    <span>
                      {message.role === 'user'
                        ? 'Клиент'
                        : message.role === 'manager'
                          ? 'Менеджер'
                          : 'AI OZELIF'}
                    </span>
                    {message.metadata?.imageUrl ? (
                      <a
                        className="admin-live-chat-image"
                        href={message.metadata.imageUrl}
                        target="_blank"
                        rel="noreferrer"
                      >
                        <img
                          src={message.metadata.imageUrl}
                          alt={message.content || 'Фото'}
                        />
                      </a>
                    ) : null}
                    <p>{message.content}</p>
                    <small>{time(message.createdAt)}</small>
                  </article>
                ))}
                <div ref={bottomRef} />
              </div>

              <form onSubmit={send}>
                <textarea
                  value={draft}
                  onChange={event => setDraft(event.target.value)}
                  placeholder={
                    selected.channel === 'telegram'
                      ? telegramPhoto
                        ? 'Подпись к фотографии (необязательно)…'
                        : selected.aiEnabled
                          ? 'Ответить в Telegram — AI отключится автоматически…'
                          : 'Ответить клиенту в Telegram…'
                      : selected.aiEnabled
                        ? 'При отправке сообщения AI отключится автоматически…'
                        : 'Ответить клиенту…'
                  }
                  rows={3}
                  maxLength={
                    selected.channel === 'telegram'
                    && telegramPhoto
                      ? 1_024
                      : 4_000
                  }
                  disabled={selected.status === 'closed'}
                />

                {selected.channel === 'telegram' ? (
                  <div className="admin-live-chat-telegram-composer">
                    <label>
                      <input
                        type="file"
                        accept="image/jpeg,image/png"
                        onChange={event => {
                          setTelegramPhoto(
                            event.target.files?.[0]
                            ?? null,
                          )
                          event.currentTarget.value = ''
                        }}
                        disabled={
                          loading
                          || selected.status === 'closed'
                        }
                      />
                      <span>
                        {telegramPhoto
                          ? 'Заменить фото'
                          : 'Прикрепить фото'}
                      </span>
                    </label>

                    {telegramPhoto ? (
                      <div className="admin-live-chat-photo-selected">
                        <span>
                          {telegramPhoto.name}
                        </span>
                        <button
                          type="button"
                          onClick={() => setTelegramPhoto(null)}
                          disabled={loading}
                        >
                          Убрать
                        </button>
                      </div>
                    ) : null}
                  </div>
                ) : null}

                <button
                  type="submit"
                  disabled={
                    loading
                    || selected.status === 'closed'
                    || (
                      !draft.trim()
                      && !(
                        selected.channel === 'telegram'
                        && telegramPhoto
                      )
                    )
                  }
                >
                  {selected.channel === 'telegram'
                    && telegramPhoto
                    ? 'Отправить фото'
                    : 'Отправить'}
                </button>
              </form>
            </>
          ) : (
            <div className="admin-live-chat-placeholder">
              Выберите диалог слева.
            </div>
          )}
        </main>
      </div>
    </div>
  )
}
