export type CartProductSnapshot = {
  title: string
  href: string
  category: string
  categorySlug: string | null
  image: string | null
}

export type CartVariantSnapshot = {
  title: string
  shade: string | null
  unit: string | null
  priceRub: number | null
  oldPriceRub: number | null
  currency: 'RUB' | null
  priceSource: string
}

export type CartItem = {
  productId: string
  variantId: string | null
  quantity: number
  addedAt: string
  product: CartProductSnapshot
  variant: CartVariantSnapshot | null
}

export type CartInput = Pick<CartItem, 'productId' | 'variantId'> & {
  quantity?: number
  product?: { title?: string; image?: { url?: string } | null; slug?: string; subtype?: string[] }
  variant?: { title?: string; shade?: string | null; unit?: string | null; priceRub?: number | null; oldPriceRub?: number | null; currency?: 'RUB' | null; priceSource?: string }
  snapshot?: { product: CartProductSnapshot; variant: CartVariantSnapshot | null }
}
