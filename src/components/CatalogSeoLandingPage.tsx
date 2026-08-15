import {
  useEffect,
  useMemo,
} from 'react'

import {
  ArrowUpRight,
} from 'lucide-react'

import type {
  PublicCatalogProduct,
} from '../api/publicCatalog'

import {
  getCatalogSeoLanding,
  matchesCatalogSeoLandingProduct,
} from '../data/catalogSeoLandings'

import {
  usePublicCatalog,
} from '../hooks/usePublicCatalog'

import {
  responsiveProductImage,
} from '../utils/responsiveProductImage'

import {
  CatalogCardPrice,
} from './CatalogCardPrice'

import {
  Footer,
} from './Footer'

import {
  Header,
} from './Header'


const COMMERCIAL_PURCHASE_TITLES: Record<string, string> = {
  '/odejnayakozha/krs': 'Купить натуральную кожу КРС',
  '/odejnayakozha/perforirovannaya': 'Купить перфорированную натуральную кожу',
  '/dublyonka/kerli': 'Купить дублёночный материал Кёрли',
  '/dublyonka/toskana': 'Купить дублёночный материал Тоскана',
}

function commercialPurchaseTitle(
  path: string,
  fallbackTitle: string,
) {
  return (
    COMMERCIAL_PURCHASE_TITLES[path]
    ?? `Купить ${fallbackTitle}`
  )
}


function setMeta(
  selector: string,
  attribute: 'name' | 'property',
  key: string,
  content: string,
) {
  const node =
    document.querySelector<HTMLMetaElement>(
      selector,
    )
    ?? document.head.appendChild(
      document.createElement('meta'),
    )

  node.setAttribute(
    attribute,
    key,
  )

  node.content =
    content
}


function setCanonical(
  href: string,
) {
  const node =
    document.querySelector<HTMLLinkElement>(
      'link[rel="canonical"]',
    )
    ?? document.head.appendChild(
      document.createElement('link'),
    )

  node.rel =
    'canonical'

  node.href =
    href
}


function normalizeUnit(
  value: string | null | undefined,
) {
  const normalized =
    value
      ?.trim()
      .toUpperCase()

  if (!normalized) {
    return null
  }

  if (
    [
      'FOT',
      'FT2',
      'FT²',
      'ФУТ2',
      'ФУТ²',
    ].includes(normalized)
  ) {
    return 'фут²'
  }

  if (
    [
      'DM2',
      'DM²',
      'ДМ2',
      'ДМ²',
    ].includes(normalized)
  ) {
    return 'дм²'
  }

  if (
    [
      'M2',
      'M²',
      'М2',
      'М²',
    ].includes(normalized)
  ) {
    return 'м²'
  }

  return value?.trim()
    ?? null
}


function productUrl(
  categorySlug: string,
  product: PublicCatalogProduct,
) {
  return (
    `/${categorySlug}/tproduct/`
    + `${product.id}-${product.slug}`
  )
}


function productDescription(
  product: PublicCatalogProduct,
) {
  return [
    product.material,
    product.color,

    product.thickness
      ? `толщина ${product.thickness}`
      : null,

    product.coating,
    product.hideSize,
    product.origin,
  ]
    .filter(Boolean)
    .join(' · ')
}


function ProductCard({
  product,
  categorySlug,
  badge,
  index,
}: {
  product: PublicCatalogProduct
  categorySlug: string
  badge: string
  index: number
}) {
  const responsive =
    product.image
      ? responsiveProductImage(
          product.image.url,
          'card',
        )
      : null

  const href =
    productUrl(
      categorySlug,
      product,
    )

  return (
    <article
      className="product-card reveal is-visible"
    >
      <a
        href={href}
        aria-label={
          `Подробнее: ${product.title}`
        }
      >
        <div className="product-card-image">

          {product.image && responsive ? (
            <img
              src={responsive.src}
              srcSet={responsive.srcSet}
              sizes={responsive.sizes}

              alt={
                product.image.alt
                ?? `${product.title} — ${badge}`
              }

              width={900}
              height={1100}

              loading={
                index < 4
                  ? 'eager'
                  : 'lazy'
              }

              fetchPriority={
                index < 4
                  ? 'high'
                  : undefined
              }

              decoding="async"
            />
          ) : (
            <div className="sale-card-fallback">
              OZELIF
            </div>
          )}

          <span>
            {badge}
          </span>

        </div>


        <div className="product-card-body">

          <h2>
            {product.title}
          </h2>

          <p>
            {productDescription(product)
              || product.description
              || badge}
          </p>


          <div className="product-card-bottom">

            <CatalogCardPrice
              product={product}
              normalizeUnit={normalizeUnit}
              categorySlug={categorySlug}
              skipManagedLookup
            />

            <small>
              {product.variants.length}{' '}

              {product.variants.length === 1
                ? 'вариант'
                : 'вариантов'}
            </small>

          </div>


          <span className="product-card-link">
            Подробнее{' '}
            <ArrowUpRight size={16}/>
          </span>

        </div>
      </a>
    </article>
  )
}


export function CatalogSeoLandingPage({
  pathname,
}: {
  pathname: string
}) {
  const config =
    getCatalogSeoLanding(
      pathname,
    )

  if (!config) {
    return null
  }

  return (
    <CatalogSeoLandingContent
      config={config}
    />
  )
}


function CatalogSeoLandingContent({
  config,
}: {
  config: NonNullable<
    ReturnType<
      typeof getCatalogSeoLanding
    >
  >
}) {
  const {
    data: catalog,
    isLoading,
    error,
    retry,
  } = usePublicCatalog(
    config.categorySlug,
  )


  const products =
    useMemo(
      () =>
        (catalog?.items ?? [])
          .filter(
            product =>
              matchesCatalogSeoLandingProduct(
                product,
                config,
              ),
          ),
      [
        catalog,
        config,
      ],
    )


  const canonical =
    `https://ozelifkoja.ru${config.path}`


  useEffect(
    () => {
      document.title =
        config.metaTitle

      setMeta(
        'meta[name="description"]',
        'name',
        'description',
        config.metaDescription,
      )

      setMeta(
        'meta[property="og:title"]',
        'property',
        'og:title',
        config.ogTitle,
      )

      setMeta(
        'meta[property="og:description"]',
        'property',
        'og:description',
        config.metaDescription,
      )

      setMeta(
        'meta[property="og:url"]',
        'property',
        'og:url',
        canonical,
      )

      setMeta(
        'meta[property="og:image"]',
        'property',
        'og:image',
        `https://ozelifkoja.ru${config.heroBase}.webp`,
      )

      setCanonical(
        canonical,
      )
    },
    [
      canonical,
      config,
    ],
  )


  const schema =
    useMemo(
      () => ({
        '@context':
          'https://schema.org',

        '@graph': [
          {
            '@type':
              'CollectionPage',

            '@id':
              `${canonical}#collection`,

            name:
              config.title,

            url:
              canonical,

            description:
              config.metaDescription,

            isPartOf: {
              '@type':
                'CollectionPage',

              name:
                config.categoryName,

              url:
                `https://ozelifkoja.ru${config.parentPath}`,
            },
          },

          {
            '@type':
              'BreadcrumbList',

            itemListElement: [
              {
                '@type':
                  'ListItem',

                position:
                  1,

                name:
                  'Главная',

                item:
                  'https://ozelifkoja.ru/',
              },

              {
                '@type':
                  'ListItem',

                position:
                  2,

                name:
                  config.categoryName,

                item:
                  `https://ozelifkoja.ru${config.parentPath}`,
              },

              {
                '@type':
                  'ListItem',

                position:
                  3,

                name:
                  config.title,

                item:
                  canonical,
              },
            ],
          },

          {
            '@type':
              'ItemList',

            name:
              config.title,

            numberOfItems:
              products.length,

            itemListElement:
              products.map(
                (
                  product,
                  index,
                ) => ({
                  '@type':
                    'ListItem',

                  position:
                    index + 1,

                  name:
                    product.title,

                  url:
                    `https://ozelifkoja.ru${productUrl(
                      config.categorySlug,
                      product,
                    )}`,
                }),
              ),
          },
        ],
      }),
      [
        canonical,
        config,
        products,
      ],
    )


  return (
    <>
      <script
        type="application/ld+json"

        dangerouslySetInnerHTML={{
          __html:
            JSON.stringify(schema),
        }}
      />


      <Header active="catalog"/>


      <main className="clothing-catalog-page">

        <section className="clothing-catalog-hero">

          <picture>

            <source
              srcSet={
                `${config.heroBase}.avif`
              }
              type="image/avif"
            />

            <source
              srcSet={
                `${config.heroBase}.webp`
              }
              type="image/webp"
            />

            <img
              src={
                `${config.heroBase}.webp`
              }

              alt={
                config.heroAlt
              }

              width={1672}
              height={941}

              loading="eager"
              fetchPriority="high"
              decoding="async"
            />

          </picture>


          <div className="clothing-catalog-hero-scrim"/>


          <div className="clothing-catalog-shell clothing-catalog-hero-content">

            <nav
              className="clothing-catalog-breadcrumbs"
              aria-label="Хлебные крошки"
            >

              <a href="/">
                Главная
              </a>

              <span>/</span>

              <a href={config.parentPath}>
                {config.categoryName}
              </a>

              <span>/</span>

              <span>
                {config.badge}
              </span>

            </nav>


            <p className="kicker">
              {config.kicker}
            </p>


            <h1>
              {config.title}
            </h1>


            <p>
              {config.intro}
            </p>


            <b>
              {isLoading
                ? 'Загружаем товары…'
                : `${products.length} товаров`}
            </b>

          </div>
        </section>


        <section className="clothing-catalog-shell shearling-subtype-catalog">

          <div className="clothing-catalog-results-head">

            <p>
              Найдено{' '}
              <b>
                {products.length}
              </b>
            </p>


            <a
              className="text-link"
              href={config.parentPath}
            >
              Весь раздел{' '}
              <ArrowUpRight size={16}/>
            </a>

          </div>


          {isLoading ? (

            <div className="clothing-catalog-empty">

              <h2>
                {config.loadingTitle}
              </h2>

              <p>
                Получаем актуальные товары,
                характеристики и цены.
              </p>

            </div>

          ) : error ? (

            <div
              className="clothing-catalog-empty"
              role="alert"
            >

              <h2>
                Не удалось загрузить товары
              </h2>

              <p>
                Попробуйте повторить загрузку.
              </p>

              <button
                className="btn btn--dark"
                onClick={retry}
              >
                Повторить
              </button>

            </div>

          ) : products.length ? (

            <div className="clothing-catalog-grid">

              {products.map(
                (
                  product,
                  index,
                ) => (
                  <ProductCard
                    key={product.id}
                    product={product}
                    categorySlug={
                      config.categorySlug
                    }
                    badge={
                      config.badge
                    }
                    index={index}
                  />
                ),
              )}

            </div>

          ) : (

            <div className="clothing-catalog-empty">

              <h2>
                {config.emptyTitle}
              </h2>

              <p>
                Посмотрите весь раздел
                или уточните наличие
                у менеджера.
              </p>

              <a
                className="btn btn--dark"
                href={config.parentPath}
              >
                Открыть каталог
              </a>

            </div>

          )}

        </section>



        <section className="clothing-catalog-shell clothing-catalog-commercial">
          <header className="clothing-catalog-commercial-head"><div><p className="kicker">Покупка в OZELIF</p><h2>{commercialPurchaseTitle(config.path, config.title)}<br/><em>в Москве</em></h2></div><p>Здесь собраны только товары, соответствующие этой подборке в актуальном каталоге. Цены и характеристики берутся из опубликованных карточек.</p></header>
          <div className="clothing-catalog-commercial-grid">
            <article><span>01</span><h3>Весь раздел</h3><p>Сравните остальные позиции родительской категории.</p><a href={config.parentPath}>Открыть весь каталог <ArrowUpRight size={15}/></a></article>
            <article><span>02</span><h3>Оптовая закупка</h3><p>Для производства и регулярных закупок доступны отдельные условия.</p><a href="/kozhaoptom">Условия для оптовиков <ArrowUpRight size={15}/></a></article>
            <article><span>03</span><h3>Шоурум и доставка</h3><p>Материал можно посмотреть в Москве и согласовать получение заказа.</p><a href="/contacts">Контакты и шоурум <ArrowUpRight size={15}/></a><br/><a href="/delivery">Доставка и оплата <ArrowUpRight size={15}/></a></article>
          </div>
        </section>
        <section className="clothing-catalog-cta">

          <div>

            <p className="kicker">
              Подбор материала
            </p>

            <h2>
              {config.ctaTitle}
            </h2>

            <p>
              {config.ctaText}
            </p>

            <div>

              <a
                className="btn btn--light"
                href="/contacts"
              >
                Связаться с менеджером
              </a>

              <a
                className="text-link text-link--light"
                href="/kozhaoptom"
              >
                Оптовые условия{' '}
                <ArrowUpRight size={16}/>
              </a>

            </div>

          </div>

        </section>

      </main>


      <Footer/>
    </>
  )
}
