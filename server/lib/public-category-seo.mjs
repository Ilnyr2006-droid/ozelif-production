import {
  PUBLIC_SITE_ORIGIN,
  PUBLIC_STORE_ID,
  PUBLIC_STORE_SCHEMA,
  absoluteSeoUrl,
  asSeoText,
  escapeSeoHtml,
  replaceRootWithSeoContent,
  safeSeoJson,
  stripHomeHeroPreloads,
} from './public-seo-html.mjs'
import { getPublishedProductOffer } from './public-product-seo.mjs'
import { getCatalogSeoLandingsForCategory } from './catalog-seo-landings.mjs'

const DEFAULT_ORIGIN = PUBLIC_SITE_ORIGIN
const asText = asSeoText
const escapeHtml = escapeSeoHtml
const formatDecimal = value => new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 2 }).format(value)

function clothingCatalogFacts(products) {
  const attributes = products.map(product => product?.attributes ?? {})
  const materials = [...new Set(attributes.map(item => asText(item?.material)).filter(Boolean))].sort((left, right) => left.localeCompare(right, 'ru'))
  const thicknessNumbers = attributes.flatMap(item => asText(item?.thickness).match(/\d+(?:[.,]\d+)?/g) ?? [])
    .map(value => Number(value.replace(',', '.')))
    .filter(Number.isFinite)
  const range = thicknessNumbers.length ? { min: Math.min(...thicknessNumbers), max: Math.max(...thicknessNumbers) } : null

  return [
    ['Для изделий', 'Для одежды, головных уборов и аксессуаров.'],
    ['Сырьё в каталоге', materials.length ? materials.join(' и ') : 'Указано в карточках материалов.'],
    ['Толщина', range ? `От ${formatDecimal(range.min)} до ${formatDecimal(range.max)} мм по данным карточек каталога.` : 'Указана в карточках материалов и доступна в фильтре.'],
    ['Покупка и подбор', 'Розница и опт, просмотр образцов и помощь с подбором в московском шоуруме.'],
  ]
}

const CATEGORY_SEO_OVERRIDES = {
  odejnayakozha: {
    title: 'Одежная кожа — купить натуральную кожу в Москве | OZELIF',
    description: 'Натуральная одежная кожа для пошива одежды и аксессуаров. Подбор по фактуре, цвету и толщине, розница и опт, шоурум в Москве, доставка по России.',
    bodyDescription: 'OZELIF — магазин и склад натуральной одежной кожи в Москве. Материалы доступны в розницу и оптом; посмотреть образцы и получить помощь с подбором можно в шоуруме на Краснобогатырской улице, 24.',
    bodyFacts: clothingCatalogFacts,
    heroPreload: {
      href: '/images/catalog/clothing-leather/catalog-hero.avif',
      type: 'image/avif',
    },
  },
}

function absoluteUrl(origin, value) {
  return absoluteSeoUrl(value, origin)
}

function renderCategoryBody(category, products, { origin, description, facts = [] }) {
  const name = asText(category?.name) || 'Каталог'
  const subcategories = getCatalogSeoLandingsForCategory(asText(category?.slug))
  const productCards = products.map(product => {
    const productUrl = absoluteUrl(origin, product?.url)
    const offer = getPublishedProductOffer(product)
    const priceText = offer
      ? `от ${new Intl.NumberFormat('ru-RU').format(offer.price)} ₽${offer.unit ? ` / ${offer.unit}` : ''}`
      : 'Цена по запросу'
    return [
      '      <li>',
      `        <a href="${escapeHtml(productUrl)}">`,
      `          <h2>${escapeHtml(product?.name)}</h2>`,
      `          <p>${escapeHtml(priceText)}</p>`,
      '        </a>',
      '      </li>',
    ].join('\n')
  })

  return [
    '<main class="seo-prerender seo-prerender--category" data-seo-prerender="true">',
    '  <nav aria-label="Хлебные крошки"><a href="/">Главная</a></nav>',
    '  <header>',
    '    <p>Каталог OZELIF</p>',
    `    <h1>${escapeHtml(name)}</h1>`,
    `    <p>${escapeHtml(description)}</p>`,
    '  </header>',
    ...(subcategories.length ? [
      '  <section aria-labelledby="catalog-subcategories-title">',
      '    <h2 id="catalog-subcategories-title">Подкатегории</h2>',
      '    <nav aria-label="Подкатегории каталога">',
      ...subcategories.map(item => `      <a href="${escapeHtml(item.path)}">${escapeHtml(item.title)}</a>`),
      '    </nav>',
      '  </section>',
    ] : []),
    ...(facts.length ? [
      '  <section aria-labelledby="category-facts-title">',
      '    <h2 id="category-facts-title">Одежная кожа для пошива</h2>',
      '    <p>OZELIF поставляет натуральную одежную кожу и помогает подобрать материал под конкретное изделие.</p>',
      '    <dl>',
      ...facts.map(([title, text]) => `      <div><dt>${escapeHtml(title)}</dt><dd>${escapeHtml(text)}</dd></div>`),
      '    </dl>',
      '  </section>',
    ] : []),
    ...(productCards.length ? [
      '  <section aria-labelledby="catalog-products-title">',
      '    <h2 id="catalog-products-title">Товары категории</h2>',
      '    <ul>',
      ...productCards,
      '    </ul>',
      '  </section>',
    ] : ['  <p>Опубликованные товары пока отсутствуют.</p>']),
    '  <p><a href="/contacts">Подобрать материал</a></p>',
    '</main>',
  ].join('\n')
}

export function renderCategorySeoPage(template, category, { origin = DEFAULT_ORIGIN, notFound = false, products = [] } = {}) {
  const slug = asText(category?.slug)
  const name = asText(category?.name) || 'Каталог'
  const canonical = `${origin.replace(/\/$/, '')}/${slug}`
  const override = CATEGORY_SEO_OVERRIDES[slug]
  const title = override?.title || asText(category?.seoTitle) || `${name} — купить в Москве | OZELIF`
  const description = override?.description || asText(category?.seoDescription)
    || asText(category?.description)
    || `${name} в каталоге натуральных материалов OZELIF.`
  const image = absoluteUrl(origin, category?.coverImage)
  const productItems = Array.isArray(products) ? products : []
  const emptyCategory = !notFound && productItems.length === 0
  const categorySchema = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    '@id': `${canonical}#collection`,
    name,
    description,
    url: canonical,
    about: { '@id': PUBLIC_STORE_ID },
    mainEntity: {
      '@type': 'ItemList',
      numberOfItems: productItems.length,
      itemListElement: productItems.map((product, index) => ({
        '@type': 'ListItem',
        position: index + 1,
        name: asText(product?.name),
        url: absoluteUrl(origin, product?.url),
      })),
    },
  }
  const breadcrumbSchema = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Главная', item: absoluteUrl(origin, '/') },
      { '@type': 'ListItem', position: 2, name, item: canonical },
    ],
  }
  const head = [
    `<title>${escapeHtml(notFound ? 'Страница не найдена | OZELIF' : title)}</title>`,
    `<meta name="description" content="${escapeHtml(notFound ? 'Запрошенная страница не найдена.' : description)}" />`,
    ...((notFound || emptyCategory) ? ['<meta name="robots" content="noindex,follow" />'] : []),
    ...(!notFound ? [`<link rel="canonical" href="${escapeHtml(canonical)}" />`] : []),
    `<meta property="og:type" content="website" />`,
    `<meta property="og:url" content="${escapeHtml(canonical)}" />`,
    `<meta property="og:title" content="${escapeHtml(notFound ? 'Страница не найдена | OZELIF' : title)}" />`,
    `<meta property="og:description" content="${escapeHtml(notFound ? 'Запрошенная страница не найдена.' : description)}" />`,
    ...(image && !notFound ? [
      `<meta property="og:image" content="${escapeHtml(image)}" />`,
    ] : []),
    ...(override?.heroPreload && !notFound ? [
      `<link rel="preload" as="image" href="${escapeHtml(override.heroPreload.href)}" type="${escapeHtml(override.heroPreload.type)}" fetchpriority="high" />`,
    ] : []),
    ...(!notFound ? [
      `<script type="application/ld+json">${safeSeoJson(PUBLIC_STORE_SCHEMA)}</script>`,
      `<script type="application/ld+json">${safeSeoJson(categorySchema)}</script>`,
      `<script type="application/ld+json">${safeSeoJson(breadcrumbSchema)}</script>`,
    ] : []),
  ].join('\n    ')

  const html = stripHomeHeroPreloads(template)
    .replace(/<meta\s+name="description"[^>]*>\s*/i, '')
    .replace(/<meta\s+name="robots"[^>]*>\s*/gi, '')
    .replace(/<link\s+rel="canonical"[^>]*>\s*/i, '')
    .replace(/<meta\s+property="og:(?:type|url|title|description|image)"[^>]*>\s*/gi, '')
    .replace(/<title>[\s\S]*?<\/title>/i, head)

  if (notFound) return html
  return replaceRootWithSeoContent(html, renderCategoryBody(category, productItems, {
    origin,
    description: override?.bodyDescription || description,
    facts: override?.bodyFacts?.(productItems) ?? [],
  }))
}
