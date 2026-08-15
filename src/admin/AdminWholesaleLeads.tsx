import {
  RefreshCw,
  Search,
  Trash2,
} from 'lucide-react'
import {
  useCallback,
  useEffect,
  useState,
} from 'react'
import {
  adminApiV2,
  type WholesaleLead,
} from './adminApiV2'

const statusLabels: Record<string, string> = {
  new: 'Новая',
  contacted: 'Связались',
  qualified: 'Квалифицирована',
  completed: 'Завершена',
  cancelled: 'Отменена',
}

const statusOptions = Object.entries(statusLabels)

function formatDate(value: string) {
  return new Date(value).toLocaleString('ru-RU', {
    dateStyle: 'short',
    timeStyle: 'short',
  })
}

function optional(value: string | null | undefined) {
  return value?.trim() || '—'
}

export function AdminWholesaleLeads() {
  const [items, setItems] = useState<WholesaleLead[]>([])
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState('')
  const [newCount, setNewCount] = useState(0)
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [pendingId, setPendingId] = useState<string | null>(
    null,
  )
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')

    try {
      const result = await adminApiV2.wholesaleLeads(
        query,
        status,
      )

      setItems(result.items)
      setTotal(result.total)
      setNewCount(result.newCount)
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : 'Не удалось загрузить заявки',
      )
    } finally {
      setLoading(false)
    }
  }, [query, status])

  useEffect(() => {
    void load()
  }, [load])

  async function updateStatus(
    item: WholesaleLead,
    nextStatus: string,
  ) {
    setPendingId(item.id)
    setError('')

    try {
      const result =
        await adminApiV2.updateWholesaleLeadStatus(
          item.id,
          nextStatus,
        )

      setItems(current =>
        current.map(currentItem =>
          currentItem.id === item.id
            ? result.item
            : currentItem,
        ),
      )

      if (item.status === 'new' && nextStatus !== 'new') {
        setNewCount(current => Math.max(0, current - 1))
      }

      if (item.status !== 'new' && nextStatus === 'new') {
        setNewCount(current => current + 1)
      }
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : 'Не удалось изменить статус',
      )
    } finally {
      setPendingId(null)
    }
  }

  async function remove(item: WholesaleLead) {
    const confirmed = window.confirm(
      `Удалить заявку от «${item.name}»?`,
    )

    if (!confirmed) return

    setPendingId(item.id)
    setError('')

    try {
      await adminApiV2.deleteWholesaleLead(item.id)

      setItems(current =>
        current.filter(currentItem => currentItem.id !== item.id),
      )

      setTotal(current => Math.max(0, current - 1))

      if (item.status === 'new') {
        setNewCount(current => Math.max(0, current - 1))
      }
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : 'Не удалось удалить заявку',
      )
    } finally {
      setPendingId(null)
    }
  }

  return (
    <section className="admin-card admin-table-card">
      <header className="admin-section-head">
        <div>
          <p className="admin-eyebrow">CRM</p>
          <h2>Оптовые заявки</h2>
          <p>
            Всего: {total}
            {' · '}
            Новых: {newCount}
          </p>
        </div>

        <button
          className="admin-primary-button"
          onClick={() => void load()}
          disabled={loading}
        >
          <RefreshCw size={17} />
          Обновить
        </button>
      </header>

      {error && (
        <div className="admin-global-error">
          {error}
        </div>
      )}

      <div className="admin-v2-toolbar">
        <div className="admin-search">
          <Search size={17} />

          <input
            value={query}
            onChange={event => setQuery(event.target.value)}
            placeholder="Имя, телефон, компания или город"
            onKeyDown={event => {
              if (event.key === 'Enter') {
                void load()
              }
            }}
          />
        </div>

        <select
          value={status}
          onChange={event => setStatus(event.target.value)}
        >
          <option value="">Все статусы</option>

          {statusOptions.map(([value, label]) => (
            <option value={value} key={value}>
              {label}
            </option>
          ))}
        </select>

        <button onClick={() => void load()}>
          <Search size={16} />
          Найти
        </button>
      </div>

      {loading ? (
        <div className="admin-v2-leads-empty">
          Загружаем заявки…
        </div>
      ) : items.length === 0 ? (
        <div className="admin-v2-leads-empty">
          Заявок пока нет.
        </div>
      ) : (
        <div className="admin-v2-leads-list">
          {items.map(item => (
            <article
              className={`admin-v2-lead-card ${
                item.status === 'new' ? 'is-new' : ''
              }`}
              key={item.id}
            >
              <header>
                <div>
                  <span>
                    {formatDate(item.created_at)}
                  </span>

                  {item.status === 'new' && (
                    <b>Новая заявка</b>
                  )}
                </div>

                <select
                  value={item.status}
                  disabled={pendingId === item.id}
                  onChange={event =>
                    void updateStatus(
                      item,
                      event.target.value,
                    )
                  }
                  aria-label={`Статус заявки от ${item.name}`}
                >
                  {statusOptions.map(([value, label]) => (
                    <option value={value} key={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </header>

              <div className="admin-v2-lead-main">
                <section>
                  <h3>{item.name}</h3>

                  <a href={`tel:${item.normalized_phone}`}>
                    {item.phone}
                  </a>

                  <p>
                    Компания: {optional(item.company)}
                  </p>

                  <p>
                    Город: {optional(item.city)}
                  </p>
                </section>

                <section>
                  <dl>
                    <div>
                      <dt>Категория</dt>
                      <dd>{optional(item.category)}</dd>
                    </div>

                    <div>
                      <dt>Примерный объём</dt>
                      <dd>{optional(item.volume)}</dd>
                    </div>

                    <div>
                      <dt>Источник</dt>
                      <dd>Оптовая форма сайта</dd>
                    </div>
                  </dl>
                </section>
              </div>

              {item.comment && (
                <div className="admin-v2-lead-comment">
                  <b>Комментарий</b>
                  <p>{item.comment}</p>
                </div>
              )}

              <footer>
                <a
                  href={`tel:${item.normalized_phone}`}
                  className="admin-primary-button"
                >
                  Позвонить
                </a>

                <a
                  href={
                    `https://wa.me/${
                      item.normalized_phone
                    }`
                  }
                  target="_blank"
                  rel="noreferrer"
                >
                  WhatsApp
                </a>

                <button
                  className="is-danger"
                  disabled={pendingId === item.id}
                  onClick={() => void remove(item)}
                  title="Удалить заявку"
                >
                  <Trash2 size={16} />
                  Удалить
                </button>
              </footer>
            </article>
          ))}
        </div>
      )}
    </section>
  )
}
