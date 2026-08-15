import { CatalogSeoSubcategoryLinks } from './CatalogSeoSubcategoryLinks'
import { useEffect, useMemo, useState } from 'react'
import { ArrowLeft, ArrowUpRight, ChevronDown, Search } from 'lucide-react'
import type { PublicCatalogProduct, PublicCatalogVariant } from '../api/publicCatalog'
import { usePublicCatalog, usePublicCatalogProduct } from '../hooks/usePublicCatalog'
import { getProductPriceDisplay, getSourcePrice } from '../utils/productPrice'
import { responsiveProductImage } from '../utils/responsiveProductImage'
import { CatalogCardPrice } from './CatalogCardPrice'
import { Footer } from './Footer'
import { Header } from './Header'
import { useCart } from '../cart/CartProvider'
import { telegram, whatsapp } from '../data'
import { sanitizeCatalogQuery, trackEvent } from '../analytics/track'

type CategoryConfig = {
  slug: string
  name: string
  description: string
  heroClass: string
  heroImage: string
  heroAlt: string
  fallbackSubtype: string
  searchPlaceholder: string
  ctaKicker: string
  ctaTitle: string
  ctaDescription: string
  hardware?: boolean
}

const CONFIG: Record<string, CategoryConfig> = {
  dublyonka: { slug: 'dublyonka', name: 'Дублёночный материал', description: 'Натуральная овчина для дублёнок, верхней одежды и дизайнерских изделий.', heroClass: 'shearling-catalog-hero', heroImage: '/images/catalog/shearling/catalog-hero.png', heroAlt: 'Дублёночный материал в кремовых, карамельных и коричневых оттенках', fallbackSubtype: 'Дублёночный материал', searchPlaceholder: 'Поиск по названию', ctaKicker: 'Подбор материала', ctaTitle: 'Нужна помощь с выбором?', ctaDescription: 'Напишите менеджеру — подберём материал по фактуре, цвету и размеру шкур.' },
  zamsha: { slug: 'zamsha', name: 'Замша', description: 'Натуральная замша для одежды, обуви и изделий из кожи.', heroClass: 'suede-catalog-hero', heroImage: '/images/catalog/suede/catalog-hero.png', heroAlt: 'Натуральная замша разных оттенков', fallbackSubtype: 'Замша', searchPlaceholder: 'Поиск по названию', ctaKicker: 'Подбор материала', ctaTitle: 'Нужна помощь с выбором?', ctaDescription: 'Напишите менеджеру — подберём материал по фактуре, цвету и размеру шкур.' },
  obuvnayakozha: { slug: 'obuvnayakozha', name: 'Обувная кожа', description: 'Натуральная кожа для обуви и аксессуаров.', heroClass: 'shoe-leather-catalog-hero', heroImage: '/images/catalog/shoe-leather/catalog-hero.png', heroAlt: 'Натуральная обувная кожа', fallbackSubtype: 'Обувная кожа', searchPlaceholder: 'Поиск по названию', ctaKicker: 'Подбор материала', ctaTitle: 'Нужна помощь с выбором?', ctaDescription: 'Напишите менеджеру — подберём материал по фактуре и назначению.' },
  galantereynayakozha: { slug: 'galantereynayakozha', name: 'Галантерейная кожа', description: 'Натуральная кожа для сумок, ремней, кошельков и других галантерейных изделий.', heroClass: 'leather-goods-catalog-hero', heroImage: '/images/categories/leather-goods.webp', heroAlt: 'Натуральная галантерейная кожа', fallbackSubtype: 'Галантерейная кожа', searchPlaceholder: 'Поиск по названию', ctaKicker: 'Подбор материала', ctaTitle: 'Нужна помощь с выбором?', ctaDescription: 'Напишите менеджеру — поможем подобрать кожу под изделие.' },
  furnitura: { slug: 'furnitura', name: 'Фурнитура', description: 'Молнии, кнопки и комплектующие для одежды и изделий из натуральной кожи.', heroClass: 'hardware-catalog-hero', heroImage: '/images/categories/hardware.webp', heroAlt: 'Металлическая фурнитура для изделий из кожи', fallbackSubtype: 'Фурнитура', searchPlaceholder: 'Молния, YKK, латунь...', ctaKicker: 'Подбор комплектующих', ctaTitle: 'Нужен цвет или размер под конкретное изделие?', ctaDescription: 'Напишите менеджеру — уточним наличие, совместимость, минимальный заказ и подходящий вариант фурнитуры.', hardware: true },
}

type CommercialProfile = {
  metaTitle:string; metaDescription:string; kicker:string; h1:string; intro:string;
  choiceTitle:string; choiceText:string; buyTitle:string; buyText:string;
}
const COMMERCIAL:Record<string,CommercialProfile>={
  dublyonka:{metaTitle:'Дублёночный материал купить в Москве — натуральная овчина | OZELIF',metaDescription:'Каталог натурального дублёночного материала OZELIF: цены и характеристики, подбор по типу, цвету, отделке и размеру шкур. Розница и опт, шоурум в Москве, доставка по России.',kicker:'Натуральная овчина · Москва',h1:'Дублёночный материал для верхней одежды',intro:'Натуральный дублёночный материал для дублёнок, курток, пальто и дизайнерской верхней одежды. Сравнивайте типы, оттенки, отделку, размеры шкур и актуальные цены.',choiceTitle:'Как выбрать материал для дублёнки и верхней одежды',choiceText:'Сравнивайте тип материала, цвет, размер шкуры, покрытие и происхождение по карточкам. Для дублёнок, курток и пальто менеджер поможет сверить материал с конкретной моделью.',buyTitle:'Купить дублёночный материал для пошива в Москве',buyText:'Цена и единица продажи указаны в карточке каждого товара. Конкретную партию, оттенок и объём лучше подтвердить у менеджера перед заказом.'},
  zamsha:{metaTitle:'Натуральная замша купить в Москве — замшевая кожа | OZELIF',metaDescription:'Каталог натуральной замши OZELIF с ценами и характеристиками. Подбор по цвету, типу сырья и фактуре для одежды, обуви и кожгалантереи. Розница и опт, шоурум в Москве.',kicker:'Натуральная замша · Москва',h1:'Натуральная замша для одежды и изделий',intro:'Натуральная одежная замша для курток, жакетов, юбок, жилетов, брюк, обуви и других изделий. Сравните актуальные цены, цвет, сырьё и фактуру конкретных позиций.',choiceTitle:'Как выбрать замшу для одежды',choiceText:'Для курток, жакетов, юбок, жилетов и брюк сравнивайте мягкость, сырьё, цвет и характеристики конкретной позиции. Материал можно посмотреть и сравнить в московском шоуруме.',buyTitle:'Купить натуральную замшу для одежды в Москве',buyText:'В карточках опубликованы актуальные варианты, цены и характеристики. Для оптовой партии или точного попадания в оттенок свяжитесь с менеджером.'},
  obuvnayakozha:{metaTitle:'Обувная кожа купить в Москве — натуральная кожа для обуви | OZELIF',metaDescription:'Каталог натуральной обувной кожи OZELIF: цены и характеристики, подбор по цвету, сырью и фактуре. Розница и опт, шоурум в Москве, доставка по России.',kicker:'Натуральная кожа · Москва',h1:'Натуральная кожа для пошива обуви',intro:'Каталог натуральной кожи для пошива обуви и аксессуаров с актуальными ценами и характеристиками. Сравнивайте сырьё, цвет, фактуру и параметры конкретных товаров.',choiceTitle:'Как выбрать кожу для обуви',choiceText:'Для обуви сравните сырьё, цвет, фактуру, размер шкуры и другие параметры карточки. Менеджер поможет подобрать вариант под модель и требования производства.',buyTitle:'Купить натуральную кожу для обуви в Москве',buyText:'OZELIF продаёт материалы в розницу и оптом. Цена и единица продажи указаны в карточках; наличие нужной партии и объём подтверждаются менеджером.'},
  galantereynayakozha:{metaTitle:'Галантерейная кожа купить в Москве — кожа для сумок и ремней | OZELIF',metaDescription:'Каталог натуральной галантерейной кожи OZELIF для сумок, ремней, кошельков и малых кожаных изделий. Цены и характеристики, розница и опт, шоурум в Москве.',kicker:'Натуральная кожа · Москва',h1:'Натуральная галантерейная кожа',intro:'Каталог натуральной кожи для сумок, ремней, кошельков и других галантерейных изделий. Цены и характеристики берутся из опубликованных карточек OZELIF.',choiceTitle:'Как выбрать галантерейную кожу',choiceText:'Сравнивайте цвет, сырьё, фактуру, размер шкуры и другие характеристики конкретных материалов. Для изделия или серии менеджер поможет сузить выбор.',buyTitle:'Купить галантерейную кожу в Москве',buyText:'Материалы доступны розничным и оптовым покупателям. Перед заказом партии можно уточнить актуальный оттенок, объём и условия получения.'},
  furnitura:{metaTitle:'Фурнитура для кожи купить в Москве — молнии, кнопки, комплектующие | OZELIF',metaDescription:'Каталог фурнитуры OZELIF для одежды и изделий из кожи: молнии, кнопки и комплектующие с ценами и характеристиками. Подбор по типу, бренду, длине и цвету.',kicker:'Комплектующие · Москва',h1:'Фурнитура для пошива одежды и изделий из кожи',intro:'Молнии, кнопки и комплектующие для пошива одежды, курток, сумок и изделий из натуральной кожи. Используйте фильтры по типу, бренду, длине и цветам.',choiceTitle:'Как выбрать фурнитуру для изделия',choiceText:'Сверяйте тип комплектующего, бренд, длину, цвет металла и тесьмы. Для куртки, сумки или другого изделия менеджер поможет проверить совместимость и доступный вариант.',buyTitle:'Купить фурнитуру для одежды и кожи в Москве',buyText:'В каталоге опубликованы реальные позиции и цены. Наличие конкретного цвета, длины или партии подтверждается менеджером перед заказом.'}
}

function genericConfig(slug: string): CategoryConfig {
  return {
    slug,
    name: 'Каталог',
    description: 'Актуальные материалы OZELIF со склада в Москве.',
    heroClass: 'catalog-hero',
    heroImage: '/images/hero-leather-wide.jpg',
    heroAlt: 'Натуральная кожа OZELIF',
    fallbackSubtype: 'Материал',
    searchPlaceholder: 'Поиск по названию',
    ctaKicker: 'Подбор материала',
    ctaTitle: 'Нужна помощь с выбором?',
    ctaDescription: 'Напишите менеджеру — поможем подобрать подходящий материал.',
  }
}

type Filters = { q: string; subtype: string; color: string; material: string; brand: string; tapeColor: string; metalColor: string; length: string; country: string; sort: string }
const initialFilters: Filters = { q: '', subtype: '', color: '', material: '', brand: '', tapeColor: '', metalColor: '', length: '', country: '', sort: 'default' }
const pageSize = 16
const formatter = new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB', maximumFractionDigits: 1 })

function setMeta(selector:string,attribute:'name'|'property',key:string,content:string){
  const node=document.querySelector<HTMLMetaElement>(selector)??document.head.appendChild(document.createElement('meta'))
  node.setAttribute(attribute,key); node.content=content
}
function setCanonical(href:string){
  const node=document.querySelector<HTMLLinkElement>('link[rel="canonical"]')??document.head.appendChild(document.createElement('link'))
  node.rel='canonical'; node.href=href
}

function normalizeUnit(value: string | null | undefined) {
  const unit = value?.trim().toUpperCase()
  if (!unit) return null
  if (['PCE', 'PCS', 'PC', 'ШТ', 'ШТ.'].includes(unit)) return 'шт.'
  if (['FOT', 'FT2', 'FT²', 'ФУТ2', 'ФУТ²'].includes(unit)) return 'фут²'
  if (['DM2', 'DM²', 'ДМ2', 'ДМ²'].includes(unit)) return 'дм²'
  if (['M2', 'M²', 'М2', 'М²'].includes(unit)) return 'м²'
  return value?.trim() ?? null
}

function productUrl(config: CategoryConfig, product: PublicCatalogProduct) {
  return `/${config.slug}/tproduct/${product.id}-${product.slug}`
}

function productDescription(config: CategoryConfig, product: PublicCatalogProduct) {
  if (config.hardware) return [product.subtype.join(' · '), product.brand, product.length, product.metalColor, product.tapeColor ? `тесьма: ${product.tapeColor}` : null].filter(Boolean).join(' · ')
  return [product.material, product.color, product.thickness ? `${product.thickness} мм` : null, product.coating, product.hideSize, product.countryOfOrigin].filter(Boolean).slice(0,6).join(' · ')
}

function ProductImage({ product, priority = false, size = 'card' }: { product: PublicCatalogProduct; priority?: boolean; size?: 'card' | 'detail' }) {
  const [failed, setFailed] = useState(false)
  if (!product.image || failed) return <div className="product-card-fallback" role="img" aria-label={`Фото товара ${product.title} недоступно`}>OZELIF</div>
  const responsive = responsiveProductImage(product.image.url, size)
  return <img src={responsive.src} srcSet={responsive.srcSet} sizes={responsive.sizes} alt={product.image.alt ?? product.title} width={900} height={1100} loading={priority ? 'eager' : 'lazy'} fetchPriority={priority ? 'high' : undefined} decoding="async" onError={() => setFailed(true)} />
}

function FilterSelect({ label, value, items, onChange }: { label: string; value: string; items: string[]; onChange(value: string): void }) {
  return <label className="clothing-catalog-filter"><span>{label}</span><select value={value} onChange={event => onChange(event.target.value)}><option value="">Все</option>{items.map(item => <option value={item} key={item}>{item}</option>)}</select><ChevronDown size={15} /></label>
}

function CatalogCard({ config, product, index }: { config: CategoryConfig; product: PublicCatalogProduct; index: number }) {
  return <article className="product-card reveal" style={{ transitionDelay: `${Math.min(index % 8, 7) * 55}ms` }}><a href={productUrl(config, product)}><div className="product-card-image"><ProductImage product={product} priority={index < 4} /><span>{product.subtype[0] ?? config.fallbackSubtype}</span></div><div className="product-card-body"><h2>{product.title}</h2><p>{productDescription(config, product)}</p><div className="product-card-bottom"><CatalogCardPrice product={product} normalizeUnit={normalizeUnit} categorySlug={config.slug} skipManagedLookup /><small>{product.variants.length} {product.variants.length === 1 ? 'вариант' : 'вариантов'}</small></div><span className="product-card-link">Подробнее <ArrowUpRight size={16} /></span></div></a></article>
}

function useReveal(shown: number, count: number) {
  useEffect(() => {
    const nodes = document.querySelectorAll<HTMLElement>('.reveal:not(.is-visible)')
    const observer = new IntersectionObserver(entries => entries.forEach(entry => { if (entry.isIntersecting) { entry.target.classList.add('is-visible'); observer.unobserve(entry.target) } }), { threshold: .1 })
    nodes.forEach(node => observer.observe(node))
    return () => observer.disconnect()
  }, [shown, count])
}

function ApiCatalogPage({ config }: { config: CategoryConfig }) {
  const { data: catalog, isLoading, error, retry } = usePublicCatalog(config.slug)
  const [filters, setFilters] = useState(initialFilters)
  const [shown, setShown] = useState(pageSize)
  const commercial = COMMERCIAL[config.slug] ?? null
  const currentConfig = useMemo(() => ({
    ...config,
    name: catalog?.category?.name || config.name,
    description: catalog?.category?.description || config.description,
    heroImage: catalog?.category?.coverImage || config.heroImage,
    heroAlt: catalog?.category?.name || config.heroAlt,
  }), [catalog?.category?.coverImage, catalog?.category?.description, catalog?.category?.name, config])
  useEffect(() => {
    document.title=commercial?.metaTitle ?? `${currentConfig.name} — каталог OZELIF`
    if(!commercial)return
    setMeta('meta[name="description"]','name','description',commercial.metaDescription)
    setMeta('meta[property="og:title"]','property','og:title',commercial.metaTitle)
    setMeta('meta[property="og:description"]','property','og:description',commercial.metaDescription)
    setCanonical(`https://ozelifkoja.ru/${config.slug}`)
  },[commercial,config.slug,currentConfig.name])
  const options = useMemo(() => {
    const items = catalog?.items ?? []
    const strings = (values: Array<string | null>) => [...new Set(values.filter((value): value is string => Boolean(value)))].sort()
    return { subtypes: [...new Set(items.flatMap(item => item.subtype))].sort(), colors: strings(items.map(item => item.normalizedColor)), materials: strings(items.map(item => item.material)), brands: strings(items.map(item => item.brand)), tapeColors: strings(items.map(item => item.tapeColor)), metalColors: strings(items.map(item => item.metalColor)), lengths: strings(items.map(item => item.length)), countries: strings(items.map(item => item.countryOfOrigin)) }
  }, [catalog])
  const products = useMemo(() => {
    const query = filters.q.trim().toLocaleLowerCase('ru')
    const result = (catalog?.items ?? []).filter(product => {
      const searchable = [product.title, product.article, product.subtype.join(' '), product.material, product.color, product.brand, product.tapeColor, product.metalColor, product.length, product.countryOfOrigin].filter(Boolean).join(' ').toLocaleLowerCase('ru')
      return (!query || searchable.includes(query)) && (!filters.subtype || product.subtype.includes(filters.subtype)) && (!filters.color || product.normalizedColor === filters.color) && (!filters.material || product.material === filters.material) && (!filters.brand || product.brand === filters.brand) && (!filters.tapeColor || product.tapeColor === filters.tapeColor) && (!filters.metalColor || product.metalColor === filters.metalColor) && (!filters.length || product.length === filters.length) && (!filters.country || product.countryOfOrigin === filters.country)
    })
    return [...result].sort((a, b) => {
      if (filters.sort === 'name') return a.title.localeCompare(b.title, 'ru')
      const ap = getProductPriceDisplay(a).price ?? Infinity; const bp = getProductPriceDisplay(b).price ?? Infinity
      return filters.sort === 'price-asc' ? ap - bp : filters.sort === 'price-desc' ? bp - ap : 0
    })
  }, [catalog, filters])
  useReveal(shown, products.length)
  useEffect(() => {
    const query = sanitizeCatalogQuery(filters.q)
    if (!query || isLoading || error || products.length > 0) return

    const timer = window.setTimeout(() => {
      void trackEvent('search_no_results', {
        entityType: 'catalog',
        entityId: config.slug,
        metadata: { category: config.slug, query },
      })
    }, 800)

    return () => window.clearTimeout(timer)
  }, [config.slug, error, filters.q, isLoading, products.length])
  const patch = (change: Partial<Filters>) => {
    setFilters(current => ({ ...current, ...change }))
    setShown(pageSize)
    Object.entries(change).forEach(([filter, value]) => {
      if (filter === 'q' || !value || value === 'default') return
      void trackEvent('catalog_filter', {
        entityType: 'catalog',
        entityId: config.slug,
        metadata: { category: config.slug, filter, value },
      })
    })
  }
  const hasFilters = Object.entries(filters).some(([key, value]) => key !== 'sort' ? Boolean(value) : value !== 'default')
  const shownProducts = products.slice(0, shown)
  const sidebar = <><div className="clothing-catalog-sidebar-head"><h2>Фильтры</h2><span>Найдено: <b>{products.length}</b></span></div><div className="clothing-catalog-search"><Search size={19} /><label><span className="sr-only">Поиск</span><input value={filters.q} onChange={event => patch({ q: event.target.value })} placeholder={config.searchPlaceholder} /></label></div><div className="clothing-catalog-filter-grid"><FilterSelect label={config.hardware ? 'Тип' : 'Подкатегория'} value={filters.subtype} items={options.subtypes} onChange={subtype => patch({ subtype })} />{config.hardware ? <><FilterSelect label="Бренд" value={filters.brand} items={options.brands} onChange={brand => patch({ brand })} /><FilterSelect label="Цвет тесьмы" value={filters.tapeColor} items={options.tapeColors} onChange={tapeColor => patch({ tapeColor })} /><FilterSelect label="Цвет металла" value={filters.metalColor} items={options.metalColors} onChange={metalColor => patch({ metalColor })} /><FilterSelect label="Длина" value={filters.length} items={options.lengths} onChange={length => patch({ length })} /><FilterSelect label="Страна" value={filters.country} items={options.countries} onChange={country => patch({ country })} /></> : <><FilterSelect label="Цвет" value={filters.color} items={options.colors} onChange={color => patch({ color })} /><FilterSelect label="Тип сырья" value={filters.material} items={options.materials} onChange={material => patch({ material })} /></>}</div><label className="clothing-catalog-sort"><span>Сортировка</span><select value={filters.sort} onChange={event => patch({ sort: event.target.value })}><option value="default">По умолчанию</option><option value="name">По названию</option><option value="price-asc">Сначала дешевле</option><option value="price-desc">Сначала дороже</option></select><ChevronDown size={15} /></label>{hasFilters && <button type="button" className="clothing-catalog-reset" onClick={() => { setFilters(initialFilters); setShown(pageSize) }}>Сбросить фильтры</button>}</>
  const heroWebp = currentConfig.heroImage.replace(/\.png$/, '.webp')
  const heroAvif = currentConfig.heroImage.replace(/\.png$/, '.avif')
  const hasOptimizedHero = heroWebp !== currentConfig.heroImage
  return <><Header active="catalog" /><main className="clothing-catalog-page"><section className={`clothing-catalog-hero ${currentConfig.heroClass}`}><picture>{hasOptimizedHero && <><source srcSet={heroAvif} type="image/avif"/><source srcSet={heroWebp} type="image/webp"/></>}<img src={hasOptimizedHero ? heroWebp : currentConfig.heroImage} alt={currentConfig.heroAlt} width={1672} height={941} loading="eager" fetchPriority="high" decoding="async" /></picture><div className="clothing-catalog-hero-scrim" /><div className="clothing-catalog-shell clothing-catalog-hero-content"><nav className="clothing-catalog-breadcrumbs" aria-label="Хлебные крошки"><a href="/">Главная</a><span>/</span><span>{currentConfig.name}</span></nav><p className="kicker">{commercial?.kicker ?? 'Каталог'}</p><h1>{commercial?.h1 ?? currentConfig.name}</h1><p>{commercial?.intro ?? currentConfig.description}</p><b>{isLoading ? 'Загружаем товары…' : `${products.length} из ${catalog?.pagination.total ?? 0} товаров`}</b></div></section><CatalogSeoSubcategoryLinks categorySlug={currentConfig.slug}/>{commercial&&<section className="clothing-catalog-shell clothing-catalog-commercial"><header className="clothing-catalog-commercial-head"><div><p className="kicker">Выбор и покупка</p><h2>{commercial.choiceTitle}</h2></div><p>{commercial.choiceText}</p></header><div className="clothing-catalog-commercial-grid"><article><span>01</span><h3>{commercial.buyTitle}</h3><p>{commercial.buyText}</p><a href="/contacts">Контакты и шоурум <ArrowUpRight size={15}/></a></article><article><span>02</span><h3>Оптовая закупка</h3><p>Для производства и регулярных закупок доступны отдельные условия. Менеджер поможет сверить параметры и подходящий объём.</p><a href="/kozhaoptom">Условия для оптовиков <ArrowUpRight size={15}/></a></article><article><span>03</span><h3>Доставка по России</h3><p>После выбора позиции согласуйте удобный способ получения заказа.</p><a href="/delivery">Доставка и оплата <ArrowUpRight size={15}/></a></article></div></section>}<section className="clothing-catalog-shell clothing-catalog-layout" id="catalog-controls"><div className="clothing-catalog-results" aria-live="polite"><div className="clothing-catalog-results-head"><p>Найдено <b>{products.length}</b></p></div>{isLoading ? <div className="clothing-catalog-empty"><h2>Загружаем каталог</h2><p>Получаем актуальные товары и цены.</p></div> : error ? <div className="clothing-catalog-empty" role="alert"><h2>Не удалось загрузить каталог</h2><p>Проверьте подключение и попробуйте ещё раз.</p><button className="btn btn--dark" onClick={retry}>Повторить</button></div> : products.length ? <><div className="clothing-catalog-grid">{shownProducts.map((product, index) => <CatalogCard config={currentConfig} product={product} index={index} key={product.id} />)}</div>{shown < products.length && <button className="btn btn--dark clothing-catalog-more" onClick={() => setShown(value => value + pageSize)}>Показать ещё <span>({products.length - shown})</span></button>}</> : <div className="clothing-catalog-empty"><h2>Ничего не нашли</h2><p>Попробуйте изменить запрос или снять часть фильтров.</p><button className="btn btn--dark" onClick={() => { setFilters(initialFilters); setShown(pageSize) }}>Сбросить фильтры</button></div>}</div><aside className="clothing-catalog-sidebar" aria-label="Фильтры каталога">{sidebar}</aside></section>{commercial&&<section className="clothing-catalog-shell clothing-catalog-faq"><div className="clothing-catalog-faq-head"><p className="kicker">Перед заказом</p><h2>Что уточнить<br/><em>у менеджера</em></h2></div><div className="clothing-catalog-faq-list"><details><summary>Где посмотреть материал или фурнитуру?</summary><p>Опубликованные позиции можно сравнить онлайн, а образцы и доступные варианты посмотреть в шоуруме OZELIF в Москве.</p></details><details><summary>Как узнать наличие конкретной партии?</summary><p>Каталог показывает товары, цены и характеристики, но складской статус отдельной партии не публикуется в публичном API. Наличие нужного варианта или объёма подтвердит менеджер.</p></details></div></section>}<section className="clothing-catalog-cta"><div><p className="kicker">{currentConfig.ctaKicker}</p><h2>{currentConfig.ctaTitle}</h2><p>{currentConfig.ctaDescription}</p><div><a className="btn btn--light" href={whatsapp} target="_blank" rel="noreferrer">WhatsApp</a></div></div></section></main><Footer /></>
}

function ApiProductPage({ config }: { config: CategoryConfig }) {
  const escapedSlug = config.slug.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const match = window.location.pathname.match(new RegExp(`^/${escapedSlug}/tproduct/(\\d+|[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12})-`, 'i'))
  const { data: product, isLoading, error, retry } = usePublicCatalogProduct(config.slug, match?.[1] ?? '')
  const [selectedId, setSelectedId] = useState('')
  const { addItem, hasItem } = useCart()
  useEffect(() => { if (product?.variants[0]) setSelectedId(current => product.variants.some(variant => variant.id === current) ? current : product.variants[0].id) }, [product])
  useEffect(() => {
    if (!product) return
    void trackEvent('product_view', {
      entityType: 'product',
      entityId: product.id,
      metadata: { category: config.slug },
    })
  }, [config.slug, product])
  if (isLoading) return <><Header active="catalog" /><main className="product-page-not-found"><p className="kicker">Каталог</p><h1>Загружаем товар…</h1></main><Footer /></>
  if (error) return <><Header active="catalog" /><main className="product-page-not-found" role="alert"><p className="kicker">Каталог</p><h1>Не удалось загрузить товар</h1><button className="btn btn--dark" onClick={retry}>Повторить</button></main><Footer /></>
  if (!product) return <><Header active="catalog" /><main className="product-page-not-found"><p className="kicker">Каталог</p><h1>Товар не найден</h1><a className="btn btn--dark" href={`/${config.slug}`}>Вернуться в каталог</a></main><Footer /></>
  const selected = product.variants.find(variant => variant.id === selectedId) ?? product.variants[0] ?? null
  const categoryName = product.category?.name || config.name
  const details = [['Тип сырья', product.material], ['Цвет', product.color], ['Размер шкур', product.hideSize], ['Толщина', product.thickness], ['Покрытие', product.coating], ['Происхождение сырья', product.origin], ['Страна производства', product.country], ['Бренд', product.brand], ['Цвет тесьмы', product.tapeColor], ['Цвет металла', product.metalColor], ['Длина', product.length], ['Минимальный заказ', product.minimumOrder]].filter(([, value]) => value)
  const selectedPrice = selected ? getSourcePrice(selected) : null
  const old = selected?.oldPriceRub && selectedPrice && selected.oldPriceRub > selectedPrice ? formatter.format(selected.oldPriceRub) : null
  return <><Header active="catalog" /><main className="product-page"><div className="product-page-shell"><nav className="clothing-catalog-breadcrumbs" aria-label="Хлебные крошки"><a href="/">Главная</a><span>/</span><a href={`/${config.slug}`}>{categoryName}</a><span>/</span><span>{product.title}</span></nav><a className="product-page-back" href={`/${config.slug}`}><ArrowLeft size={17} /> В каталог</a><div className="product-page-layout"><section className="product-page-gallery"><ProductImage product={product} priority size="detail" /></section><section className="product-page-info"><p className="kicker">{product.subtype.join(' · ') || config.fallbackSubtype}</p><h1>{product.title}</h1>{product.article && <p className="product-page-article">Артикул: {product.article}</p>}<div className="product-page-price"><span className="product-card-price">{selectedPrice === null ? 'Цена по запросу' : `${formatter.format(selectedPrice)}${normalizeUnit(selected?.unit) ? ` за ${normalizeUnit(selected?.unit)}` : ''}`}</span>{old && <del>{old}</del>}</div>{product.variants.length > 0 && <fieldset className="product-page-options"><legend>Вариант</legend><div>{product.variants.map((variant: PublicCatalogVariant) => <button type="button" className={variant.id === selected?.id ? 'is-selected' : ''} onClick={() => { setSelectedId(variant.id); void trackEvent('variant_select', { entityType: 'variant', entityId: variant.id, metadata: { productId: product.id, category: config.slug } }) }} key={variant.id}>{variant.shadeHex && <i style={{ backgroundColor: variant.shadeHex }} aria-hidden="true" />}<span>{normalizeUnit(variant.unit) ?? 'Вариант'}{variant.shade ? ` · ${variant.shade}` : ''}</span></button>)}</div></fieldset>}<div className="product-page-actions"><button type="button" className="btn btn--accent" disabled={!selected} onClick={() => selected && addItem({ productId: product.id, variantId: selected.id, snapshot: { product: { title: product.title, href: productUrl(config, product), category: categoryName, categorySlug: config.slug, image: product.image?.url ?? null }, variant: { title: selected.title, shade: selected.shade, unit: selected.unit, priceRub: selected.priceRub, oldPriceRub: selected.oldPriceRub, currency: selected.currency, priceSource: selected.priceSource } } })}>{selected && hasItem(product.id, selected.id) ? 'В корзине' : 'Добавить в корзину'}</button><a className="btn btn--accent" href={whatsapp} target="_blank" rel="noreferrer">Уточнить наличие</a>{config.hardware && <a className="text-link" href={telegram} target="_blank" rel="noreferrer">Telegram <ArrowUpRight size={16} /></a>}</div></section></div><section className="product-page-details"><h2>Характеристики</h2><dl>{details.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl></section></div></main><Footer /></>
}

export const ShearlingCatalogFromApi = () => <ApiCatalogPage config={CONFIG.dublyonka} />
export const ShearlingProductFromApi = () => <ApiProductPage config={CONFIG.dublyonka} />
export const SuedeCatalogFromApi = () => <ApiCatalogPage config={CONFIG.zamsha} />
export const SuedeProductFromApi = () => <ApiProductPage config={CONFIG.zamsha} />
export const ShoeLeatherCatalogFromApi = () => <ApiCatalogPage config={CONFIG.obuvnayakozha} />
export const ShoeLeatherProductFromApi = () => <ApiProductPage config={CONFIG.obuvnayakozha} />
export const HardwareCatalogFromApi = () => <ApiCatalogPage config={CONFIG.furnitura} />
export const HardwareProductFromApi = () => <ApiProductPage config={CONFIG.furnitura} />
export const GenericCatalogFromApi = ({ categorySlug }: { categorySlug: string }) => <ApiCatalogPage config={CONFIG[categorySlug] ?? genericConfig(categorySlug)} />
export const GenericProductFromApi = ({ categorySlug }: { categorySlug: string }) => <ApiProductPage config={CONFIG[categorySlug] ?? genericConfig(categorySlug)} />
