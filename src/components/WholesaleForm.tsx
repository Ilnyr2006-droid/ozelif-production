import { FormEvent, useState } from 'react'
import { Check } from 'lucide-react'
import { external } from '../data'

type Status = 'idle' | 'loading' | 'success' | 'error'
type FieldErrors = Partial<Record<'name' | 'phone', string>>

const phonePattern = /^[+0-9()\s-]{10,20}$/

type LeadResponse = {
  ok: true
  lead: {
    id: string
    number: number
    status: string
    createdAt: string
  }
}

export function WholesaleForm() {
  const [status, setStatus] = useState<Status>('idle')
  const [errors, setErrors] = useState<FieldErrors>({})
  const [submitError, setSubmitError] = useState<string | null>(null)

  const locked = status === 'loading' || status === 'success'

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (locked) return

    const form = event.currentTarget
    const data = new FormData(form)

    const name = String(data.get('name') ?? '').trim()
    const phone = String(data.get('phone') ?? '').trim()

    const nextErrors: FieldErrors = {}

    if (!name) {
      nextErrors.name = 'Укажите имя.'
    }

    if (!phone) {
      nextErrors.phone = 'Укажите телефон.'
    } else if (!phonePattern.test(phone)) {
      nextErrors.phone = 'Проверьте формат телефона.'
    }

    setErrors(nextErrors)
    setSubmitError(null)

    const firstInvalid = Object.keys(nextErrors)[0]

    if (firstInvalid) {
      form
        .querySelector<HTMLElement>(`[name="${firstInvalid}"]`)
        ?.focus()

      return
    }

    const payload = {
      name,
      phone,
      company: String(data.get('company') ?? '').trim(),
      city: String(data.get('city') ?? '').trim(),
      category: String(data.get('category') ?? '').trim(),
      volume: String(data.get('volume') ?? '').trim(),
      comment: String(data.get('comment') ?? '').trim(),
      pagePath: window.location.pathname,
    }

    setStatus('loading')

    try {
      const response = await fetch('/api/wholesale-leads', {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      })

      const body = (await response.json().catch(() => null)) as
        | LeadResponse
        | { error?: string }
        | null

      if (!response.ok || !body || !('ok' in body)) {
        throw new Error(
          body && 'error' in body && body.error
            ? body.error
            : 'Не удалось отправить заявку.',
        )
      }

      form.reset()
      setStatus('success')
    } catch (error) {
      setSubmitError(
        error instanceof Error
          ? error.message
          : 'Не удалось отправить заявку.',
      )
      setStatus('error')
    }
  }

  function clearError(field: 'name' | 'phone') {
    if (errors[field]) {
      setErrors(current => ({
        ...current,
        [field]: undefined,
      }))
    }

    if (status === 'error') {
      setStatus('idle')
      setSubmitError(null)
    }
  }

  return (
    <form
      className="wholesale-form"
      id="wholesale-form"
      onSubmit={submit}
      noValidate
      aria-busy={status === 'loading'}
    >
      <p className="kicker">Оптовая заявка</p>

      <h2>
        Получить
        <br />
        <em>оптовые условия</em>
      </h2>

      <div className="wholesale-form-grid">
        <label>
          Имя <span>*</span>
          <input
            name="name"
            autoComplete="name"
            required
            placeholder="Как к вам обращаться"
            aria-invalid={!!errors.name}
            aria-describedby={
              errors.name ? 'wholesale-name-error' : undefined
            }
            onInput={() => clearError('name')}
          />

          {errors.name && (
            <small
              className="field-error"
              id="wholesale-name-error"
            >
              {errors.name}
            </small>
          )}
        </label>

        <label>
          Компания
          <input
            name="company"
            autoComplete="organization"
            placeholder="Название компании"
          />
        </label>

        <label>
          Телефон <span>*</span>
          <input
            name="phone"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            required
            placeholder="+7 999 000-00-00"
            aria-invalid={!!errors.phone}
            aria-describedby={
              errors.phone ? 'wholesale-phone-error' : undefined
            }
            onInput={() => clearError('phone')}
          />

          {errors.phone && (
            <small
              className="field-error"
              id="wholesale-phone-error"
            >
              {errors.phone}
            </small>
          )}
        </label>

        <label>
          Город
          <input
            name="city"
            autoComplete="address-level2"
            placeholder="Ваш город"
          />
        </label>

        <label>
          Интересующая категория
          <select name="category" defaultValue="">
            <option value="">Выберите категорию</option>
            <option>Одежная кожа</option>
            <option>Дублёночный материал</option>
            <option>Замша</option>
            <option>Обувная кожа</option>
            <option>Галантерейная кожа</option>
            <option>Фурнитура</option>
          </select>
        </label>

        <label>
          Примерный объём
          <input
            name="volume"
            placeholder="Например, одна пачка"
          />
        </label>

        <label className="wholesale-form-comment">
          Комментарий
          <textarea
            name="comment"
            rows={4}
            placeholder="Что планируете производить и какой материал нужен?"
          />
        </label>
      </div>

      <button
        className="btn btn--accent"
        disabled={locked}
      >
        {status === 'loading'
          ? 'Отправляем…'
          : status === 'success'
            ? 'Заявка отправлена'
            : 'Получить оптовые условия'}
      </button>

      <small className="wholesale-consent">
        Нажимая кнопку, вы соглашаетесь с{' '}
        <a href={external('/privacy')}>
          политикой конфиденциальности
        </a>
        . Обязательны только имя и телефон.
      </small>

      {status === 'success' && (
        <p
          className="form-message form-success"
          role="status"
        >
          <Check size={17} />
          Спасибо! Заявка принята.
        </p>
      )}

      {status === 'error' && (
        <p
          className="form-message form-error"
          role="alert"
        >
          {submitError ??
            'Не удалось отправить заявку. Попробуйте ещё раз.'}
        </p>
      )}
    </form>
  )
}
