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

const filterLabels: Record<string, string> = {
  subtype: 'Тип',
  color: 'Цвет',
  material: 'Материал',
  thickness: 'Толщина',
  brand: 'Бренд',
  tapeColor: 'Цвет тесьмы',
  metalColor: 'Цвет металла',
  length: 'Длина',
  country: 'Страна',
  sort: 'Сортировка',
}

const contactLabels = {
  whatsapp: 'WhatsApp',
  telegram: 'Telegram',
  phone: 'Телефон',
  route: 'Построить маршрут',
}

export function VisitorTrafficAnalytics() {
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
            <h2>Воронка каталога и заявок</h2>
          </div>
          <small>Уникальные браузеры на каждом этапе</small>
        </header>

        <ol>
          {data?.funnel.map((stage, index) => {
            const previous = index > 0
              ? Number(data.funnel[index - 1]?.sessions ?? 0)
              : null
            const sessions = Number(stage.sessions)
            const conversion = previous && previous > 0
              ? Math.round(sessions / previous * 100)
              : null

            return (
              <li key={stage.event_name}>
                <span>{index + 1}</span>
                <strong>{stage.label}</strong>
                <b>{metric(sessions)}</b>
                <small>
                  {conversion === null
                    ? 'Старт воронки'
                    : `${conversion}% от прошлого этапа`}
                </small>
              </li>
            )
          })}
        </ol>

        <p>
          Успешной считается только заявка, которую backend сохранил в PostgreSQL.
          Нажатие кнопки без ответа сервера в этот этап не попадает.
        </p>
      </article>

      <article className="admin-card admin-demand">
        <header>
          <div>
            <p className="admin-eyebrow">Последние 30 дней</p>
            <h2>Спрос на каталог</h2>
          </div>
          <small>
            Просмотры, добавления в корзину и реальные заявки из PostgreSQL
          </small>
        </header>

        <section className="admin-demand-products">
          <div>
            <h3>Товары по спросу</h3>
            <p>Какие материалы смотрят и добавляют в корзину чаще всего.</p>
          </div>

          {data?.demand.products.length ? (
            <div className="admin-demand-table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Товар</th>
                    <th>Категория</th>
                    <th>Просмотры</th>
                    <th>В корзину</th>
                    <th>Заявки</th>
                  </tr>
                </thead>
                <tbody>
                  {data.demand.products.map(product => (
                    <tr key={product.product_id}>
                      <td>{product.product_name}</td>
                      <td>{product.category_name}</td>
                      <td>{metric(product.views)}</td>
                      <td>{metric(product.cart_adds)}</td>
                      <td>
                        {Number(product.requests) > 0 ? (
                          metric(product.requests)
                        ) : (
                          <span className="admin-demand-zero">Без заявок</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="admin-demand-empty">
              Данные появятся после новых просмотров товаров.
            </p>
          )}
        </section>

        <div className="admin-demand-grid">
          <section>
            <h3>Смотрят, но не оформляют</h3>
            <ul>
              {data?.demand.products
                .filter(item => Number(item.requests) === 0)
                .slice(0, 8)
                .map(item => (
                  <li key={item.product_id}>
                    <span>{item.product_name}</span>
                    <b>{metric(item.views)}</b>
                    <small>{metric(item.cart_adds)} добавлений в корзину</small>
                  </li>
                ))}
            </ul>
            {!data?.demand.products.some(
              item => Number(item.requests) === 0,
            ) ? (
              <p className="admin-demand-empty">Таких товаров пока нет.</p>
            ) : null}
          </section>

          <section>
            <h3>Популярные категории</h3>
            <ul>
              {data?.demand.categories.map(item => (
                <li key={item.category_slug}>
                  <span>{item.category_name}</span>
                  <b>{metric(item.views)}</b>
                  <small>{metric(item.viewers)} посетителей</small>
                </li>
              ))}
            </ul>
            {!data?.demand.categories.length ? (
              <p className="admin-demand-empty">Пока нет данных.</p>
            ) : null}
          </section>

          <section>
            <h3>Используемые фильтры</h3>
            <ul>
              {data?.demand.filters.map(item => (
                <li key={`${item.category_slug}-${item.filter}-${item.value}`}>
                  <span>
                    {filterLabels[item.filter] ?? item.filter}: {item.value}
                  </span>
                  <b>{metric(item.uses)}</b>
                  <small>{item.category_slug}</small>
                </li>
              ))}
            </ul>
            {!data?.demand.filters.length ? (
              <p className="admin-demand-empty">Пока нет данных.</p>
            ) : null}
          </section>

          <section>
            <h3>Поиск без результатов</h3>
            <ul>
              {data?.demand.emptySearches.map(item => (
                <li key={`${item.category_slug}-${item.query}`}>
                  <span>«{item.query}»</span>
                  <b>{metric(item.searches)}</b>
                  <small>{item.category_slug}</small>
                </li>
              ))}
            </ul>
            {!data?.demand.emptySearches.length ? (
              <p className="admin-demand-empty">Пока нет данных.</p>
            ) : null}
          </section>

          <section>
            <h3>Контактные действия</h3>
            <ul>
              {data?.demand.contacts.map(item => (
                <li key={item.channel}>
                  <span>{contactLabels[item.channel] ?? item.channel}</span>
                  <b>{metric(item.clicks)}</b>
                  <small>{metric(item.users)} посетителей</small>
                </li>
              ))}
            </ul>
            {!data?.demand.contacts.length ? (
              <p className="admin-demand-empty">Пока нет данных.</p>
            ) : null}
          </section>
        </div>
      </article>
    </section>
  )
}
