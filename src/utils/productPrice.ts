export type PriceSource = {
  priceRub?: unknown
  price?: unknown
  price_from?: unknown
  priceFrom?: unknown
  price_on_request?: boolean
  priceOnRequest?: boolean
  currency?: unknown
  priceSource?: unknown
  active?: boolean
  available?: boolean
  hidden?: boolean
  deleted?: boolean
  status?: unknown
  unit?: string | null
}

export type ProductPriceSource = PriceSource & {
  variants?: PriceSource[]
  offers?: PriceSource[]
  sizes?: PriceSource[]
}

export type ProductPriceDisplay = {
  kind: 'exact' | 'from' | 'on-request'
  price: number | null
  unit: string | null
}

const rubFormatter = new Intl.NumberFormat('ru-RU', {
  style: 'currency',
  currency: 'RUB',
  minimumFractionDigits: 0,
  maximumFractionDigits: 1,
})

export const formatRub = (value: number) => rubFormatter.format(value)

export function toValidPrice(value: unknown): number | null {
  const normalized = typeof value === 'string'
    ? value.replace(/[\s\u00a0]/g, '').replace(',', '.')
    : value
  const parsed = typeof normalized === 'number' || typeof normalized === 'string' ? Number(normalized) : NaN
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null
}

function isAvailable(source: PriceSource) {
  if (source.hidden || source.deleted || source.active === false || source.available === false) return false
  return !['hidden', 'deleted', 'inactive', 'unavailable'].includes(String(source.status ?? '').toLowerCase())
}

export function getSourcePrice(source: PriceSource): number | null {
  if (!isAvailable(source) || source.priceSource === 'unverified') return null
  if (source.currency !== undefined && source.currency !== null && source.currency !== 'RUB') return null

  return toValidPrice(source.priceRub)
    ?? toValidPrice(source.price)
    ?? toValidPrice(source.price_from)
    ?? toValidPrice(source.priceFrom)
}

export function getProductPriceDisplay(product: ProductPriceSource): ProductPriceDisplay {
  // In the current OZELIF models there is no price_on_request field. When it is
  // supplied by a future loader, a true value is treated as an explicit business rule.
  if (product.price_on_request === true || product.priceOnRequest === true) {
    return { kind: 'on-request', price: null, unit: null }
  }

  const sources = [product, ...(product.variants ?? []), ...(product.offers ?? []), ...(product.sizes ?? [])]
  const priced = sources
    .map(source => ({ price: getSourcePrice(source), unit: source.unit ?? null }))
    .filter((item): item is { price: number; unit: string | null } => item.price !== null)

  if (!priced.length) return { kind: 'on-request', price: null, unit: null }

  const prices = [...new Set(priced.map(item => item.price))]
  const lowest = priced.reduce((current, item) => item.price < current.price ? item : current)

  return { kind: prices.length === 1 ? 'exact' : 'from', price: lowest.price, unit: lowest.unit }
}

export function formatProductPrice(product: ProductPriceSource, normalizeUnit?: (unit: string | null | undefined) => string | null) {
  const display = getProductPriceDisplay(product)
  if (display.kind === 'on-request' || display.price === null) return 'Цена по запросу'
  const unit = normalizeUnit?.(display.unit) ?? display.unit
  return [display.kind === 'from' ? 'от' : null, formatRub(display.price), unit ? `за ${unit}` : null].filter(Boolean).join(' ')
}


/* OZELIF_DUAL_CARD_PRICE_BEGIN */
type DualPriceVariant = {
  priceRub?: number | null
  unit?: string | null
  currency?: string | null
  priceSource?: string | null
}

type DualPriceProduct = { variants?: DualPriceVariant[] }
type DualPriceOptions = { categorySlug?: string }
const SQUARE_FOOT_TO_SQUARE_DECIMETER = 9.290304
const dualPriceFormatter = new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 1 })

function confirmedDualPrice(variant: DualPriceVariant) {
  return Number.isFinite(Number(variant.priceRub))
    && Number(variant.priceRub) > 0
    && variant.priceSource !== 'unverified'
    && (variant.currency === undefined || variant.currency === null || variant.currency === 'RUB')
}

function formatDualPriceNumber(value: number) {
  return dualPriceFormatter
    .format(value)
    .replace(/[\u00a0\u202f]/g, ' ')
}

function dualPriceText(value: number, unit: string) {
  return `от ${formatDualPriceNumber(value)} ₽ за ${unit}`
}

export function getProductCardPriceLines(
  product: DualPriceProduct,
  normalizeUnit: (value: string | null | undefined) => string | null,
  options: DualPriceOptions = {},
) {
  const variants = (product.variants ?? []).filter(confirmedDualPrice).map(variant => ({
    price: Number(variant.priceRub),
    unit: normalizeUnit(variant.unit),
  }))

  if (!variants.length) return ['Цена по запросу']

  const minFor = (unit: string) => {
    const prices = variants.filter(variant => variant.unit === unit).map(variant => variant.price)
    return prices.length ? Math.min(...prices) : null
  }

  let squareFoot = minFor('фут²')
  let squareDecimeter = minFor('дм²')
  if (squareFoot === null && squareDecimeter !== null) squareFoot = squareDecimeter * SQUARE_FOOT_TO_SQUARE_DECIMETER
  if (squareDecimeter === null && squareFoot !== null) squareDecimeter = squareFoot / SQUARE_FOOT_TO_SQUARE_DECIMETER

  if (squareFoot !== null && squareDecimeter !== null) {
    return [dualPriceText(squareFoot, 'фут²'), dualPriceText(squareDecimeter, 'дм²')]
  }

  const first = variants.reduce((best, variant) => variant.price < best.price ? variant : best)
  if (options.categorySlug === 'furnitura') return [dualPriceText(first.price, 'шт.')]
  if (first.unit) return [dualPriceText(first.price, first.unit)]
  return [`от ${formatDualPriceNumber(first.price)} ₽`]
}
/* OZELIF_DUAL_CARD_PRICE_END */
