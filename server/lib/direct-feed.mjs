import crypto from 'node:crypto'

const xml = value => String(value ?? '').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[c])
const plain = value => String(value ?? '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
const categoryId = slug => BigInt('0x' + crypto.createHash('sha256').update(slug).digest('hex').slice(0, 14)).toString()
const safeUrl = (value, origin) => {
  try { const url = new URL(value, origin); return ['http:', 'https:'].includes(url.protocol) ? url.href : null } catch { return null }
}

export function renderDirectFeed(rows, origin = 'https://ozelifkoja.ru', now = new Date()) {
  const categories = new Map()
  const offers = []
  const excluded = { unknownStock: 0, invalidPrice: 0, missingImage: 0 }
  for (const p of rows) {
    // Unknown is neither in stock nor out of stock. Never silently advertise it.
    if (p.stock_quantity === null || p.stock_quantity === undefined) { excluded.unknownStock++; continue }
    const price = Number(p.price)
    if (!Number.isFinite(price) || price <= 0) { excluded.invalidPrice++; continue }
    const picture = p.primary_image && safeUrl(p.primary_image, origin)
    if (!picture) { excluded.missingImage++; continue }
    const cid = categoryId(p.category_slug)
    categories.set(cid, p.category_name)
    const attributes = { ...p.attributes, ...p.variant_attributes }
    const params = Object.entries(attributes).filter(([, v]) => typeof v === 'string' || typeof v === 'number' || Array.isArray(v)).map(([k, v]) => `<param name="${xml(k)}">${xml(plain(Array.isArray(v) ? v.join(', ') : v))}</param>`).join('')
    const url = `${origin}/${p.category_slug}/tproduct/${p.identifier}-${p.slug}?variant=${encodeURIComponent(p.variant_identifier)}`
    // Variant ids are shared with ecommerce; landing selects the same priced variant.
    offers.push(`<offer id="${xml(p.variant_identifier)}" group_id="${xml(p.identifier)}" available="${Number(p.stock_quantity) > 0}"><url>${xml(url)}</url><price>${price.toFixed(2)}</price><currencyId>RUB</currencyId><categoryId>${cid}</categoryId><picture>${xml(picture)}</picture><name>${xml(p.name)} — ${xml(p.variant_name)}</name><description>${xml(plain(p.description).slice(0, 3000))}</description>${p.unit ? `<param name="Единица продажи">${xml(p.unit)}</param>` : ''}${params}</offer>`)
  }
  const date = now.toISOString().slice(0, 16).replace('T', ' ')
  return { count: offers.length, excluded, xml: `<?xml version="1.0" encoding="UTF-8"?><yml_catalog date="${date}"><shop><name>OZELIF</name><company>OZELIF</company><url>${xml(origin)}</url><currencies><currency id="RUB" rate="1"/></currencies><categories>${[...categories].map(([id, name]) => `<category id="${id}">${xml(name)}</category>`).join('')}</categories><offers>${offers.join('')}</offers></shop></yml_catalog>` }
}

export const DIRECT_FEED_QUERY = `SELECT COALESCE(p.legacy_id,p.id::text) identifier,p.slug,p.name,p.description,p.primary_image,p.attributes,c.slug category_slug,c.name category_name,COALESCE(v.legacy_id,v.id::text) variant_identifier,v.name variant_name,v.price,v.unit,v.stock_quantity,v.attributes variant_attributes FROM products p JOIN categories c ON c.id=p.category_id JOIN product_variants v ON v.product_id=p.id WHERE p.is_published=true AND c.is_published=true AND v.is_active=true ORDER BY p.id,v.sort_order,v.id`
