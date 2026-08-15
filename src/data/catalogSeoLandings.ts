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
  matcherAttributes?: Array<'coating' | 'brand'>

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


  {
    path:
      '/odejnayakozha/gladkaya',

    categorySlug:
      'odejnayakozha',

    categoryName:
      'Одежная кожа',

    parentPath:
      '/odejnayakozha',

    metaTitle:
      'Гладкая натуральная кожа купить в Москве — одежная кожа | OZELIF',

    metaDescription:
      'Гладкая натуральная одежная кожа в каталоге OZELIF: актуальные цвета, толщина, сырьё, покрытия и цены. Розница и опт, шоурум в Москве, доставка по России.',

    ogTitle:
      'Гладкая натуральная кожа — OZELIF',

    kicker:
      'Одежная кожа · Гладкая',

    title:
      'Гладкая натуральная кожа',

    intro:
      'Подборка гладкой натуральной кожи из актуального каталога OZELIF. Сравните цвет, сырьё, толщину, покрытие и цену конкретных позиций.',

    badge:
      'Гладкая кожа',

    heroBase:
      '/images/catalog/clothing-leather/catalog-hero',

    heroAlt:
      'Гладкая натуральная одежная кожа',

    matcherTokens: [
      'гладк',
      'gladk',
    ],

    emptyTitle:
      'Сейчас нет опубликованной гладкой кожи',

    loadingTitle:
      'Загружаем гладкую кожу',

    ctaTitle:
      'Нужна гладкая кожа под конкретное изделие?',

    ctaText:
      'Менеджер поможет сравнить сырьё, цвет, толщину, покрытие и актуальную партию. Для объёмной закупки доступны оптовые условия.',
  },

  {
    path:
      '/odejnayakozha/fakturnaya',

    categorySlug:
      'odejnayakozha',

    categoryName:
      'Одежная кожа',

    parentPath:
      '/odejnayakozha',

    metaTitle:
      'Фактурная натуральная кожа купить в Москве — одежная кожа | OZELIF',

    metaDescription:
      'Фактурная натуральная одежная кожа в каталоге OZELIF: актуальные фактуры, цвета, толщина, сырьё и цены. Розница и опт, шоурум в Москве, доставка по России.',

    ogTitle:
      'Фактурная натуральная кожа — OZELIF',

    kicker:
      'Одежная кожа · Фактурная',

    title:
      'Фактурная натуральная кожа',

    intro:
      'Подборка фактурной натуральной кожи из актуального каталога OZELIF. Сравните рельеф поверхности, цвет, толщину, сырьё и цену конкретных позиций.',

    badge:
      'Фактурная кожа',

    heroBase:
      '/images/catalog/clothing-leather/catalog-hero',

    heroAlt:
      'Фактурная натуральная одежная кожа',

    matcherTokens: [
      'фактур',
      'fakturn',
    ],

    emptyTitle:
      'Сейчас нет опубликованной фактурной кожи',

    loadingTitle:
      'Загружаем фактурную кожу',

    ctaTitle:
      'Нужна фактурная кожа под конкретное изделие?',

    ctaText:
      'Менеджер поможет сравнить фактуру, цвет, толщину, сырьё и актуальную партию. Для объёмной закупки доступны оптовые условия.',
  },

  {
    path:
      '/odejnayakozha/vintazhnaya',

    categorySlug:
      'odejnayakozha',

    categoryName:
      'Одежная кожа',

    parentPath:
      '/odejnayakozha',

    metaTitle:
      'Винтажная кожа купить в Москве — натуральная одежная кожа | OZELIF',

    metaDescription:
      'Винтажная натуральная кожа в каталоге OZELIF: актуальные цвета, толщина, покрытия и цены. Розница и опт, шоурум в Москве, доставка по России.',

    ogTitle:
      'Винтажная натуральная кожа — OZELIF',

    kicker:
      'Одежная кожа · Винтаж',

    title:
      'Винтажная натуральная кожа',

    intro:
      'Подборка винтажной натуральной кожи из актуального каталога OZELIF. Сравните фактуру, цвет, толщину, покрытие и цену конкретных позиций.',

    badge:
      'Винтаж',

    heroBase:
      '/images/catalog/clothing-leather/catalog-hero',

    heroAlt:
      'Винтажная натуральная одежная кожа',

    matcherTokens: [
      'винтаж',
      'vintage',
    ],

    emptyTitle:
      'Сейчас нет опубликованной винтажной кожи',

    loadingTitle:
      'Загружаем винтажную кожу',

    ctaTitle:
      'Нужна винтажная кожа под конкретное изделие?',

    ctaText:
      'Менеджер поможет сравнить фактуру, цвет, толщину и актуальную партию. Для объёмной закупки доступны оптовые условия.',
  },

  {
    path:
      '/odejnayakozha/nappa',

    categorySlug:
      'odejnayakozha',

    categoryName:
      'Одежная кожа',

    parentPath:
      '/odejnayakozha',

    metaTitle:
      'Кожа Наппа купить в Москве — натуральная одежная кожа | OZELIF',

    metaDescription:
      'Натуральная кожа Наппа в каталоге OZELIF: актуальные цвета, толщина, характеристики и цены. Розница и опт, шоурум в Москве, доставка по России.',

    ogTitle:
      'Натуральная кожа Наппа — OZELIF',

    kicker:
      'Одежная кожа · Наппа',

    title:
      'Натуральная кожа Наппа',

    intro:
      'Актуальная подборка натуральной кожи Наппа. Сравните опубликованные цвета, толщину, фактуру, покрытие и цены.',

    badge:
      'Наппа',

    heroBase:
      '/images/catalog/clothing-leather/catalog-hero',

    heroAlt:
      'Натуральная кожа Наппа',

    matcherTokens: [
      'наппа',
      'nappa',
    ],

    matcherAttributes: [
      'coating',
    ],

    emptyTitle:
      'Сейчас нет опубликованной кожи Наппа',

    loadingTitle:
      'Загружаем кожу Наппа',

    ctaTitle:
      'Нужна кожа Наппа под конкретное изделие?',

    ctaText:
      'Менеджер поможет проверить характеристики и подобрать подходящую партию. Для объёмной закупки доступны оптовые условия.',
  },

  {
    path:
      '/dublyonka/merinos',

    categorySlug:
      'dublyonka',

    categoryName:
      'Дублёночный материал',

    parentPath:
      '/dublyonka',

    metaTitle:
      'Дублёночный материал Меринос купить в Москве | OZELIF',

    metaDescription:
      'Дублёночный материал Меринос из натуральной овчины в каталоге OZELIF. Актуальные цвета, покрытия, размеры шкур и цены. Розница, опт и доставка.',

    ogTitle:
      'Дублёночный материал Меринос — OZELIF',

    kicker:
      'Дублёнка · Меринос',

    title:
      'Дублёночный материал Меринос',

    intro:
      'Подборка натурального дублёночного материала Меринос из текущего каталога OZELIF. Сравните цвета, покрытия, размеры шкур и цены.',

    badge:
      'Меринос',

    heroBase:
      '/images/catalog/shearling/catalog-hero',

    heroAlt:
      'Дублёночный материал Меринос',

    matcherTokens: [
      'меринос',
      'merinos',
      'merino',
    ],

    emptyTitle:
      'Сейчас нет опубликованных товаров Меринос',

    loadingTitle:
      'Загружаем материал Меринос',

    ctaTitle:
      'Нужен Меринос под конкретное изделие?',

    ctaText:
      'Менеджер поможет сверить цвет, отделку, размер шкур и актуальную партию. Для объёмной закупки доступны оптовые условия.',
  },

  {
    path:
      '/dublyonka/tigrado',

    categorySlug:
      'dublyonka',

    categoryName:
      'Дублёночный материал',

    parentPath:
      '/dublyonka',

    metaTitle:
      'Дублёночный материал Тиградо купить в Москве | OZELIF',

    metaDescription:
      'Дублёночный материал Тиградо в каталоге OZELIF: актуальные цвета, покрытия, размеры шкур и цены. Шоурум в Москве, розница, опт и доставка.',

    ogTitle:
      'Дублёночный материал Тиградо — OZELIF',

    kicker:
      'Дублёнка · Тиградо',

    title:
      'Дублёночный материал Тиградо',

    intro:
      'Актуальная подборка дублёночного материала Тиградо. Сравните цвета, покрытия, размеры шкур, характеристики и цены.',

    badge:
      'Тиградо',

    heroBase:
      '/images/catalog/shearling/catalog-hero',

    heroAlt:
      'Дублёночный материал Тиградо',

    matcherTokens: [
      'тиградо',
      'tigrado',
    ],

    emptyTitle:
      'Сейчас нет опубликованных товаров Тиградо',

    loadingTitle:
      'Загружаем материал Тиградо',

    ctaTitle:
      'Нужен Тиградо под конкретное изделие?',

    ctaText:
      'Менеджер поможет сверить цвет, отделку, размер шкур и актуальную партию. Для объёмной закупки доступны оптовые условия.',
  },

  {
    path:
      '/furnitura/ykk',

    categorySlug:
      'furnitura',

    categoryName:
      'Фурнитура',

    parentPath:
      '/furnitura',

    metaTitle:
      'Молнии YKK купить в Москве — фурнитура | OZELIF',

    metaDescription:
      'Молнии YKK в каталоге OZELIF: актуальные длины, цвета металла и тесьмы, характеристики и цены. Розница и опт, шоурум в Москве, доставка по России.',

    ogTitle:
      'Молнии YKK — OZELIF',

    kicker:
      'Фурнитура · YKK',

    title:
      'Молнии YKK',

    intro:
      'Подборка молний YKK из актуального каталога OZELIF. Сравните длину, цвет металла, цвет тесьмы, варианты и цены.',

    badge:
      'YKK',

    heroBase:
      '/images/categories/hardware',

    heroAlt:
      'Молнии YKK и фурнитура',

    matcherTokens: [
      'ykk',
    ],

    matcherAttributes: [
      'brand',
    ],

    emptyTitle:
      'Сейчас нет опубликованных молний YKK',

    loadingTitle:
      'Загружаем молнии YKK',

    ctaTitle:
      'Нужны молнии YKK под конкретное изделие?',

    ctaText:
      'Менеджер поможет сверить длину, цвет металла, цвет тесьмы и доступные варианты. Для объёмной закупки доступны оптовые условия.',
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

  const matcherAttributes =
    (config.matcherAttributes ?? [])
      .flatMap(key => {
        const value = product[key]
        return (
          typeof value === 'string'
          && value.trim()
        )
          ? [normalize(value)]
          : []
      })

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
        || matcherAttributes.some(
          value =>
            value === token
            || value.includes(token),
        )
        || titleAndSlug.includes(token)
      )
    },
  )
}
