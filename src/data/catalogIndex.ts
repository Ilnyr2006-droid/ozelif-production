import { clothingLeatherProducts } from './clothingLeatherProducts'
import { shearlingProducts } from './shearlingProducts'
import { suedeProducts } from './suedeProducts'
import { shoeLeatherProducts } from './shoeLeatherProducts'
import { hardwareProducts } from './hardwareProducts'

export type CatalogVariant = {
  id: string
  title: string
  unit: string | null
  shade: string | null
  shadeHex: string | null
  priceRub: number | null
  oldPriceRub: number | null
  currency: 'RUB' | null
  priceSource: string
}

export type CatalogProduct = {
  id: string
  slug: string
  title: string
  href: string
  category: string
  image: string | null
  variants: CatalogVariant[]
}

export function normalizeCatalogUnit(value: string | null | undefined) {
  const normalized = value?.trim().toUpperCase()
  if (!normalized) return null
  if (['PCE', 'PCS', 'PC', 'ШТ', 'ШТ.'].includes(normalized)) return 'шт.'
  if (['FOT', 'FT2', 'FT²', 'ФУТ2', 'ФУТ²'].includes(normalized)) return 'фут²'
  if (['DM2', 'DM²', 'ДМ2', 'ДМ²'].includes(normalized)) return 'дм²'
  if (['M2', 'M²', 'М2', 'М²'].includes(normalized)) return 'м²'
  return value?.trim() ?? null
}

const clothing = clothingLeatherProducts.map(product => ({
  id: product.id,
  slug: product.slug,
  title: product.title,
  href: `/odejnayakozha/tproduct/${product.id}-${product.slug}`,
  category: 'Одежная кожа',
  image: product.image?.card.src ?? product.image?.full.src ?? null,
  variants: product.variants.map(variant => ({ ...variant, unit: normalizeCatalogUnit(variant.unit) })),
}))

const shearling = shearlingProducts.map(product => ({
  id: product.id,
  slug: product.slug,
  title: product.title,
  href: `/dublyonka/tproduct/${product.id}-${product.slug}`,
  category: 'Дублёночный материал',
  image: product.image,
  variants: product.variants.map(variant => ({ ...variant, unit: normalizeCatalogUnit(variant.unit), priceSource: variant.priceRub === null ? 'unverified' : 'imported' })),
}))

const suede = suedeProducts.map(product => ({
  id: product.id,
  slug: product.slug,
  title: product.title,
  href: `/zamsha/tproduct/${product.id}-${product.slug}`,
  category: 'Замша',
  image: product.image,
  variants: product.variants.map(variant => ({
    ...variant,
    unit: normalizeCatalogUnit(variant.unit),
    priceSource: variant.priceRub === null ? 'unverified' : 'imported',
  })),
}))

const shoeLeather = shoeLeatherProducts.map(product => ({
  id: product.id,
  slug: product.slug,
  title: product.color ? `${product.title} — ${product.color}` : product.title,
  href: `/obuvnayakozha/tproduct/${product.id}-${product.slug}`,
  category: 'Обувная кожа',
  image: product.image,
  variants: product.variants.map(variant => ({
    ...variant,
    unit: normalizeCatalogUnit(variant.unit),
    priceSource: variant.priceRub === null ? 'unverified' : 'imported',
  })),
}))

const hardware = hardwareProducts.map(product => ({
  id: product.id,
  slug: product.slug,
  title: product.title,
  href: `/furnitura/tproduct/${product.id}-${product.slug}`,
  category: 'Фурнитура',
  image: product.image,
  variants: product.variants.map(variant => ({
    ...variant,
    unit: normalizeCatalogUnit(variant.unit),
    priceSource: variant.priceRub === null ? 'unverified' : 'imported',
  })),
}))

const products: CatalogProduct[] = [...clothing, ...shearling, ...suede, ...shoeLeather, ...hardware]
const productById = new Map(products.map(product => [product.id, product]))

export const getAllProducts = () => products
export const getProductById = (productId: string) => productById.get(productId) ?? null
export const getVariantById = (productId: string, variantId: string | null) => {
  const product = getProductById(productId)
  if (!product) return null
  if (variantId === null) return null
  return product.variants.find(variant => variant.id === variantId) ?? null
}
export const getProductsByIds = (ids: string[]) => ids.map(getProductById).filter((item): item is CatalogProduct => item !== null)
export const isValidProductId = (id: string) => getProductById(id) !== null
export const isValidVariantId = (productId: string, variantId: string | null) => {
  const product = getProductById(productId)
  if (!product) return false
  return variantId === null ? product.variants.length === 0 : getVariantById(productId, variantId) !== null
}
