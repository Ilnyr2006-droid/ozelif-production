import {
  FormEvent,
  useState,
} from 'react'
import {
  ArrowUpRight,
  Check,
  MapPin,
} from 'lucide-react'
import {
  contacts,
  external,
  telegram,
  whatsapp,
} from '../data'

type Status =
  | 'idle'
  | 'loading'
  | 'success'
  | 'error'

export function Contact() {
  const [status, setStatus] =
    useState<Status>('idle')

  const locked =
    status === 'loading'
    || status === 'success'

  async function submit(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault()

    if (locked) return

    const form = event.currentTarget

    if (!form.reportValidity()) {
      return
    }

    const data = new FormData(form)

    setStatus('loading')

    try {
      const response = await fetch(
        '/api/manager-leads',
        {
          method: 'POST',
          headers: {
            'Content-Type':
              'application/json',
          },
          body: JSON.stringify({
            name: String(
              data.get('name') ?? '',
            ).trim(),
            phone: String(
              data.get('phone') ?? '',
            ).trim(),
            comment: String(
              data.get('comment') ?? '',
            ).trim(),
            pagePath:
              window.location.pathname,
          }),
        },
      )

      if (!response.ok) {
        throw new Error(
          'submit failed',
        )
      }

      form.reset()
      setStatus('success')
    } catch {
      setStatus('error')
    }
  }

  return (
    <section
      className="contact section"
      id="contacts"
    >
      <div className="contact-info reveal">
        <p className="kicker">
          05 — Шоурум в Москве
        </p>

        <h2>
          Посмотрите материал
          <br />
          <em>вживую</em>
        </h2>

        <div className="address">
          <MapPin />

          <div>
            <b>
              Москва, Краснобогатырская
              улица, 24
            </b>

            <span>
              Адрес шоурума и склада
              OZELIF.
            </span>

            <a
              className="text-link"
              href="https://yandex.ru/maps/org/ozelif_kozha/242632009920/"
              target="_blank"
              rel="noreferrer"
            >
              Построить маршрут
              {' '}
              <ArrowUpRight size={16} />
            </a>
          </div>
        </div>

        <div className="people">
          {contacts.map(contact => (
            <div key={contact.name}>
              <p>
                <b>{contact.name}</b>
                {' / '}
                {contact.role}
              </p>

              <a href={contact.href}>
                {contact.phone}
              </a>

              <span>
                {contact.note}
              </span>
            </div>
          ))}
        </div>

        <div className="social-line">
          <a
            href={whatsapp}
            target="_blank"
            rel="noreferrer"
          >
            WhatsApp
          </a>

          <a
            href={telegram}
            target="_blank"
            rel="noreferrer"
          >
            Telegram
          </a>
        </div>
      </div>

      <form
        className="contact-form reveal"
        onSubmit={submit}
      >
        <p className="kicker">
          Запрос менеджеру
        </p>

        <h3>
          Поможем подобрать
          <br />
          материал под задачу
        </h3>

        <label>
          Ваше имя

          <input
            name="name"
            autoComplete="name"
            required
            placeholder="Как к вам обращаться"
          />
        </label>

        <label>
          Телефон

          <input
            name="phone"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            required
            pattern="[+0-9()\s-]{10,20}"
            placeholder="+7 999 000-00-00"
          />
        </label>

        <label>
          Комментарий

          <textarea
            name="comment"
            rows={3}
            placeholder="Что планируете шить?"
          />
        </label>

        <button
          className="btn btn--accent"
          disabled={locked}
        >
          {status === 'loading'
            ? 'Отправляем…'
            : status === 'success'
              ? 'Запрос отправлен'
              : 'Отправить запрос'}
        </button>

        <small>
          Нажимая кнопку, вы
          соглашаетесь с
          {' '}

          <a href={external('/privacy')}>
            политикой
            конфиденциальности
          </a>.
        </small>

        {status === 'success' && (
          <p
            className="form-message form-success"
            role="status"
          >
            <Check size={17} />
            Спасибо! Запрос принят.
          </p>
        )}

        {status === 'error' && (
          <p
            className="form-message form-error"
            role="alert"
          >
            Не удалось отправить.
            Позвоните нам или
            попробуйте ещё раз.
          </p>
        )}
      </form>
    </section>
  )
}
