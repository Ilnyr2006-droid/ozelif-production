
import { useEffect, useMemo, useState } from 'react'
import { getProductCardPriceLines } from '../utils/productPrice'

type VariantLike = {
  priceRub?: number | null
  unit?: string | null
  currency?: string | null
  priceSource?: string | null
}

type ProductLike = {
  id: string
  variants: VariantLike[]
}

type PublicProduct = {
  base_price: string | number | null
  unit: string | null
  category_slug: string
  attributes?: Record<string, unknown> | null
  variants?: Array<{
    priceRub?: number | string | null
    unit?: string | null
    currency?: string | null
    priceSource?: string | null
  }>
}

const publicProductCache = new Map<string, PublicProduct | null>()

async function readPublicProduct(productId: string) {
  if (publicProductCache.has(productId)) {
    return publicProductCache.get(productId) ?? null
  }

  try {
    const response = await fetch(
      `/api/public/products/${encodeURIComponent(productId)}`,
    )

    if (!response.ok) {
      publicProductCache.set(productId, null)
      return null
    }

    const body = await response.json() as { item?: PublicProduct }
    const item = body.item ?? null
    publicProductCache.set(productId, item)
    return item
  } catch {
    publicProductCache.set(productId, null)
    return null
  }
}

export function CatalogCardPrice({
  product,
  normalizeUnit,
  categorySlug,
  skipManagedLookup = false,
}: {
  product: ProductLike
  normalizeUnit: (value: string | null | undefined) => string | null
  categorySlug: string
  skipManagedLookup?: boolean
}) {
  const [managed, setManaged] = useState<PublicProduct | null>(null)

  useEffect(() => {
    let cancelled = false

    if (skipManagedLookup || import.meta.env.MODE === 'test') {
      return () => {
        cancelled = true
      }
    }

    readPublicProduct(product.id).then(item => {
      if (cancelled) return

      if (item?.attributes?.__pricingManaged === true) {
        setManaged(item)
      }
    })

    return () => {
      cancelled = true
    }
  }, [product.id, skipManagedLookup])

  const effectiveProduct = useMemo<ProductLike>(() => {
    if (!managed) return product

    const managedVariants = (managed.variants ?? [])
      .map(variant => ({
        priceRub: Number(variant.priceRub),
        unit: variant.unit,
        currency: variant.currency ?? 'RUB',
        priceSource: variant.priceSource ?? 'admin',
      }))
      .filter(variant => Number.isFinite(variant.priceRub) && variant.priceRub > 0)

    if (managedVariants.length) {
      return {
        id: product.id,
        variants: managedVariants,
      }
    }

    const price = Number(managed.base_price)
    if (!Number.isFinite(price) || price <= 0) return product

    return {
      id: product.id,
      variants: [{
        priceRub: price,
        unit: managed.unit,
        currency: 'RUB',
        priceSource: 'admin',
      }],
    }
  }, [managed, product])

  const lines = getProductCardPriceLines(
    effectiveProduct,
    normalizeUnit,
    {
      categorySlug: managed?.category_slug ?? categorySlug,
    },
  )

  return (
    <span className="product-card-price product-card-price--stack">
      {lines.map((line, index) => (
        <span className={index === 0 && lines.length > 1 ? 'is-secondary' : ''} key={line}>
          {line}
        </span>
      ))}
    </span>
  )
}
