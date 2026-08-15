import { CatalogSeoSubcategoryLinks } from './CatalogSeoSubcategoryLinks'
import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { ArrowUpRight, ChevronDown, Search, SlidersHorizontal, X } from 'lucide-react'
import { CatalogCardPrice } from './CatalogCardPrice'
import type { PublicCatalogProduct, PublicCatalogVariant } from '../api/publicCatalog'
import { telegram, whatsapp } from '../data'
import { Footer } from './Footer'
import { Header } from './Header'
import { useCart } from '../cart/CartProvider'
import { getProductPriceDisplay, getSourcePrice } from '../utils/productPrice'
import { usePublicCatalog, usePublicCatalogProduct } from '../hooks/usePublicCatalog'
import { responsiveProductImage } from '../utils/responsiveProductImage'
import { trackEvent } from '../analytics/track'



type Filters = { q: string; subtype: string; color: string; material: string; thickness: string; sort: string }
const initialFilters: Filters = { q: '', subtype: '', color: '', material: '', thickness: '', sort: 'default' }
const normalizeUnit = (value: string | null | undefined) => {
  const normalized = value?.trim().toUpperCase()

  if (!normalized) return null
  if (['FOT', 'FT2', 'FT²', 'ФУТ2', 'ФУТ²'].includes(normalized)) return 'фут²'
  if (['DM2', 'DM²', 'ДМ2', 'ДМ²'].includes(normalized)) return 'дм²'
  if (['M2', 'M²', 'М2', 'М²'].includes(normalized)) return 'м²'

  return value?.trim() ?? null
}

const pageSize = 16
const catalogHero = {
  src: '/images/catalog/clothing-leather/catalog-hero.webp',
  avif: '/images/catalog/clothing-leather/catalog-hero.avif',
  width: 1916,
  height: 821,
  alt: 'Мягкая одежная кожа в бежевых, коньячных и коричневых оттенках',
}

const rubFormatter = new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB', maximumFractionDigits: 0 })
const rubDecimalFormatter = new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB', minimumFractionDigits: 1, maximumFractionDigits: 1 })
const primaryPrice = (product: PublicCatalogProduct) => getProductPriceDisplay(product).price
const localProductUrl = (product: PublicCatalogProduct) => `/odejnayakozha/tproduct/${product.id}-${product.slug}`
const productDescription = (product: PublicCatalogProduct) => [product.material, product.color, product.thickness ? `${product.thickness} мм` : null].filter(Boolean).join(' · ')
const formatDecimal = (value: number) => new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 2 }).format(value)
const thicknessRange = (values: string[]) => {
  const numbers = values.flatMap(value => value.match(/\d+(?:[.,]\d+)?/g) ?? []).map(value => Number(value.replace(',', '.'))).filter(Number.isFinite)
  if (!numbers.length) return null
  return { min: Math.min(...numbers), max: Math.max(...numbers) }
}
const formatRub = (price: number, unit: string | null) => unit === 'дм²' && !Number.isInteger(price) ? rubDecimalFormatter.format(price) : rubFormatter.format(price)
function priceLabel(variant: PublicCatalogVariant | null) {
  const price = variant ? getSourcePrice(variant) : null
  if (!variant || price === null) return 'Цена по запросу'
  const unit = normalizeUnit(variant.unit)
  return [formatRub(price, unit), unit ? `за ${unit}` : null].filter(Boolean).join(' ')
}

function setMeta(selector: string, attribute: 'name' | 'property', key: string, content: string) {
  const node = document.querySelector<HTMLMetaElement>(selector) ?? document.head.appendChild(document.createElement('meta'))
  node.setAttribute(attribute, key); node.content = content
}
function setCanonical(url: string) {
  const node = document.querySelector<HTMLLinkElement>('link[rel="canonical"]') ?? document.head.appendChild(document.createElement('link'))
  node.rel = 'canonical'; node.href = url
}
function getFiltersFromUrl(): Filters {
  const params = new URLSearchParams(window.location.search)
  return { q: params.get('q') ?? '', subtype: params.get('subtype') ?? '', color: params.get('color') ?? '', material: params.get('material') ?? '', thickness: params.get('thickness') ?? '', sort: params.get('sort') ?? 'default' }
}
function updateUrl(filters: Filters) {
  const params = new URLSearchParams()
  Object.entries(filters).forEach(([key, value]) => { if (value && value !== 'default') params.set(key, value) })
  const query = params.toString(); window.history.replaceState(null, '', `${window.location.pathname}${query ? `?${query}` : ''}`)
}
function useReveal(shown = 0, itemCount = 0) {
  useEffect(() => {
    const nodes = document.querySelectorAll<HTMLElement>('.reveal:not(.is-visible)')
    const observer = new IntersectionObserver(entries => entries.forEach(entry => {
      if (!entry.isIntersecting) return
      entry.target.classList.add('is-visible')
      observer.unobserve(entry.target)
    }), { threshold: .1 })
    nodes.forEach(node => observer.observe(node))
    return () => observer.disconnect()
  }, [shown, itemCount])
}
function ProductImage({ product, priority = false, size = 'card' }: { product: PublicCatalogProduct; priority?: boolean; size?: 'card' | 'detail' }) {
  const [failed, setFailed] = useState(false)
  const image = product.image
  if (!image || failed) return <div className="product-card-fallback" role="img" aria-label={`Фото товара ${product.title} недоступно`}>OZELIF</div>
  const responsive = responsiveProductImage(image.url, size)
  return <img src={responsive.src} srcSet={responsive.srcSet} sizes={responsive.sizes} alt={image.alt ?? `${product.title} — натуральная одежная кожа`} loading={priority ? 'eager' : 'lazy'} fetchPriority={priority ? 'high' : 'low'} decoding="async" onError={() => setFailed(true)}/>
}
function Price({ variant }: { variant: PublicCatalogVariant | null }) {
  return <span className="product-card-price">{priceLabel(variant)}</span>
}
function ProductCard({ product, priority, index }: { product: PublicCatalogProduct; priority?: boolean; index: number }) {
  const shades = new Set(product.variants.map(variant => variant.shade).filter(Boolean)).size
  return <article className="product-card reveal" style={{ transitionDelay: `${Math.min(index % 8, 7) * 55}ms` }}><a href={localProductUrl(product)} aria-label={`Подробнее: ${product.title}`}><div className="product-card-image"><ProductImage product={product} priority={priority}/><span>{product.subtype[0] ?? 'Одежная кожа'}</span></div><div className="product-card-body"><h2>{product.title}</h2><p>{productDescription(product)}</p><div className="product-card-bottom"><CatalogCardPrice product={product} normalizeUnit={normalizeUnit} categorySlug="odejnayakozha" skipManagedLookup/><small>{shades || product.variants.length} {shades === 1 ? 'оттенок' : 'оттенков'}</small></div><span className="product-card-link">Подробнее <ArrowUpRight size={16}/></span></div></a></article>
}
function FilterSelect({ label, value, items, onChange }: { label: string; value: string; items: string[]; onChange: (value: string) => void }) {
  return <label className="clothing-catalog-filter"><span>{label}</span><select value={value} onChange={event => onChange(event.target.value)}><option value="">Все</option>{items.map(item => <option value={item} key={item}>{item}</option>)}</select><ChevronDown size={15}/></label>
}

export function ClothingLeatherCatalogPage() {
  const { data: catalog, isLoading, error, retry } = usePublicCatalog('odejnayakozha')
  const [filters, setFilters] = useState<Filters>(getFiltersFromUrl)
  const [shown, setShown] = useState(pageSize)
  const [filtersOpen, setFiltersOpen] = useState(false)
  const drawerRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    document.title = 'Одежная кожа — купить натуральную кожу в Москве | OZELIF'
    setMeta('meta[name="description"]', 'name', 'description', 'Натуральная одежная кожа для пошива одежды и аксессуаров. Подбор по фактуре, цвету и толщине, розница и опт, шоурум в Москве, доставка по России.')
    setMeta('meta[property="og:title"]', 'property', 'og:title', 'Одежная кожа — каталог OZELIF')
    setMeta('meta[property="og:description"]', 'property', 'og:description', 'Каталог одежной кожи с фильтрами по фактуре, цвету, сырью и толщине.')
    setMeta('meta[property="og:url"]', 'property', 'og:url', 'https://ozelifkoja.ru/odejnayakozha')
    setMeta('meta[property="og:image"]', 'property', 'og:image', `https://ozelifkoja.ru${catalogHero.src}`)
    setCanonical('https://ozelifkoja.ru/odejnayakozha')
  }, [])
  useEffect(() => { updateUrl(filters); setShown(pageSize) }, [filters])
  useEffect(() => {
    if (!filtersOpen) return
    const firstControl = drawerRef.current?.querySelector<HTMLElement>('input, select, button, a')
    firstControl?.focus()
    const onKeyDown = (event: globalThis.KeyboardEvent) => { if (event.key === 'Escape') setFiltersOpen(false) }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [filtersOpen])

  const options = useMemo(() => ({
    subtypes: [...new Set((catalog?.items ?? []).flatMap(product => product.subtype))].sort(),
    colors: [...new Set((catalog?.items ?? []).map(product => product.normalizedColor).filter((value): value is string => !!value))].sort(),
    materials: [...new Set((catalog?.items ?? []).map(product => product.material).filter((value): value is string => !!value))].sort(),
    thickness: [...new Set((catalog?.items ?? []).map(product => product.thickness).filter((value): value is string => !!value))].sort(),
  }), [catalog])
  const products = useMemo(() => {
    const query = filters.q.trim().toLocaleLowerCase('ru')
    const result = (catalog?.items ?? []).filter(product => (!query || `${product.title} ${product.article ?? ''}`.toLocaleLowerCase('ru').includes(query)) && (!filters.subtype || product.subtype.includes(filters.subtype)) && (!filters.color || product.normalizedColor === filters.color) && (!filters.material || product.material === filters.material) && (!filters.thickness || product.thickness === filters.thickness))
    return [...result].sort((left, right) => {
      if (filters.sort === 'name') return left.title.localeCompare(right.title, 'ru')
      const leftPrice = primaryPrice(left) ?? Infinity; const rightPrice = primaryPrice(right) ?? Infinity
      if (filters.sort === 'price-asc') return leftPrice - rightPrice
      if (filters.sort === 'price-desc') return rightPrice - leftPrice
      return 0
    })
  }, [catalog, filters])
  const shownProducts = products.slice(0, shown)
  const facts = useMemo(() => {
    const range = thicknessRange(options.thickness)
    return [
      ['Для изделий', 'Для одежды, головных уборов и аксессуаров.'],
      ['Сырьё в каталоге', options.materials.length ? options.materials.join(' и ') : 'Указано в карточках материалов.'],
      ['Толщина', range ? `От ${formatDecimal(range.min)} до ${formatDecimal(range.max)} мм по данным карточек каталога.` : 'Указана в карточках материалов и доступна в фильтре.'],
      ['Покупка и подбор', 'Розница и опт, просмотр образцов и помощь с подбором в московском шоуруме.'],
    ] as const
  }, [options.materials, options.thickness])
  useReveal(shown, products.length)
  const patchFilters = (patch: Partial<Filters>) => setFilters(current => ({ ...current, ...patch }))
  const hasFilters = Object.entries(filters).some(([key, value]) => key !== 'sort' && value) || filters.sort !== 'default'
  const schema = { '@context': 'https://schema.org', '@graph': [{ '@type': 'BreadcrumbList', itemListElement: [{ '@type': 'ListItem', position: 1, name: 'Главная', item: 'https://ozelifkoja.ru/' }, { '@type': 'ListItem', position: 2, name: 'Одежная кожа', item: 'https://ozelifkoja.ru/odejnayakozha' }] }, { '@type': 'ItemList', name: 'Одежная кожа', numberOfItems: catalog?.pagination.total ?? 0, itemListElement: (catalog?.items ?? []).map((product, index) => ({ '@type': 'ListItem', position: index + 1, name: product.title, url: `https://ozelifkoja.ru${localProductUrl(product)}` })) }] }
  const filterContent = <div className="clothing-catalog-filter-grid"><FilterSelect label="Подкатегория" value={filters.subtype} items={options.subtypes} onChange={subtype => patchFilters({ subtype })}/><FilterSelect label="Цвет" value={filters.color} items={options.colors} onChange={color => patchFilters({ color })}/><FilterSelect label="Тип сырья" value={filters.material} items={options.materials} onChange={material => patchFilters({ material })}/><FilterSelect label="Толщина, мм" value={filters.thickness} items={options.thickness} onChange={thickness => patchFilters({ thickness })}/></div>
  const search = <div className="clothing-catalog-search"><Search size={19}/><label><span className="sr-only">Поиск по названию или артикулу</span><input value={filters.q} onChange={event => patchFilters({ q: event.target.value })} placeholder="Поиск по названию или артикулу"/></label>{filters.q && <button type="button" onClick={() => patchFilters({ q: '' })} aria-label="Очистить поиск"><X size={16}/></button>}</div>
  const sidebar = <><div className="clothing-catalog-sidebar-head"><h2>Фильтры</h2><span>Найдено: <b>{products.length}</b></span></div>{search}{filterContent}<label className="clothing-catalog-sort"><span>Сортировка</span><select value={filters.sort} onChange={event => patchFilters({ sort: event.target.value })}><option value="default">По умолчанию</option><option value="name">По названию</option><option value="price-asc">Сначала дешевле</option><option value="price-desc">Сначала дороже</option></select><ChevronDown size={15}/></label>{hasFilters && <button type="button" className="clothing-catalog-reset" onClick={() => setFilters(initialFilters)}>Сбросить фильтры</button>}</>
  const trapDrawerFocus = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'Tab') return
    const focusable = [...(drawerRef.current?.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled]), select:not([disabled]), a[href]') ?? [])]
    if (!focusable.length) return
    const first = focusable[0]; const last = focusable.at(-1)!
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus() }
    if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus() }
  }
  return <><script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}/><Header active="catalog"/><main className="clothing-catalog-page"><section className="clothing-catalog-hero"><picture><source srcSet={catalogHero.avif} type="image/avif"/><source srcSet={catalogHero.src} type="image/webp"/><img src={catalogHero.src} alt={catalogHero.alt} width={catalogHero.width} height={catalogHero.height} loading="eager" fetchPriority="high" decoding="async"/></picture><div className="clothing-catalog-hero-scrim"/><div className="clothing-catalog-shell clothing-catalog-hero-content"><nav className="clothing-catalog-breadcrumbs" aria-label="Хлебные крошки"><a href="/">Главная</a><span>/</span><span>Одежная кожа</span></nav><p className="kicker">Каталог</p><h1>Одежная кожа</h1><p>OZELIF — магазин и склад натуральной одежной кожи в Москве. Материалы доступны в розницу и оптом; посмотреть образцы и получить помощь с подбором можно в шоуруме на Краснобогатырской улице, 24.</p><b>{isLoading ? 'Загружаем товары…' : `${products.length} из ${catalog?.pagination.total ?? 0} товаров`}</b></div></section>
    <section className="clothing-catalog-shell clothing-catalog-facts" aria-labelledby="clothing-catalog-facts-title"><div className="clothing-catalog-facts-intro"><p className="kicker">Выбор материала</p><h2 id="clothing-catalog-facts-title">Одежная кожа<br/><em>для пошива</em></h2><p>OZELIF поставляет натуральную одежную кожу и помогает подобрать материал под конкретное изделие.</p></div><dl>{facts.map(([title, text]) => <div key={title}><dt>{title}</dt><dd>{text}</dd></div>)}</dl></section>
    <CatalogSeoSubcategoryLinks categorySlug="odejnayakozha"/>
    <section className="clothing-catalog-shell clothing-catalog-layout" id="catalog-controls"><div className="clothing-catalog-mobile-controls"><p>Найдено <b>{products.length}</b></p><button type="button" className="clothing-catalog-filters-toggle" onClick={() => setFiltersOpen(true)} aria-expanded={filtersOpen} aria-controls="catalog-mobile-filters"><SlidersHorizontal size={17}/> Фильтры</button></div><div className="clothing-catalog-results" aria-live="polite"><div className="clothing-catalog-results-head"><p>Найдено <b>{products.length}</b></p>{hasFilters && <div className="clothing-catalog-applied">{filters.subtype && <span>{filters.subtype}</span>}{filters.color && <span>{filters.color}</span>}{filters.material && <span>{filters.material}</span>}{filters.thickness && <span>{filters.thickness} мм</span>}</div>}</div>{isLoading ? <div className="clothing-catalog-empty"><h2>Загружаем каталог</h2><p>Получаем актуальные товары и цены.</p></div> : error ? <div className="clothing-catalog-empty" role="alert"><h2>Не удалось загрузить каталог</h2><p>Проверьте подключение и попробуйте ещё раз.</p><button className="btn btn--dark" onClick={retry}>Повторить</button></div> : products.length ? <><div className="clothing-catalog-grid">{shownProducts.map((product, index) => <ProductCard product={product} index={index} key={product.id}/>)}</div>{shown < products.length && <button className="btn btn--dark clothing-catalog-more" onClick={() => setShown(current => current + pageSize)}>Показать ещё <span>({products.length - shown})</span></button>}</> : <div className="clothing-catalog-empty"><h2>Ничего не нашли</h2><p>Попробуйте изменить запрос или снять часть фильтров.</p><button className="btn btn--dark" onClick={() => setFilters(initialFilters)}>Сбросить фильтры</button></div>}</div><aside className="clothing-catalog-sidebar" aria-label="Фильтры каталога">{sidebar}</aside></section>
    {filtersOpen && <div className="clothing-catalog-drawer-layer"><button type="button" className="clothing-catalog-drawer-backdrop" aria-label="Закрыть фильтры" onClick={() => setFiltersOpen(false)}/><div className="clothing-catalog-drawer" id="catalog-mobile-filters" role="dialog" aria-modal="true" aria-label="Фильтры каталога" ref={drawerRef} onKeyDown={trapDrawerFocus}><div className="clothing-catalog-drawer-head"><h2>Фильтры</h2><button type="button" aria-label="Закрыть фильтры" onClick={() => setFiltersOpen(false)}><X size={19}/></button></div>{sidebar}</div></div>}
    <section className="clothing-catalog-cta"><div><p className="kicker">Подбор материала</p><h2>Не нашли<br/><em>нужный материал?</em></h2><p>Напишите менеджеру — поможем сузить выбор по задаче, фактуре и оттенку.</p><div><a className="btn btn--light" href={whatsapp} target="_blank" rel="noreferrer">WhatsApp</a><a className="text-link text-link--light" href="#catalog-controls">Подобрать материал <ArrowUpRight size={17}/></a></div></div></section>
  </main><Footer/></>
}

export function ClothingLeatherProductPage() {
  const match = window.location.pathname.match(/^\/odejnayakozha\/tproduct\/(\d+)-/)
  const identifier = match?.[1] ?? ''
  const { data: product, isLoading, error, retry } = usePublicCatalogProduct('odejnayakozha', identifier)
  const { data: relatedCatalog } = usePublicCatalog('odejnayakozha')
  const [selectedId, setSelectedId] = useState('')
  const { addItem, hasItem } = useCart()
  useReveal()
  const selected = product?.variants.find(variant => variant.id === selectedId) ?? product?.variants[0] ?? null
  useEffect(() => {
    if (product?.variants[0]) setSelectedId(current => product.variants.some(variant => variant.id === current) ? current : product.variants[0].id)
  }, [product])
  useEffect(() => {
    if (!product) return
    void trackEvent('product_view', { entityType: 'product', entityId: product.id, metadata: { category: 'odejnayakozha' } })
  }, [product])
  useEffect(() => {
    if (!product) return
    const description = productDescription(product) || 'Натуральная одежная кожа в каталоге OZELIF.'
    document.title = `${product.title} — одежная кожа OZELIF`; setMeta('meta[name="description"]', 'name', 'description', description); setMeta('meta[property="og:title"]', 'property', 'og:title', `${product.title} — OZELIF`); setMeta('meta[property="og:description"]', 'property', 'og:description', description); setMeta('meta[property="og:url"]', 'property', 'og:url', `https://ozelifkoja.ru${localProductUrl(product)}`); if (product.image) setMeta('meta[property="og:image"]', 'property', 'og:image', product.image.url); setCanonical(`https://ozelifkoja.ru${localProductUrl(product)}`)
  }, [product])
  if (isLoading) return <><Header active="catalog"/><main className="product-page-not-found"><p className="kicker">Каталог</p><h1>Загружаем товар…</h1></main><Footer/></>
  if (error) return <><Header active="catalog"/><main className="product-page-not-found" role="alert"><p className="kicker">Каталог</p><h1>Не удалось загрузить товар</h1><button className="btn btn--dark" onClick={retry}>Повторить</button></main><Footer/></>
  if (!product) return <><Header active="catalog"/><main className="product-page-not-found"><p className="kicker">Каталог</p><h1>Товар не найден</h1><a className="btn btn--dark" href="/odejnayakozha">Вернуться в каталог</a></main><Footer/></>
  const related = (relatedCatalog?.items ?? []).filter(item => item.id !== product.id && item.subtype.some(subtype => product.subtype.includes(subtype))).slice(0, 4)
  const details = [['Тип сырья', product.material], ['Цвет', product.color], ['Толщина', product.thickness ? `${product.thickness} мм` : null], ['Размер шкур', product.hideSize], ['Сорт', product.grade], ['Покрытие', product.coating], ['Происхождение сырья', product.origin], ['Страна производства', product.country], ['Минимальный заказ', product.minimumOrder], ['Единица', normalizeUnit(product.unit)], ['Порция', product.portion]].filter(([, value]) => value)

  const isConfirmedSelected = selected !== null && selected.priceRub !== null && selected.currency === 'RUB' && selected.priceSource !== 'unverified'
  const offer = isConfirmedSelected ? { '@type': 'Offer', priceCurrency: 'RUB', price: selected.priceRub } : undefined
  const oldPriceLabel = selected && selected.oldPriceRub !== null && selected.priceRub !== null && selected.oldPriceRub > selected.priceRub ? formatRub(selected.oldPriceRub, normalizeUnit(selected.unit)) : null
  const productSchema = { '@context': 'https://schema.org', '@type': 'Product', name: product.title, image: product.image ? [product.image.url] : undefined, sku: product.article ?? product.id, url: `https://ozelifkoja.ru${localProductUrl(product)}`, ...(offer ? { offers: offer } : {}) }
  const breadcrumbSchema = { '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [{ '@type': 'ListItem', position: 1, name: 'Главная', item: 'https://ozelifkoja.ru/' }, { '@type': 'ListItem', position: 2, name: 'Одежная кожа', item: 'https://ozelifkoja.ru/odejnayakozha' }, { '@type': 'ListItem', position: 3, name: product.title, item: `https://ozelifkoja.ru${localProductUrl(product)}` }] }
  return <><script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }}/><script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(productSchema) }}/><Header active="catalog"/><main className="product-page"><div className="product-page-shell"><nav className="clothing-catalog-breadcrumbs" aria-label="Хлебные крошки"><a href="/">Главная</a><span>/</span><a href="/odejnayakozha">Одежная кожа</a><span>/</span><span>{product.title}</span></nav><a className="product-page-back" href="/odejnayakozha">← В каталог</a><div className="product-page-layout"><section className="product-page-gallery"><ProductImage product={product} priority size="detail"/></section><section className="product-page-info"><p className="kicker">{product.subtype.join(' · ') || 'Одежная кожа'}</p><h1>{product.title}</h1>{product.article && <p className="product-page-article">Артикул: {product.article}</p>}<div className="product-page-price"><Price variant={selected}/>{oldPriceLabel && <del>{oldPriceLabel}</del>}</div><fieldset className="product-page-options"><legend>Вариант</legend><div>{product.variants.map(variant => <button type="button" className={variant.id === selected?.id ? 'is-selected' : ''} onClick={() => { setSelectedId(variant.id); void trackEvent('variant_select', { entityType: 'variant', entityId: variant.id, metadata: { productId: product.id, category: 'odejnayakozha' } }) }} key={variant.id}>{variant.shadeHex && <i style={{ backgroundColor: variant.shadeHex }} aria-hidden="true"/>}<span>{normalizeUnit(variant.unit) ?? 'Вариант'}{variant.shade ? ` · ${variant.shade}` : ''}</span></button>)}</div></fieldset><div className="product-page-actions"><button type="button" className="btn btn--accent" disabled={!selected} onClick={() => selected && addItem({ productId: product.id, variantId: selected.id, snapshot: { product: { title: product.title, href: localProductUrl(product), category: 'Одежная кожа', categorySlug: 'odejnayakozha', image: product.image?.url ?? null }, variant: { title: selected.title, shade: selected.shade, unit: selected.unit, priceRub: selected.priceRub, oldPriceRub: selected.oldPriceRub, currency: selected.currency, priceSource: selected.priceSource } } })}>{selected && hasItem(product.id, selected.id) ? 'В корзине' : 'Добавить в корзину'}</button><a className="text-link" href={whatsapp} target="_blank" rel="noreferrer">Уточнить наличие <ArrowUpRight size={16}/></a><a className="text-link" href={telegram} target="_blank" rel="noreferrer">Telegram <ArrowUpRight size={16}/></a></div></section></div><section className="product-page-details"><h2>Характеристики</h2><dl>{details.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl></section>{related.length > 0 && <section className="product-page-related"><div><p className="kicker">Похожие материалы</p><h2>В той же<br/><em>фактуре</em></h2></div><div className="clothing-catalog-grid">{related.map((productItem, index) => <ProductCard product={productItem} index={index} key={productItem.id}/>)}</div></section>}</div></main><Footer/></>
}
