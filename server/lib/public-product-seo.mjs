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

const DEFAULT_ORIGIN = PUBLIC_SITE_ORIGIN
const asText = asSeoText
const escapeHtml = escapeSeoHtml
const safeJson = safeSeoJson

function absoluteUrl(origin, value) {
  return absoluteSeoUrl(value, origin)
}


function responsiveProductImage(imageUrl) {
  const value = asText(imageUrl)
  const match = value.match(/^(https?:\/\/[^/]+)(\/images\/catalog\/[^/]+\/[^/]+\/)w\d+(-v2)?\.webp$/i)
  if (!match) return { src: value, srcSet: null, sizes: null }

  const origin = match[1]
  const directory = match[2]
  const suffix = match[3] ?? ''
  const widths = suffix
    ? [480, 720, 960, 1280, 1440, 1680]
    : [480, 720, 1280]

  return {
    src: `${origin}${directory}w${suffix ? 720 : 480}${suffix}.webp`,
    mobileSrc: `${origin}${directory}w480${suffix}.webp`,
    srcSet: widths
      .map(width => `${origin}${directory}w${width}${suffix}.webp ${width}w`)
      .join(', '),
    sizes: '(min-width: 900px) 50vw, 100vw',
  }
}

function renderProductImage(imageUrl, alt) {
  const image = responsiveProductImage(imageUrl)
  if (!image.src) return ''

  const img = [
    '<img',
    `src="${escapeHtml(image.src)}"`,
    ...(image.srcSet ? [`srcset="${escapeHtml(image.srcSet)}"`] : []),
    ...(image.sizes ? [`sizes="${escapeHtml(image.sizes)}"`] : []),
    `alt="${escapeHtml(alt)}"`,
    'loading="eager"',
    'decoding="async"',
    'fetchpriority="high"',
    '/>',
  ].join(' ')

  return image.mobileSrc
    ? `<picture><source media="(max-width: 639px)" srcset="${escapeHtml(image.mobileSrc)}" />${img}</picture>`
    : img
}

function positiveNumber(value) {
  const number = Number(value)
  return Number.isFinite(number) && number > 0 ? number : null
}

export function getPublishedProductPrice(product) {
  return getPublishedProductOffer(product)?.price ?? null
}

export function getPublishedProductOffer(product) {
  const variantOffers = (Array.isArray(product?.variants) ? product.variants : [])
    .filter(variant => variant?.isActive !== false)
    .map(variant => ({
      price: positiveNumber(variant?.price),
      unit: asText(variant?.unit),
      currency: asText(variant?.currency) || asText(product?.currency) || 'RUB',
    }))
    .filter(offer => offer.price !== null)

  if (variantOffers.length) {
    const offer = variantOffers.reduce((lowest, current) => current.price < lowest.price ? current : lowest)
    const distinctPrices = new Set(variantOffers.map(item => item.price))
    return { ...offer, from: distinctPrices.size > 1 }
  }

  const price = positiveNumber(product?.price)
  return price === null ? null : {
    price,
    unit: asText(product?.unit),
    currency: asText(product?.currency) || 'RUB',
    from: false,
  }
}

function productReference(product) {
  return asText(product?.legacyId) || asText(product?.id) || asText(product?.sku)
}

function productFacts(product) {
  const attributes = product?.attributes && typeof product.attributes === 'object'
    ? product.attributes
    : {}
  const facts = [
    ['Материал', attributes.material],
    ['Цвет', attributes.color || attributes.normalizedColor],
    ['Толщина', attributes.thickness],
    ['Страна', attributes.origin || attributes.country],
    ['Тип', attributes.zipperType],
    ['Цвет ленты', attributes.tapeColor],
  ]

  return facts
    .map(([label, value]) => [label, asText(value)])
    .filter(([, value]) => value)
    .map(([label, value]) => `${label}: ${value}`)
}

function variantFacts(variant, product) {
  const price = positiveNumber(variant?.price)
  const name = asText(variant?.name) || asText(variant?.sku) || 'Вариант'
  const unit = asText(variant?.unit || product?.unit)
  const priceText = price ? `${new Intl.NumberFormat('ru-RU').format(price)} ₽${unit ? ` / ${unit}` : ''}` : 'Цена по запросу'
  return `${name} — ${priceText}`
}

function renderProductBody(product, { categoryName, productUrl, imageUrl, description, offer }) {
  const name = asText(product?.name) || 'Материал OZELIF'
  const category = asText(categoryName || product?.category?.name) || 'Каталог'
  const categorySlug = asText(product?.category?.slug) || asText(product?.url).split('/')[1]
  const categoryUrl = categorySlug ? `/${categorySlug}` : '/'
  const variants = (Array.isArray(product?.variants) ? product.variants : [])
    .filter(variant => variant?.isActive !== false)
  const facts = productFacts(product)
  const priceText = offer
    ? `${offer.from ? 'от ' : ''}${new Intl.NumberFormat('ru-RU').format(offer.price)} ₽${offer.unit ? ` / ${offer.unit}` : ''}`
    : 'Цена по запросу'

  return [
    '<main class="seo-prerender seo-prerender--product" data-seo-prerender="true">',
    '  <nav aria-label="Хлебные крошки">',
    '    <a href="/">Главная</a>',
    `    <a href="${escapeHtml(categoryUrl)}">${escapeHtml(category)}</a>`,
    '  </nav>',
    '  <article>',
    `    <p>${escapeHtml(category)}</p>`,
    `    <h1>${escapeHtml(name)}</h1>`,
    `    <p>${escapeHtml(description)}</p>`,
    ...(imageUrl ? [`    ${renderProductImage(imageUrl, product?.primaryImage?.alt || product?.images?.[0]?.alt || name)}`] : []),
    `    <p><strong>${escapeHtml(priceText)}</strong></p>`,
    ...(facts.length ? [
      '    <section>',
      '      <h2>Характеристики</h2>',
      '      <ul>',
      ...facts.map(fact => `        <li>${escapeHtml(fact)}</li>`),
      '      </ul>',
      '    </section>',
    ] : []),
    ...(variants.length ? [
      '    <section>',
      '      <h2>Доступные варианты</h2>',
      '      <ul>',
      ...variants.map(variant => `        <li>${escapeHtml(variantFacts(variant, product))}</li>`),
      '      </ul>',
      '    </section>',
    ] : []),
    '    <p><a href="/contacts">Уточнить наличие у менеджера</a></p>',
    `    <link itemprop="url" href="${escapeHtml(productUrl)}" />`,
    '  </article>',
    '</main>',
  ].join('\n')
}

function conciseDescription(parts, suffix, limit = 160) {
  const ending = asText(suffix)
  const available = Math.max(0, limit - ending.length - (ending ? 1 : 0))
  let body = parts.filter(Boolean).join(' ')
  if (body.length > available) {
    body = body.slice(0, available + 1)
    const lastSpace = body.lastIndexOf(' ')
    body = (lastSpace > available * 0.7 ? body.slice(0, lastSpace) : body.slice(0, available))
      .replace(/[\s,;:.!?-]+$/, '')
  }
  return [body, ending].filter(Boolean).join(' ')
}

export function getProductSeoMetadata(product, { categoryName = null } = {}) {
  const name = asText(product?.name) || 'Материал OZELIF'
  const category = asText(categoryName || product?.category?.name) || 'Каталог'
  const reference = productReference(product)
  const sourceDescription = asText(product?.description).replace(/[.!?]+$/, '')
  const facts = productFacts(product)
  const referenceText = reference ? `№${reference}.` : ''
  const description = conciseDescription([
    sourceDescription || `${name} в каталоге OZELIF`,
    facts.length ? `${facts.join(', ')}.` : '',
  ], referenceText)

  return {
    name,
    description,
    title: `${name}${reference ? ` №${reference}` : ` — ${category}`} — OZELIF`,
  }
}

export function renderProductSeoPage(template, product, { origin = DEFAULT_ORIGIN, categoryName = null, modulePreloadHref = null } = {}) {
  const productUrl = absoluteUrl(origin, product?.url)
  if (!productUrl) throw new Error('Published product must have a public URL')

  const { name, description, title } = getProductSeoMetadata(product, { categoryName })
  const primaryImage = product?.primaryImage?.url || product?.images?.[0]?.url || null
  const imageUrl = absoluteUrl(origin, primaryImage)
  const responsiveImage = responsiveProductImage(imageUrl)
  const offer = getPublishedProductOffer(product)
  const productSchema = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name,
    description,
    url: productUrl,
    ...(product?.sku ? { sku: asText(product.sku) } : {}),
    ...(imageUrl ? { image: [imageUrl] } : {}),
    seller: { '@id': PUBLIC_STORE_ID },
    ...(offer ? {
      offers: {
        '@type': 'Offer',
        price: String(offer.price),
        priceCurrency: offer.currency,
        url: productUrl,
        seller: { '@id': PUBLIC_STORE_ID },
        ...(offer.unit ? {
          priceSpecification: {
            '@type': 'UnitPriceSpecification',
            price: String(offer.price),
            priceCurrency: offer.currency,
            unitText: offer.unit,
          },
        } : {}),
      },
    } : {}),
  }
  const breadcrumbSchema = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Главная', item: absoluteUrl(origin, '/') },
      { '@type': 'ListItem', position: 2, name: categoryName || 'Каталог', item: absoluteUrl(origin, `/${product.url.split('/')[1]}`) },
      { '@type': 'ListItem', position: 3, name, item: productUrl },
    ],
  }
  const bootstrap = safeJson({
    categorySlug: asText(product?.category?.slug) || asText(product?.url).split('/')[1],
    item: product,
  })
  const head = [
    `<title>${escapeHtml(title)}</title>`,
    `<meta name="description" content="${escapeHtml(description)}" />`,
    `<link rel="canonical" href="${escapeHtml(productUrl)}" />`,
    '<meta property="og:type" content="product" />',
    `<meta property="og:url" content="${escapeHtml(productUrl)}" />`,
    `<meta property="og:title" content="${escapeHtml(title)}" />`,
    `<meta property="og:description" content="${escapeHtml(description)}" />`,
    ...(imageUrl ? [`<meta property="og:image" content="${escapeHtml(imageUrl)}" />`] : []),
    '<meta name="twitter:card" content="summary_large_image" />',
    ...(responsiveImage?.mobileSrc ? [
      `<link rel="preload" as="image" type="image/webp" href="${escapeHtml(responsiveImage.mobileSrc)}" media="(max-width: 639px)" fetchpriority="high" />`,
    ] : []),
    ...(modulePreloadHref ? [`<link rel="modulepreload" href="${escapeHtml(modulePreloadHref)}" />`] : []),
    `<script id="ozelif-product-bootstrap" type="application/json">${bootstrap}</script>`,
    `<script type="application/ld+json">${safeJson(PUBLIC_STORE_SCHEMA)}</script>`,
    `<script type="application/ld+json">${safeJson(productSchema)}</script>`,
    `<script type="application/ld+json">${safeJson(breadcrumbSchema)}</script>`,
  ].join('\n    ')

  const html = stripHomeHeroPreloads(template)
    .replace(/<meta\s+name="description"[^>]*>\s*/i, '')
    .replace(/<link\s+rel="canonical"[^>]*>\s*/i, '')
    .replace(/<meta\s+property="og:(?:type|url|title|description|image)"[^>]*>\s*/gi, '')
    .replace(/<meta\s+name="twitter:card"[^>]*>\s*/i, '')
    .replace(/<title>[\s\S]*?<\/title>/i, head)

  return replaceRootWithSeoContent(html, renderProductBody(product, {
    categoryName,
    productUrl,
    imageUrl,
    description,
    offer,
  }))
}
