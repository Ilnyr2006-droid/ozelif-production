import type { CartItem } from '../cart/cartTypes'
import type { PublicCatalogProduct } from '../api/publicCatalog'

export const METRIKA_ID = 112275551
export type Goal = 'product_view' | 'add_to_cart' | 'begin_checkout' | 'purchase' | 'order_submitted' | 'click_phone' | 'click_whatsapp' | 'click_telegram' | 'wholesale_lead' | 'production_lead'
type Product = { id: string; name: string; category: string; price?: number; quantity: number }
type AnalyticsWindow = Window & { ym?: (...args: unknown[]) => void; dataLayer?: unknown[] }
const browser = () => window as AnalyticsWindow
const publicPage = () => !/^\/admin(?:\/|$)/.test(window.location.pathname)

// Only explicit catalog fields enter the third-party payload; never spread form/order data.
export function goal(name: Goal) {
  if (publicPage()) browser().ym?.(METRIKA_ID, 'reachGoal', name)
}
function ecommerce(action: string, products: Product[], actionField?: { id: string; revenue: number }) {
  if (!publicPage() || !products.length) return
  const target = browser()
  target.dataLayer ??= []
  target.dataLayer.push({ ecommerce: { currencyCode: 'RUB', [action]: { ...(actionField ? { actionField } : {}), products } } })
}
export function cartProducts(items: CartItem[]): Product[] {
  return items.map(item => ({ id: item.variantId ?? item.productId, name: item.product.title, category: item.product.category, quantity: item.quantity, ...(item.variant?.currency === 'RUB' && item.variant.priceRub !== null && item.variant.priceSource !== 'unverified' ? { price: item.variant.priceRub } : {}) }))
}
let lastViewed = ''
export function viewProduct(product: PublicCatalogProduct, variantId?: string) {
  const variant = product.variants.find(v => v.id === variantId) ?? product.variants[0]
  const key = `${window.location.pathname}:${variant?.id ?? product.id}`
  if (lastViewed === key) return
  lastViewed = key
  goal('product_view')
  ecommerce('detail', [{ id: variant?.id ?? product.id, name: product.title, category: product.category?.name ?? '', quantity: 1, ...(variant?.priceRub != null ? { price: variant.priceRub } : {}) }])
}
export function addCartProduct(item: CartItem) { goal('add_to_cart'); ecommerce('add', cartProducts([item])) }
export function beginCheckout(items: CartItem[]) { if (items.length) goal('begin_checkout') }

export function purchase(order: { order_id: string; revenue: number; products: Product[]; status: string }) {
  if (!['paid', 'completed'].includes(order.status) || !order.order_id || !Number.isFinite(order.revenue) || order.revenue <= 0) return false
  const key = `ozelif-metrika-purchase:${order.order_id}`
  // Fail closed if durable deduplication is unavailable. Reloads must not create purchases.
  try { if (localStorage.getItem(key)) return false; localStorage.setItem(key, '1') } catch { return false }
  goal('purchase')
  ecommerce('purchase', order.products.map(p => ({ id: p.id, name: p.name, category: p.category, price: p.price, quantity: p.quantity })), { id: order.order_id, revenue: order.revenue })
  return true
}
