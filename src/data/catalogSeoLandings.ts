import type { PublicCatalogProduct } from '../api/publicCatalog'

export type CatalogSeoLandingConfig = {
  path: string
  categorySlug: string
  categoryName: string
  parentPath: string

  metaTitle: string
  metaDescription: string
  ogTitle: string

  kicker: string
  title: string
  intro: string
  badge: string

  heroBase: string
  heroAlt: string

  matcherTokens: string[]

  emptyTitle: string
  loadingTitle: string

  ctaTitle: string
  ctaText: string
}

export const catalogSeoLandings: CatalogSeoLandingConfig[] = [
  {
    path: '/dublyonka/kerli',

    categorySlug: 'dublyonka',
    categoryName: 'Дублёночный материал',
    parentPath: '/dublyonka',

    metaTitle:
      'Дублёночный материал Кёрли купить в Москве — OZELIF',

    metaDescription:
      'Дублёночный материал Кёрли из натуральной овчины в каталоге OZELIF. Актуальные цвета, покрытия, размеры шкур и цены. Склад и шоурум в Москве, опт и доставка по России.',

    ogTitle:
      'Дублёночный материал Кёрли — OZELIF',

    kicker:
      'Каталог · Кёрли',

    title:
      'Дублёночный материал Кёрли',

    intro:
      'Натуральная овчина Кёрли для дублёнок, верхней одежды и дизайнерских изделий. Сравните актуальные цвета, покрытия, размеры шкур и цены.',

    badge:
      'Кёрли',

    heroBase:
      '/images/catalog/shearling/catalog-hero',

    heroAlt:
      'Натуральный дублёночный материал Кёрли',

    matcherTokens: [
      'керли',
      'кёрли',
      'kyorli',
    ],

    emptyTitle:
      'Сейчас нет опубликованных товаров Кёрли',

    loadingTitle:
      'Загружаем каталог Кёрли',

    ctaTitle:
      'Нужна партия Кёрли под конкретное изделие?',

    ctaText:
      'Менеджер поможет сверить цвет, покрытие, размер шкур и актуальное наличие. Для объёмной закупки доступны оптовые условия.',
  },

  {
    path:
      '/odejnayakozha/perforirovannaya',

    categorySlug:
      'odejnayakozha',

    categoryName:
      'Одежная кожа',

    parentPath:
      '/odejnayakozha',

    metaTitle:
      'Перфорированная натуральная кожа купить в Москве — OZELIF',

    metaDescription:
      'Перфорированная натуральная кожа для одежды и дизайнерских изделий в каталоге OZELIF. Актуальные цвета, толщина, размеры шкур и цены. Склад и шоурум в Москве.',

    ogTitle:
      'Перфорированная натуральная кожа — OZELIF',

    kicker:
      'Одежная кожа · Перфорация',

    title:
      'Перфорированная натуральная кожа',

    intro:
      'Натуральная кожа с перфорацией для одежды, отделки и дизайнерских изделий. Сравните актуальные цвета, толщину, размеры шкур и цены.',

    badge:
      'Перфорация',

    heroBase:
      '/images/catalog/clothing-leather/catalog-hero',

    heroAlt:
      'Перфорированная натуральная кожа',

    matcherTokens: [
      'perforat',
      'перфор',
    ],

    emptyTitle:
      'Сейчас нет опубликованной перфорированной кожи',

    loadingTitle:
      'Загружаем перфорированную кожу',

    ctaTitle:
      'Нужна перфорированная кожа под конкретное изделие?',

    ctaText:
      'Менеджер поможет подобрать толщину, цвет и подходящую партию. Для объёмной закупки доступны оптовые условия.',
  },

  {
    path:
      '/odejnayakozha/krs',

    categorySlug:
      'odejnayakozha',

    categoryName:
      'Одежная кожа',

    parentPath:
      '/odejnayakozha',

    metaTitle:
      'Кожа КРС купить в Москве — натуральная кожа | OZELIF',

    metaDescription:
      'Кожа КРС в каталоге OZELIF в Москве. Актуальные варианты натуральной кожи, цвета, толщина, размеры шкур и цены. Розница, оптовые условия и доставка по России.',

    ogTitle:
      'Натуральная кожа КРС — OZELIF',

    kicker:
      'Одежная кожа · КРС',

    title:
      'Натуральная кожа КРС',

    intro:
      'Актуальная подборка кожи КРС из каталога OZELIF. Сравните варианты, цвета, толщину, размеры шкур и цены.',

    badge:
      'КРС',

    heroBase:
      '/images/catalog/clothing-leather/catalog-hero',

    heroAlt:
      'Натуральная кожа КРС',

    matcherTokens: [
      'крс',
      'krs',
    ],

    emptyTitle:
      'Сейчас нет опубликованной кожи КРС',

    loadingTitle:
      'Загружаем кожу КРС',

    ctaTitle:
      'Нужна кожа КРС под конкретное изделие?',

    ctaText:
      'Менеджер поможет проверить характеристики, наличие и подобрать подходящую партию. Для объёмной закупки доступны оптовые условия.',
  },

  {
    path:
      '/dublyonka/toskana',

    categorySlug:
      'dublyonka',

    categoryName:
      'Дублёночный материал',

    parentPath:
      '/dublyonka',

    metaTitle:
      'Дублёночный материал Тоскана купить в Москве — OZELIF',

    metaDescription:
      'Дублёночный материал Тоскана в каталоге OZELIF. Актуальные цвета, покрытия, размеры шкур и цены. Склад и шоурум в Москве, оптовые условия и доставка по России.',

    ogTitle:
      'Дублёночный материал Тоскана — OZELIF',

    kicker:
      'Каталог · Тоскана',

    title:
      'Дублёночный материал Тоскана',

    intro:
      'Подборка дублёночного материала Тоскана из актуального каталога OZELIF. Сравните цвета, покрытия, размеры шкур и цены.',

    badge:
      'Тоскана',

    heroBase:
      '/images/catalog/shearling/catalog-hero',

    heroAlt:
      'Дублёночный материал Тоскана',

    matcherTokens: [
      'тоскана',
      'toskana',
      'toscana',
    ],

    emptyTitle:
      'Сейчас нет опубликованных товаров Тоскана',

    loadingTitle:
      'Загружаем материал Тоскана',

    ctaTitle:
      'Нужна партия Тосканы под конкретное изделие?',

    ctaText:
      'Менеджер поможет сверить цвет, покрытие, размер шкур и актуальное наличие. Для объёмной закупки доступны оптовые условия.',
  },
]

function normalizePathname(
  pathname: string,
) {
  if (
    pathname.length > 1
    && pathname.endsWith('/')
  ) {
    return pathname.slice(0, -1)
  }

  return pathname
}

export function getCatalogSeoLanding(
  pathname: string,
) {
  const normalized =
    normalizePathname(pathname)

  return (
    catalogSeoLandings.find(
      item =>
        item.path === normalized,
    )
    ?? null
  )
}

export function hasCatalogSeoLanding(
  pathname: string,
) {
  return Boolean(
    getCatalogSeoLanding(
      pathname,
    ),
  )
}

export function matchesCatalogSeoLandingProduct(
  product: PublicCatalogProduct,
  config: CatalogSeoLandingConfig,
) {
  /*
   * Не используем description.
   *
   * У дублёночного материала описания общие и содержат
   * перечисление "меринос, тоскана, керли...", из-за чего
   * любой subtype начинал совпадать со всем каталогом.
   *
   * Источник истины для SEO-подгруппы:
   * 1. subtype;
   * 2. название;
   * 3. slug.
   */
  const normalize = (value: string) =>
    value
      .trim()
      .toLocaleLowerCase('ru-RU')
      .replaceAll('ё', 'е')

  const subtype =
    product.subtype.map(normalize)

  const titleAndSlug =
    normalize(
      [
        product.title,
        product.slug,
      ]
        .filter(Boolean)
        .join(' '),
    )

  return config.matcherTokens.some(
    rawToken => {
      const token =
        normalize(rawToken)

      return (
        subtype.some(
          value =>
            value === token
            || value.includes(token),
        )
        || titleAndSlug.includes(token)
      )
    },
  )
}
