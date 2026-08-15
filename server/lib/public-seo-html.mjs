export const PUBLIC_SITE_ORIGIN = 'https://ozelifkoja.ru'
export const PUBLIC_STORE_ID = `${PUBLIC_SITE_ORIGIN}/#store`

export const PUBLIC_STORE_SCHEMA = Object.freeze({
  '@context': 'https://schema.org',
  '@type': 'Store',
  '@id': PUBLIC_STORE_ID,
  name: 'OZELIF',
  alternateName: ['Озелиф', 'OZELIF Кожа'],
  legalName: 'ИП Касумов Элхан Низамхан Оглы',
  url: `${PUBLIC_SITE_ORIGIN}/`,
  telephone: '+7-903-370-78-54',
  image: `${PUBLIC_SITE_ORIGIN}/images/hero-leather-wide.jpg`,
  logo: `${PUBLIC_SITE_ORIGIN}/favicon.svg`,
  address: {
    '@type': 'PostalAddress',
    addressLocality: 'Москва',
    addressRegion: 'Москва',
    streetAddress: 'Краснобогатырская улица, 24',
    addressCountry: 'RU',
  },
  geo: {
    '@type': 'GeoCoordinates',
    latitude: 55.811503,
    longitude: 37.698942,
  },
  hasMap: 'https://yandex.ru/maps/org/ozelif_kozha/242632009920/',
  areaServed: [
    { '@type': 'City', name: 'Москва' },
    { '@type': 'Country', name: 'Россия' },
  ],
  sameAs: [
    'https://yandex.ru/maps/org/ozelif_kozha/242632009920/',
    'https://t.me/ozelifleather',
    'https://vk.com/ozelifleatherofficial',
  ],
})

export function asSeoText(value) {
  return String(value ?? '').trim()
}

export function escapeSeoHtml(value) {
  return asSeoText(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

export function safeSeoJson(value) {
  return JSON.stringify(value).replaceAll('<', '\\u003c')
}

export function stripHomeHeroPreloads(value) {
  return String(value).replace(
    /<link\s+[^>]*data-home-hero-preload[^>]*>\s*/gi,
    '',
  )
}

export function absoluteSeoUrl(value, origin = PUBLIC_SITE_ORIGIN) {
  const url = asSeoText(value)
  if (!url) return null
  if (/^https?:\/\//i.test(url)) return url
  return `${origin.replace(/\/$/, '')}/${url.replace(/^\//, '')}`
}

export function replaceRootWithSeoContent(template, content) {
  const root = /<div\s+id=(?:"root"|'root')\s*>[\s\S]*?<\/div>/i
  if (!root.test(String(template))) throw new Error('Frontend template must contain #root')
  return String(template).replace(root, `<div id="root">${content}</div>`)
}

export function renderSeoContent({
  eyebrow = 'OZELIF',
  title,
  paragraphs = [],
  sections = [],
  links = [],
  image = null,
  imageAlt = '',
}) {
  const cleanParagraphs = paragraphs.map(asSeoText).filter(Boolean)
  const cleanSections = sections
    .map(section => ({ title: asSeoText(section?.title), text: asSeoText(section?.text) }))
    .filter(section => section.title || section.text)
  const cleanLinks = links
    .map(link => ({ href: asSeoText(link?.href), label: asSeoText(link?.label) }))
    .filter(link => link.href && link.label)
  const imageUrl = absoluteSeoUrl(image)

  return [
    '<main class="seo-prerender" data-seo-prerender="true">',
    '  <article class="seo-prerender__content">',
    `    <p>${escapeSeoHtml(eyebrow)}</p>`,
    `    <h1>${escapeSeoHtml(title)}</h1>`,
    ...cleanParagraphs.map(text => `    <p>${escapeSeoHtml(text)}</p>`),
    ...(imageUrl ? [`    <img src="${escapeSeoHtml(imageUrl)}" alt="${escapeSeoHtml(imageAlt || title)}" loading="lazy" decoding="async" />`] : []),
    ...cleanSections.map(section => [
      '    <section>',
      ...(section.title ? [`      <h2>${escapeSeoHtml(section.title)}</h2>`] : []),
      ...(section.text ? [`      <p>${escapeSeoHtml(section.text)}</p>`] : []),
      '    </section>',
    ].join('\n')),
    ...(cleanLinks.length ? [
      '    <nav aria-label="Полезные разделы">',
      ...cleanLinks.map(link => `      <a href="${escapeSeoHtml(link.href)}">${escapeSeoHtml(link.label)}</a>`),
      '    </nav>',
    ] : []),
    '  </article>',
    '</main>',
  ].join('\n')
}
