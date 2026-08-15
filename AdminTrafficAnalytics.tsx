import {
  Activity,
  Eye,
  RefreshCw,
  Users,
} from 'lucide-react'
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react'
import {
  adminApiV2,
  type TrafficAnalytics,
} from './adminApiV2'

function metric(value: number | undefined) {
  return Number(value ?? 0).toLocaleString('ru-RU')
}

function dayLabel(value: string) {
  return new Intl.DateTimeFormat('ru-RU', {
    day: '2-digit',
    month: 'short',
  }).format(new Date(`${value}T12:00:00`))
}

export function AdminTrafficAnalytics() {
  const [data, setData] = useState<TrafficAnalytics | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    try {
      setError('')
      setData(await adminApiV2.trafficAnalytics())
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : 'Не удалось загрузить аналитику',
      )
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()

    const timer = window.setInterval(() => {
      void load()
    }, 15_000)

    return () => window.clearInterval(timer)
  }, [load])

  const maxViews = useMemo(
    () => Math.max(
      1,
      ...(data?.daily.map(item => Number(item.page_views)) ?? []),
    ),
    [data],
  )
  const funnelStart = Number(data?.funnel[0]?.sessions ?? 0)

  return (
    <section className="admin-traffic">
      <header className="admin-section-head">
        <div>
          <p className="admin-eyebrow">Посещаемость сайта</p>
          <h2>Аналитика посетителей</h2>
          <p>
            Онлайн обновляется каждые 15 секунд. Посетитель считается
            активным, если сайт отправлял сигнал в последние 90 секунд.
          </p>
        </div>

        <button
          type="button"
          onClick={() => void load()}
          disabled={loading}
        >
          <RefreshCw size={16} />
          Обновить
        </button>
      </header>

      {error ? (
        <div className="admin-traffic-error">{error}</div>
      ) : null}

      <div className="admin-traffic-metrics">
        <article className="is-online">
          <Activity size={21} />
          <span>Сейчас на сайте</span>
          <strong>{metric(data?.summary.online_now)}</strong>
          <small>
            Активность за последние 90 секунд
          </small>
        </article>

        <article>
          <Users size={21} />
          <span>Посетители сегодня</span>
          <strong>{metric(data?.summary.visitors_today)}</strong>
          <small>Уникальные браузеры за сегодня</small>
        </article>

        <article>
          <Eye size={21} />
          <span>Просмотры сегодня</span>
          <strong>{metric(data?.summary.page_views_today)}</strong>
          <small>Открытия страниц с начала дня</small>
        </article>

        <article>
          <Users size={21} />
          <span>Посетители за 7 дней</span>
          <strong>{metric(data?.summary.visitors_7d)}</strong>
          <small>
            {metric(data?.summary.page_views_7d)} просмотров
          </small>
        </article>
      </div>

      <article className="admin-card admin-traffic-chart">
        <header>
          <div>
            <p className="admin-eyebrow">Последние семь дней</p>
            <h2>Посетители и просмотры</h2>
          </div>

          {data?.generatedAt ? (
            <small>
              Обновлено{' '}
              {new Date(data.generatedAt).toLocaleTimeString('ru-RU', {
                hour: '2-digit',
                minute: '2-digit',
              })}
            </small>
          ) : null}
        </header>

        {loading && !data ? (
          <div className="admin-traffic-loading">Загрузка…</div>
        ) : (
          <div className="admin-traffic-bars">
            {data?.daily.map(item => (
              <div className="admin-traffic-day" key={item.date}>
                <div className="admin-traffic-bar-area">
                  <div
                    className="admin-traffic-bar"
                    style={{
                      height: `${
                        Math.max(
                          5,
                          Number(item.page_views) / maxViews * 100,
                        )
                      }%`,
                    }}
                    title={`${item.page_views} просмотров`}
                  >
                    <span>{metric(item.page_views)}</span>
                  </div>
                </div>

                <strong>{metric(item.visitors)}</strong>
                <small>{dayLabel(item.date)}</small>
              </div>
            ))}
          </div>
        )}

        <footer>
          <span><i /> Столбец — просмотры страниц</span>
          <span>Число под столбцом — посетители</span>
        </footer>
      </article>

      <article className="admin-card admin-traffic-funnel">
        <header>
          <div>
            <p className="admin-eyebrow">Сегодня</p>
            <h2>Воронка заявки</h2>
          </div>
          <small>Уникальные браузерные сессии</small>
        </header>

        <ol>
          {data?.funnel.map(stage => {
            const sessions = Number(stage.sessions)
            const conversion = funnelStart > 0
              ? Math.round(sessions / funnelStart * 100)
              : 0

            return (
              <li key={stage.position}>
                <span>{stage.position}</span>
                <strong>{stage.stage}</strong>
                <b>{metric(sessions)}</b>
                <small>{conversion}% от просмотров сайта</small>
              </li>
            )
          })}
        </ol>
        <p>
          «Заявка сохранена» учитывается только после успешного ответа
          backend — не по нажатию кнопки.
        </p>
      </article>
    </section>
  )
}
