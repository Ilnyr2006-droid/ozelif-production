import {
  type FormEvent,
  useState,
} from 'react'
import { Check } from 'lucide-react'
import { external } from '../data'

type Status =
  | 'idle'
  | 'loading'
  | 'success'
  | 'error'

type FieldErrors = Partial<
  Record<'name' | 'phone', string>
>

const phonePattern =
  /^[+0-9()\s-]{10,20}$/

export function SewingProductionForm() {
  const [status, setStatus] =
    useState<Status>('idle')

  const [errors, setErrors] =
    useState<FieldErrors>({})

  const [submitError, setSubmitError] =
    useState<string | null>(null)

  const locked =
    status === 'loading'
    || status === 'success'

  async function submit(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault()

    if (locked) return

    const form = event.currentTarget
    const data = new FormData(form)

    const name = String(
      data.get('name') ?? '',
    ).trim()

    const phone = String(
      data.get('phone') ?? '',
    ).trim()

    const nextErrors: FieldErrors = {}

    if (!name) {
      nextErrors.name = 'Укажите имя.'
    }

    if (!phone) {
      nextErrors.phone =
        'Укажите телефон.'
    } else if (!phonePattern.test(phone)) {
      nextErrors.phone =
        'Проверьте формат телефона.'
    }

    setErrors(nextErrors)
    setSubmitError(null)

    const firstInvalid =
      Object.keys(nextErrors)[0]

    if (firstInvalid) {
      form
        .querySelector<HTMLElement>(
          `[name="${firstInvalid}"]`,
        )
        ?.focus()

      return
    }

    setStatus('loading')

    try {
      const response = await fetch(
        '/api/production-leads',
        {
          method: 'POST',
          headers: {
            Accept: 'application/json',
            'Content-Type':
              'application/json',
          },
          body: JSON.stringify({
            name,
            phone,
            productType: String(
              data.get('productType') ?? '',
            ).trim(),
            quantity: String(
              data.get('quantity') ?? '',
            ).trim(),
            comment: String(
              data.get('comment') ?? '',
            ).trim(),
            pagePath:
              window.location.pathname,
          }),
        },
      )

      const body = await response
        .json()
        .catch(() => null) as
        | { ok: true }
        | { error?: string }
        | null

      if (
        !response.ok
        || !body
        || !('ok' in body)
      ) {
        throw new Error(
          body
          && 'error' in body
          && body.error
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

  function clearError(
    field: 'name' | 'phone',
  ) {
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
      className="wholesale-form sewing-form"
      id="production-form"
      onSubmit={submit}
      noValidate
      aria-busy={status === 'loading'}
    >
      <p className="kicker">
        Заявка на производство
      </p>

      <h2>
        Обсудить
        <br />
        <em>производство</em>
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
              errors.name
                ? 'production-name-error'
                : undefined
            }
            onInput={() =>
              clearError('name')
            }
          />

          {errors.name && (
            <small
              className="field-error"
              id="production-name-error"
            >
              {errors.name}
            </small>
          )}
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
              errors.phone
                ? 'production-phone-error'
                : undefined
            }
            onInput={() =>
              clearError('phone')
            }
          />

          {errors.phone && (
            <small
              className="field-error"
              id="production-phone-error"
            >
              {errors.phone}
            </small>
          )}
        </label>

        <label>
          Тип изделия
          <input
            name="productType"
            placeholder="Например, кожаная куртка"
          />
        </label>

        <label>
          Количество
          <input
            name="quantity"
            inputMode="numeric"
            placeholder="От 10 изделий одной модели"
          />
        </label>

        <label className="wholesale-form-comment">
          Комментарий
          <textarea
            name="comment"
            rows={5}
            placeholder="Опишите модель, материалы и готовность лекал"
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
            : 'Обсудить производство'}
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
          <Check size={24} />
          Спасибо! Заявка принята.
        </p>
      )}

      {status === 'error' && (
        <p
          className="form-message form-error"
          role="alert"
        >
          {submitError
            ?? 'Не удалось отправить заявку. Попробуйте ещё раз или свяжитесь с Эмилией.'}
        </p>
      )}
    </form>
  )
}
