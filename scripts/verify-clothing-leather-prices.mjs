import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(fileURLToPath(new URL('..', import.meta.url)))
const cache = JSON.parse(await readFile(`${root}/data/catalog/clothing-leather-prices.json`, 'utf8'))
const failures = []
const products = Object.entries(cache.products)
const variants = products.flatMap(([productId, product]) => product.variants.map(variant => ({ productId, ...variant })))
const externalIds = new Set()
let confirmed = 0; let withoutPrice = 0

if (products.length !== 88) failures.push(`Expected 88 products, got ${products.length}`)
if (variants.length !== 176) failures.push(`Expected 176 variants, got ${variants.length}`)
if (cache.currency !== 'RUB' || cache.conversionMethod !== 'tilda-rendered-price' || cache.conversionRate !== null) failures.push('Unexpected price source metadata')
for (const variant of variants) {
  if (!variant.unit) failures.push(`Missing unit for ${variant.productId}/${variant.id}`)
  if (variant.externalId) {
    if (externalIds.has(variant.externalId)) failures.push(`Duplicate External ID ${variant.externalId}`)
    externalIds.add(variant.externalId)
  }
  if (variant.priceRub === null) { withoutPrice += 1; continue }
  confirmed += 1
  if (variant.currency !== 'RUB') failures.push(`Non-RUB confirmed price for ${variant.productId}/${variant.id}`)
  if (variant.priceSource === 'unverified') failures.push(`Unverified display price for ${variant.productId}/${variant.id}`)
  if (!(variant.priceRub > 0)) failures.push(`Invalid price for ${variant.productId}/${variant.id}`)
  if (variant.oldPriceRub !== null && variant.oldPriceRub <= variant.priceRub) failures.push(`Old price is not greater for ${variant.productId}/${variant.id}`)
}
const summary = { products: products.length, variants: variants.length, confirmedProducts: products.filter(([, product]) => product.variants.some(variant => variant.priceRub !== null)).length, confirmedVariants: confirmed, productsWithoutPrice: products.filter(([, product]) => product.variants.every(variant => variant.priceRub === null)).length, variantsWithoutPrice: withoutPrice, productsWithMultipleUnits: products.filter(([, product]) => new Set(product.variants.map(variant => variant.unit)).size > 1).length, mismatches: cache.mismatches.length, conversionMethod: cache.conversionMethod, conversionRate: cache.conversionRate, failures }
console.log(JSON.stringify(summary, null, 2))
if (failures.length || cache.mismatches.length) process.exitCode = 1
