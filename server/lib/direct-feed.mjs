import crypto from 'node:crypto'

const xml = value => String(value ?? '').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[c])
const plain = value => String(value ?? '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
const categoryId = slug => BigInt('0x' + crypto.createHash('sha256').update(slug).digest('hex').slice(0, 14)).toString()
const safeUrl = (value, origin) => {
  try { const url = new URL(value, origin); return ['http:', 'https:'].includes(url.protocol) ? url.href : null } catch { return null }
}

const PARAM_LABELS = {
  color: 'Цвет',
  normalizedColor: 'Цвет',
  shade: 'Оттенок',
  thickness: 'Толщина',
  material: 'Материал',
  subtype: 'Тип материала',
  origin: 'Страна происхождения',
  article: 'Артикул',
  grade: 'Сорт',
  hideSize: 'Размер шкуры',
  categories: 'Категории',
}

const INTERNAL_ATTRIBUTE_KEYS = new Set([
  'auditSourceImageUrls',
  'sourceImageUrls',
  'priceSource',
  'currency',
  'shadeHex',
  'unit',
  'portion',
])

const valueText = value => plain(Array.isArray(value) ? value.join(', ') : value)
const normalizedKey = value => String(value ?? '').toLocaleLowerCase('ru-RU')
const materialCategory = value => /(кож|замш|дубл(?:ен|ёноч))/iu.test(String(value ?? ''))

function salesUnit(value) {
  const text = valueText(value).toLocaleLowerCase('ru-RU').replace(/\s/g, '')
  if (/^(?:дм(?:²|2|\.кв\.?)?|dm(?:²|2))$/.test(text)) return 'дм²'
  if (/^(?:фут(?:²|2|\.кв\.?)?|foot(?:²|2)|fot)$/.test(text)) return 'фут²'
  if (/^(?:шт\.?|pcs?)$/.test(text)) return 'шт.'
  return valueText(value) || null
}

function rowUnit(row) {
  const attributes = { ...row.attributes, ...row.variant_attributes }
  return salesUnit(row.unit ?? attributes.unit)
}

function publicName(productName, categoryName) {
  const name = plain(productName)
  const category = plain(categoryName)
  if (!category || !name) return name || category
  const normalize = value => value.toLocaleLowerCase('ru-RU').replace(/ё/g, 'е')
  const lowerName = normalize(name)
  const lowerCategory = normalize(category)
  return lowerName.includes(lowerCategory) ? name : `${category} ${name}`
}

function publicParams(attributes, unit) {
  const entries = []
  const seen = new Set()
  const add = (name, value) => {
    const text = valueText(value)
    const key = `${name}\u0000${text}`
    if (!text || seen.has(key)) return
    seen.add(key)
    entries.push([name, text])
  }
  if (unit) add('Единица продажи', unit)
  for (const [key, value] of Object.entries(attributes)) {
    if (INTERNAL_ATTRIBUTE_KEYS.has(key) || ['sourceimageurls', 'pricesource'].includes(normalizedKey(key))) continue
    add(PARAM_LABELS[key] ?? key, value)
  }
  return entries
}

function publicDescription(description, params) {
  const base = plain(description)
  const details = params
    .filter(([name]) => !['Артикул', 'Категории'].includes(name))
    .map(([name, value]) => `${name}: ${value}`)
  if (!details.length) return base.slice(0, 3000)
  return `${base}${base ? ' ' : ''}Характеристики: ${details.join('; ')}.`.slice(0, 3000)
}

export function renderDirectFeed(rows, origin = 'https://ozelifkoja.ru', now = new Date()) {
  const categories = new Map()
  const offers = []
  const excluded = { unknownStock: 0, invalidPrice: 0, missingImage: 0, missingUnit: 0, nonDmMaterialVariant: 0 }
  const effectiveUnits = new Map(rows.map(row => [row.variant_identifier, rowUnit(row)]))
  const materialRows = new Map()
  for (const row of rows) {
    if (!materialCategory(row.category_name)) continue
    const key = String(row.identifier)
    materialRows.set(key, [...(materialRows.get(key) ?? []), row])
  }
  for (const siblings of materialRows.values()) {
    if (siblings.some(row => effectiveUnits.get(row.variant_identifier) === 'дм²')) continue
    // The legacy import omitted units for a few paired material prices. The lower
    // price is the dm² variant (the paired price differs by the ft²↔dm² factor).
    const sorted = [...siblings].sort((a, b) => Number(a.price) - Number(b.price))
    sorted.forEach((row, index) => effectiveUnits.set(row.variant_identifier, index === 0 ? 'дм²' : 'фут²'))
  }
  for (const p of rows) {
    // Unknown is neither in stock nor out of stock. Never silently advertise it.
    if (p.stock_quantity === null || p.stock_quantity === undefined) { excluded.unknownStock++; continue }
    const price = Number(p.price)
    if (!Number.isFinite(price) || price <= 0) { excluded.invalidPrice++; continue }
    const picture = p.primary_image && safeUrl(p.primary_image, origin)
    const versionedPicture = picture && `${picture}${picture.includes('?') ? '&' : '?'}v=20260907`
    if (!versionedPicture) { excluded.missingImage++; continue }
    const unit = effectiveUnits.get(p.variant_identifier)
    if (!unit) { excluded.missingUnit++; continue }
    if (materialCategory(p.category_name) && unit !== 'дм²') { excluded.nonDmMaterialVariant++; continue }
    const cid = categoryId(p.category_slug)
    categories.set(cid, p.category_name)
    const attributes = { ...p.attributes, ...p.variant_attributes }
    const publicAttributes = publicParams(attributes, unit)
    const params = publicAttributes.map(([name, value]) => `<param name="${xml(name)}">${xml(value)}</param>`).join('')
    const url = `${origin}/${p.category_slug}/tproduct/${p.identifier}-${p.slug}?variant=${encodeURIComponent(p.variant_identifier)}`
    // Variant ids are shared with ecommerce; landing selects the same priced variant.
    offers.push(`<offer id="${xml(p.variant_identifier)}" group_id="${xml(p.identifier)}" available="${Number(p.stock_quantity) > 0}"><url>${xml(url)}</url><price>${price.toFixed(2)}</price><currencyId>RUB</currencyId><categoryId>${cid}</categoryId><picture>${xml(versionedPicture)}</picture><name>${xml(publicName(p.name, p.category_name))}</name><description>${xml(publicDescription(p.description, publicAttributes))}</description>${params}</offer>`)
  }
  const date = now.toISOString().slice(0, 16).replace('T', ' ')
  return { count: offers.length, excluded, xml: `<?xml version="1.0" encoding="UTF-8"?><yml_catalog date="${date}"><shop><name>OZELIF</name><company>OZELIF</company><url>${xml(origin)}</url><currencies><currency id="RUB" rate="1"/></currencies><categories>${[...categories].map(([id, name]) => `<category id="${id}">${xml(name)}</category>`).join('')}</categories><offers>${offers.join('')}</offers></shop></yml_catalog>` }
}

export const DIRECT_FEED_QUERY = `SELECT COALESCE(p.legacy_id,p.id::text) identifier,p.slug,p.name,p.description,p.primary_image,p.attributes,c.slug category_slug,c.name category_name,COALESCE(v.legacy_id,v.id::text) variant_identifier,v.name variant_name,v.price,v.unit,v.stock_quantity,v.attributes variant_attributes FROM products p JOIN categories c ON c.id=p.category_id JOIN product_variants v ON v.product_id=p.id WHERE p.is_published=true AND c.is_published=true AND v.is_active=true ORDER BY p.id,v.sort_order,v.id`
