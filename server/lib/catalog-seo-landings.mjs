export const CATALOG_SEO_LANDINGS = Object.freeze([
  Object.freeze({
    path: '/dublyonka/kerli',
    categorySlug: 'dublyonka',
    categoryName: 'Дублёночный материал',
    parentPath: '/dublyonka',
    title: 'Дублёночный материал Кёрли',
    label: 'Кёрли',
    matcherTokens: Object.freeze(['керли', 'кёрли', 'kyorli']),
  }),
  Object.freeze({
    path: '/dublyonka/toskana',
    categorySlug: 'dublyonka',
    categoryName: 'Дублёночный материал',
    parentPath: '/dublyonka',
    title: 'Дублёночный материал Тоскана',
    label: 'Тоскана',
    matcherTokens: Object.freeze(['тоскана', 'toskana', 'toscana']),
  }),
  Object.freeze({
    path: '/odejnayakozha/perforirovannaya',
    categorySlug: 'odejnayakozha',
    categoryName: 'Одежная кожа',
    parentPath: '/odejnayakozha',
    title: 'Перфорированная натуральная кожа',
    label: 'Перфорированная кожа',
    matcherTokens: Object.freeze(['perforat', 'перфор']),
  }),
  Object.freeze({
    path: '/odejnayakozha/vintazhnaya',
    categorySlug: 'odejnayakozha',
    categoryName: 'Одежная кожа',
    parentPath: '/odejnayakozha',
    title: 'Винтажная натуральная кожа',
    label: 'Винтажная кожа',
    matcherTokens: Object.freeze(['винтаж', 'vintage']),
  }),
  Object.freeze({
    path: '/odejnayakozha/nappa',
    categorySlug: 'odejnayakozha',
    categoryName: 'Одежная кожа',
    parentPath: '/odejnayakozha',
    title: 'Натуральная кожа Наппа',
    label: 'Кожа Наппа',
    matcherTokens: Object.freeze(['наппа', 'nappa']),
    matcherAttributes: Object.freeze(['coating']),
  }),
  Object.freeze({
    path: '/dublyonka/merinos',
    categorySlug: 'dublyonka',
    categoryName: 'Дублёночный материал',
    parentPath: '/dublyonka',
    title: 'Дублёночный материал Меринос',
    label: 'Меринос',
    matcherTokens: Object.freeze(['меринос', 'merinos', 'merino']),
  }),
  Object.freeze({
    path: '/dublyonka/tigrado',
    categorySlug: 'dublyonka',
    categoryName: 'Дублёночный материал',
    parentPath: '/dublyonka',
    title: 'Дублёночный материал Тиградо',
    label: 'Тиградо',
    matcherTokens: Object.freeze(['тиградо', 'tigrado']),
  }),
  Object.freeze({
    path: '/furnitura/ykk',
    categorySlug: 'furnitura',
    categoryName: 'Фурнитура',
    parentPath: '/furnitura',
    title: 'Молнии YKK',
    label: 'YKK',
    matcherTokens: Object.freeze(['ykk']),
    matcherAttributes: Object.freeze(['brand']),
  }),
  Object.freeze({
    path: '/odejnayakozha/krs',
    categorySlug: 'odejnayakozha',
    categoryName: 'Одежная кожа',
    parentPath: '/odejnayakozha',
    title: 'Натуральная кожа КРС',
    label: 'Кожа КРС',
    matcherTokens: Object.freeze(['крс', 'krs']),
  }),
])

export function normalizeSeoMatchText(value) {
  return String(value ?? '')
    .trim()
    .toLocaleLowerCase('ru-RU')
    .replaceAll('ё', 'е')
}

function stringList(value) {
  if (Array.isArray(value)) {
    return value
      .filter(item => typeof item === 'string')
      .map(normalizeSeoMatchText)
      .filter(Boolean)
  }

  const text = normalizeSeoMatchText(value)
  return text ? [text] : []
}

export function matchesCatalogSeoLandingProduct(product, landing) {
  if (!product || !landing) return false

  const attributes = product.attributes && typeof product.attributes === 'object'
    ? product.attributes
    : {}
  const subtype = stringList(attributes.subtype)
  const matcherAttributes = (landing.matcherAttributes ?? [])
    .flatMap(key => stringList(attributes[key]))
  const titleAndSlug = normalizeSeoMatchText([
    product.name,
    product.slug,
  ].filter(Boolean).join(' '))

  return landing.matcherTokens.some(rawToken => {
    const token = normalizeSeoMatchText(rawToken)
    return subtype.some(value => value === token || value.includes(token))
      || matcherAttributes.some(value => value === token || value.includes(token))
      || titleAndSlug.includes(token)
  })
}

export function getCatalogSeoLandingByPath(pathname) {
  const normalized = String(pathname ?? '').replace(/\/$/, '') || '/'
  return CATALOG_SEO_LANDINGS.find(item => item.path === normalized) ?? null
}

export function getCatalogSeoLandingsForCategory(categorySlug) {
  return CATALOG_SEO_LANDINGS.filter(item => item.categorySlug === categorySlug)
}
