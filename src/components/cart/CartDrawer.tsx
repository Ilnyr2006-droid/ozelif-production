import { useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react'
import { ShoppingBag, X } from 'lucide-react'
import { getCartSummary, useCart } from '../../cart/CartProvider'
import { CartCheckout } from './CartCheckout'
import { CartItemCard } from './CartItemCard'

const money = new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB', maximumFractionDigits: 0 })

export function CartDrawer() {
  const { items, isOpen, closeCart } = useCart()
  const closeRef = useRef<HTMLButtonElement>(null)
  const drawerRef = useRef<HTMLElement>(null)
  const returnFocusRef = useRef<HTMLElement | null>(null)
  const summary = getCartSummary(items)
  const [submittedOrder, setSubmittedOrder] = useState(false)
  useEffect(() => {
    if (!isOpen) return
    const previousOverflow = document.body.style.overflow
    returnFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
    document.body.style.overflow = 'hidden'
    closeRef.current?.focus()
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === 'Escape') closeCart() }
    window.addEventListener('keydown', onKeyDown)
    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', onKeyDown)
      returnFocusRef.current?.focus()
    }
  }, [closeCart, isOpen])

  const trapFocus = (event: ReactKeyboardEvent<HTMLElement>) => {
    if (event.key !== 'Tab' || !drawerRef.current) return
    const focusable = [...drawerRef.current.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), input:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])')]
    if (!focusable.length) return
    const first = focusable[0]
    const last = focusable[focusable.length - 1]
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault()
      last.focus()
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault()
      first.focus()
    }
  }
  if (!isOpen) return null
  return <div className="cart-drawer-layer"><button type="button" className="cart-drawer-backdrop" aria-label="Закрыть корзину" onClick={closeCart}/><aside ref={drawerRef} className="cart-drawer" role="dialog" aria-modal="true" aria-labelledby="cart-drawer-title" onKeyDown={trapFocus}><header><div><p className="kicker">Заявка на материалы</p><h2 id="cart-drawer-title">Корзина</h2></div><button ref={closeRef} type="button" onClick={closeCart} aria-label="Закрыть корзину"><X size={21}/></button></header>{items.length === 0 && !submittedOrder ? <div className="cart-empty"><ShoppingBag size={32}/><h3>Корзина пока пуста</h3><p>Добавьте материалы со страницы товара — они появятся здесь.</p></div> : <><div className="cart-drawer-items">{items.map(item => <CartItemCard key={`${item.productId}-${item.variantId}`} item={item}/>)}</div>{!submittedOrder && <section className="cart-summary" aria-label="Итог по корзине"><p>Предварительная стоимость товаров с подтверждёнными ценами</p><strong>{summary.subtotal ? money.format(summary.subtotal) : 'Цена уточняется'}</strong>{summary.unpricedItemsCount > 0 && <small>В корзине есть товары, стоимость которых уточнит менеджер.</small>}<small>Точное количество и площадь уточнит менеджер.</small></section>}<CartCheckout onOrderCreated={() => setSubmittedOrder(true)}/></>}</aside></div>
}
