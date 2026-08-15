
import { createHash } from 'node:crypto'

const CATEGORY_PATHS = {
  odejnayakozha: '/odejnayakozha',
  dublyonka: '/dublyonka',
  zamsha: '/zamsha',
  obuvnayakozha: '/obuvnayakozha',
  furnitura: '/furnitura',
}

function scalarText(value) {
  if (value === null || value === undefined) return ''

  if (Array.isArray(value)) {
    return value
      .map(item => scalarText(item))
      .filter(Boolean)
      .join(' · ')
  }

  if (typeof value === 'object') return ''
  return String(value).replace(/\s+/g, ' ').trim()
}

function cleanAttributes(attributes) {
  if (!attributes || typeof attributes !== 'object' || Array.isArray(attributes)) {
    return []
  }

  return Object.entries(attributes)
    .filter(([key]) => !key.startsWith('__'))
    .map(([key, value]) => [key.trim(), scalarText(value)])
    .filter(([key, value]) => key && value)
    .sort(([left], [right]) => left.localeCompare(right, 'ru'))
}

function cleanUnits(variants) {
  if (!Array.isArray(variants)) return []

  return [...new Set(
    variants
      .filter(variant => variant?.isActive !== false)
      .map(variant => scalarText(variant?.unit))
      .filter(Boolean),
  )]
}

export function buildProductVectorDocument(product) {
  const attributes = cleanAttributes(product.attributes)
  const units = cleanUnits(product.variants)
  const categoryPath = CATEGORY_PATHS[product.categorySlug]
    ?? `/${product.categorySlug ?? ''}`

  const identifier = product.legacyId || product.id
  const productUrl = product.slug
    ? `${categoryPath}/tproduct/${identifier}-${product.slug}`
    : categoryPath

  const lines = [
    '# Товар OZELIF',
    '',
    `PRODUCT_ID: ${product.id}`,
    product.legacyId ? `LEGACY_ID: ${product.legacyId}` : '',
    `Название: ${scalarText(product.name)}`,
    `Каталог: ${scalarText(product.categoryName)}`,
    `Каталог slug: ${scalarText(product.categorySlug)}`,
    product.sku ? `Артикул: ${scalarText(product.sku)}` : '',
    product.description
      ? `Описание: ${scalarText(product.description)}`
      : '',
    units.length
      ? `Единицы продажи: ${units.join(', ')}`
      : '',
    `Ссылка: ${productUrl}`,
    '',
    attributes.length ? '## Характеристики' : '',
    ...attributes.map(([key, value]) => `- ${key}: ${value}`),
    '',
    '## Правила использования',
    '- Это поисковый документ для смыслового подбора товара.',
    '- Актуальную цену, публикацию, изображения и наличие нужно проверять в PostgreSQL.',
    '- Не использовать этот документ как окончательный источник цены или наличия.',
  ].filter(Boolean)

  return lines.join('\n').trim() + '\n'
}

export function productVectorContentHash(content) {
  return createHash('sha256').update(content, 'utf8').digest('hex')
}

export function productVectorFilename(product) {
  const safeSlug = String(product.slug || product.id)
    .toLocaleLowerCase('en-US')
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)

  return `ozelif-product-${product.id}-${safeSlug || 'item'}.md`
}
