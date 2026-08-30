import {
  useCallback,
  useEffect,
  useState,
} from 'react'

import './AdminAiMonitoring.css'

type Period =
  | 7
  | 30
  | 90

type Payload = {
  periodDays: number
  runtime: {
    requests: number
    fallbacks: number
    fallbackRate: number
    emptyRetries: number
    incompleteRetries: number
    averageLatencyMs: number
    p95LatencyMs: number
    inputTokens: number
    cachedInputTokens: number
    outputTokens: number
    reasoningTokens: number
    totalTokens: number
    estimatedCostUsd: number
    recommendationResponses: number
    recommendationRate: number
  }
  funnel: {
    conversations: number
    recommendationClicks: number
    recommendationClickRate: number
    contacts: number
    contactRate: number
    managerRequests: number
    managerRequestRate: number
    orders: number
    orderRate: number
  }
  models: Array<{
    model: string
    promptVersion: number | null
    channel: string
    requests: number
  }>
  latestEval: null | {
    id: string
    status: string
    model: string | null
    prompt_version: number | null
    scenario_count: number
    passed_count: number
    failed_count: number
    avg_latency_ms: number
    input_tokens: number
    output_tokens: number
    estimated_cost_usd: number
    started_at: string
    completed_at: string | null
  }
  latestEvalFailures: Array<{
    scenario_key: string
    category: string
    reply: string | null
    checks: Record<string, unknown>
    latency_ms: number
  }>
}

const periods: readonly Period[] = [
  7,
  30,
  90,
]

const number =
  new Intl.NumberFormat(
    'ru-RU',
    {
      maximumFractionDigits: 1,
    },
  )

const integer =
  new Intl.NumberFormat(
    'ru-RU',
    {
      maximumFractionDigits: 0,
    },
  )

function usd(value: number) {
  return `$${Number(value || 0).toFixed(4)}`
}

function seconds(value: number) {
  return `${(
    Number(value || 0)
    / 1000
  ).toFixed(2)} с`
}

function Metric({
  label,
  value,
  note,
}: {
  label: string
  value: string
  note: string
}) {
  return (
    <article className="ai-monitor-card">
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{note}</small>
    </article>
  )
}

export function AdminAiMonitoring() {
  const [period, setPeriod] =
    useState<Period>(30)

  const [payload, setPayload] =
    useState<Payload | null>(null)

  const [error, setError] =
    useState('')

  const [loading, setLoading] =
    useState(true)

  const load = useCallback(
    async (
      signal?: AbortSignal,
    ) => {
      setLoading(true)
      setError('')

      try {
        const response =
          await fetch(
            `/api/admin/ai-monitoring?days=${period}`,
            {
              credentials:
                'include',
              signal,
              headers: {
                Accept:
                  'application/json',
              },
            },
          )

        if (!response.ok) {
          throw new Error(
            `HTTP ${response.status}`,
          )
        }

        const next =
          await response.json()

        if (!signal?.aborted) {
          setPayload(next)
        }
      } catch (requestError) {
        if (
          !signal?.aborted
        ) {
          setError(
            requestError
              instanceof Error
              ? requestError.message
              : 'Не удалось загрузить AI-метрики',
          )
        }
      } finally {
        if (!signal?.aborted) {
          setLoading(false)
        }
      }
    },
    [period],
  )

  useEffect(() => {
    const controller =
      new AbortController()

    void load(
      controller.signal,
    )

    return () =>
      controller.abort()
  }, [load])

  if (loading && !payload) {
    return (
      <div className="ai-monitor-state">
        Загружаем AI-метрики…
      </div>
    )
  }

  if (error && !payload) {
    return (
      <div className="ai-monitor-state is-error">
        {error}
      </div>
    )
  }

  if (!payload) return null

  const runtime =
    payload.runtime
  const funnel =
    payload.funnel
  const evalRun =
    payload.latestEval

  return (
    <section className="ai-monitor">
      <header className="ai-monitor-head">
        <div>
          <p>AI runtime</p>
          <h3>
            Luna · качество и стоимость
          </h3>
          <span>
            Продовые запросы, токены,
            задержка, fallback и конверсии.
          </span>
        </div>

        <div className="ai-monitor-period">
          {periods.map(value => (
            <button
              key={value}
              type="button"
              className={
                period === value
                  ? 'is-active'
                  : ''
              }
              onClick={() =>
                setPeriod(value)
              }
            >
              {value} дней
            </button>
          ))}
        </div>
      </header>

      <div className="ai-monitor-grid">
        <Metric
          label="Ответов AI"
          value={
            integer.format(
              runtime.requests,
            )
          }
          note={
            `${runtime.fallbacks} fallback · `
            + `${runtime.fallbackRate}%`
          }
        />

        <Metric
          label="Среднее время"
          value={
            seconds(
              runtime.averageLatencyMs,
            )
          }
          note={
            `p95 ${seconds(
              runtime.p95LatencyMs,
            )}`
          }
        />

        <Metric
          label="Входные токены"
          value={
            integer.format(
              runtime.inputTokens,
            )
          }
          note={
            `${integer.format(
              runtime.cachedInputTokens,
            )} cached`
          }
        />

        <Metric
          label="Выходные токены"
          value={
            integer.format(
              runtime.outputTokens,
            )
          }
          note={
            `${integer.format(
              runtime.reasoningTokens,
            )} reasoning`
          }
        />

        <Metric
          label="Оценочная стоимость"
          value={
            usd(
              runtime.estimatedCostUsd,
            )
          }
          note={
            `${integer.format(
              runtime.totalTokens,
            )} total tokens`
          }
        />

        <Metric
          label="Retry"
          value={
            integer.format(
              runtime.emptyRetries
              + runtime.incompleteRetries,
            )
          }
          note={
            `${runtime.emptyRetries} empty · `
            + `${runtime.incompleteRetries} incomplete`
          }
        />

        <Metric
          label="Рекомендации"
          value={
            `${runtime.recommendationRate}%`
          }
          note={
            `${runtime.recommendationResponses} ответов`
          }
        />

        <Metric
          label="Заказы из AI"
          value={
            `${funnel.orderRate}%`
          }
          note={
            `${funnel.orders} из `
            + `${funnel.conversations} чатов`
          }
        />
      </div>

      <div className="ai-monitor-columns">
        <article className="ai-monitor-panel">
          <header>
            <h4>
              AI-воронка
            </h4>
            <span>
              Уникальные AI-чаты
            </span>
          </header>

          {[
            [
              'Клик по рекомендации',
              funnel
                .recommendationClicks,
              funnel
                .recommendationClickRate,
            ],
            [
              'Оставили контакт',
              funnel.contacts,
              funnel.contactRate,
            ],
            [
              'Запросили менеджера',
              funnel.managerRequests,
              funnel.managerRequestRate,
            ],
            [
              'Создали заказ',
              funnel.orders,
              funnel.orderRate,
            ],
          ].map(
            ([
              label,
              count,
              rate,
            ]) => (
              <div
                className="ai-monitor-funnel-row"
                key={String(label)}
              >
                <span>
                  {label}
                </span>
                <strong>
                  {integer.format(
                    Number(count),
                  )}
                  {' · '}
                  {number.format(
                    Number(rate),
                  )}%
                </strong>
              </div>
            ),
          )}
        </article>

        <article className="ai-monitor-panel">
          <header>
            <h4>
              Модель и промпт
            </h4>
            <span>
              Что реально работало
            </span>
          </header>

          {payload.models.length
            ? payload.models.map(
                item => (
                  <div
                    className="ai-monitor-model"
                    key={
                      `${item.model}-`
                      + `${item.promptVersion}-`
                      + item.channel
                    }
                  >
                    <b>
                      {item.model}
                    </b>
                    <span>
                      prompt v{
                        item.promptVersion
                        ?? '—'
                      }
                      {' · '}
                      {item.channel}
                      {' · '}
                      {item.requests}
                    </span>
                  </div>
                ),
              )
            : (
                <p>
                  Пока нет AI-запросов
                  за выбранный период.
                </p>
              )}
        </article>
      </div>

      <article className="ai-monitor-panel ai-monitor-eval">
        <header>
          <div>
            <h4>
              Последний real-model eval
            </h4>
            <span>
              Сценарии действительно
              вызывают Luna через
              /api/assistant.
            </span>
          </div>
        </header>

        {evalRun ? (
          <>
            <div className="ai-monitor-eval-summary">
              <strong>
                {evalRun.passed_count}
                /
                {evalRun.scenario_count}
              </strong>

              <span>
                {evalRun.status}
                {' · '}
                {seconds(
                  Number(
                    evalRun
                      .avg_latency_ms,
                  ),
                )}
                {' avg · '}
                {usd(
                  Number(
                    evalRun
                      .estimated_cost_usd,
                  ),
                )}
              </span>
            </div>

            {payload
              .latestEvalFailures
              .length > 0 && (
              <div className="ai-monitor-failures">
                {payload
                  .latestEvalFailures
                  .map(item => (
                    <details
                      key={
                        item.scenario_key
                      }
                    >
                      <summary>
                        {item.scenario_key}
                        {' · '}
                        {item.category}
                      </summary>
                      <pre>
                        {item.reply
                          ?? 'Нет ответа'}
                      </pre>
                    </details>
                  ))}
              </div>
            )}
          </>
        ) : (
          <p>
            Полный eval ещё не запускался.
          </p>
        )}
      </article>
    </section>
  )
}
