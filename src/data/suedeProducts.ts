import csvSource from '../../data/source/store-11012911-202607191359.csv?raw'

export type SuedeVariant = {
  id: string
  title: string
  unit: string | null
  shade: string | null
  shadeHex: string | null
  sourcePrice: number | null
  sourceOldPrice: number | null
  priceRub: number | null
  oldPriceRub: number | null
  currency: 'RUB' | null
}

export type SuedeProduct = {
  id: string
  slug: string
  title: string
  legacyUrl: string
  image: string | null
  categories: string[]
  subtype: string[]
  material: string | null
  color: string | null
  normalizedColor: string | null
  hideSize: string | null
  thickness: string | null
  country: string | null
  coating: string | null
  origin: string | null
  variants: SuedeVariant[]
}

const SUBTYPES = new Set(['Гладкая', 'Фактурная'])

function parseCsv(source: string) {
  const rows: string[][] = []
  let row: string[] = []
  let value = ''
  let quoted = false

  for (let index = 0; index < source.length; index += 1) {
    const character = source[index]

    if (character === '"') {
      if (quoted && source[index + 1] === '"') {
        value += '"'
        index += 1
      } else {
        quoted = !quoted
      }
    } else if (character === ';' && !quoted) {
      row.push(value)
      value = ''
    } else if ((character === '\n' || character === '\r') && !quoted) {
      if (character === '\r' && source[index + 1] === '\n') index += 1
      row.push(value)
      if (row.some(Boolean)) rows.push(row)
      row = []
      value = ''
    } else {
      value += character
    }
  }

  if (value || row.length) {
    row.push(value)
    if (row.some(Boolean)) rows.push(row)
  }

  return rows
}

const normalizeUnit = (value: string | null | undefined) => {
  const normalized = value?.trim().toUpperCase()

  if (!normalized) return null
  if (['FOT', 'FT2', 'FT²', 'ФУТ2', 'ФУТ²'].includes(normalized)) return 'фут²'
  if (['DM2', 'DM²', 'ДМ2', 'ДМ²'].includes(normalized)) return 'дм²'
  if (['M2', 'M²', 'М2', 'М²'].includes(normalized)) return 'м²'

  return value?.trim() ?? null
}

const clean = (value: string | undefined) => value?.trim() || null

const parsePrice = (value: string | undefined) => {
  const parsed = Number(String(value ?? '').trim().replace(',', '.'))
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null
}

// Fixed store conversion used by the public OZELIF catalog.
// Verified against visible prices: 6.50 -> 603.7 ₽ and 9.285 -> 862.4 ₽.
const STORE_RUB_RATE = 92.88
const toStoreRub = (value: number | null) =>
  value === null ? null : Math.round(value * STORE_RUB_RATE * 10) / 10

const parseCategories = (value: string | undefined) =>
  String(value ?? '')
    .split(';')
    .map(item => item.trim())
    .filter(Boolean)

const parseSubtypes = (categories: string[], legacyUrl = '', title = '') => {
  const direct = categories
    .flatMap(category => category.split('/').map(item => item.trim()))
    .filter(item => SUBTYPES.has(item))

  const source = [legacyUrl, title, ...categories].join(' ').toLocaleLowerCase('ru')
  if (/фактур|fakturn/.test(source)) direct.push('Фактурная')
  if (/гладк|gladk/.test(source)) direct.push('Гладкая')

  return [...new Set(direct)]
}

function parseEdition(value: string | undefined) {
  const values = Object.fromEntries(
    String(value ?? '')
      .split(';')
      .map(item => {
        const separator = item.indexOf(':')
        return separator === -1
          ? [item.trim(), '']
          : [item.slice(0, separator).trim(), item.slice(separator + 1).trim()]
      })
      .filter(([key]) => key),
  )

  const shadeValue = values['Оттенок цвета'] || ''
  const shadeMatch = shadeValue.match(/^(.*?)\s+(#[0-9a-f]{3,8})$/i)

  return {
    unit: normalizeUnit(clean(values['Единица измерения'])),
    shade: clean(shadeMatch?.[1] ?? shadeValue),
    shadeHex: shadeMatch?.[2] ?? null,
  }
}

const normalizeColor = (value: string | null) =>
  value?.replace(/^Черный$/i, 'Чёрный') ?? null

const rows = parseCsv(csvSource.replace(/^\uFEFF/, ''))
const [header, ...records] = rows
const columns = Object.fromEntries(header.map((name, index) => [name, index]))
const get = (record: string[], column: string) => record[columns[column]] ?? ''

const catalogRecords = records.filter(record =>
  /\/zamsha(?:\/[^/?]+)?\/tproduct\//.test(get(record, 'Url')),
)

const parents = catalogRecords.filter(record => !clean(get(record, 'Parent UID')))
const variants = catalogRecords.filter(record => clean(get(record, 'Parent UID')))
const variantsByParent = new Map(parents.map(record => [get(record, 'Tilda UID'), [] as string[][]]))

for (const variant of variants) {
  const parentId = get(variant, 'Parent UID')
  const group = variantsByParent.get(parentId)
  if (!group) throw new Error(`Lost Parent UID: ${parentId}`)
  group.push(variant)
}

const parsedSuedeProducts: SuedeProduct[] = parents.map(record => {
  const id = get(record, 'Tilda UID')
  const legacyUrl = get(record, 'Url')
  const categories = parseCategories(get(record, 'Category'))
  const color = clean(get(record, 'Characteristics:Цвет'))

  return {
    id,
    slug: legacyUrl.match(new RegExp(`/tproduct/${id}-(.+?)(?:\\?|$)`))?.[1] || id,
    title: get(record, 'Title').replaceAll('&amp;', '&'),
    legacyUrl,
    image: clean(get(record, 'Photo')),
    categories,
    subtype: parseSubtypes(categories, legacyUrl, get(record, 'Title')),
    material: clean(get(record, 'Characteristics:Тип сырья')),
    color,
    normalizedColor: normalizeColor(color),
    hideSize: clean(get(record, 'Characteristics:Размер шкур')),
    thickness: clean(get(record, 'Characteristics:Толщина (мм)')),
    country: clean(get(record, 'Characteristics:Страна производства')),
    coating: clean(get(record, 'Characteristics:Вид покрытия')),
    origin: clean(get(record, 'Characteristics:Происхождение сырья')),
    variants: (variantsByParent.get(id) ?? []).map(variant => {
      const edition = parseEdition(get(variant, 'Editions'))

      return {
        id: get(variant, 'Tilda UID'),
        title: get(variant, 'Title').replaceAll('&amp;', '&'),
        unit: normalizeUnit(edition.unit ?? clean(get(variant, 'Unit'))),
        shade: edition.shade,
        shadeHex: edition.shadeHex,
        sourcePrice: parsePrice(get(variant, 'Price')),
        sourceOldPrice: parsePrice(get(variant, 'Price Old')),
        priceRub: toStoreRub(parsePrice(get(variant, 'Price'))),
        oldPriceRub: toStoreRub(parsePrice(get(variant, 'Price Old'))),
        currency: parsePrice(get(variant, 'Price')) !== null ? 'RUB' : null,
      }
    }),
  }
})


export const suedeProducts: SuedeProduct[] = parsedSuedeProducts.filter(
  product => !product.title.toLocaleLowerCase('ru').includes('sandy brown'),
)

export const suedeImportStatistics = {
  rows: catalogRecords.length,
  products: suedeProducts.length,
  variants: variants.length,
} as const
