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
  const colors = [...new Set(attributes.map(item => asText(item?.normalizedColor || item?.color)).filter(Boolean))]
  const subtypeValues = attributes.flatMap(item => Array.isArray(item?.subtype) ? item.subtype : [item?.subtype])
    .map(asText)
    .filter(Boolean)
  const subtypes = [...new Set(subtypeValues)]
  const thicknessNumbers = attributes.flatMap(item => asText(item?.thickness).match(/\d+(?:[.,]\d+)?/g) ?? [])
    .map(value => Number(value.replace(',', '.')))
    .filter(Number.isFinite)
  const range = thicknessNumbers.length ? { min: Math.min(...thicknessNumbers), max: Math.max(...thicknessNumbers) } : null

  return [
    ['Ассортимент', `${products.length} опубликованных товаров в текущем каталоге.`],
    ['Цвета и фактуры', colors.length || subtypes.length ? `${colors.length} цветовых групп и ${subtypes.length} типов материала представлены в каталоге.` : 'Параметры указаны в карточках товаров.'],
    ['Сырьё', materials.length ? materials.join(' и ') : 'Указано в карточках материалов.'],
    ['Толщина', range ? `От ${formatDecimal(range.min)} до ${formatDecimal(range.max)} мм по данным карточек каталога.` : 'Указана в карточках материалов.'],
  ]
}

function clothingProductFacts(product) {
  const attributes = product?.attributes ?? {}
  return [
    asText(attributes?.material),
    asText(attributes?.color || attributes?.normalizedColor),
    asText(attributes?.thickness) ? `${asText(attributes.thickness)} мм` : '',
    asText(attributes?.coating),
    asText(attributes?.country),
  ].filter(Boolean).slice(0, 5)
}

const CATEGORY_SEO_OVERRIDES = {
  odejnayakozha: {
    title: 'Одежная кожа купить в Москве — натуральная кожа для пошива | OZELIF',
    description: 'Каталог натуральной одежной кожи OZELIF: цены и характеристики, подбор по сырью, цвету, фактуре и толщине. Розница и опт, шоурум в Москве, доставка по России.',
    bodyDescription: 'Каталог натуральной одежной кожи с актуальными ценами и характеристиками. Подберите материал по сырью, цвету, фактуре и толщине; OZELIF работает в розницу и оптом, а образцы можно посмотреть в шоуруме на Краснобогатырской улице, 24.',
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
  const slug = asText(category?.slug)
  const isClothingLeather = slug === 'odejnayakozha'
  const pageHeading = isClothingLeather ? 'Одежная кожа для пошива' : name
  const subcategories = getCatalogSeoLandingsForCategory(slug)
  const productCards = products.map(product => {
    const productUrl = absoluteUrl(origin, product?.url)
    const offer = getPublishedProductOffer(product)
    const facts = isClothingLeather ? clothingProductFacts(product) : []
    const priceText = offer
      ? `от ${new Intl.NumberFormat('ru-RU').format(offer.price)} ₽${offer.unit ? ` / ${offer.unit}` : ''}`
      : 'Цена по запросу'
    return [
      '      <li>',
      `        <a href="${escapeHtml(productUrl)}">`,
      `          <h2>${escapeHtml(product?.name)}</h2>`,
      `          <p>${escapeHtml(priceText)}</p>`,
      ...(facts.length ? [`          <p>${escapeHtml(facts.join(' · '))}</p>`] : []),
      '        </a>',
      '      </li>',
    ].join('\n')
  })

  return [
    '<main class="seo-prerender seo-prerender--category" data-seo-prerender="true">',
    '  <nav aria-label="Хлебные крошки"><a href="/">Главная</a></nav>',
    '  <header>',
    '    <p>Каталог OZELIF</p>',
    `    <h1>${escapeHtml(pageHeading)}</h1>`,
    `    <p>${escapeHtml(description)}</p>`,
    '  </header>',
    ...(subcategories.length ? [
      '  <section aria-labelledby="catalog-subcategories-title">',
      `    <h2 id="catalog-subcategories-title">${escapeHtml(isClothingLeather ? 'Виды одежной кожи' : 'Подкатегории')}</h2>`,
      '    <nav aria-label="Подкатегории каталога">',
      ...subcategories.map(item => `      <a href="${escapeHtml(item.path)}">${escapeHtml(item.title)}</a>`),
      '    </nav>',
      '  </section>',
    ] : []),
    ...(facts.length ? [
      '  <section aria-labelledby="category-facts-title">',
      '    <h2 id="category-facts-title">Как выбрать одежную кожу</h2>',
      '    <p>Сравнивайте реальные параметры каталога: тип сырья, цвет, фактуру и толщину. Для одежды, головных уборов и аксессуаров менеджер поможет сверить материал с конкретной задачей.</p>',
      '    <dl>',
      ...facts.map(([title, text]) => `      <div><dt>${escapeHtml(title)}</dt><dd>${escapeHtml(text)}</dd></div>`),
      '    </dl>',
      '  </section>',
    ] : []),
    ...(isClothingLeather ? [
      '  <section aria-labelledby="category-commercial-title">',
      '    <h2 id="category-commercial-title">Купить одежную кожу в Москве — в розницу и оптом</h2>',
      '    <p>Цены, единицы продажи и характеристики указаны в карточках товаров. Наличие конкретного оттенка или партии лучше подтвердить у менеджера перед заказом.</p>',
      '    <ul>',
      '      <li><a href="/contacts">Посмотреть образцы в шоуруме OZELIF в Москве</a></li>',
      '      <li><a href="/kozhaoptom">Условия для оптовых покупателей</a></li>',
      '      <li><a href="/delivery">Доставка и оплата</a></li>',
      '    </ul>',
      '  </section>',
      '  <section aria-labelledby="category-faq-title">',
      '    <h2 id="category-faq-title">Вопросы перед покупкой одежной кожи</h2>',
      '    <h3>Можно ли купить одежную кожу в розницу?</h3>',
      '    <p>Да. OZELIF работает с розничными и оптовыми клиентами. Цена и единица продажи конкретного материала указаны в его карточке.</p>',
      '    <h3>Как подобрать кожу по толщине и фактуре?</h3>',
      '    <p>Используйте фильтры по типу материала, цвету, сырью и толщине. Материал также можно посмотреть в московском шоуруме.</p>',
      '    <h3>Как узнать наличие конкретной партии?</h3>',
      '    <p>Опубликованный каталог показывает актуальные товары и цены, но складской статус отдельной партии не публикуется в API. Наличие нужного оттенка или объёма подтвердит менеджер.</p>',
      '  </section>',
    ] : []),
    ...(productCards.length ? [
      '  <section aria-labelledby="catalog-products-title">',
      `    <h2 id="catalog-products-title">${escapeHtml(isClothingLeather ? 'Каталог одежной кожи с ценами' : 'Товары категории')}</h2>`,
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
