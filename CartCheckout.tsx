/* eslint-disable react-refresh/only-export-components */
import { FormEvent, useMemo, useRef, useState } from 'react'
import { contacts, telegram, whatsapp } from '../../data'
import { getCartConfirmedSubtotal, useCart } from '../../cart/CartProvider'
import { createRequestId } from '../../utils/requestId'
import { trackEvent } from '../../analytics/track'

const money = new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB', maximumFractionDigits: 0 })

export function createCartRequestText(items: ReturnType<typeof useCart>['items'], details: { name: string; contact: string; city: string; comment: string }) {
  const lines = ['Здравствуйте! Хочу уточнить наличие и оформить заказ.', '']
  items.forEach((item, index) => {
    const product = item.product
    const variant = item.variant
    const confirmed = variant !== null && variant.priceRub !== null && variant.currency === 'RUB' && variant.priceSource !== 'unverified'
    lines.push(`${index + 1}. ${product.title}`, `Вариант: ${variant ? `${variant.title}${variant.shade ? ` · ${variant.shade}` : ''}` : 'уточняется'}`, `Количество: ${item.quantity} ${variant?.unit ?? 'шт.'}`, `Цена: ${confirmed ? `${money.format(variant.priceRub!)}${variant.unit ? ` / ${variant.unit}` : ''}` : 'Цена уточняется'}`, product.href === '#' ? '' : `Ссылка: ${window.location.origin}${product.href}`, '')
  })
  const subtotal = getCartConfirmedSubtotal(items)
  if (subtotal) lines.push(`Предварительная стоимость подтверждённых позиций: ${money.format(subtotal)}`)
  if (details.name) lines.push(`Имя: ${details.name}`)
  if (details.city) lines.push(`Город: ${details.city}`)
  if (details.comment) lines.push(`Комментарий: ${details.comment}`)
  lines.push(`Контакт клиента: ${details.contact}`, '', 'Наличие, точное количество и итоговую стоимость прошу подтвердить.')
  return lines.join('\n')
}

export function CartCheckout({ onOrderCreated }: { onOrderCreated?: () => void }) {
  const { items, clearCart, refreshPrices } = useCart()
  const [name, setName] = useState('')
  const [contact, setContact] = useState('')
  const [city, setCity] = useState('')
  const [comment, setComment] = useState('')
  const [copied, setCopied] = useState(false)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')
  const [createdOrder, setCreatedOrder] = useState<{ number: string; telegramDeepLink: string | null } | null>(null)
  const requestAttempt = useRef<{ idempotencyKey: string; cartSignature: string } | null>(null)
  const text = useMemo(() => createCartRequestText(items, { name, contact, city, comment }), [items, name, contact, city, comment])
  const onSubmit = async (event: FormEvent) => {
    event.preventDefault()
    if (!contact.trim() || pending) return
    setPending(true); setError('')
    try {
      void trackEvent('checkout_start', { entityType: 'cart', metadata: { itemCount: items.reduce((sum, item) => sum + item.quantity, 0) } })
      await refreshPrices()
      const orderItems = items.map(item => ({ productId: item.productId, variantId: item.variantId, quantity: item.quantity }))
      const cartSignature = JSON.stringify(orderItems)
      if (!requestAttempt.current || requestAttempt.current.cartSignature !== cartSignature) {
        requestAttempt.current = { idempotencyKey: createRequestId(), cartSignature }
      }
      const response = await fetch('/api/orders/checkout', { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify({ name, phone: contact, city, comment, idempotencyKey: requestAttempt.current.idempotencyKey, items: orderItems }) })
      const body = await response.json().catch(() => ({})) as { order?: { number?: string }; telegramDeepLink?: string | null; error?: string }
      if (!response.ok || !body.order?.number) throw new Error(body.error || 'Не удалось оформить заявку')
      setCreatedOrder({ number: body.order.number, telegramDeepLink: body.telegramDeepLink ?? null })
      void trackEvent('checkout_success', { entityType: 'cart', metadata: { itemCount: orderItems.reduce((sum, item) => sum + item.quantity, 0) } })
      clearCart()
      requestAttempt.current = null
      onOrderCreated?.()
    } catch (requestError) { void trackEvent('checkout_error', { entityType: 'cart' }); setError(requestError instanceof Error ? requestError.message : 'Не удалось оформить заявку') } finally { setPending(false) }
  }
  const copyThenOpenTelegram = async () => {
    try { await navigator.clipboard?.writeText(text); setCopied(true) } catch { setCopied(true) }
    window.open(telegram, '_blank', 'noopener,noreferrer')
  }
  if (!createdOrder) return <form className="cart-checkout" onSubmit={event => void onSubmit(event)}><h3>Оформить заявку</h3><p>Это не онлайн-оплата. Менеджер подтвердит наличие, точное количество и стоимость.</p><label>Имя<input value={name} onChange={event => setName(event.target.value)} placeholder="Как к вам обращаться" aria-label="Имя" /></label><label>Телефон или контакт *<input value={contact} onChange={event => setContact(event.target.value)} placeholder="+7 999 000-00-00" aria-label="Телефон или контакт" required /></label><label>Город<input value={city} onChange={event => setCity(event.target.value)} aria-label="Город" /></label><label>Комментарий<textarea value={comment} onChange={event => setComment(event.target.value)} aria-label="Комментарий к заявке" /></label>{error && <p className="form-error" role="alert">{error}</p>}<button className="btn btn--accent" type="submit" disabled={pending}>{pending ? 'Оформляем…' : 'Оформить заявку'}</button></form>
  return <section className="cart-checkout cart-checkout--summary"><h3>Заявка №{createdOrder.number} принята</h3><p>Менеджер подтвердит наличие, количество и итоговую стоимость.</p>{createdOrder.telegramDeepLink && <a className="btn btn--accent" href={createdOrder.telegramDeepLink}>Привязать Telegram</a>}<div className="cart-checkout-actions"><a className="btn btn--accent" href={`${whatsapp}&text=${encodeURIComponent(text)}`} target="_blank" rel="noreferrer">Отправить в WhatsApp</a><button type="button" className="btn btn--dark" onClick={() => void copyThenOpenTelegram()}>Открыть Telegram</button><a className="text-link" href={contacts[1].href}>Позвонить</a><a className="text-link" href="/contacts">Открыть контакты</a></div>{copied && <p role="status">Текст заявки скопирован</p>}</section>
}
