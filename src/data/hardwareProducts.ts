
import csvSource from '../../data/source/store-11012911-202607191359.csv?raw'

export type HardwareVariant = {
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

export type HardwareProduct = {
  id: string
  slug: string
  title: string
  legacyUrl: string
  image: string | null
  categories: string[]
  subtype: string
  brand: string | null
  minimumOrder: string | null
  country: string | null
  zipperType: string | null
  connectionType: string | null
  tapeColor: string | null
  metalColor: string | null
  length: string | null
  diameter: string | null
  variants: HardwareVariant[]
}

const localHardwareImageById: Record<string, string> = {
  '145892231632': '/images/catalog/hardware/145892231632.jpg',
  '215893631892': '/images/catalog/hardware/215893631892.jpg',
  '230111089532': '/images/catalog/hardware/230111089532.jpg',
  '261950592552': '/images/catalog/hardware/261950592552.jpg',
  '309625921252': '/images/catalog/hardware/309625921252.jpg',
  '335015677072': '/images/catalog/hardware/335015677072.jpg',
  '430427505372': '/images/catalog/hardware/430427505372.jpg',
  '466039704042': '/images/catalog/hardware/466039704042.jpg',
  '494593832262': '/images/catalog/hardware/494593832262.jpg',
  '608459593322': '/images/catalog/hardware/608459593322.jpg',
  '660438162572': '/images/catalog/hardware/660438162572.jpg',
  '727842353882': '/images/catalog/hardware/727842353882.jpg',
  '731755138242': '/images/catalog/hardware/731755138242.jpg',
  '785959637532': '/images/catalog/hardware/785959637532.jpg',
  '878018632782': '/images/catalog/hardware/878018632782.jpg',
  '919655081872': '/images/catalog/hardware/919655081872.jpg',
}

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

const clean = (value: string | undefined) => value?.trim() || null

const normalizeUnit = (value: string | null | undefined) => {
  const normalized = value?.trim().toUpperCase()
  if (!normalized) return null
  if (['PCE', 'PCS', 'PC', 'ШТ', 'ШТ.'].includes(normalized)) return 'шт.'
  if (['FOT', 'FT2', 'FT²', 'ФУТ2', 'ФУТ²'].includes(normalized)) return 'фут²'
  if (['DM2', 'DM²', 'ДМ2', 'ДМ²'].includes(normalized)) return 'дм²'
  if (['M2', 'M²', 'М2', 'М²'].includes(normalized)) return 'м²'
  return value?.trim() ?? null
}

const parsePrice = (value: string | undefined) => {
  const parsed = Number(String(value ?? '').trim().replace(',', '.'))
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null
}

const STORE_RUB_RATE = 92.88
const toStoreRub = (value: number | null) =>
  value === null ? null : Math.round(value * STORE_RUB_RATE * 10) / 10

const parseCategories = (value: string | undefined) =>
  String(value ?? '')
    .split(';')
    .map(item => item.trim())
    .filter(Boolean)

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

const inferSubtype = (categories: string[], title: string) => {
  const source = [...categories, title].join(' ').toLocaleLowerCase('ru')
  if (source.includes('кнопк')) return 'Кнопки'
  if (source.includes('молни')) return 'Молнии'
  return 'Фурнитура'
}

const inferBrand = (title: string) => {
  const match = title.match(/\b(YKK|INOX)\b/i)
  if (!match) return null
  return match[1].toUpperCase() === 'INOX' ? 'Inox' : 'YKK'
}

const rows = parseCsv(csvSource.replace(/^\uFEFF/, ''))
const [header, ...records] = rows
const columns = Object.fromEntries(header.map((name, index) => [name, index]))
const get = (record: string[], column: string) => record[columns[column]] ?? ''

const catalogRecords = records.filter(record =>
  /\/furnitura(?:\/[^/?]+)?\/tproduct\//.test(get(record, 'Url')),
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

export const hardwareProducts: HardwareProduct[] = parents.map(record => {
  const id = get(record, 'Tilda UID')
  const legacyUrl = get(record, 'Url')
  const title = get(record, 'Title').replaceAll('&amp;', '&')
  const categories = parseCategories(get(record, 'Category'))
  const parentUnit = normalizeUnit(clean(get(record, 'Unit')))

  return {
    id,
    slug: legacyUrl.match(new RegExp(`/tproduct/${id}-(.+?)(?:\\?|$)`))?.[1] || id,
    title,
    legacyUrl,
    image: localHardwareImageById[id] ?? clean(get(record, 'Photo')),
    categories,
    subtype: inferSubtype(categories, title),
    brand: inferBrand(title),
    minimumOrder: clean(get(record, 'Characteristics:Минимальный заказ')),
    country: clean(get(record, 'Characteristics:Страна производства')),
    zipperType: clean(get(record, 'Characteristics:Тип молнии')),
    connectionType: clean(get(record, 'Characteristics:Вид соединения')),
    tapeColor: clean(get(record, 'Characteristics:Цвет тесьмы')),
    metalColor: clean(get(record, 'Characteristics:Цвет металла')),
    length: clean(get(record, 'Characteristics:Длина')),
    diameter: clean(get(record, 'Characteristics:Диаметр')),
    variants: (variantsByParent.get(id) ?? []).map(variant => {
      const edition = parseEdition(get(variant, 'Editions'))
      const sourcePrice = parsePrice(get(variant, 'Price'))
      const sourceOldPrice = parsePrice(get(variant, 'Price Old'))

      return {
        id: get(variant, 'Tilda UID'),
        title: get(variant, 'Title').replaceAll('&amp;', '&'),
        unit: edition.unit ?? normalizeUnit(clean(get(variant, 'Unit'))) ?? parentUnit,
        shade: edition.shade,
        shadeHex: edition.shadeHex,
        sourcePrice,
        sourceOldPrice,
        priceRub: toStoreRub(sourcePrice),
        oldPriceRub: toStoreRub(sourceOldPrice),
        currency: sourcePrice !== null ? 'RUB' : null,
      }
    }),
  }
})

export const hardwareImportStatistics = {
  rows: catalogRecords.length,
  products: hardwareProducts.length,
  variants: variants.length,
} as const
