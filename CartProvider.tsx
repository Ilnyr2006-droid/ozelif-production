/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { CartInput, CartItem, CartProductSnapshot, CartVariantSnapshot } from './cartTypes'
import { trackEvent } from '../analytics/track'

const CART_STORAGE_KEY = 'ozelif-cart-v1'
const MAX_QUANTITY = 999
type CartContextValue = { items: CartItem[]; itemCount: number; isOpen: boolean; openCart(): void; closeCart(): void; addItem(input: CartInput): void; updateQuantity(productId: string, variantId: string | null, quantity: number): void; removeItem(productId: string, variantId: string | null): void; clearCart(): void; hasItem(productId: string, variantId: string | null): boolean; refreshPrices(): Promise<void> }
const emptyCartContext: CartContextValue = { items: [], itemCount: 0, isOpen: false, openCart: () => undefined, closeCart: () => undefined, addItem: () => undefined, updateQuantity: () => undefined, removeItem: () => undefined, clearCart: () => undefined, hasItem: () => false, refreshPrices: async () => undefined }
const CartContext = createContext<CartContextValue | null>(null)
const itemKey = (productId: string, variantId: string | null) => `${productId}:${variantId ?? 'none'}`
const clamp = (value: number) => Math.min(MAX_QUANTITY, Math.max(1, Math.floor(Number.isFinite(value) ? value : 1)))
const knownCategory = (value: string | null | undefined) => value && /^[a-z0-9-]+$/.test(value) ? value : null
const defaultProduct = (): CartProductSnapshot => ({ title: 'Товар из сохранённой корзины', href: '#', category: 'Материал', categorySlug: null, image: null })
const defaultVariant = (): CartVariantSnapshot => ({ title: 'Вариант уточняется', shade: null, unit: null, priceRub: null, oldPriceRub: null, currency: null, priceSource: 'unverified' })

function validItem(value: unknown): value is CartItem {
  if (!value || typeof value !== 'object') return false
  const item = value as Partial<CartItem>
  return typeof item.productId === 'string' && (typeof item.variantId === 'string' || item.variantId === null) && typeof item.quantity === 'number' && typeof item.addedAt === 'string'
}
function normalizeStored(value: unknown): CartItem | null {
  if (!validItem(value)) return null
  const item = value as CartItem
  return { ...item, quantity: clamp(item.quantity), product: item.product && typeof item.product.title === 'string' ? item.product : defaultProduct(), variant: item.variant && typeof item.variant.title === 'string' ? item.variant : defaultVariant() }
}
function readCart(): CartItem[] {
  try { const saved = JSON.parse(window.localStorage.getItem(CART_STORAGE_KEY) ?? '{"items":[]}') as { items?: unknown[] }; const dedupe = new Map<string, CartItem>(); for (const raw of saved.items ?? []) { const item = normalizeStored(raw); if (!item) continue; const key = itemKey(item.productId, item.variantId); const existing = dedupe.get(key); dedupe.set(key, { ...item, quantity: clamp((existing?.quantity ?? 0) + item.quantity) }) } return [...dedupe.values()] } catch { return [] }
}
function confirmed(item: CartItem) { const variant = item.variant; return variant !== null && variant.priceRub !== null && variant.currency === 'RUB' && variant.priceSource !== 'unverified' }
export const getCartConfirmedSubtotal = (items: CartItem[]) => items.reduce((sum, item) => confirmed(item) ? sum + item.variant!.priceRub! * item.quantity : sum, 0)
export const getCartUnpricedItemsCount = (items: CartItem[]) => items.filter(item => !confirmed(item)).length
export const getCartSummary = (items: CartItem[]) => ({ subtotal: getCartConfirmedSubtotal(items), unpricedItemsCount: getCartUnpricedItemsCount(items), itemCount: items.reduce((sum, item) => sum + item.quantity, 0) })

function snapshot(input: CartInput): { product: CartProductSnapshot; variant: CartVariantSnapshot | null } {
  if (input.snapshot) return input.snapshot
  const categorySlug = knownCategory(input.product?.slug?.includes('') ? null : null)
  return { product: { title: input.product?.title ?? defaultProduct().title, href: '#', category: input.product?.subtype?.[0] ?? 'Материал', categorySlug, image: input.product?.image?.url ?? null }, variant: input.variant ? { title: input.variant.title ?? 'Вариант', shade: input.variant.shade ?? null, unit: input.variant.unit ?? null, priceRub: input.variant.priceRub ?? null, oldPriceRub: input.variant.oldPriceRub ?? null, currency: input.variant.currency ?? null, priceSource: input.variant.priceSource ?? (input.variant.priceRub ? 'api' : 'unverified') } : defaultVariant() }
}
async function refreshItem(item: CartItem): Promise<CartItem> {
  const slug = knownCategory(item.product.categorySlug)
  if (!slug || !item.variantId) return item
  try {
    const response = await fetch(`/api/public/catalog/v1/categories/${encodeURIComponent(slug)}/products/${encodeURIComponent(item.productId)}`, { headers: { Accept: 'application/json' } })
    if (!response.ok) return item
    const body = await response.json() as { item?: { name?: string; slug?: string; primaryImage?: { url?: string }; variants?: Array<{ id?: string; name?: string; price?: number | string | null; oldPrice?: number | string | null; currency?: 'RUB' | null; unit?: string | null; attributes?: { shade?: string } }> } }
    const product = body.item
    const variant = product?.variants?.find(value => value.id === item.variantId)
    if (!product || !variant) return item
    const price = Number(variant.price)
    const oldPrice = Number(variant.oldPrice)
    return { ...item, product: { ...item.product, title: product.name ?? item.product.title, href: `/${slug}/tproduct/${item.productId}-${product.slug ?? ''}`, image: product.primaryImage?.url ?? item.product.image }, variant: { title: variant.name ?? item.variant?.title ?? 'Вариант', shade: variant.attributes?.shade ?? item.variant?.shade ?? null, unit: variant.unit ?? null, priceRub: Number.isFinite(price) && price > 0 ? price : null, oldPriceRub: Number.isFinite(oldPrice) && oldPrice > 0 ? oldPrice : null, currency: variant.currency === 'RUB' ? 'RUB' : null, priceSource: Number.isFinite(price) && price > 0 ? 'api' : 'unverified' } }
  } catch { return item }
}
export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>(readCart); const [isOpen, setIsOpen] = useState(false)
  useEffect(() => { try { window.localStorage.setItem(CART_STORAGE_KEY, JSON.stringify({ items })) } catch { /* optional storage */ } }, [items])
  const value = useMemo<CartContextValue>(() => ({ items, itemCount: items.reduce((sum, item) => sum + item.quantity, 0), isOpen, openCart: () => { setIsOpen(true); void trackEvent('cart_open', { entityType: 'cart', metadata: { itemCount: items.reduce((sum, item) => sum + item.quantity, 0) } }) }, closeCart: () => setIsOpen(false), addItem: (input) => { if (!input.productId || !input.variantId || (!input.snapshot && !input.product)) return; const saved = snapshot(input); void trackEvent('add_to_cart', { entityType: 'product', entityId: input.productId, metadata: { category: saved.product.categorySlug ?? 'unknown', quantity: clamp(input.quantity ?? 1) } }); setItems(current => { const key = itemKey(input.productId, input.variantId); const old = current.find(item => itemKey(item.productId, item.variantId) === key); return old ? current.map(item => itemKey(item.productId, item.variantId) === key ? { ...item, quantity: clamp(item.quantity + (input.quantity ?? 1)), product: saved.product, variant: saved.variant } : item) : [...current, { productId: input.productId, variantId: input.variantId, quantity: clamp(input.quantity ?? 1), addedAt: new Date().toISOString(), ...saved }] }) }, updateQuantity: (productId, variantId, quantity) => setItems(current => current.map(item => itemKey(item.productId, item.variantId) === itemKey(productId, variantId) ? { ...item, quantity: clamp(quantity) } : item)), removeItem: (productId, variantId) => setItems(current => current.filter(item => itemKey(item.productId, item.variantId) !== itemKey(productId, variantId))), clearCart: () => setItems([]), hasItem: (productId, variantId) => items.some(item => itemKey(item.productId, item.variantId) === itemKey(productId, variantId)), refreshPrices: async () => setItems(await Promise.all(items.map(refreshItem))) }), [isOpen, items])
  return <CartContext.Provider value={value}>{children}</CartContext.Provider>
}
export function useCart() { return useContext(CartContext) ?? emptyCartContext }
