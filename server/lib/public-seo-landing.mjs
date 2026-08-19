import {
  PUBLIC_SITE_ORIGIN,
  PUBLIC_STORE_ID,
  PUBLIC_STORE_SCHEMA,
  absoluteSeoUrl,
  asSeoText,
  escapeSeoHtml,
  safeSeoJson,
  stripHomeHeroPreloads,
  replaceRootWithSeoContent,
} from './public-seo-html.mjs'
import { getPublishedProductOffer } from './public-product-seo.mjs'

const DEFAULT_ORIGIN = PUBLIC_SITE_ORIGIN
const asText = asSeoText
const escapeHtml = escapeSeoHtml
const money = new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 2 })

function textList(value) {
  if (Array.isArray(value)) {
    return value.map(asText).filter(Boolean)
  }
  const text = asText(value)
  return text ? [text] : []
}

function distinct(values) {
  return [...new Set(values.map(asText).filter(Boolean))]
    .sort((left, right) => left.localeCompare(right, 'ru'))
}

function productAttributes(product) {
  return product?.attributes && typeof product.attributes === 'object'
    ? product.attributes
    : {}
}

function attributeValues(products, keys) {
  return distinct(products.flatMap(product => {
    const attributes = productAttributes(product)
    return keys.flatMap(key => textList(attributes[key]))
  }))
}

function aggregateFacts(products) {
  const thicknesses = attributeValues(products, ['thickness'])
  const hideSizes = attributeValues(products, ['hideSize'])
  const colors = attributeValues(products, ['color', 'normalizedColor'])
  const coatings = attributeValues(products, ['coating'])
  const origins = attributeValues(products, ['origin', 'country'])
  const offers = products
    .map(getPublishedProductOffer)
    .filter(Boolean)
    .map(offer => offer.price)
    .filter(Number.isFinite)

  return [
    ['Товаров', String(products.length)],
    ...(thicknesses.length ? [['Толщина', thicknesses.join(', ')]] : []),
    ...(hideSizes.length ? [['Размеры шкур', hideSizes.join(', ')]] : []),
    ...(colors.length ? [['Цвета', colors.join(', ')]] : []),
    ...(coatings.length ? [['Покрытия', coatings.join(', ')]] : []),
    ...(origins.length ? [['Происхождение', origins.join(', ')]] : []),
    ...(offers.length ? [[
      'Цены',
      Math.min(...offers) === Math.max(...offers)
        ? `${money.format(Math.min(...offers))} ₽`
        : `${money.format(Math.min(...offers))}–${money.format(Math.max(...offers))} ₽`,
    ]] : []),
  ]
}

function productFacts(product) {
  const attributes = productAttributes(product)
  const facts = [
    ['Материал', attributes.material],
    ['Цвет', attributes.color || attributes.normalizedColor],
    ['Толщина', attributes.thickness],
    ['Размер шкуры', attributes.hideSize],
    ['Покрытие', attributes.coating],
    ['Происхождение', attributes.origin || attributes.country],
  ]
    .map(([label, value]) => [label, asText(value)])
    .filter(([, value]) => value)

  const offer = getPublishedProductOffer(product)
  if (offer) {
    facts.push([
      'Цена',
      `${offer.from ? 'от ' : ''}${money.format(offer.price)} ₽${offer.unit ? ` / ${offer.unit}` : ''}`,
    ])
  }

  return facts
}

function renderProductsSection(landing, products) {
  const facts = aggregateFacts(products)
  const productItems = products.map(product => {
    const url = asText(product?.url)
    const name = asText(product?.name) || 'Материал OZELIF'
    const factsHtml = productFacts(product)
      .map(([label, value]) => `            <li><strong>${escapeHtml(label)}:</strong> ${escapeHtml(value)}</li>`)
      .join('\n')

    return [
      '      <li>',
      '        <article>',
      `          <h3><a href="${escapeHtml(url)}">${escapeHtml(name)}</a></h3>`,
      ...(factsHtml ? [
        '          <ul>',
        factsHtml,
        '          </ul>',
      ] : []),
      '        </article>',
      '      </li>',
    ].join('\n')
  })

  return [
    '<section class="seo-prerender__live-products" aria-labelledby="seo-landing-products-title">',
    `  <h2 id="seo-landing-products-title">Товары: ${escapeHtml(landing.title)}</h2>`,
    ...(facts.length ? [
      '  <dl>',
      ...facts.map(([label, value]) => `    <div><dt>${escapeHtml(label)}</dt><dd>${escapeHtml(value)}</dd></div>`),
      '  </dl>',
    ] : []),
    ...(productItems.length ? [
      '  <ul>',
      ...productItems,
      '  </ul>',
    ] : [
      '  <p>Опубликованные товары этой подкатегории пока отсутствуют.</p>',
    ]),
    '</section>',
  ].join('\n')
}

const COMMERCIAL_PURCHASE_TITLES = Object.freeze({
  '/zamsha/gladkaya': 'Купить гладкую натуральную замшу в Москве',
  '/odejnayakozha/krs': 'Купить натуральную кожу КРС в Москве',
  '/odejnayakozha/perforirovannaya': 'Купить перфорированную натуральную кожу в Москве',
  '/dublyonka/kerli': 'Купить дублёночный материал Кёрли в Москве',
  '/dublyonka/toskana': 'Купить дублёночный материал Тоскана в Москве',
  '/odejnayakozha/gladkaya': 'Купить гладкую натуральную кожу в Москве',
  '/odejnayakozha/fakturnaya': 'Купить фактурную натуральную кожу в Москве',
  '/odejnayakozha/vintazhnaya': 'Купить винтажную натуральную кожу в Москве',
  '/odejnayakozha/nappa': 'Купить натуральную кожу Наппа в Москве',
  '/dublyonka/merinos': 'Купить дублёночный материал Меринос в Москве',
  '/dublyonka/tigrado': 'Купить дублёночный материал Тиградо в Москве',
  '/furnitura/ykk': 'Купить молнии YKK в Москве',
})

function commercialPurchaseTitle(landing) {
  return COMMERCIAL_PURCHASE_TITLES[asText(landing?.path)]
    ?? `Купить ${asText(landing?.title)} в Москве`
}

function commercialSection(landing){
  return ['<section class="seo-prerender__commercial">',`  <h2>${escapeHtml(commercialPurchaseTitle(landing))}</h2>`,'  <p>Цены и характеристики берутся из опубликованных карточек актуального каталога.</p>','  <ul>',`    <li><a href="${escapeHtml(landing.parentPath)}">Открыть весь каталог</a></li>`,'    <li><a href="/kozhaoptom">Условия для оптовых покупателей</a></li>','    <li><a href="/contacts">Контакты и шоурум</a></li>','    <li><a href="/delivery">Доставка и оплата</a></li>','  </ul>','  <p>Складской статус отдельной партии не публикуется в публичном API; нужный вариант и объём подтвердит менеджер.</p>','</section>'].join('\n')
}


function landingMetaDescription(landing) {
  return `${asText(landing?.title)} в каталоге OZELIF: актуальные товары, цены и характеристики. Розница и опт, шоурум в Москве, доставка по России.`
}

function replaceFallbackLandingMetadata(html, landing, canonical) {
  const title = `${commercialPurchaseTitle(landing)} | OZELIF`
  const description = landingMetaDescription(landing)

  let next = String(html)
    .replace(
      /<title>[\s\S]*?<\/title>/i,
      `<title>${escapeHtml(title)}</title>`,
    )
    .replace(/<meta\s+name="description"[^>]*>\s*/gi, '')
    .replace(
      /<meta\s+property="og:(?:url|title|description)"[^>]*>\s*/gi,
      '',
    )

  const tags = [
    `<meta name="description" content="${escapeHtml(description)}" />`,
    `<meta property="og:url" content="${escapeHtml(canonical)}" />`,
    `<meta property="og:title" content="${escapeHtml(title)}" />`,
    `<meta property="og:description" content="${escapeHtml(description)}" />`,
  ].join('\n  ')

  return next.replace('</head>', `  ${tags}\n</head>`)
}

function renderFallbackLandingBody(landing, section) {
  return [
    '<main class="seo-prerender seo-prerender--landing" data-seo-prerender="true">',
    '  <nav aria-label="Хлебные крошки">',
    '    <a href="/">Главная</a>',
    `    <a href="${escapeHtml(landing.parentPath)}">${escapeHtml(landing.categoryName)}</a>`,
    '  </nav>',
    '  <article>',
    `    <p>${escapeHtml(landing.categoryName)}</p>`,
    `    <h1>${escapeHtml(landing.title)}</h1>`,
    `    <p>${escapeHtml(landingMetaDescription(landing))}</p>`,
    section,
    '  </article>',
    '</main>',
  ].join('\n')
}

function hasRouteSpecificLandingTemplate(template, canonical) {
  const source = String(template)
  const links = source.match(/<link\b[^>]*>/gi) ?? []
  const hasCanonical = links.some(tag => {
    if (!/\brel\s*=\s*(?:"canonical"|'canonical')/i.test(tag)) return false
    const href = tag.match(/\bhref\s*=\s*(?:"([^"]*)"|'([^']*)')/i)
    return (href?.[1] ?? href?.[2] ?? '') === canonical
  })

  return hasCanonical && /<h1\b[^>]*>/i.test(source)
}

function replaceCanonical(html, canonical) {
  const tag = `<link rel="canonical" href="${escapeHtml(canonical)}" />`
  if (/<link\s+rel="canonical"[^>]*>/i.test(html)) {
    return html.replace(/<link\s+rel="canonical"[^>]*>/i, tag)
  }
  return html.replace('</head>', `  ${tag}\n</head>`)
}

function setRobots(html, noindex) {
  let next = html.replace(/<meta\s+name="robots"[^>]*>\s*/gi, '')
  if (noindex) {
    next = next.replace('</head>', '  <meta name="robots" content="noindex,follow" />\n</head>')
  }
  return next
}

function replaceStructuredData(html, schemas) {
  const withoutSchemas = html.replace(
    /<script\s+type="application\/ld\+json"[^>]*>[\s\S]*?<\/script>\s*/gi,
    '',
  )
  const scripts = schemas
    .map(schema => `  <script type="application/ld+json">${safeSeoJson(schema)}</script>`)
    .join('\n')
  return withoutSchemas.replace('</head>', `${scripts}\n</head>`)
}

export function renderCatalogSeoLandingPage(template, landing, products, { origin = DEFAULT_ORIGIN } = {}) {
  const productItems = Array.isArray(products) ? products : []
  const canonical = `${origin.replace(/\/$/, '')}${landing.path}`
  const itemListId = `${canonical}#items`

  const collectionSchema = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    '@id': `${canonical}#collection`,
    name: landing.title,
    url: canonical,
    about: { '@id': PUBLIC_STORE_ID },
    isPartOf: {
      '@type': 'CollectionPage',
      name: landing.categoryName,
      url: `${origin.replace(/\/$/, '')}${landing.parentPath}`,
    },
    mainEntity: { '@id': itemListId },
  }

  const breadcrumbSchema = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Главная', item: absoluteSeoUrl('/', origin) },
      { '@type': 'ListItem', position: 2, name: landing.categoryName, item: absoluteSeoUrl(landing.parentPath, origin) },
      { '@type': 'ListItem', position: 3, name: landing.title, item: canonical },
    ],
  }

  const itemListSchema = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    '@id': itemListId,
    name: landing.title,
    numberOfItems: productItems.length,
    itemListElement: productItems.map((product, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: asText(product?.name),
      url: absoluteSeoUrl(product?.url, origin),
    })),
  }

  const hasRouteSpecificPrerender = hasRouteSpecificLandingTemplate(
    template,
    canonical,
  )

  let html = stripHomeHeroPreloads(template)
  html = replaceCanonical(html, canonical)
  html = setRobots(html, productItems.length === 0)
  html = replaceStructuredData(html, [
    PUBLIC_STORE_SCHEMA,
    collectionSchema,
    breadcrumbSchema,
    itemListSchema,
  ])

  const section = [renderProductsSection(landing, productItems), commercialSection(landing)].join('\n')

  if (!hasRouteSpecificPrerender) {
    html = replaceFallbackLandingMetadata(html, landing, canonical)
    return replaceRootWithSeoContent(
      html,
      renderFallbackLandingBody(landing, section),
    )
  }

  if (/<\/article>/i.test(html)) {
    return html.replace(/<\/article>/i, `${section}\n  </article>`)
  }

  return html.replace(/<\/main>/i, `${section}\n</main>`)
}
