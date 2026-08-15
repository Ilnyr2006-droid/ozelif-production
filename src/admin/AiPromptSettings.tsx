
import { useEffect, useMemo, useState } from 'react'
import './ai-prompt-settings.css'

type PromptVersion = {
  id: string
  version: number
  status: 'draft' | 'published' | 'archived'
  content: string
  notes: string | null
  createdBy: string | null
  createdAt: string | null
  publishedAt?: string | null
}

type PromptPayload = {
  published: PromptVersion
  versions: PromptVersion[]
  protectedCore: string
  limits: {
    minCharacters: number
    maxCharacters: number
  }
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
    throw new Error(
      body?.error
        ?? body?.message
        ?? `HTTP ${response.status}`,
    )
  }

  return body as T
}

function formatDate(value: string | null | undefined) {
  if (!value) return '—'

  return new Intl.DateTimeFormat('ru-RU', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value))
}

export function AiPromptSettings() {
  const [open, setOpen] = useState(false)
  const [payload, setPayload] = useState<PromptPayload | null>(null)
  const [content, setContent] = useState('')
  const [notes, setNotes] = useState('')
  const [testQuestion, setTestQuestion] = useState(
    'Где находится магазин и как связаться с менеджером?',
  )
  const [testAnswer, setTestAnswer] = useState('')
  const [loading, setLoading] = useState(false)
  const [testing, setTesting] = useState(false)
  const [error, setError] = useState('')

  const characters = content.length
  const limits = useMemo(() => payload?.limits ?? {
    minCharacters: 500,
    maxCharacters: 60_000,
  }, [payload?.limits])

  const canSave = useMemo(
    () => (
      characters >= limits.minCharacters
      && characters <= limits.maxCharacters
      && !loading
    ),
    [characters, limits, loading],
  )

  async function loadPrompt() {
    setLoading(true)
    setError('')

    try {
      const result = await requestJson<{
        ok: true
      } & PromptPayload>('/api/admin/ai-prompt')

      setPayload(result)
      setContent(result.published.content)
      setNotes('')
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : 'Не удалось загрузить промпт.',
      )
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (open && !payload && !loading) {
      void loadPrompt()
    }
  }, [open, payload, loading])

  async function saveDraft() {
    if (!canSave) return
    setLoading(true)
    setError('')

    try {
      await requestJson('/api/admin/ai-prompt/draft', {
        method: 'POST',
        body: JSON.stringify({ content, notes }),
      })
      await loadPrompt()
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : 'Не удалось сохранить черновик.',
      )
      setLoading(false)
    }
  }

  async function publishPrompt() {
    if (!canSave) return

    const confirmed = window.confirm(
      'Опубликовать эту версию? Она начнёт использоваться ботом без перезапуска сервера.',
    )

    if (!confirmed) return

    setLoading(true)
    setError('')

    try {
      await requestJson('/api/admin/ai-prompt/publish', {
        method: 'POST',
        body: JSON.stringify({ content, notes }),
      })
      await loadPrompt()
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : 'Не удалось опубликовать промпт.',
      )
      setLoading(false)
    }
  }

  async function rollback(version: PromptVersion) {
    const confirmed = window.confirm(
      `Создать и опубликовать новую версию на основе версии №${version.version}?`,
    )

    if (!confirmed) return

    setLoading(true)
    setError('')

    try {
      await requestJson(
        `/api/admin/ai-prompt/versions/${version.id}/rollback`,
        { method: 'POST', body: '{}' },
      )
      await loadPrompt()
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : 'Не удалось выполнить откат.',
      )
      setLoading(false)
    }
  }

  async function testPrompt() {
    const question = testQuestion.trim()
    if (!question) return

    setTesting(true)
    setTestAnswer('')
    setError('')

    try {
      const result = await requestJson<{
        reply: string
      }>('/api/assistant', {
        method: 'POST',
        body: JSON.stringify({
          messages: [{ role: 'user', content: question }],
          path: '/admin/ai-prompt-test',
        }),
      })

      setTestAnswer(result.reply)
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : 'Не удалось получить тестовый ответ.',
      )
    } finally {
      setTesting(false)
    }
  }

  return (
    <>
      <button
        className="ai-prompt-launcher"
        type="button"
        onClick={() => setOpen(true)}
      >
        AI-промпт
      </button>

      {open ? (
        <div
          className="ai-prompt-overlay"
          role="dialog"
          aria-modal="true"
          aria-label="Системный промпт AI-консультанта"
        >
          <div className="ai-prompt-modal">
            <header className="ai-prompt-header">
              <div>
                <span className="ai-prompt-eyebrow">AI-консультант</span>
                <h2>Системный промпт</h2>
                <p>
                  Опубликованная версия применяется ботом автоматически.
                  Защищённое ядро нельзя удалить через админку.
                </p>
              </div>

              <button
                className="ai-prompt-close"
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Закрыть"
              >
                ×
              </button>
            </header>

            {error ? (
              <div className="ai-prompt-error">{error}</div>
            ) : null}

            <div className="ai-prompt-layout">
              <main className="ai-prompt-editor-column">
                <div className="ai-prompt-toolbar">
                  <div>
                    <strong>
                      Версия №{payload?.published.version ?? '—'}
                    </strong>
                    <span>
                      Опубликована:
                      {' '}
                      {formatDate(payload?.published.publishedAt)}
                    </span>
                  </div>

                  <div
                    className={
                      characters < limits.minCharacters
                      || characters > limits.maxCharacters
                        ? 'ai-prompt-counter is-invalid'
                        : 'ai-prompt-counter'
                    }
                  >
                    {characters.toLocaleString('ru-RU')}
                    {' / '}
                    {limits.maxCharacters.toLocaleString('ru-RU')}
                  </div>
                </div>

                <textarea
                  className="ai-prompt-textarea"
                  value={content}
                  onChange={event => setContent(event.target.value)}
                  disabled={loading}
                  spellCheck
                />

                <label className="ai-prompt-notes">
                  <span>Комментарий к версии</span>
                  <input
                    value={notes}
                    onChange={event => setNotes(event.target.value)}
                    placeholder="Например: обновлены условия производства"
                    maxLength={1000}
                  />
                </label>

                <div className="ai-prompt-actions">
                  <button
                    type="button"
                    className="ai-prompt-button is-secondary"
                    onClick={() => void saveDraft()}
                    disabled={!canSave}
                  >
                    Сохранить черновик
                  </button>

                  <button
                    type="button"
                    className="ai-prompt-button is-primary"
                    onClick={() => void publishPrompt()}
                    disabled={!canSave}
                  >
                    Опубликовать
                  </button>
                </div>

                <section className="ai-prompt-test">
                  <div>
                    <h3>Тестовый вопрос</h3>
                    <p>
                      Проверяет уже опубликованную версию, а не несохранённый текст.
                    </p>
                  </div>

                  <textarea
                    value={testQuestion}
                    onChange={event => setTestQuestion(event.target.value)}
                    rows={3}
                  />

                  <button
                    type="button"
                    className="ai-prompt-button is-secondary"
                    onClick={() => void testPrompt()}
                    disabled={testing || !testQuestion.trim()}
                  >
                    {testing ? 'Проверяем…' : 'Задать вопрос боту'}
                  </button>

                  {testAnswer ? (
                    <div className="ai-prompt-answer">
                      {testAnswer}
                    </div>
                  ) : null}
                </section>
              </main>

              <aside className="ai-prompt-sidebar">
                <details>
                  <summary>Защищённое ядро</summary>
                  <pre>{payload?.protectedCore}</pre>
                </details>

                <section>
                  <h3>История версий</h3>

                  <div className="ai-prompt-history">
                    {payload?.versions.map(version => (
                      <article
                        className="ai-prompt-version"
                        key={version.id}
                      >
                        <div>
                          <strong>№{version.version}</strong>
                          <span
                            className={`status-${version.status}`}
                          >
                            {version.status}
                          </span>
                        </div>

                        <p>
                          {version.notes || 'Без комментария'}
                        </p>

                        <small>
                          {formatDate(
                            version.publishedAt ?? version.createdAt,
                          )}
                        </small>

                        {version.status !== 'published' ? (
                          <button
                            type="button"
                            onClick={() => void rollback(version)}
                            disabled={loading}
                          >
                            Откатиться к этой версии
                          </button>
                        ) : null}
                      </article>
                    ))}
                  </div>
                </section>
              </aside>
            </div>
          </div>
        </div>
      ) : null}
    </>
  )
}
