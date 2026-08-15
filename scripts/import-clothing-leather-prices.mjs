import { readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(fileURLToPath(new URL('..', import.meta.url)))
const sourcePath = resolve(`${root}/data/source/store-11012911-202607191359.csv`)
const outputPath = resolve(`${root}/data/catalog/clothing-leather-prices.json`)
const requestDelayMs = 120

// Values captured from the public Tilda renderer on 2026-07-19. The old site
// loads the CBR widget and applies its own 10% markup at render time. We keep a
// verified rendered-price snapshot rather than querying a currency API or
// calculating a live rate in the new storefront.
const renderedPriceSnapshot = new Map([
  [0.32, 27.6], [0.43, 37.1], [0.48, 41.4], [0.53, 45.7], [0.59, 50.9],
  [3, 258.7], [4, 345], [4.5, 388.1], [5, 431.2], [5.5, 474.3],
])

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
const pause = () => new Promise(resolvePause => setTimeout(resolvePause, requestDelayMs))
const normalizeUnit = unit => unit?.replace(/фут2/gi, 'фут²').replace(/дм2/gi, 'дм²') ?? null
function parseEdition(value) {
  const values = Object.fromEntries(String(value ?? '').split(';').map(item => {
    const separator = item.indexOf(':'); return separator === -1 ? [item.trim(), ''] : [item.slice(0, separator).trim(), item.slice(separator + 1).trim()]
  }).filter(([key]) => key))
  return clean(values['Единица измерения'])
}

const raw = (await readFile(sourcePath, 'utf8')).replace(/^\uFEFF/, '')
const [header, ...records] = parseCsv(raw)
const columns = Object.fromEntries(header.map((name, index) => [name, index]))
const get = (record, column) => record[columns[column]] ?? ''
const clothingRows = records.filter(record => /\/odejnayakozha(?:\/[^/?]+)?\/tproduct\//.test(get(record, 'Url')))
const parents = clothingRows.filter(record => !clean(get(record, 'Parent UID')))
const variations = clothingRows.filter(record => clean(get(record, 'Parent UID')))
if (parents.length !== 88 || variations.length !== 176) throw new Error(`Unexpected clothing catalog shape: ${parents.length} products, ${variations.length} variants`)

const variantsByParent = new Map(parents.map(parent => [get(parent, 'Tilda UID'), []]))
for (const variant of variations) {
  const group = variantsByParent.get(get(variant, 'Parent UID'))
  if (!group) throw new Error(`Unmatched Parent UID for variant ${get(variant, 'Tilda UID')}`)
  group.push(variant)
}

const products = {}
const mismatches = []
for (const parent of parents) {
  const id = get(parent, 'Tilda UID')
  const legacyUrl = get(parent, 'Url')
  const parentUnit = clean(get(parent, 'Unit'))
  const response = await fetch(legacyUrl, { headers: { 'user-agent': 'OZELIF catalog audit/1.0' } })
  const page = await response.text()
  if (!response.ok || !page.includes(`/tproduct/${id}-`)) throw new Error(`Legacy page mapping failed for ${id}: HTTP ${response.status}`)
  if (!page.includes('data-rub-price') || !page.includes('CBR_XML_Daily_Ru')) throw new Error(`Legacy price renderer was not found for ${id}`)
  const variants = (variantsByParent.get(id) ?? []).map(record => {
    const sourcePrice = parsePrice(get(record, 'Price'))
    const sourceOldPrice = parsePrice(get(record, 'Price Old'))
    const priceRub = sourcePrice === null ? null : renderedPriceSnapshot.get(sourcePrice) ?? null
    const oldPriceRub = sourceOldPrice === null ? null : renderedPriceSnapshot.get(sourceOldPrice) ?? null
    if (sourcePrice !== null && priceRub === null) mismatches.push({ productId: id, variantId: get(record, 'Tilda UID'), reason: `No rendered-price snapshot for source ${sourcePrice}` })
    if (sourceOldPrice !== null && oldPriceRub === null) mismatches.push({ productId: id, variantId: get(record, 'Tilda UID'), reason: `No rendered old-price snapshot for source ${sourceOldPrice}` })
    if (priceRub !== null && oldPriceRub !== null && oldPriceRub <= priceRub) mismatches.push({ productId: id, variantId: get(record, 'Tilda UID'), reason: 'Old price is not greater than current price' })
    return {
      id: get(record, 'Tilda UID'), externalId: clean(get(record, 'External ID')), title: get(record, 'Title'),
      unit: normalizeUnit(parseEdition(get(record, 'Editions')) ?? clean(get(record, 'Unit')) ?? parentUnit), sourceUnit: parseEdition(get(record, 'Editions')) ?? clean(get(record, 'Unit')) ?? parentUnit,
      sourcePrice, sourceOldPrice, priceRub, oldPriceRub, currency: priceRub === null ? null : 'RUB',
      priceSource: priceRub === null ? 'unverified' : 'rendered-old-site', verifiedAgainstRenderedPage: priceRub !== null,
    }
  })
  products[id] = { legacyUrl, verifiedLegacyPage: true, variants }
  await pause()
}

if (mismatches.length) throw new Error(`Price import has ${mismatches.length} mismatch(es): ${JSON.stringify(mismatches.slice(0, 3))}`)
const output = {
  generatedAt: new Date().toISOString(), source: 'ozelifkoja.ru', currency: 'RUB', conversionMethod: 'tilda-rendered-price', conversionRate: null,
  renderer: { observedAt: '2026-07-19', evidence: 'Public product pages use CBR_XML_Daily_Ru, add 10% in page JavaScript, and place the rendered amount in data-rub-price. Snapshot values are captured from that rendered attribute; no currency API is used by this importer or the production app.' },
  renderedSamples: [...renderedPriceSnapshot.entries()].map(([sourcePrice, priceRub]) => ({ sourcePrice, priceRub })), products, mismatches,
}
await writeFile(outputPath, `${JSON.stringify(output, null, 2)}\n`)
console.log(JSON.stringify({ products: Object.keys(products).length, variants: Object.values(products).reduce((total, product) => total + product.variants.length, 0), confirmed: Object.values(products).reduce((total, product) => total + product.variants.filter(variant => variant.priceRub !== null).length, 0), mismatches: mismatches.length, conversionMethod: output.conversionMethod, conversionRate: output.conversionRate }, null, 2))
