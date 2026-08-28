import { useEffect } from 'react'
import { ArrowLeft, ArrowUpRight } from 'lucide-react'
import type { PublicCatalogProduct } from '../api/publicCatalog'
import { usePublicCatalogNewest, usePublicCatalogSale } from '../hooks/usePublicCatalog'
import { getProductPriceDisplay } from '../utils/productPrice'
import { responsiveProductImage } from '../utils/responsiveProductImage'
import { Footer } from './Footer'
import { Header } from './Header'

const rubFormatter = new Intl.NumberFormat('ru-RU', {
  style: 'currency',
  currency: 'RUB',
  maximumFractionDigits: 1,
})

function normalizeUnit(value: string | null | undefined) {
  const normalized = value?.trim().toUpperCase()
  if (!normalized) return null
  if (['FOT', 'FT2', 'FT²', 'ФУТ2', 'ФУТ²'].includes(normalized)) return 'фут²'
  if (['DM2', 'DM²', 'ДМ2', 'ДМ²'].includes(normalized)) return 'дм²'
  if (['M2', 'M²', 'М2', 'М²'].includes(normalized)) return 'м²'
  return value?.trim() ?? null
}

function productUrl(product: PublicCatalogProduct) {
  return `/${product.category?.slug ?? 'odejnayakozha'}/tproduct/${product.id}-${product.slug}`
}

function SaleCard({ product, priority = false }: { product: PublicCatalogProduct; priority?: boolean }) {
  const display = getProductPriceDisplay(product)
  const unit = normalizeUnit(display.unit)
  const oldPrice = product.variants.find(variant => variant.oldPriceRub && variant.priceRub && variant.oldPriceRub > variant.priceRub)?.oldPriceRub ?? null
  const image = product.image ? responsiveProductImage(product.image.url, 'card') : null
  return <article className="sale-card reveal is-visible"><a href={productUrl(product)}><div className="sale-card-media">{product.image && image ? <img src={image.src} srcSet={image.srcSet} sizes={image.sizes} alt={product.image.alt ?? product.title} width={900} height={900} loading={priority ? 'eager' : 'lazy'} decoding="async"/> : <div className="sale-card-fallback">OZELIF</div>}<span>{product.category?.name ?? 'Каталог'}</span></div><div className="sale-card-body"><h3>{product.title}</h3><div className="sale-card-prices"><strong>{display.price === null ? 'Цена по запросу' : `${display.kind === 'from' ? 'от ' : ''}${rubFormatter.format(display.price)}${unit ? ` / ${unit}` : ''}`}</strong>{oldPrice && display.price && oldPrice > display.price && <del>{rubFormatter.format(oldPrice)}</del>}</div></div></a></article>
}

function SaleGrid({ products, priority = false }: { products: PublicCatalogProduct[]; priority?: boolean }) {
  return <div className="sale-grid">{products.map((product, index) => <SaleCard product={product} priority={priority && index < 4} key={product.id}/>)}</div>
}

export function SaleProductsSection() {
  const { data: products, isLoading } = usePublicCatalogSale()
  if (isLoading || !products?.length) return null
  return <section className="section sale-section"><div className="sale-section-head reveal is-visible"><div><p className="kicker">Специальные предложения</p><h2>Товары<br/><em>со скидкой</em></h2></div><a className="text-link" href="/sale">Смотреть все <ArrowUpRight size={17}/></a></div><SaleGrid products={products.slice(0, 8)} priority/></section>
}


export function NewPage() {
  const { data: products, isLoading, error, retry } = usePublicCatalogNewest()
  useEffect(() => { document.title = 'Новое в каталоге натуральной кожи — OZELIF' }, [])
  return <><Header active="catalog"/><main className="sale-page"><section className="sale-page-hero"><div className="sale-page-hero-inner"><nav className="clothing-catalog-breadcrumbs" aria-label="Хлебные крошки"><a href="/">Главная</a><span>/</span><span>Новое в каталоге</span></nav><p className="kicker">Каталог</p><h1>Новое<br/><em>в каталоге</em></h1><p>Последние добавленные или обновлённые позиции OZELIF.</p><b>{isLoading ? 'Загружаем товары…' : <>{products?.length ?? 0} позиций</>}</b></div></section><section className="sale-page-content"><a className="product-page-back" href="/"><ArrowLeft size={17}/> На главную</a>{isLoading ? <div className="clothing-catalog-empty"><h2>Загружаем каталог</h2></div> : error ? <div className="clothing-catalog-empty" role="alert"><h2>Не удалось загрузить каталог</h2><button className="btn btn--dark" onClick={retry}>Повторить</button></div> : products?.length ? <SaleGrid products={products} priority/> : <div className="clothing-catalog-empty"><h2>Новых позиций пока нет</h2><p>Вернитесь позже — раздел обновляется вместе с каталогом.</p></div>}</section></main><Footer/></>
}

export function SalePage() {
  const { data: products, isLoading, error, retry } = usePublicCatalogSale()
  useEffect(() => { document.title = 'Товары со скидкой — OZELIF' }, [])
  return <><Header active="catalog"/><main className="sale-page"><section className="sale-page-hero"><div className="sale-page-hero-inner"><nav className="clothing-catalog-breadcrumbs" aria-label="Хлебные крошки"><a href="/">Главная</a><span>/</span><span>Товары со скидкой</span></nav><p className="kicker">Каталог</p><h1>Товары<br/><em>со скидкой</em></h1><p>Материалы из актуальной распродажи OZELIF.</p><b>{isLoading ? 'Загружаем товары…' : `${products?.length ?? 0} товаров`}</b></div></section><section className="sale-page-content"><a className="product-page-back" href="/"><ArrowLeft size={17}/> На главную</a>{isLoading ? <div className="clothing-catalog-empty"><h2>Загружаем предложения</h2></div> : error ? <div className="clothing-catalog-empty" role="alert"><h2>Не удалось загрузить предложения</h2><button className="btn btn--dark" onClick={retry}>Повторить</button></div> : products?.length ? <SaleGrid products={products} priority/> : <div className="clothing-catalog-empty"><h2>Сейчас нет товаров со скидкой</h2><p>Вернитесь позже — раздел обновляется вместе с каталогом.</p></div>}</section></main><Footer/></>
}
