/* eslint-disable react-refresh/only-export-components */

import {
  FormEvent,
  useMemo,
  useRef,
  useState,
} from 'react'

import {
  contacts,
  telegram,
  whatsapp,
} from '../../data'

import {
  getCartConfirmedSubtotal,
  useCart,
} from '../../cart/CartProvider'

import {
  createRequestId,
} from '../../utils/requestId'

import {
  getStoredLiveChatReference,
} from '../../api/liveChat'
import { trackEvent } from '../../analytics/track'

const money = new Intl.NumberFormat(
  'ru-RU',
  {
    style: 'currency',
    currency: 'RUB',
    maximumFractionDigits: 0,
  },
)

type DeliveryMethod =
  | 'pickup'
  | 'courier'

type CheckoutDetails = {
  name: string
  contact: string
  email?: string
  city: string
  comment: string
  deliveryMethod?: DeliveryMethod
  deliveryAddress?: string
  desiredDeliveryDate?: string
}

const deliveryLabels: Record<
  DeliveryMethod,
  string
> = {
  pickup: 'Самовывоз',
  courier: 'Доставка',
}


export function createCartRequestText(
  items: ReturnType<typeof useCart>['items'],
  details: CheckoutDetails,
) {
  const lines = [
    'Здравствуйте! Хочу уточнить наличие и оформить заказ.',
    '',
  ]

  items.forEach((item, index) => {
    const product = item.product
    const variant = item.variant

    const confirmed =
      variant !== null
      && variant.priceRub !== null
      && variant.currency === 'RUB'
      && variant.priceSource !== 'unverified'

    lines.push(
      `${index + 1}. ${product.title}`,
      `Вариант: ${
        variant
          ? `${variant.title}${
              variant.shade
                ? ` · ${variant.shade}`
                : ''
            }`
          : 'уточняется'
      }`,
      `Количество: ${item.quantity} ${
        variant?.unit ?? 'шт.'
      }`,
      `Цена: ${
        confirmed
          ? `${money.format(
              variant.priceRub!,
            )}${
              variant.unit
                ? ` / ${variant.unit}`
                : ''
            }`
          : 'Цена уточняется'
      }`,
      product.href === '#'
        ? ''
        : `Ссылка: ${
            window.location.origin
          }${product.href}`,
      '',
    )
  })

  const subtotal =
    getCartConfirmedSubtotal(items)

  if (subtotal) {
    lines.push(
      `Предварительная стоимость: ${
        money.format(subtotal)
      }`,
    )
  }

  if (details.name) {
    lines.push(`Имя: ${details.name}`)
  }

  if (details.email) {
    lines.push(`Email: ${details.email}`)
  }

  if (details.deliveryMethod) {
    lines.push(
      `Доставка: ${
        deliveryLabels[
          details.deliveryMethod
        ]
      }`,
    )
  }

  if (details.city) {
    lines.push(`Город: ${details.city}`)
  }

  if (details.deliveryAddress) {
    lines.push(
      `Адрес: ${details.deliveryAddress}`,
    )
  }

  if (details.desiredDeliveryDate) {
    lines.push(
      `Желаемая дата: ${
        details.desiredDeliveryDate
      }`,
    )
  }

  if (details.comment) {
    lines.push(
      `Комментарий: ${details.comment}`,
    )
  }

  lines.push(
    `Телефон: ${details.contact}`,
    '',
    'Наличие, количество и итоговую стоимость прошу подтвердить.',
  )

  return lines.join('\n')
}

function localToday() {
  const now = new Date()

  const local = new Date(
    now.getTime()
    - now.getTimezoneOffset() * 60_000,
  )

  return local
    .toISOString()
    .slice(0, 10)
}

export function CartCheckout({
  onOrderCreated,
}: {
  onOrderCreated?: () => void
}) {
  const {
    items,
    clearCart,
    refreshPrices,
  } = useCart()

  const [name, setName] = useState('')
  const [contact, setContact] =
    useState('')
  const [email, setEmail] = useState('')

  const [
    deliveryMethod,
    setDeliveryMethod,
  ] = useState<DeliveryMethod>(
    'pickup',
  )

  const [city, setCity] = useState('')

  const [
    deliveryAddress,
    setDeliveryAddress,
  ] = useState('')

  const [
    desiredDeliveryDate,
    setDesiredDeliveryDate,
  ] = useState('')

  const [comment, setComment] =
    useState('')

  const [
    privacyConsent,
    setPrivacyConsent,
  ] = useState(false)

  const [copied, setCopied] =
    useState(false)

  const [pending, setPending] =
    useState(false)

  const [error, setError] =
    useState('')

  const [
    createdOrder,
    setCreatedOrder,
  ] = useState<{
    publicNumber: string
    telegramDeepLink: string | null
    requestText: string
  } | null>(null)

  const requestAttempt = useRef<{
    idempotencyKey: string
    cartSignature: string
  } | null>(null)

  const minimumDate = useMemo(
    localToday,
    [],
  )

  const details: CheckoutDetails = useMemo(() => ({
    name,
    contact,
    email,
    city,
    comment,
    deliveryMethod,
    deliveryAddress,
    desiredDeliveryDate,
  }), [
    name,
    contact,
    email,
    city,
    comment,
    deliveryMethod,
    deliveryAddress,
    desiredDeliveryDate,
  ])

  const text = useMemo(
    () => createCartRequestText(
      items,
      details,
    ),
    [items, details],
  )

  const onSubmit = async (
    event: FormEvent,
  ) => {
    event.preventDefault()

    if (
      !contact.trim()
      || !privacyConsent
      || pending
    ) {
      return
    }

    setPending(true)
    setError('')
    void trackEvent('checkout_start', {
      entityType: 'cart',
      metadata: {
        itemCount: items.reduce((sum, item) => sum + item.quantity, 0),
      },
    })

    try {
      await refreshPrices()

      const orderItems = items.map(
        item => ({
          productId: item.productId,
          variantId: item.variantId,
          quantity: item.quantity,
        }),
      )

      const cartSignature =
        JSON.stringify(orderItems)

      if (
        !requestAttempt.current
        || requestAttempt.current
          .cartSignature !== cartSignature
      ) {
        requestAttempt.current = {
          idempotencyKey:
            createRequestId(),
          cartSignature,
        }
      }

      const response = await fetch(
        '/api/orders/checkout',
        {
          method: 'POST',
          headers: {
            'Content-Type':
              'application/json',
            Accept: 'application/json',
          },
          body: JSON.stringify({
            name,
            phone: contact,
            email,
                        deliveryMethod,

            city:
              deliveryMethod === 'pickup'
                ? null
                : city,

            deliveryAddress:
              deliveryMethod === 'pickup'
                ? null
                : deliveryAddress,
            desiredDeliveryDate:
              desiredDeliveryDate || null,

            comment,
            privacyConsent,

            liveChat:
              getStoredLiveChatReference(),

            idempotencyKey:
              requestAttempt.current
                .idempotencyKey,

            items: orderItems,
          }),
        },
      )

      const body = await response
        .json()
        .catch(() => ({})) as {
          ok?: boolean
          publicNumber?: string
          telegramDeepLink?: string | null
          error?: string
        }

      if (!response.ok || !body.ok) {
        throw new Error(
          body.error
          || 'Не удалось оформить заявку',
        )
      }

      if (!body.publicNumber) {
        throw new Error('Сервер не вернул номер сохранённой заявки')
      }

      void trackEvent('checkout_success', {
        entityType: 'cart',
        metadata: {
          itemCount: orderItems.reduce((sum, item) => sum + item.quantity, 0),
        },
      })

      setCreatedOrder({
        publicNumber: body.publicNumber,
        telegramDeepLink:
          body.telegramDeepLink ?? null,
        requestText: text,
      })

      clearCart()
      requestAttempt.current = null
      onOrderCreated?.()
    } catch (requestError) {
      void trackEvent('checkout_error', {
        entityType: 'cart',
        metadata: {
          itemCount: items.reduce((sum, item) => sum + item.quantity, 0),
        },
      })
      setError(
        requestError instanceof Error
          ? requestError.message
          : 'Не удалось оформить заявку',
      )
    } finally {
      setPending(false)
    }
  }

  const copyThenOpenTelegram =
    async () => {
      if (!createdOrder) return

      try {
        await navigator.clipboard
          ?.writeText(
            createdOrder.requestText,
          )

        setCopied(true)
      } catch {
        setCopied(true)
      }

      window.open(
        telegram,
        '_blank',
        'noopener,noreferrer',
      )
    }

  if (!createdOrder) {
    return (
      <form
        className="cart-checkout cart-checkout-v2"
        onSubmit={event => {
          void onSubmit(event)
        }}
      >
        <h3>Оформить заявку</h3>

        <p>
          Менеджер подтвердит наличие,
          количество, доставку и итоговую
          стоимость.
        </p>

        <fieldset className="cart-checkout-group">
          <legend>Контактные данные</legend>

          <div className="cart-checkout-grid">
            <label>
              Имя
              <input
                value={name}
                onChange={event => {
                  setName(
                    event.target.value,
                  )
                }}
                placeholder="Как к вам обращаться"
                aria-label="Имя"
              />
            </label>

            <label>
              Телефон *
              <input
                type="tel"
                value={contact}
                onChange={event => {
                  setContact(
                    event.target.value,
                  )
                }}
                placeholder="+7 999 000-00-00"
                aria-label="Телефон"
                required
              />
            </label>

            <label className="cart-checkout-wide">
              Email
              <input
                type="email"
                value={email}
                onChange={event => {
                  setEmail(
                    event.target.value,
                  )
                }}
                placeholder="mail@example.ru"
                aria-label="Email"
              />
            </label>
          </div>
        </fieldset>


        <fieldset className="cart-checkout-group cart-delivery-group">
          <legend>Получение заказа</legend>

          <div
            className="cart-delivery-options"
            role="radiogroup"
            aria-label="Способ получения"
          >
            <label
              className={
                `cart-delivery-option ${
                  deliveryMethod === 'pickup'
                    ? 'is-selected'
                    : ''
                }`
              }
            >
              <input
                type="radio"
                name="deliveryMethod"
                value="pickup"
                checked={
                  deliveryMethod === 'pickup'
                }
                onChange={() => {
                  setDeliveryMethod('pickup')
                  setCity('')
                  setDeliveryAddress('')
                  setDesiredDeliveryDate('')
                }}
              />

              <span
                className="cart-delivery-radio"
                aria-hidden="true"
              />

              <span>
                <b>Самовывоз</b>
                <small>
                  Из шоурума OZELIF в Москве
                </small>
              </span>
            </label>

            <label
              className={
                `cart-delivery-option ${
                  deliveryMethod === 'courier'
                    ? 'is-selected'
                    : ''
                }`
              }
            >
              <input
                type="radio"
                name="deliveryMethod"
                value="courier"
                checked={
                  deliveryMethod === 'courier'
                }
                onChange={() => {
                  setDeliveryMethod('courier')
                }}
              />

              <span
                className="cart-delivery-radio"
                aria-hidden="true"
              />

              <span>
                <b>Доставка</b>
                <small>
                  По адресу или до транспортной компании
                </small>
              </span>
            </label>
          </div>

          {deliveryMethod === 'courier' && (
            <div className="cart-checkout-grid cart-delivery-fields">
              <label>
                Город *
                <input
                  value={city}
                  onChange={event => {
                    setCity(
                      event.target.value,
                    )
                  }}
                  placeholder="Москва"
                  required
                />
              </label>

              <label>
                Желаемая дата
                <input
                  type="date"
                  min={minimumDate}
                  value={
                    desiredDeliveryDate
                  }
                  onChange={event => {
                    setDesiredDeliveryDate(
                      event.target.value,
                    )
                  }}
                />
              </label>

              <label className="cart-checkout-wide">
                Адрес доставки *
                <textarea
                  value={deliveryAddress}
                  onChange={event => {
                    setDeliveryAddress(
                      event.target.value,
                    )
                  }}
                  placeholder="Улица, дом, помещение или терминал транспортной компании"
                  required
                />
              </label>
            </div>
          )}
        </fieldset>

        <label>
          Комментарий
          <textarea
            value={comment}
            onChange={event => {
              setComment(
                event.target.value,
              )
            }}
            aria-label="Комментарий к заявке"
            placeholder="Цвет, толщина, назначение материала или особые пожелания"
          />
        </label>

        <label className="cart-checkout-consent">
          <input
            type="checkbox"
            checked={privacyConsent}
            onChange={event => {
              setPrivacyConsent(
                event.target.checked,
              )
            }}
            required
          />

          <span>
            Я согласен на обработку
            персональных данных для
            оформления и обработки заявки.
          </span>
        </label>

        {error && (
          <p
            className="form-error"
            role="alert"
          >
            {error}
          </p>
        )}

        <button
          className="btn btn--accent"
          type="submit"
          disabled={pending}
        >
          {pending
            ? 'Оформляем…'
            : 'Оформить заявку'}
        </button>
      </form>
    )
  }

  return (
    <section className="cart-checkout cart-checkout--summary">
      <h3>Заявка принята</h3>

      <p>
        Менеджер подтвердит наличие,
        количество, доставку и итоговую
        стоимость.
      </p>

      {createdOrder.telegramDeepLink && (
        <a
          className="btn btn--accent"
          href={
            createdOrder.telegramDeepLink
          }
        >
          Привязать Telegram
        </a>
      )}

      <div className="cart-checkout-actions">
        <a
          className="btn btn--accent"
          href={
            `${whatsapp}&text=${
              encodeURIComponent(
                createdOrder.requestText,
              )
            }`
          }
          target="_blank"
          rel="noreferrer"
        >
          Отправить в WhatsApp
        </a>

        <button
          type="button"
          className="btn btn--dark"
          onClick={() => {
            void copyThenOpenTelegram()
          }}
        >
          Открыть Telegram
        </button>

        <a
          className="text-link"
          href={contacts[1].href}
        >
          Позвонить
        </a>

        <a
          className="text-link"
          href="/contacts"
        >
          Открыть контакты
        </a>
      </div>

      {copied && (
        <p role="status">
          Текст заявки скопирован
        </p>
      )}
    </section>
  )
}
