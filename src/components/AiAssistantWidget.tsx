import { Bot, Eraser, GripHorizontal, RotateCcw, Send, Sparkles, X } from 'lucide-react'
import { FormEvent, KeyboardEvent as ReactKeyboardEvent, useEffect, useRef, useState } from 'react'
import {
  AI_ASSISTANT_MAX_MESSAGE_LENGTH,
  AI_ASSISTANT_MAX_MESSAGES,
  AI_ASSISTANT_STORAGE_KEY,
  AssistantMessage,
  createMessage,
  getLocalAssistantReply,
  quickQuestions,
  welcomeMessage,
} from '../data/aiAssistant'
import { useDraggableFloatingPanel } from '../hooks/useDraggableFloatingPanel'
import {
  ensureLiveChatSession,
  pollLiveChat,
  resetLiveChatSession,
  sendLiveChatMessage,
} from '../api/liveChat'

const AI_ASSISTANT_POSITION_KEY = 'ozelif-ai-chat-position-v1'
const AI_ASSISTANT_UI_STORAGE_KEY = 'ozelif-ai-chat-ui-v1'
const AI_ASSISTANT_CONTACT_PROMPT =
  'Как к вам обращаться и какой номер телефона оставить для связи?'

function contactPromptMessage() {
  return createMessage('assistant', AI_ASSISTANT_CONTACT_PROMPT)
}

function initialAssistantMessages() {
  return [
    welcomeMessage(),
    contactPromptMessage(),
  ]
}

type AssistantUiState = {
  isOpen: boolean
  draft: string
}

function readStoredUi(): AssistantUiState {
  try {
    if (typeof window === 'undefined') return { isOpen: false, draft: '' }
    const raw = window.sessionStorage.getItem(AI_ASSISTANT_UI_STORAGE_KEY)
    if (!raw) return { isOpen: false, draft: '' }
    const parsed: unknown = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object' || typeof (parsed as AssistantUiState).isOpen !== 'boolean' || typeof (parsed as AssistantUiState).draft !== 'string') {
      window.sessionStorage.removeItem(AI_ASSISTANT_UI_STORAGE_KEY)
      return { isOpen: false, draft: '' }
    }
    return {
      isOpen: (parsed as AssistantUiState).isOpen,
      draft: (parsed as AssistantUiState).draft.slice(0, AI_ASSISTANT_MAX_MESSAGE_LENGTH),
    }
  } catch {
    return { isOpen: false, draft: '' }
  }
}

function readStoredMessages(): AssistantMessage[] {
  try {
    const raw = window.localStorage.getItem(AI_ASSISTANT_STORAGE_KEY)
    if (!raw) return initialAssistantMessages()
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed) || parsed.length === 0 || parsed.some(message => (
      !message || typeof message !== 'object' || !['assistant', 'user'].includes((message as AssistantMessage).role) || typeof (message as AssistantMessage).content !== 'string'
    ))) {
      window.localStorage.removeItem(AI_ASSISTANT_STORAGE_KEY)
      return initialAssistantMessages()
    }

    const stored = parsed.slice(
      -AI_ASSISTANT_MAX_MESSAGES,
    ) as AssistantMessage[]

    const alreadyAsked = stored.some(message =>
      message.content === AI_ASSISTANT_CONTACT_PROMPT
    )

    const alreadyStarted = stored.some(message =>
      message.role === 'user'
    )

    if (!alreadyAsked && !alreadyStarted) {
      return [
        ...stored,
        contactPromptMessage(),
      ].slice(-AI_ASSISTANT_MAX_MESSAGES)
    }

    return stored
  } catch {
    window.localStorage.removeItem(AI_ASSISTANT_STORAGE_KEY)
    return initialAssistantMessages()
  }
}

function formatTime(timestamp: string) {
  const date = new Date(timestamp)
  return Number.isNaN(date.valueOf()) ? '' : date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })
}

function liveChatMessageActions(
  message: {
    metadata?: Record<string, unknown>
  } | null | undefined,
): Array<{ label: string; href: string }> {
  const actions = message?.metadata?.actions

  if (!Array.isArray(actions)) return []

  return actions.flatMap(action => {
    if (!action || typeof action !== 'object') return []

    const label = Reflect.get(action, 'label')
    const href = Reflect.get(action, 'href')

    if (
      typeof label !== 'string'
      || !label.trim()
      || typeof href !== 'string'
      || !href.trim()
    ) {
      return []
    }

    return [{
      label: label.trim(),
      href: href.trim(),
    }]
  })
}

function MessageContent({ content }: { content: string }) {
  const parts = content.split(/(https?:\/\/[^\s]+|\/(?:odejnayakozha|dublyonka|zamsha|obuvnayakozha|furnitura|delivery|contacts|production|kozhaoptom)\b[^\s]*)/g)
  return <>{parts.map((part, index) => {
    if (/^https?:\/\//.test(part)) return <a href={part} target="_blank" rel="noreferrer" key={`${part}-${index}`}>{part}</a>
    if (/^\/(odejnayakozha|dublyonka|zamsha|obuvnayakozha|furnitura|delivery|contacts|production|kozhaoptom)\b/.test(part)) return <a href={part} key={`${part}-${index}`}>{part}</a>
    return <span key={`${part}-${index}`}>{part}</span>
  })}</>
}

export function AiAssistantWidget() {
  const [storedUi] = useState(readStoredUi)
  const [isOpen, setIsOpen] = useState(storedUi.isOpen)
  const [messages, setMessages] = useState<AssistantMessage[]>(() => readStoredMessages())
  const [draft, setDraft] = useState(storedUi.draft)
  const [isTyping, setIsTyping] = useState(false)
  const [isMobile, setIsMobile] = useState(false)
  const [hasHydrated, setHasHydrated] = useState(false)
  const [isRestoredOpen, setIsRestoredOpen] = useState(storedUi.isOpen)
  const [session, setSession] = useState<Awaited<ReturnType<typeof ensureLiveChatSession>> | null>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const endRef = useRef<HTMLDivElement>(null)
  const messagesRef = useRef<HTMLDivElement>(null)
  const shouldAutoScrollRef = useRef(true)
  const chatResetVersionRef = useRef(0)
  const wasOpenRef = useRef(false)
  const draggablePanel = useDraggableFloatingPanel({
    storageKey: AI_ASSISTANT_POSITION_KEY,
    enabled: isOpen && !isMobile,
    margin: 12,
  })

  const hasUserMessage = messages.some(message => message.role === 'user')

  useEffect(() => {
    const updateMobileState = () => setIsMobile(typeof window.matchMedia === 'function' ? window.matchMedia('(max-width: 720px)').matches : window.innerWidth <= 720)
    updateMobileState()
    window.addEventListener('resize', updateMobileState)
    return () => window.removeEventListener('resize', updateMobileState)
  }, [])

  useEffect(() => { setHasHydrated(true) }, [])

  useEffect(() => {
    if (!hasHydrated) return
    try {
      window.sessionStorage.setItem(AI_ASSISTANT_UI_STORAGE_KEY, JSON.stringify({ isOpen, draft }))
    } catch {
      // Session persistence is optional and must not prevent a conversation.
    }
  }, [draft, hasHydrated, isOpen])

  useEffect(() => {
    try {
      window.localStorage.setItem(AI_ASSISTANT_STORAGE_KEY, JSON.stringify(messages.slice(-AI_ASSISTANT_MAX_MESSAGES)))
    } catch {
      // The widget stays usable even when browser storage is unavailable.
    }
  }, [messages])

  useEffect(() => {
    let focusTimer: number | undefined
    let scrollTimer: number | undefined

    if (isOpen) {
      if (!isRestoredOpen) {
        focusTimer = window.setTimeout(() => {
          inputRef.current?.focus()
        }, 0)
      }

      shouldAutoScrollRef.current = true

      scrollTimer = window.setTimeout(() => {
        endRef.current?.scrollIntoView?.({ block: 'end' })
      }, 0)
    } else if (wasOpenRef.current) {
      triggerRef.current?.focus()
    }

    wasOpenRef.current = isOpen

    return () => {
      if (focusTimer !== undefined) {
        window.clearTimeout(focusTimer)
      }

      if (scrollTimer !== undefined) {
        window.clearTimeout(scrollTimer)
      }
    }
  }, [isOpen, isRestoredOpen])

  useEffect(() => {
    if (!isOpen || !shouldAutoScrollRef.current) return

    const timer = window.setTimeout(() => {
      if (!shouldAutoScrollRef.current) return

      endRef.current?.scrollIntoView?.({
        block: 'end',
        behavior: isTyping ? 'auto' : 'smooth',
      })
    }, 0)

    return () => {
      window.clearTimeout(timer)
    }
  }, [isOpen, messages, isTyping])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && isOpen) {
        setIsRestoredOpen(false)
        setIsOpen(false)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [isOpen])

  function handleMessagesScroll() {
    const element = messagesRef.current
    if (!element) return

    const distanceFromBottom = (
      element.scrollHeight
      - element.scrollTop
      - element.clientHeight
    )

    shouldAutoScrollRef.current = distanceFromBottom <= 72
  }

  function openChat() {
    setIsRestoredOpen(false)
    setIsOpen(true)
  }

  function closeChat() {
    setIsRestoredOpen(false)
    setIsOpen(false)
  }

  useEffect(() => {
    if (!isOpen || !isMobile) return
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = previousOverflow }
  }, [isOpen, isMobile])

  useEffect(() => {
    if (!isOpen || !session) return

    const resetVersion = chatResetVersionRef.current
    let cancelled = false

    const open = async () => {
      const current = session

      if (
        cancelled
        || resetVersion !== chatResetVersionRef.current
      ) return

      setSession(current)

      const update = async () => {
        const result = await pollLiveChat(current, 0)

        if (
          cancelled
          || resetVersion !== chatResetVersionRef.current
        ) return

        setMessages(existing => {
          const mapped = result.messages.map(message =>
            createMessage(
              message.role === 'user' ? 'user' : 'assistant',
              message.content,
              liveChatMessageActions(message),
            )
          )

          return mapped.length
            ? mapped.slice(-AI_ASSISTANT_MAX_MESSAGES)
            : existing
        })
      }

      await update()

      const timer = window.setInterval(() => {
        void update().catch(() => undefined)
      }, 3_000)

      return () => window.clearInterval(timer)
    }

    let stop: (() => void) | undefined

    void open()
      .then(value => { stop = value })
      .catch(() => undefined)

    return () => {
      cancelled = true
      stop?.()
    }
  }, [isOpen, session])

  async function sendMessage(rawMessage: string) {
    const content = rawMessage.trim().slice(0, AI_ASSISTANT_MAX_MESSAGE_LENGTH)
    if (!content || isTyping) return

    shouldAutoScrollRef.current = true
    const resetVersion = chatResetVersionRef.current

    const userMessage = createMessage('user', content)
    const nextMessages = [...messages, userMessage].slice(-AI_ASSISTANT_MAX_MESSAGES)
    setMessages(nextMessages)
    setDraft('')
    setIsTyping(true)

    try {
      const current = session ?? await ensureLiveChatSession()

      if (resetVersion !== chatResetVersionRef.current) {
        resetLiveChatSession()
        return
      }

      if (!session) setSession(current)

      const result = await sendLiveChatMessage(
        current,
        content,
        {
          messages: nextMessages,
          path: window.location.pathname,
        },
      )

      if (resetVersion !== chatResetVersionRef.current) return

      const reply = result.assistant?.message?.content
        ?? result.assistant?.reply

      const actions = result.assistant?.actions
        ?? liveChatMessageActions(result.assistant?.message)

      if (reply) {
        setMessages(currentMessages => [
          ...currentMessages,
          createMessage('assistant', reply, actions),
        ].slice(-AI_ASSISTANT_MAX_MESSAGES))
      }
      else if (!result.conversation.aiEnabled) setMessages(currentMessages => [...currentMessages, createMessage('assistant', 'Сообщение передано менеджеру. Ответ появится в этом чате.')].slice(-AI_ASSISTANT_MAX_MESSAGES))
    } catch {
      if (resetVersion !== chatResetVersionRef.current) return

      const reply = getLocalAssistantReply(content)

      setMessages(current => [
        ...current,
        createMessage(
          'assistant',
          reply.content,
          reply.actions,
        ),
      ].slice(-AI_ASSISTANT_MAX_MESSAGES))
    } finally {
      if (resetVersion === chatResetVersionRef.current) {
        setIsTyping(false)
      }
    }
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    void sendMessage(draft)
  }

  function onInputKeyDown(event: ReactKeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      void sendMessage(draft)
    }
  }

  function clearHistory() {
    chatResetVersionRef.current += 1

    resetLiveChatSession()
    window.localStorage.removeItem(AI_ASSISTANT_STORAGE_KEY)

    setSession(null)
    setMessages(initialAssistantMessages())
    setDraft('')
    setIsTyping(false)

    shouldAutoScrollRef.current = true
  }

  const panelStyle = draggablePanel.position && !isMobile
    ? { left: `${draggablePanel.position.x}px`, top: `${draggablePanel.position.y}px`, transform: 'none' }
    : undefined

  if (!hasHydrated) return null

  return (
    <aside className={`ai-assistant ${isOpen ? 'is-open' : ''}`} aria-live="polite">
      {isOpen && (
        <section ref={draggablePanel.panelRef} className={`ai-assistant-dialog ${draggablePanel.hasCustomPosition && !isMobile ? 'has-custom-position' : ''} ${isRestoredOpen ? 'ai-assistant-dialog--restored' : ''}`} style={panelStyle} role="dialog" aria-modal="true" aria-labelledby="ai-assistant-title">
          <header className={`ai-assistant-header ai-assistant-drag-handle ${draggablePanel.isDragging ? 'is-dragging' : ''}`} {...draggablePanel.dragHandleProps}>
            <div className="ai-assistant-title">
              <span className="ai-assistant-mark"><Sparkles size={17} aria-hidden="true" /></span>
              <div>
                <h2 id="ai-assistant-title">AI-ассистент OZELIF</h2>
                <p>Помогу подобрать материал <span><i />Онлайн</span></p>
              </div>
            </div>
            <div className="ai-assistant-header-actions">
              {!isMobile && <>
                <span className="ai-assistant-grip" aria-hidden="true"><GripHorizontal size={18} /></span>
                <button type="button" className="ai-assistant-icon-button ai-assistant-reset-button" onClick={draggablePanel.resetPosition} title="Вернуть исходное положение" aria-label="Вернуть исходное положение">
                  <RotateCcw size={16} />
                </button>
              </>}
              <button type="button" className="ai-assistant-icon-button" onClick={clearHistory} title="Очистить историю чата" aria-label="Очистить историю чата">
                <Eraser size={17} />
              </button>
              <button type="button" className="ai-assistant-icon-button" onClick={closeChat} aria-label="Закрыть чат с AI-ассистентом">
                <X size={19} />
              </button>
            </div>
          </header>

          <div
            ref={messagesRef}
            className="ai-assistant-messages"
            aria-label="История сообщений"
            onScroll={handleMessagesScroll}
          >
            {messages.map(message => (
              <article className={`ai-message ai-message--${message.role}`} key={message.id}>
                <div className="ai-message-bubble"><MessageContent content={message.content} /></div>
                {message.actions && message.actions.length > 0 && (
                  <div className="ai-message-actions">
                    {message.actions.map(action => <a href={action.href} target={action.href.startsWith('http') ? '_blank' : undefined} rel={action.href.startsWith('http') ? 'noreferrer' : undefined} key={`${message.id}-${action.href}`}>{action.label}</a>)}
                  </div>
                )}
                <time dateTime={message.timestamp}>{formatTime(message.timestamp)}</time>
              </article>
            ))}
            {isTyping && <div className="ai-assistant-typing"><span /><span /><span />Ассистент печатает…</div>}
            {!hasUserMessage && !isTyping && (
              <div className="ai-assistant-quick-questions" aria-label="Быстрые вопросы">
                {quickQuestions.map(question => <button type="button" onClick={() => void sendMessage(question)} key={question}>{question}</button>)}
              </div>
            )}
            <div ref={endRef} />
          </div>

          <form className="ai-assistant-form" onSubmit={onSubmit}>
            <textarea
              ref={inputRef}
              value={draft}
              onChange={event => setDraft(event.target.value.slice(0, AI_ASSISTANT_MAX_MESSAGE_LENGTH))}
              onKeyDown={onInputKeyDown}
              placeholder="Напишите ваш вопрос…"
              aria-label="Сообщение для AI-ассистента"
              rows={1}
              maxLength={AI_ASSISTANT_MAX_MESSAGE_LENGTH}
            />
            <button type="submit" aria-label="Отправить сообщение" disabled={!draft.trim() || isTyping}><Send size={18} /></button>
          </form>
        </section>
      )}

      {!isOpen && <button
        ref={triggerRef}
        className="ai-assistant-trigger ai-assistant-trigger--right-center"
        type="button"
        onClick={openChat}
        aria-label="Открыть чат с AI-ассистентом"
        aria-expanded="false"
      >
        <Bot size={24} />
      </button>}
    </aside>
  )
}
