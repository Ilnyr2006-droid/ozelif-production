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

function values(products,keys){
  return [...new Set(products.flatMap(product=>{
    const a=product?.attributes&&typeof product.attributes==='object'?product.attributes:{}
    return keys.flatMap(k=>(Array.isArray(a[k])?a[k]:[a[k]]).map(asText).filter(Boolean))
  }))].sort((a,b)=>a.localeCompare(b,'ru'))
}
function leatherFacts(products){
  const materials=values(products,['material']), colors=values(products,['normalizedColor','color']), subtypes=values(products,['subtype'])
  return [['Ассортимент',`${products.length} опубликованных товаров в текущем каталоге.`],['Типы и фактуры',subtypes.length?`${subtypes.length} типов материала представлены в каталоге.`:'Тип указан в карточках товаров.'],['Цвета',colors.length?`${colors.length} цветовых групп доступны для подбора.`:'Цвет указан в карточках товаров.'],['Сырьё',materials.length?materials.join(' и '):'Указано в карточках товаров.']]
}
function hardwareFacts(products){
  const types=values(products,['subtype']),brands=values(products,['brand']),lengths=values(products,['length']),metal=values(products,['metalColor']),tape=values(products,['tapeColor'])
  return [['Ассортимент',`${products.length} опубликованных товаров в текущем каталоге.`],['Типы',types.length?`${types.length} типов комплектующих представлены в каталоге.`:'Тип указан в карточках товаров.'],['Бренды',brands.length?brands.join(', '):'Указаны в карточках товаров.'],['Варианты',`${lengths.length} вариантов длины, ${metal.length} цветов металла и ${tape.length} цветов тесьмы.`]]
}
function leatherProductFacts(product){
  const a=product?.attributes??{}
  return [a.material,a.color||a.normalizedColor,a.thickness?`${a.thickness} мм`:'',a.coating,a.hideSize,a.origin||a.country].map(asText).filter(Boolean).slice(0,6)
}
function hardwareProductFacts(product){
  const a=product?.attributes??{}
  return [...(Array.isArray(a.subtype)?a.subtype:[a.subtype]),a.brand,a.length,a.metalColor,a.tapeColor?`тесьма: ${a.tapeColor}`:''].map(asText).filter(Boolean).slice(0,6)
}

const CATEGORY_SEO_OVERRIDES={
  odejnayakozha:{title:'Одежная кожа купить в Москве — натуральная кожа для пошива | OZELIF',description:'Натуральная одежная кожа OZELIF для курток, жакетов, жилетов, юбок и брюк: актуальные цены, сырьё, цвет, фактура и толщина. Розница и опт, шоурум в Москве.',bodyDescription:'Натуральная кожа для пошива одежды: курток, жакетов, жилетов, юбок, брюк и дизайнерских изделий. Сравните актуальные цены, сырьё, цвет, фактуру и толщину.',heading:'Натуральная кожа для пошива одежды',subcategoriesTitle:'Виды одежной кожи',choiceTitle:'Как выбрать кожу для одежды',buyTitle:'Купить натуральную кожу для пошива одежды в Москве',productsTitle:'Каталог одежной кожи с ценами',bodyFacts:leatherFacts,productFacts:leatherProductFacts,heroPreload:{href:'/images/catalog/clothing-leather/catalog-hero.avif',type:'image/avif'}},
  dublyonka:{title:'Дублёночный материал купить в Москве — натуральная овчина | OZELIF',description:'Натуральный дублёночный материал OZELIF для дублёнок, курток и пальто: актуальные цены, тип, цвет, отделка и размер шкур. Розница и опт, шоурум в Москве.',bodyDescription:'Натуральный дублёночный материал для дублёнок, курток, пальто и дизайнерской верхней одежды с актуальными ценами и характеристиками.',heading:'Дублёночный материал для верхней одежды',subcategoriesTitle:'Виды дублёночного материала',choiceTitle:'Как выбрать материал для дублёнки и верхней одежды',buyTitle:'Купить дублёночный материал для пошива в Москве',productsTitle:'Каталог дублёночного материала с ценами',bodyFacts:leatherFacts,productFacts:leatherProductFacts},
  zamsha:{title:'Натуральная замша купить в Москве — замшевая кожа | OZELIF',description:'Каталог натуральной замши OZELIF для одежды и изделий: курток, жакетов, юбок, жилетов, брюк, обуви и кожгалантереи. Актуальные цены, цвета, сырьё и фактура; розница и опт, шоурум в Москве.',bodyDescription:'Натуральная одежная замша для курток, жакетов, юбок, жилетов, брюк и других изделий с актуальными ценами и характеристиками.',heading:'Натуральная замша для одежды и изделий',choiceTitle:'Как выбрать замшу для одежды',buyTitle:'Купить натуральную замшу для одежды в Москве',productsTitle:'Каталог натуральной замши с ценами',bodyFacts:leatherFacts,productFacts:leatherProductFacts},
  obuvnayakozha:{title:'Обувная кожа купить в Москве — натуральная кожа для обуви | OZELIF',description:'Каталог натуральной кожи OZELIF для пошива обуви и аксессуаров: актуальные цены, цвет, сырьё, фактура и характеристики. Розница и опт, шоурум в Москве, доставка по России.',bodyDescription:'Натуральная кожа для пошива обуви и аксессуаров с актуальными ценами и характеристиками.',heading:'Натуральная кожа для пошива обуви',choiceTitle:'Как выбрать кожу для обуви',buyTitle:'Купить натуральную кожу для обуви в Москве',productsTitle:'Каталог обувной кожи с ценами',bodyFacts:leatherFacts,productFacts:leatherProductFacts},
  galantereynayakozha:{title:'Галантерейная кожа купить в Москве — кожа для сумок и ремней | OZELIF',description:'Каталог натуральной галантерейной кожи OZELIF для сумок, ремней, кошельков и малых кожаных изделий. Цены и характеристики, розница и опт, шоурум в Москве.',bodyDescription:'Каталог натуральной кожи для сумок, ремней, кошельков и других галантерейных изделий.',heading:'Натуральная галантерейная кожа',choiceTitle:'Как выбрать галантерейную кожу',buyTitle:'Купить галантерейную кожу в Москве',productsTitle:'Каталог галантерейной кожи с ценами',bodyFacts:leatherFacts,productFacts:leatherProductFacts},
  furnitura:{title:'Фурнитура для кожи купить в Москве — молнии, кнопки, комплектующие | OZELIF',description:'Каталог фурнитуры OZELIF для пошива одежды, курток, сумок и изделий из натуральной кожи: молнии, кнопки и комплектующие с ценами и характеристиками. Подбор по типу, бренду, длине и цвету.',bodyDescription:'Фурнитура и комплектующие для пошива одежды, курток, сумок и изделий из кожи с актуальными ценами и характеристиками.',heading:'Фурнитура для пошива одежды и изделий из кожи',choiceTitle:'Как выбрать фурнитуру для изделия',buyTitle:'Купить фурнитуру для одежды и кожи в Москве',productsTitle:'Каталог фурнитуры с ценами',bodyFacts:hardwareFacts,productFacts:hardwareProductFacts}
}

function absoluteUrl(origin, value) {
  return absoluteSeoUrl(value, origin)
}

function renderCategoryBody(category,products,{origin,description,facts=[],profile=null}){
  const name=asText(category?.name)||'Каталог', slug=asText(category?.slug)
  const subs=getCatalogSeoLandingsForCategory(slug)
  const cards=products.map(product=>{
    const url=absoluteUrl(origin,product?.url), offer=getPublishedProductOffer(product), pf=profile?.productFacts?.(product)??[]
    const price=offer?`${offer.from?'от ':''}${new Intl.NumberFormat('ru-RU').format(offer.price)} ₽${offer.unit?` / ${offer.unit}`:''}`:'Цена по запросу'
    return ['      <li>',`        <a href="${escapeHtml(url)}">`,`          <h2>${escapeHtml(product?.name)}</h2>`,`          <p>${escapeHtml(price)}</p>`,...(pf.length?[`          <p>${escapeHtml(pf.join(' · '))}</p>`]:[]),'        </a>','      </li>'].join('\n')
  })
  return ['<main class="seo-prerender seo-prerender--category" data-seo-prerender="true">','  <nav aria-label="Хлебные крошки"><a href="/">Главная</a></nav>','  <header>','    <p>Каталог OZELIF</p>',`    <h1>${escapeHtml(profile?.heading||name)}</h1>`,`    <p>${escapeHtml(description)}</p>`,'  </header>',
    ...(subs.length?['  <section>',`    <h2>${escapeHtml(profile?.subcategoriesTitle||'Подкатегории')}</h2>`,'    <nav>',...subs.map(x=>`      <a href="${escapeHtml(x.path)}">${escapeHtml(x.title)}</a>`),'    </nav>','  </section>']:[]),
    ...(facts.length?['  <section>',`    <h2>${escapeHtml(profile?.choiceTitle||'Как выбрать материал')}</h2>`,'    <dl>',...facts.map(([k,v])=>`      <div><dt>${escapeHtml(k)}</dt><dd>${escapeHtml(v)}</dd></div>`),'    </dl>','  </section>']:[]),
    ...(profile?.buyTitle?['  <section>',`    <h2>${escapeHtml(profile.buyTitle)}</h2>`,'    <p>Цены и характеристики указаны в карточках товаров. Наличие конкретной партии подтверждает менеджер.</p>','    <ul>','      <li><a href="/contacts">Контакты и шоурум OZELIF в Москве</a></li>','      <li><a href="/kozhaoptom">Условия для оптовых покупателей</a></li>','      <li><a href="/delivery">Доставка и оплата</a></li>','    </ul>','    <h3>Как узнать наличие конкретной партии?</h3>','    <p>Складской статус отдельной партии не публикуется в публичном API. Нужный вариант и объём подтвердит менеджер.</p>','  </section>']:[]),
    ...(cards.length?['  <section>',`    <h2>${escapeHtml(profile?.productsTitle||'Товары категории')}</h2>`,'    <ul>',...cards,'    </ul>','  </section>']:['  <p>Опубликованные товары пока отсутствуют.</p>']),
    '</main>'].join('\n')
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
    profile: override ?? null,
  }))
}
