import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react'

type PeriodDays =
  | 7
  | 30
  | 90

const PERIOD_OPTIONS: readonly PeriodDays[] = [
  7,
  30,
  90,
]

type AnalyticsPayload = {
  periodDays: number

  summary: {
    ordersToday: number
    revenueToday: number
    averageOrderValueToday: number
    ordersMonth: number
    revenueMonth: number
  }

  salesByDay: Array<{
    date: string
    orders: number
    revenue: number
  }>

  customersByDay: Array<{
    date: string
    customers: number
  }>

  statuses: Array<{
    status: string
    orders: number
  }>

  delivery: Array<{
    method: string
    orders: number
  }>

  chatFunnel: Array<{
    key: string
    label: string
    count: number
  }>

  recommendationProducts: Array<{
    name: string
    clicks: number
    phoneLeads: number
    managerRequests: number
  }>

  topProducts: Array<{
    name: string
    quantity: number
    revenue: number
  }>
}

type LoadState =
  | {
      status: 'loading'
    }
  | {
      status: 'ready'
      payload: AnalyticsPayload
    }
  | {
      status: 'error'
      message: string
    }

const statusLabels:
  Record<string, string> = {
    new: 'Новые',
    confirmed: 'Подтверждены',
    processing: 'В работе',
    ready: 'Готовы',
    completed: 'Завершены',
    cancelled: 'Отменены',
  }

const deliveryLabels:
  Record<string, string> = {
    pickup: 'Самовывоз',
    delivery: 'Доставка',
    courier: 'Курьер',
    transport_company:
      'Транспортная компания',
    unknown: 'Не указано',
  }

const moneyFormatter =
  new Intl.NumberFormat(
    'ru-RU',
    {
      style: 'currency',
      currency: 'RUB',
      maximumFractionDigits: 0,
    },
  )

const numberFormatter =
  new Intl.NumberFormat('ru-RU', {
    maximumFractionDigits: 1,
  })

const shortDateFormatter =
  new Intl.DateTimeFormat(
    'ru-RU',
    {
      day: '2-digit',
      month: 'short',
    },
  )

function asDate(value: string) {
  return new Date(
    value.includes('T')
      ? value
      : `${value}T00:00:00`,
  )
}

function MetricCard({
  label,
  value,
  note,
}: {
  label: string
  value: string
  note: string
}) {
  return (
    <article className="native-analytics-metric">
      <p>{label}</p>
      <strong>{value}</strong>
      <span>{note}</span>
    </article>
  )
}

function BarChart({
  items,
  valueKey,
  labelKey,
  formatValue,
}: {
  items: Array<Record<string, unknown>>
  valueKey: string
  labelKey: string
  formatValue: (
    value: number,
  ) => string
}) {
  const maximum = Math.max(
    1,
    ...items.map(item =>
      Number(item[valueKey] ?? 0),
    ),
  )

  return (
    <div className="native-analytics-bars">
      {items.map((item, index) => {
        const value = Number(
          item[valueKey] ?? 0,
        )

        const label = String(
          item[labelKey] ?? '—',
        )

        return (
          <div
            className="native-analytics-bars__row"
            key={`${label}-${index}`}
          >
            <div className="native-analytics-bars__labels">
              <span>{label}</span>
              <strong>
                {formatValue(value)}
              </strong>
            </div>

            <div className="native-analytics-bars__track">
              <span
                style={{
                  width:
                    `${Math.max(
                      value > 0 ? 3 : 0,
                      value / maximum * 100,
                    )}%`,
                }}
              />
            </div>
          </div>
        )
      })}
    </div>
  )
}

export function NativeSalesAnalytics() {
  const [period, setPeriod] =
    useState<PeriodDays>(30)

  const [state, setState] =
    useState<LoadState>({
      status: 'loading',
    })

  const load = useCallback(
    async (
      signal?: AbortSignal,
    ) => {
      setState({
        status: 'loading',
      })

      try {
        const response = await fetch(
          `/api/admin/native-analytics?days=${period}`,
          {
            credentials: 'include',
            signal,
            headers: {
              Accept: 'application/json',
            },
          },
        )

        if (!response.ok) {
          throw new Error(
            `HTTP ${response.status}`,
          )
        }

        const payload =
          await response.json()

        if (signal?.aborted) {
          return
        }

        setState({
          status: 'ready',
          payload,
        })
      } catch (error) {
        if (signal?.aborted) {
          return
        }

        setState({
          status: 'error',
          message:
            error instanceof Error
              ? error.message
              : 'Не удалось загрузить аналитику',
        })
      }
    },
    [period],
  )

  useEffect(() => {
    const controller =
      new AbortController()

    void load(controller.signal)

    return () => {
      controller.abort()
    }
  }, [load])

  const prepared = useMemo(() => {
    if (state.status !== 'ready') {
      return null
    }

    const payload = state.payload

    const revenueMaximum = Math.max(
      1,
      ...payload.salesByDay.map(
        item => item.revenue,
      ),
    )

    return {
      payload,

      revenueMaximum,

      statusItems:
        payload.statuses.map(item => ({
          label:
            statusLabels[item.status]
            ?? item.status,
          value: item.orders,
        })),

      deliveryItems:
        payload.delivery.map(item => ({
          label:
            deliveryLabels[item.method]
            ?? item.method,
          value: item.orders,
        })),
    }
  }, [state])

  return (
    <section className="native-analytics">
      <header className="native-analytics__toolbar">
        <div>
          <p>Коммерческие показатели</p>
          <h3>Продажи и товары</h3>
        </div>

        <div className="native-analytics__actions">
          <div
            className="native-analytics-period"
            aria-label="Период аналитики"
          >
            {PERIOD_OPTIONS.map(value => (
              <button
                type="button"
                key={value}
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

          <button
            type="button"
            className="native-analytics-refresh"
            onClick={() => void load()}
            disabled={
              state.status === 'loading'
            }
          >
            Обновить
          </button>
        </div>
      </header>

      {state.status === 'loading' && (
        <div className="native-analytics-state">
          Загружаем данные…
        </div>
      )}

      {state.status === 'error' && (
        <div
          className="native-analytics-state is-error"
          role="alert"
        >
          <strong>
            Не удалось загрузить данные
          </strong>

          <span>{state.message}</span>

          <button
            type="button"
            onClick={() => void load()}
          >
            Повторить
          </button>
        </div>
      )}

      {prepared && (
        <>
          <div className="native-analytics-metrics">
            <MetricCard
              label="Заказы сегодня"
              value={numberFormatter.format(
                prepared.payload
                  .summary.ordersToday,
              )}
              note="Без отменённых"
            />

            <MetricCard
              label="Выручка сегодня"
              value={moneyFormatter.format(
                prepared.payload
                  .summary.revenueToday,
              )}
              note="По активным заказам"
            />

            <MetricCard
              label="Средний чек"
              value={moneyFormatter.format(
                prepared.payload
                  .summary
                  .averageOrderValueToday,
              )}
              note="За текущий день"
            />

            <MetricCard
              label="Заказы за месяц"
              value={numberFormatter.format(
                prepared.payload
                  .summary.ordersMonth,
              )}
              note="С начала месяца"
            />

            <MetricCard
              label="Выручка за месяц"
              value={moneyFormatter.format(
                prepared.payload
                  .summary.revenueMonth,
              )}
              note="Без отменённых"
            />
          </div>

          <div className="native-analytics-grid">
            <article className="native-analytics-card native-analytics-card--wide">
              <header>
                <div>
                  <p>AI-консультант</p>
                  <h4>Этапы конверсии чата</h4>
                </div>

                <span>
                  Последние {period} дней
                </span>
              </header>

              <div className="native-chat-funnel">
                {prepared.payload.chatFunnel.map(
                  stage => {
                    const started = Math.max(
                      1,
                      prepared.payload.chatFunnel[0]?.count ?? 0,
                    )

                    return (
                      <div
                        className="native-chat-funnel__stage"
                        key={stage.key}
                      >
                        <span>{stage.label}</span>
                        <strong>
                          {numberFormatter.format(stage.count)}
                        </strong>
                        <small>
                          {stage.key === 'chat_started'
                            ? '100% базы'
                            : `${numberFormatter.format(
                                stage.count / started * 100,
                              )}% от начавших чат`}
                        </small>
                      </div>
                    )
                  },
                )}
              </div>
            </article>

            <article className="native-analytics-card native-analytics-card--wide">
              <header>
                <div>
                  <p>AI-рекомендации</p>
                  <h4>Какие товары приводят к лидам</h4>
                </div>

                <span>
                  Последние {period} дней
                </span>
              </header>

              <div className="native-recommendation-table">
                <div className="native-recommendation-table__head">
                  <span>Товар</span>
                  <span>Клики</span>
                  <span>Телефон</span>
                  <span>Менеджер</span>
                </div>

                {prepared.payload.recommendationProducts.length ? (
                  prepared.payload.recommendationProducts.map(
                    product => (
                      <div
                        className="native-recommendation-table__row"
                        key={product.name}
                      >
                        <span>{product.name}</span>
                        <strong>
                          {numberFormatter.format(product.clicks)}
                        </strong>
                        <strong>
                          {numberFormatter.format(product.phoneLeads)}
                        </strong>
                        <strong>
                          {numberFormatter.format(
                            product.managerRequests,
                          )}
                        </strong>
                      </div>
                    ),
                  )
                ) : (
                  <div className="native-recommendation-table__empty">
                    Пока нет кликов по рекомендациям AI.
                  </div>
                )}
              </div>
            </article>

            <article className="native-analytics-card native-analytics-card--wide">
              <header>
                <div>
                  <p>Динамика</p>
                  <h4>Выручка по дням</h4>
                </div>

                <span>
                  Последние {period} дней
                </span>
              </header>

              <div className="native-revenue-chart">
                {prepared.payload
                  .salesByDay
                  .map(item => (
                    <div
                      className="native-revenue-chart__column"
                      key={item.date}
                      title={
                        `${shortDateFormatter.format(
                          asDate(item.date),
                        )}: `
                        + moneyFormatter.format(
                          item.revenue,
                        )
                      }
                    >
                      <div className="native-revenue-chart__bar-wrap">
                        <span
                          className="native-revenue-chart__bar"
                          style={{
                            height:
                              `${Math.max(
                                item.revenue > 0
                                  ? 4
                                  : 0,
                                item.revenue
                                / prepared
                                  .revenueMaximum
                                * 100,
                              )}%`,
                          }}
                        />
                      </div>

                      <small>
                        {shortDateFormatter
                          .format(
                            asDate(item.date),
                          )}
                      </small>
                    </div>
                  ))}
              </div>
            </article>

            <article className="native-analytics-card">
              <header>
                <div>
                  <p>CRM</p>
                  <h4>Заказы по статусам</h4>
                </div>
              </header>

              <BarChart
                items={
                  prepared.statusItems
                }
                labelKey="label"
                valueKey="value"
                formatValue={value =>
                  numberFormatter.format(
                    value,
                  )
                }
              />
            </article>

            <article className="native-analytics-card">
              <header>
                <div>
                  <p>Логистика</p>
                  <h4>Способы получения</h4>
                </div>
              </header>

              <BarChart
                items={
                  prepared.deliveryItems
                }
                labelKey="label"
                valueKey="value"
                formatValue={value =>
                  numberFormatter.format(
                    value,
                  )
                }
              />
            </article>

            <article className="native-analytics-card native-analytics-card--wide">
              <header>
                <div>
                  <p>Ассортимент</p>
                  <h4>Популярные товары</h4>
                </div>

                <span>
                  По сумме заказов
                </span>
              </header>

              <div className="native-products-table">
                <div className="native-products-table__head">
                  <span>Товар</span>
                  <span>Количество</span>
                  <span>Сумма</span>
                </div>

                {prepared.payload
                  .topProducts
                  .length ? (
                    prepared.payload
                      .topProducts
                      .map(
                        (
                          product,
                          index,
                        ) => (
                          <div
                            className="native-products-table__row"
                            key={
                              product.name
                            }
                          >
                            <span>
                              <i>
                                {String(
                                  index + 1,
                                ).padStart(
                                  2,
                                  '0',
                                )}
                              </i>

                              {product.name}
                            </span>

                            <strong>
                              {numberFormatter
                                .format(
                                  product
                                    .quantity,
                                )}
                            </strong>

                            <strong>
                              {moneyFormatter
                                .format(
                                  product
                                    .revenue,
                                )}
                            </strong>
                          </div>
                        ),
                      )
                  ) : (
                    <div className="native-products-table__empty">
                      Пока нет данных
                    </div>
                  )}
              </div>
            </article>
          </div>

          <footer className="native-analytics__footer">
            <span>
              Данные обновляются из PostgreSQL OZELIF
            </span>

            <a
              href="http://127.0.0.1:3000/dashboard/2-ozelif-prodazh"
              target="_blank"
              rel="noreferrer"
            >
              Открыть расширенную аналитику
            </a>
          </footer>
        </>
      )}
    </section>
  )
}
