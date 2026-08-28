
const MONEY = new Intl.NumberFormat('ru-RU', {
  minimumFractionDigits: 0,
  maximumFractionDigits: 1,
})

export function cleanAssistantMessages(value, limit = 12) {
  if (!Array.isArray(value)) return []

  return value
    .filter(item => (
      item
      && typeof item === 'object'
      && ['user', 'assistant'].includes(String(item.role))
      && typeof item.content === 'string'
      && item.content.trim()
    ))
    .map(item => ({
      role: item.role === 'assistant' ? 'assistant' : 'user',
      content: item.content.trim().slice(0, 1800),
    }))
    .slice(-limit)
}

export function latestUserText(messages, fallback = '') {
  return [...messages]
    .reverse()
    .find(item => item.role === 'user')
    ?.content
    ?? String(fallback ?? '').trim()
}

export function formatVariantPrice(variant) {
  const price = Number(variant?.priceRub)

  if (!Number.isFinite(price) || price <= 0) {
    return 'цена уточняется'
  }

  const unit = String(variant?.unit ?? '').trim()
  const number = MONEY
    .format(price)
    .replace(/[\u00a0\u202f]/g, ' ')

  return `${number} ₽${unit ? ` за ${unit}` : ' за шт.'}`
}

function attributeLabel(value) {
  const key = String(value ?? '').trim()
  const normalized = key
    .toLocaleLowerCase('ru')
    .replace(/ё/g, 'е')
    .replace(/\s+/g, ' ')

  const labels = new Map([
    ['grade', 'Сорт'],
    ['гrade', 'Сорт'],
    ['сорт', 'Сорт'],
    ['color', 'Цвет'],
    ['colour', 'Цвет'],
    ['цвет', 'Цвет'],
    ['origin', 'Происхождение'],
    ['country', 'Происхождение'],
    ['происхождение', 'Происхождение'],
    ['thickness', 'Толщина'],
    ['толщина', 'Толщина'],
    ['unit', 'Единица измерения'],
    ['единица', 'Единица измерения'],
    ['article', 'Артикул'],
    ['артикул', 'Артикул'],
  ])

  return labels.get(normalized) ?? key
}

function finiteStock(value) {
  if (value === null || value === undefined || value === '') {
    return null
  }

  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function productStockLine(product) {
  const productStock = finiteStock(
    product?.stockQuantity,
  )

  if (productStock !== null) {
    return (
      `Подтверждённый остаток товара: `
      + `${MONEY.format(productStock)}.`
    )
  }

  const variantStocks = Array.isArray(product?.variants)
    ? product.variants
        .map(variant => ({
          name: String(variant?.name ?? '').trim(),
          stock: finiteStock(variant?.stockQuantity),
        }))
        .filter(item => item.stock !== null)
    : []

  if (variantStocks.length) {
    return (
      'Подтверждённые остатки вариантов: '
      + variantStocks
          .slice(0, 4)
          .map(item => (
            `${item.name || 'вариант'} — ${MONEY.format(item.stock)}`
          ))
          .join(' | ')
      + '.'
    )
  }

  return (
    'Остаток: не опубликован. '
    + 'Не утверждай, что товар есть или отсутствует в наличии.'
  )
}

export function sanitizeUnverifiedStockClaims(
  value,
  products,
) {
  let text = String(value ?? '').trim()
  if (!text) return ''

  const rows = Array.isArray(products)
    ? products
    : []

  const everyProductHasStock = (
    rows.length > 0
    && rows.every(product => {
      if (finiteStock(product?.stockQuantity) !== null) {
        return true
      }

      return (
        Array.isArray(product?.variants)
        && product.variants.some(
          variant => finiteStock(
            variant?.stockQuantity,
          ) !== null,
        )
      )
    })
  )

  if (everyProductHasStock) {
    return text
  }

  // Unicode-safe boundaries: JS \b is unreliable for Cyrillic.
  text = text
    .replace(
      /(?<![\p{L}\p{N}_])(?:товар|продукт)\s+доступен(?![\p{L}\p{N}_])/giu,
      'товар опубликован в каталоге',
    )
    .replace(
      /(?<![\p{L}\p{N}_])(?:товары|продукты)\s+доступны(?![\p{L}\p{N}_])/giu,
      'товары опубликованы в каталоге',
    )
    .replace(
      /(?<![\p{L}\p{N}_])точно\s+есть\s+в\s+наличии(?![\p{L}\p{N}_])/giu,
      'опубликован в каталоге; фактический остаток нужно уточнить',
    )

  return text
}

function attributeValue(key, value) {
  const normalizedKey = String(key ?? '')
    .trim()
    .toLocaleLowerCase('ru')

  const raw = String(value ?? '')
    .replace(/\s+/g, ' ')
    .trim()

  if (
    normalizedKey === 'unit'
    || normalizedKey === 'единица'
  ) {
    const units = {
      FOT: 'фут²',
      FT2: 'фут²',
      DM2: 'дм²',
      M2: 'м²',
    }

    return units[raw.toUpperCase()] ?? raw
  }

  return raw
}

function compactAttributes(attributes, limit = 5) {
  if (
    !attributes
    || typeof attributes !== 'object'
    || Array.isArray(attributes)
  ) {
    return []
  }

  const hiddenKeys = new Set([
    'portion',
    'coefficient',
    'коэффициент',
  ])

  return Object.entries(attributes)
    .filter(([key, value]) => {
      const normalized = String(key ?? '')
        .trim()
        .toLocaleLowerCase('ru')

      return (
        !key.startsWith('__')
        && !hiddenKeys.has(normalized)
        && value !== null
        && value !== undefined
        && String(value).trim()
      )
    })
    .slice(0, limit)
    .map(([key, value]) => (
      `${attributeLabel(key)}: ${attributeValue(key, value)}`
    ))
}

function compactOrderVariants(product) {
  const variants = Array.isArray(product?.variants)
    ? product.variants
    : []

  const rows = variants
    .filter(variant => variant?.id)
    .slice(0, 6)
    .map(variant => {
      const parts = [
        `VARIANT_ID=${variant.id}`,
      ]

      if (variant.name) {
        parts.push(`название=${variant.name}`)
      }

      if (variant.unit) {
        parts.push(`единица=${variant.unit}`)
      }

      if (Number(variant.priceRub) > 0) {
        parts.push(
          `цена=${formatVariantPrice(variant)}`,
        )
      }

      return parts.join('; ')
    })

  return rows.length
    ? (
        'Служебные варианты для заказа '
        + '(ID не показывать покупателю): '
        + rows.join(' | ')
      )
    : ''
}

export function compactProductContext(products) {
  if (!Array.isArray(products) || !products.length) {
    return 'Подходящих опубликованных товаров не найдено.'
  }

  return products
    .slice(0, 3)
    .map((product, index) => {
      const prices = Array.isArray(product.variants)
        ? product.variants
            .filter(variant => Number(variant?.priceRub) > 0)
            .slice(0, 3)
            .map(formatVariantPrice)
        : []

      const attributes = compactAttributes(product.attributes)

      return [
        `${index + 1}. PRODUCT_ID=${product.id}`,
        `Название: ${product.name}`,
        product.category ? `Каталог: ${product.category}` : '',
        product.description
          ? `Описание: ${String(product.description)
              .replace(/\s+/g, ' ')
              .trim()
              .slice(0, 220)}`
          : '',
        product.recommendationReason
          ? `Почему подходит: ${String(product.recommendationReason)
              .replace(/\s+/g, ' ')
              .trim()
              .slice(0, 180)}`
          : '',
        attributes.length
          ? `Характеристики: ${attributes.join('; ')}`
          : '',
        prices.length ? `Актуальные цены: ${prices.join(' | ')}` : '',
        compactOrderVariants(product),
        productStockLine(product),
      ]
        .filter(Boolean)
        .join('\n')
    })
    .join('\n\n')
}

export function productActions(products, limit = 3) {
  return (products ?? [])
    .filter(product => product?.productUrl && product?.name)
    .slice(0, limit)
    .map(product => ({
      label: `Открыть ${String(product.name).slice(0, 52)}`,
      href: product.productUrl,
      productId: product.id,
      reason: product.recommendationReason ?? null,
    }))
}

export function deterministicCatalogReply(
  products,
  clarificationQuestion = null,
) {
  if (!Array.isArray(products) || !products.length) {
    return (
      'Я не нашёл точного совпадения в опубликованном каталоге. '
      + 'Без конкретной подтверждённой карточки я не могу назвать '
      + 'производителя, страну, толщину, выделку или наличие. '
      + 'Если эти условия обязательны, менеджер сможет проверить '
      + 'подходящую партию.'
    )
  }

  const lines = products.slice(0, 3).map(product => {
    const prices = Array.isArray(product.variants)
      ? product.variants
          .filter(variant => Number(variant?.priceRub) > 0)
          .slice(0, 2)
          .map(formatVariantPrice)
      : []

    const reason = String(
      product?.recommendationReason ?? '',
    ).trim()

    return `• ${product.name} — ${
      prices.length ? prices.join(', ') : 'цена уточняется'
    }${reason ? `; почему подходит: ${reason}` : ''}`
  })

  return [
    'Нашёл подходящие позиции в актуальном каталоге:',
    ...lines,
    '',
    clarificationQuestion
      || (
        'Если хотите, уточните назначение, цвет или толщину — '
        + 'я сузжу подбор.'
      ),
  ].join('\n')
}

const ORDER_DRAFT_REQUEST = /(?:корзин|добав(?:ь|ить)|убер(?:и|ать)|оформ(?:и|ить)|заказ(?:ать|а)?)/iu
const CATALOG_FACT_QUESTION = /(?:производител|производств|стран|происхожд|толщин|выделк|бахтарм|налич|остат|ягнен|козлен|шевро)/iu
const PRODUCT_CONTEXT = /(?:кож|замш|дублен|овчин|козлин|товар|материал|перчат)/iu

export function requiresDeterministicCatalogReply({
  intent = null,
  message = '',
  messages = [],
} = {}) {
  const current = String(message ?? '').trim()
  if (!current || ORDER_DRAFT_REQUEST.test(current)) return false
  if (intent?.needsProducts) return true

  const history = Array.isArray(messages)
    ? messages
        .filter(item => item?.role === 'user')
        .map(item => String(item.content ?? ''))
        .join(' ')
    : ''

  return (
    CATALOG_FACT_QUESTION.test(current)
    && PRODUCT_CONTEXT.test(history)
  )
}

export function assistantProductContext(products, needsProducts) {
  if (!needsProducts) {
    return 'Для этого запроса товарный поиск не требуется.'
  }

  return compactProductContext(products)
}

export function enforceCriticalIntentFacts(value, intentType) {
  const text = String(value ?? '').trim()
  if (!text) return ''

  if (intentType !== 'production') {
    return text
  }

  const additions = []

  const hasMinimumBatch = (
    /(?:минимальн\p{L}*\s+(?:заказ|объ[её]м)|от)\D{0,45}10\s+издел/iu
  ).test(text)

  if (!hasMinimumBatch) {
    additions.push(
      'Минимальный заказ — 10 изделий одной модели.',
    )
  }

  const hasFirstSample = (
    /перв\p{L}*\s+образ/iu
  ).test(text)

  if (!hasFirstSample) {
    additions.push(
      'Для новой модели перед запуском серии обязательно изготавливается первый образец.',
    )
  }

  return [text, ...additions]
    .filter(Boolean)
    .join(' ')
}

export function extractResponseText(body) {
  if (typeof body?.output_text === 'string' && body.output_text.trim()) {
    return body.output_text.trim()
  }

  if (!Array.isArray(body?.output)) return ''

  const parts = []

  for (const item of body.output) {
    if (!Array.isArray(item?.content)) continue

    for (const content of item.content) {
      if (
        content?.type === 'output_text'
        && typeof content.text === 'string'
        && content.text.trim()
      ) {
        parts.push(content.text.trim())
      }
    }
  }

  return parts.join('\n').trim()
}
