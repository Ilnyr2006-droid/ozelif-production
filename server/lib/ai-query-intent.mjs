function normalizeIntentText(value) {
  return String(value ?? '')
    .toLocaleLowerCase('ru')
    .replace(/ё/g, 'е')
    .replace(/[^\p{L}\p{N}%+]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function includesAny(text, fragments) {
  return fragments.some(fragment => text.includes(fragment))
}

const STRONG_PRODUCT_PHRASES = [
  'подбери',
  'подберите',
  'подобрать',
  'предложи',
  'предложите',
  'покажи',
  'покажите',
  'что подойдет',
  'что подойдёт',
  'какую выбрать',
  'какой выбрать',
  'какие выбрать',
  'нужна кожа',
  'нужен материал',
  'ищу кожу',
  'ищу материал',
]

const PRODUCT_FRAGMENTS = [
  'кож',
  'замша',
  'дублен',
  'овчин',
  'козлин',
  'крс',
  'фурнитур',
  'молни',
  'кнопк',
  'пряжк',
  'люверс',
  'нитк',
  'товар',
  'каталог',
  'вариант',
  'цвет',
  'толщин',
  'фактур',
  'мягк',
  'жестк',
  'плотн',
  'ворс',
  'цена',
  'стоимост',
  'стоит',
  'характерист',
  'налич',
  'остат',
  'бюджет',
  'сумк',
  'кошелек',
  'куртк',
  'пальто',
  'плать',
  'юбк',
  'брюк',
  'обув',
  'ремень',
  'перчат',
  'бомбер',
  'тренч',
]

const INFORMATION_RULES = [
  {
    type: 'contacts',
    fragments: [
      'адрес',
      'контакт',
      'телефон',
      'связаться',
      'менеджер',
      'руководитель',
      'где находится',
      'как доехать',
      'режим работы',
      'самовывоз',
    ],
  },
  {
    type: 'delivery',
    fragments: [
      'доставк',
      'сдэк',
      'отправк',
      'получени',
      'курьер',
      'транспортн',
      'предоплат',
      'оплат',
    ],
  },
  {
    type: 'production',
    fragments: [
      'швейн',
      'производство одежд',
      'производство издел',
      'пошив',
      'сшить',
      'лекал',
      'тираж',
      'образец изделия',
      'партия изделий',
      'партия кожаных курток',
    ],
  },
  {
    type: 'wholesale',
    fragments: [
      'опт',
      'оптов',
      'пачк',
      '1000 дм',
      'кожа под заказ',
      'по своему образцу',
      'по образцу',
      'индивидуальн',
      'выделк',
      'тиснени',
    ],
  },
  {
    type: 'company',
    fragments: [
      'о компании',
      'кто вы',
      'реквизит',
      'инн',
      'огрнип',
      'жалоб',
      'предложени',
    ],
  },
]

export function classifyAssistantIntent(message) {
  const text = normalizeIntentText(message)
  const productSignal = includesAny(text, PRODUCT_FRAGMENTS)
  const strongProductRequest =
    includesAny(text, STRONG_PRODUCT_PHRASES)
    && productSignal

  // Явный запрос на подбор товара важнее слова «менеджер»
  // или других сопутствующих информационных слов.
  if (strongProductRequest) {
    return {
      type: 'product',
      needsProducts: true,
      isInformation: false,
      productSignal: true,
    }
  }

  for (const rule of INFORMATION_RULES) {
    if (includesAny(text, rule.fragments)) {
      return {
        type: rule.type,
        needsProducts: false,
        isInformation: true,
        productSignal,
      }
    }
  }

  if (productSignal) {
    return {
      type: 'product',
      needsProducts: true,
      isInformation: false,
      productSignal: true,
    }
  }

  return {
    type: 'general',
    needsProducts: false,
    isInformation: false,
    productSignal: false,
  }
}

export function emptyRetrievalResult() {
  return {
    products: [],
    semantic: {
      available: false,
      vectorStoreId: null,
      error: null,
      matches: [],
    },
    lexical: {
      query: '',
      terms: [],
      count: 0,
    },
  }
}

export function buildInformationFallback(intent) {
  switch (intent?.type) {
    case 'contacts':
      return (
        'Магазин и склад OZELIF находятся по адресу: '
        + 'Москва, Краснобогатырская улица, 24. '
        + 'Основной публичный телефон OZELIF: '
        + '+7 (903) 370-78-54.'
      )

    case 'delivery':
      return (
        'Доступны самовывоз в Москве, курьерская доставка по Москве '
        + 'и отправка в регионы, в том числе через СДЭК. '
        + 'Точная стоимость зависит от города и состава заказа.'
      )

    case 'production':
      return (
        'Швейное производство работает с партиями от 10 изделий одной модели. '
        + 'Для новой модели сначала изготавливается образец. '
        + 'Точные сроки и расчёт подтверждаются после изучения модели, '
        + 'лекал, материала и объёма.'
      )

    case 'wholesale':
      return (
        'Оптовые условия зависят от вида кожи и объёма. '
        + 'Для изготовления кожи по образцу на сайте указан объём от 1000 дм² '
        + 'и предоплата 30%. Индивидуальные условия подтверждает менеджер.'
      )

    case 'company':
      return (
        'OZELIF работает с натуральной кожей, замшей, '
        + 'дублёночным материалом и фурнитурой, '
        + 'а также с розничными, оптовыми и производственными заказами.'
      )

    default:
      return (
        'Сейчас не удалось получить расширенный ответ. '
        + 'Уточните, пожалуйста, ваш вопрос одним сообщением.'
      )
  }
}
