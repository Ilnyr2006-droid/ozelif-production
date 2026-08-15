import { readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(fileURLToPath(new URL('..', import.meta.url)))
const sourcePath = resolve(process.argv[2] ?? `${root}/data/source/store-11012911-202607191359.csv`)
const outputPath = resolve(process.argv[3] ?? `${root}/src/data/clothingLeatherProducts.ts`)
const imageManifestPath = resolve(`${root}/data/catalog/clothing-leather-images.json`)
const priceManifestPath = resolve(`${root}/data/catalog/clothing-leather-prices.json`)
const SUBTYPES = new Set(['Гладкая', 'Винтажная', 'Фактурная', 'Перфорированная', 'КРС'])

function parseCsv(source) {
  const rows = []; let row = []; let value = ''; let quoted = false
  for (let index = 0; index < source.length; index += 1) {
    const character = source[index]
    if (character === '"') { if (quoted && source[index + 1] === '"') { value += '"'; index += 1 } else quoted = !quoted }
    else if (character === ';' && !quoted) { row.push(value); value = '' }
    else if ((character === '\n' || character === '\r') && !quoted) { if (character === '\r' && source[index + 1] === '\n') index += 1; row.push(value); rows.push(row); row = []; value = '' }
    else value += character
  }
  if (value || row.length) { row.push(value); rows.push(row) }
  return rows.filter(rowItem => rowItem.some(Boolean))
}

const clean = value => value?.trim() || null
const parsePrice = value => { const price = Number(String(value ?? '').trim().replace(',', '.')); return Number.isFinite(price) && price > 0 ? price : null }
const slugFromUrl = (url, id) => url?.match(new RegExp(`/tproduct/${id}-(.+?)(?:\\?|$)`))?.[1] || id
const localProductPath = product => `/odejnayakozha/tproduct/${product.id}-${product.slug}`
const parseCategories = value => String(value ?? '').split(';').map(item => item.trim()).filter(Boolean)
const parseSubtypes = categories => [...new Set(categories.flatMap(category => category.split('/').map(item => item.trim())).filter(item => SUBTYPES.has(item)))]
function parseEdition(value) {
  const values = Object.fromEntries(String(value ?? '').split(';').map(item => {
    const separator = item.indexOf(':'); return separator === -1 ? [item.trim(), ''] : [item.slice(0, separator).trim(), item.slice(separator + 1).trim()]
  }).filter(([key]) => key))
  const shadeValue = values['Оттенок цвета'] || ''; const shadeMatch = shadeValue.match(/^(.*?)\s+(#[0-9a-f]{3,8})$/i)
  return { unit: clean(values['Единица измерения']), shade: clean(shadeMatch?.[1] ?? shadeValue), shadeHex: shadeMatch?.[2] ?? null }
}
const normalizeColor = value => value?.replace(/^Черный$/i, 'Чёрный') ?? null
const parseImageUrls = value => [...new Set(String(value ?? '').match(/https?:\/\/[^\s,;"']+/g) ?? [])]

const raw = (await readFile(sourcePath, 'utf8')).replace(/^\uFEFF/, '')
const [header, ...records] = parseCsv(raw)
const columns = Object.fromEntries(header.map((name, index) => [name, index]))
const get = (record, column) => record[columns[column]] ?? ''
const clothingRecords = records.filter(record => /\/odejnayakozha(?:\/[^/?]+)?\/tproduct\//.test(get(record, 'Url')))
const parents = clothingRecords.filter(record => !clean(get(record, 'Parent UID')))
const variations = clothingRecords.filter(record => clean(get(record, 'Parent UID')))
const parentById = new Map(parents.map(record => [get(record, 'Tilda UID'), record]))
const variantsByParent = new Map(parents.map(record => [get(record, 'Tilda UID'), []]))
for (const variation of variations) {
  const parentId = get(variation, 'Parent UID'); const group = variantsByParent.get(parentId)
  if (!group) throw new Error(`Lost Parent UID: ${parentId} for variant ${get(variation, 'Tilda UID')}`)
  group.push(variation)
}
let imageManifest = { products: [] }
try { imageManifest = JSON.parse(await readFile(imageManifestPath, 'utf8')) } catch (error) {
  if (error.code !== 'ENOENT') throw error
}
const imagesByProductId = new Map(imageManifest.products.map(product => [product.id, product]))
let priceManifest = { products: {} }
try { priceManifest = JSON.parse(await readFile(priceManifestPath, 'utf8')) } catch (error) {
  if (error.code !== 'ENOENT') throw error
}
const pricesByProductId = new Map(Object.entries(priceManifest.products))

const ids = new Set(); const urls = new Set(); const slugCounts = new Map()
const products = parents.map(record => {
  const id = get(record, 'Tilda UID'); const legacyUrl = get(record, 'Url'); const slug = slugFromUrl(legacyUrl, id)
  if (ids.has(id)) throw new Error(`Duplicate product id: ${id}`)
  if (urls.has(legacyUrl)) throw new Error(`Duplicate product URL: ${legacyUrl}`)
  ids.add(id); urls.add(legacyUrl); slugCounts.set(slug, (slugCounts.get(slug) ?? 0) + 1)
  const categories = parseCategories(get(record, 'Category')); const rawColor = clean(get(record, 'Characteristics:Цвет'))
  const sourceImageUrls = parseImageUrls(get(record, 'Photo'))
  const media = imagesByProductId.get(id)?.gallery ?? []
  if (media.length && media.length !== sourceImageUrls.length) throw new Error(`Image gallery mismatch for product ${id}`)
  const priceRecords = new Map((pricesByProductId.get(id)?.variants ?? []).map(variant => [variant.id, variant]))
  const productVariants = (variantsByParent.get(id) ?? []).map(variation => {
    const edition = parseEdition(get(variation, 'Editions')); const variantId = get(variation, 'Tilda UID'); const price = priceRecords.get(variantId)
    if (priceManifest.products && !price) throw new Error(`Missing price audit record for ${id}/${variantId}`)
    return { id: variantId, title: get(variation, 'Title'), externalId: clean(get(variation, 'External ID')), editions: clean(get(variation, 'Editions')), unit: price?.unit ?? edition.unit ?? clean(get(variation, 'Unit')), sourceUnit: price?.sourceUnit ?? edition.unit ?? clean(get(variation, 'Unit')), shade: edition.shade, shadeHex: edition.shadeHex, sourcePrice: price?.sourcePrice ?? parsePrice(get(variation, 'Price')), sourceOldPrice: price?.sourceOldPrice ?? parsePrice(get(variation, 'Price Old')), priceRub: price?.priceRub ?? null, oldPriceRub: price?.oldPriceRub ?? null, currency: price?.currency ?? null, priceSource: price?.priceSource ?? 'unverified' }
  })
  return { id, slug, title: get(record, 'Title'), legacyUrl, sourceImageUrls, images: media, image: media[0] ?? null, gallery: media, categories, subtype: parseSubtypes(categories), material: clean(get(record, 'Characteristics:Тип сырья')), color: rawColor, normalizedColor: normalizeColor(rawColor), article: clean(get(record, 'Characteristics:Особенности')), grade: clean(get(record, 'Characteristics:Сорт')), hideSize: clean(get(record, 'Characteristics:Размер шкур')), thickness: clean(get(record, 'Characteristics:Толщина (мм)')), country: clean(get(record, 'Characteristics:Страна производства')), coating: clean(get(record, 'Characteristics:Вид покрытия')), origin: clean(get(record, 'Characteristics:Происхождение сырья')), minimumOrder: clean(get(record, 'Characteristics:Минимальный заказ')), unit: clean(get(record, 'Unit')), portion: clean(get(record, 'Portion')), variants: productVariants }
})

const duplicateSlugValues = [...slugCounts.entries()].filter(([, count]) => count > 1).map(([slug]) => slug)
const statistics = { sourceRows: records.length, clothingRows: clothingRecords.length, products: products.length, variants: variations.length, lostParentUids: variations.filter(record => !parentById.has(get(record, 'Parent UID'))).length, productsWithoutPrice: products.filter(product => !product.variants.some(variant => variant.priceRub !== null)).length, productsWithoutImage: products.filter(product => !product.image).length, productsWithoutColor: products.filter(product => !product.color).length, duplicateIds: parents.length - ids.size, duplicateUrls: parents.length - urls.size, duplicateSlugs: duplicateSlugValues.length, duplicateSlugValues, normalizedBlackColors: products.filter(product => product.color === 'Черный').length }
const generated = `/* This file is generated by scripts/import-clothing-leather.mjs. Do not edit manually. */\n\nexport type ClothingLeatherPriceSource = 'rendered-old-site' | 'tilda-config' | 'verified-fixed-rate' | 'unverified'\nexport type ClothingLeatherVariant = { id: string; title: string; externalId: string | null; editions: string | null; unit: string | null; sourceUnit: string | null; shade: string | null; shadeHex: string | null; sourcePrice: number | null; sourceOldPrice: number | null; priceRub: number | null; oldPriceRub: number | null; currency: 'RUB' | null; priceSource: ClothingLeatherPriceSource }\n\nexport type ClothingLeatherImageVariant = { src: string; width: number; height: number; bytes: number }\nexport type ClothingLeatherImageSet = { src: string; srcSet: string; sizes: string; width: number; height: number; variants: ClothingLeatherImageVariant[] }\nexport type ClothingLeatherImage = { card: ClothingLeatherImageSet; full: ClothingLeatherImageSet; sourceUrl: string; sourceWidth: number; sourceHeight: number; sourceBytes: number; alt: string; sha256: string }\n\nexport type ClothingLeatherProduct = { id: string; slug: string; title: string; legacyUrl: string; sourceImageUrls: string[]; images: ClothingLeatherImage[]; image: ClothingLeatherImage | null; gallery: ClothingLeatherImage[]; categories: string[]; subtype: string[]; material: string | null; color: string | null; normalizedColor: string | null; article: string | null; grade: string | null; hideSize: string | null; thickness: string | null; country: string | null; coating: string | null; origin: string | null; minimumOrder: string | null; unit: string | null; portion: string | null; variants: ClothingLeatherVariant[] }\n\nexport const clothingLeatherProducts: ClothingLeatherProduct[] = ${JSON.stringify(products, null, 2)}\n\nexport const clothingLeatherImportStatistics = ${JSON.stringify(statistics, null, 2)} as const\n`
await writeFile(outputPath, generated)
console.log(JSON.stringify(statistics, null, 2))
