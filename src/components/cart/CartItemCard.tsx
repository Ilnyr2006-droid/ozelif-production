import { Minus, Plus, Trash2 } from 'lucide-react'
import type { CartItem } from '../../cart/cartTypes'
import { useCart } from '../../cart/CartProvider'

const money = new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB', maximumFractionDigits: 0 })

export function CartItemCard({ item }: { item: CartItem }) {
  const { updateQuantity, removeItem } = useCart()
  const product = item.product
  const variant = item.variant
  const isConfirmed = variant !== null && variant.priceRub !== null && variant.currency === 'RUB' && variant.priceSource !== 'unverified'
  const unit = variant?.unit ?? null

  return <article className="cart-item">
    <a className="cart-item-image" href={product.href} aria-label={`Открыть товар ${product.title}`}>
      {product.image ? <img src={product.image} alt="" width={112} height={132} loading="lazy"/> : <span>OZELIF</span>}
    </a>
    <div className="cart-item-body">
      <div className="cart-item-head"><p>{product.category}</p><button type="button" onClick={() => removeItem(item.productId, item.variantId)} aria-label={`Удалить ${product.title} из корзины`}><Trash2 size={16}/></button></div>
      <a href={product.href} className="cart-item-title">{product.title}</a>
      <p className="cart-item-variant">{variant ? `${variant.title}${variant.shade ? ` · ${variant.shade}` : ''}` : 'Вариант уточняется'}</p>
      <p className="cart-item-price">{isConfirmed ? `${money.format(variant.priceRub!)}${unit ? ` / ${unit}` : ''}` : 'Цена уточняется'}{isConfirmed && variant.oldPriceRub !== null && variant.oldPriceRub > variant.priceRub! && <del>{money.format(variant.oldPriceRub)}</del>}</p>
      <div className="cart-item-controls"><div><button type="button" onClick={() => updateQuantity(item.productId, item.variantId, item.quantity - 1)} aria-label="Уменьшить количество"><Minus size={14}/></button><input aria-label={`Количество: ${product.title}`} type="number" min="1" max="999" value={item.quantity} onChange={event => updateQuantity(item.productId, item.variantId, Number(event.target.value))}/><button type="button" onClick={() => updateQuantity(item.productId, item.variantId, item.quantity + 1)} aria-label="Увеличить количество"><Plus size={14}/></button></div><span>{item.quantity} {unit ?? 'шт.'}</span></div>
    </div>
  </article>
}
