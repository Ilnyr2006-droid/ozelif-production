import {
  createOrder,
} from './order-crm.mjs'

import {
  query,
  transaction,
} from './db.mjs'

const MONEY = new Intl.NumberFormat('ru-RU', {
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
})

const QTY = new Intl.NumberFormat('ru-RU', {
  minimumFractionDigits: 0,
  maximumFractionDigits: 3,
})

function clean(value, limit = 200) {
  const text = String(value ?? '').trim()
  return text ? text.slice(0, limit) : null
}

function canonicalUnit(value) {
  const text = String(value ?? '')
    .trim()
    .toLocaleLowerCase('ru')
    .replace(/ё/g, 'е')
    .replace(/\s+/g, '')

  if (!text) return null

  if (
    text === 'fot'
    || text === 'ft2'
    || text === 'ft²'
    || text === 'фут'
    || text === 'фут2'
    || text === 'фут²'
    || text === 'кв.фут'
    || text === 'квфут'
  ) {
    return 'FOT'
  }

  if (
    text === 'dm2'
    || text === 'dm²'
    || text === 'дм2'
    || text === 'дм²'
  ) {
    return 'DM2'
  }

  if (
    text === 'm2'
    || text === 'm²'
    || text === 'м2'
    || text === 'м²'
  ) {
    return 'M2'
  }

  if (
    text === 'шт'
    || text === 'шт.'
    || text === 'pcs'
    || text === 'piece'
  ) {
    return 'PCS'
  }

  return text.toUpperCase()
}

function displayUnit(value) {
  const unit = canonicalUnit(value)

  return {
    FOT: 'фут²',
    DM2: 'дм²',
    M2: 'м²',
    PCS: 'шт.',
  }[unit] ?? (String(value ?? '').trim() || 'ед.')
}

function number(value) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function money(value) {
  const parsed = number(value)
  return parsed === null
    ? 'цена уточняется'
    : `${MONEY.format(parsed).replace(/[\u00a0\u202f]/g, ' ')} ₽`
}

function quantity(value) {
  const parsed = number(value)
  return parsed === null
    ? 'не указано'
    : QTY.format(parsed).replace(/[\u00a0\u202f]/g, ' ')
}

async function ensureDraft(conversationId, client = null) {
  const executor = client ?? { query }

  await executor.query(
    `INSERT INTO live_chat_order_drafts (
       conversation_id
     )
     VALUES ($1)
     ON CONFLICT (conversation_id) DO NOTHING`,
    [conversationId],
  )
}

function mapDraft(row) {
  if (!row) return null

  return {
    conversationId: row.conversation_id,
    status: row.status,
    items: Array.isArray(row.items)
      ? row.items
      : [],
    deliveryMethod:
      row.delivery_method === 'pickup'
      || row.delivery_method === 'courier'
        ? row.delivery_method
        : null,
    deliveryCity:
      clean(row.delivery_city, 160),
    deliveryAddress:
      clean(row.delivery_address, 1000),
    revision: Number(row.revision ?? 0),
    confirmedRevision:
      row.confirmed_revision === null
        || row.confirmed_revision === undefined
        ? null
        : Number(row.confirmed_revision),
    confirmedAt: row.confirmed_at ?? null,
    orderId: row.order_id ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export async function loadChatOrderDraft(
  conversationId,
  client = null,
) {
  const executor = client ?? { query }

  await ensureDraft(conversationId, executor)

  const result = await executor.query(
    `SELECT *
     FROM live_chat_order_drafts
     WHERE conversation_id = $1
     LIMIT 1`,
    [conversationId],
  )

  return mapDraft(result.rows[0])
}

async function productRecord(client, operation) {
  const productId = clean(operation?.productId)
  const productName = clean(operation?.productName)

  const result = await client.query(
    `SELECT
       p.id,
       p.legacy_id,
       p.name,
       p.unit AS product_unit,
       c.name AS category_name,
       COALESCE(
         (
           SELECT json_agg(
             json_build_object(
               'id', v.id,
               'legacyId', v.legacy_id,
               'name', v.name,
               'price', v.price,
               'unit', v.unit,
               'sortOrder', v.sort_order
             )
             ORDER BY v.sort_order, v.created_at
           )
           FROM product_variants v
           WHERE v.product_id = p.id
             AND v.is_active = true
         ),
         '[]'::json
       ) AS variants
     FROM products p
     JOIN categories c ON c.id = p.category_id
     WHERE p.is_published = true
       AND (
         ($1::text <> '' AND p.id::text = $1)
         OR (
           $2::text <> ''
           AND lower(replace(p.name, 'ё', 'е'))
             = lower(replace($2, 'ё', 'е'))
         )
       )
     ORDER BY
       CASE WHEN p.id::text = $1 THEN 0 ELSE 1 END
     LIMIT 1`,
    [
      productId ?? '',
      productName ?? '',
    ],
  )

  return result.rows[0] ?? null
}

function variantOptions(product) {
  return (
    Array.isArray(product?.variants)
      ? product.variants
      : []
  )
    .filter(item => item?.id)
    .map(item => ({
      id: String(item.id),
      legacyId: item.legacyId
        ? String(item.legacyId)
        : null,
      name: String(item.name ?? '').trim(),
      price: number(item.price),
      unit: String(
        item.unit
          ?? product.product_unit
          ?? '',
      ).trim() || null,
    }))
}

function selectVariant(product, operation, previous) {
  const options = variantOptions(product)

  if (!options.length) {
    return {
      selected: null,
      options: [],
    }
  }

  const explicitVariantId = clean(operation?.variantId)

  if (explicitVariantId) {
    const exact = options.find(option => (
      option.id === explicitVariantId
      || option.legacyId === explicitVariantId
    ))

    if (exact) {
      return {
        selected: exact,
        options,
      }
    }
  }

  const requestedUnit = canonicalUnit(
    operation?.unit
      ?? previous?.unit
      ?? null,
  )

  if (requestedUnit) {
    const matching = options.filter(option => (
      canonicalUnit(option.unit) === requestedUnit
    ))

    if (matching.length === 1) {
      return {
        selected: matching[0],
        options,
      }
    }
  }

  if (previous?.variantId) {
    const previousVariant = options.find(
      option => option.id === previous.variantId,
    )

    if (previousVariant) {
      return {
        selected: previousVariant,
        options,
      }
    }
  }

  if (options.length === 1) {
    return {
      selected: options[0],
      options,
    }
  }

  return {
    selected: null,
    options,
  }
}

function stableItems(items) {
  // Preserve insertion order; never remap quantities because of sorting.
  return [...items]
}

function normalizeReferenceText(value) {
  return String(value ?? '')
    .toLocaleLowerCase('ru')
    .replace(/ё/g, 'е')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function normalizeEvidenceText(value) {
  return String(value ?? '')
    .toLocaleLowerCase('ru')
    .replace(/ё/g, 'е')
    .replace(/[^\p{L}\p{N}.,]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function evidenceExistsInMessage(
  message,
  evidence,
) {
  const source = normalizeEvidenceText(message)
  const fragment = normalizeEvidenceText(evidence)

  return (
    fragment.length >= 2
    && source.includes(fragment)
  )
}

function evidenceNumbers(value) {
  return [
    ...String(value ?? '').matchAll(
      /\d+(?:[.,]\d+)?/gu,
    ),
  ]
    .map(match => Number(
      match[0].replace(',', '.'),
    ))
    .filter(Number.isFinite)
}

function evidenceContainsQuantity(
  evidence,
  quantityValue,
) {
  const wanted = number(quantityValue)

  if (!(wanted > 0)) {
    return false
  }

  return evidenceNumbers(evidence).some(value => (
    Math.abs(value - wanted) < 0.0005
  ))
}

const GENERIC_QUANTITY_WORDS = new Set([
  'и',
  'или',
  'по',
  'для',
  'на',
  'в',
  'во',
  'из',
  'фут',
  'фута',
  'футов',
  'футы',
  'дм',
  'метр',
  'метра',
  'метров',
  'м',
  'шт',
  'штук',
  'ед',
  'единиц',
  'количество',
])

function evidenceHasSemanticReference(evidence) {
  const words = (
    normalizeEvidenceText(evidence)
      .match(/\p{L}+/gu)
    ?? []
  )

  return words.some(word => (
    word.length >= 3
    && !GENERIC_QUANTITY_WORDS.has(word)
  ))
}

function draftItemByProductId(items, productId) {
  const id = clean(productId)

  if (!id) return null

  return items.find(item => (
    String(item.productId ?? '') === id
  )) ?? null
}

function validDraftVariant(item, variantId) {
  const id = clean(variantId)

  if (!id) return true

  if (
    item?.variantId
    && String(item.variantId) === id
  ) {
    return true
  }

  return (
    Array.isArray(item?.variantOptions)
      ? item.variantOptions
      : []
  ).some(option => (
    String(option?.id ?? '') === id
    || String(option?.legacyId ?? '') === id
  ))
}

function hasPositiveQuantity(operation) {
  return number(operation?.quantity) > 0
}

function operationHasValidEvidence(
  operation,
  message,
  {
    requireSemanticReference,
  },
) {
  if (!hasPositiveQuantity(operation)) {
    return true
  }

  const evidence = clean(
    operation?.quantityEvidence,
    240,
  )

  if (
    !evidence
    || !evidenceExistsInMessage(
      message,
      evidence,
    )
    || !evidenceContainsQuantity(
      evidence,
      operation.quantity,
    )
  ) {
    return false
  }

  if (
    requireSemanticReference
    && !evidenceHasSemanticReference(evidence)
  ) {
    return false
  }

  return true
}

export function validateModelOrderDraftUpdate({
  draft,
  update,
  message,
  allowedCatalogProductIds = [],
}) {
  if (!update) {
    return {
      update: null,
      ambiguous: false,
      rejected: [],
    }
  }

  const items = Array.isArray(draft?.items)
    ? draft.items
    : []

  const operations = Array.isArray(update?.operations)
    ? update.operations
    : []

  const allowedCatalog = new Set(
    allowedCatalogProductIds
      .map(value => String(value ?? '').trim())
      .filter(Boolean),
  )

  const requestedQuantityOperations =
    operations.filter(hasPositiveQuantity)

  const requireSemanticReference = (
    requestedQuantityOperations.length > 1
  )

  let ambiguous = (
    update.quantityResolution === 'ambiguous'
  )

  const rejected = []
  const accepted = []
  const seenDraftQuantityTargets = new Set()

  for (const operation of operations) {
    const target = (
      operation?.target === 'draft'
      || operation?.target === 'catalog'
        ? operation.target
        : null
    )

    if (!target) {
      rejected.push({
        reason: 'missing_target',
        productId: operation?.productId ?? null,
      })

      if (hasPositiveQuantity(operation)) {
        ambiguous = true
      }

      continue
    }

    if (target === 'draft') {
      const item = draftItemByProductId(
        items,
        operation.productId,
      )

      if (!item) {
        rejected.push({
          reason: 'unknown_draft_product',
          productId: operation?.productId ?? null,
        })

        if (hasPositiveQuantity(operation)) {
          ambiguous = true
        }

        continue
      }

      if (
        !validDraftVariant(
          item,
          operation.variantId,
        )
      ) {
        rejected.push({
          reason: 'invalid_draft_variant',
          productId: item.productId,
          variantId: operation?.variantId ?? null,
        })

        if (hasPositiveQuantity(operation)) {
          ambiguous = true
        }

        continue
      }

      if (hasPositiveQuantity(operation)) {
        if (
          update.quantityResolution !== 'resolved'
          || !operationHasValidEvidence(
            operation,
            message,
            {
              requireSemanticReference,
            },
          )
          || seenDraftQuantityTargets.has(
            String(item.productId),
          )
        ) {
          rejected.push({
            reason: 'invalid_quantity_mapping',
            productId: item.productId,
          })
          ambiguous = true
          continue
        }

        seenDraftQuantityTargets.add(
          String(item.productId),
        )
      }

      accepted.push({
        ...operation,
        target: 'draft',
        productId: item.productId,
        productName: item.productName,
        variantId:
          operation.variantId
          ?? item.variantId
          ?? null,
        unit:
          operation.unit
          ?? item.unit
          ?? null,
      })

      continue
    }

    const productId = clean(operation.productId)

    if (
      !productId
      || !allowedCatalog.has(productId)
    ) {
      rejected.push({
        reason: 'catalog_product_not_allowed',
        productId: productId ?? null,
      })

      if (hasPositiveQuantity(operation)) {
        ambiguous = true
      }

      continue
    }

    if (
      hasPositiveQuantity(operation)
      && (
        update.quantityResolution !== 'resolved'
        || !operationHasValidEvidence(
          operation,
          message,
          {
            requireSemanticReference,
          },
        )
      )
    ) {
      rejected.push({
        reason: 'invalid_catalog_quantity_evidence',
        productId,
      })
      ambiguous = true
      continue
    }

    accepted.push({
      ...operation,
      target: 'catalog',
      productId,
    })
  }

  if (
    update.quantityResolution === 'ambiguous'
  ) {
    ambiguous = true
  }

  const safeOperations = ambiguous
    ? accepted.map(operation => (
        hasPositiveQuantity(operation)
          ? {
              ...operation,
              quantity: null,
              quantityEvidence: null,
            }
          : operation
      ))
    : accepted

  const safeUpdate = {
    ...update,
    confirm: ambiguous
      ? false
      : Boolean(update.confirm),
    operations: safeOperations,
  }

  return {
    update: safeUpdate,
    ambiguous,
    rejected,
  }
}

export function formatAmbiguousQuantityReply(draft) {
  const items = (
    Array.isArray(draft?.items)
      ? draft.items
      : []
  ).filter(
    item => !(number(item.quantity) > 0),
  )

  const sharedUnit = (
    items.length
    && items.every(item => item.unit === items[0]?.unit)
  )
    ? items[0]?.unit
    : null

  const unitSuffix = sharedUnit
    ? ` ${sharedUnit}`
    : ''

  return [
    'Я вижу несколько количеств, но не буду угадывать, какое относится к какому товару.',
    '',
    'Напишите количество рядом с названием:',
    ...items.map(item => (
      `• ${item.productName} — количество${unitSuffix}`
    )),
  ].join('\n')
}

function compactVariantSuffix(productName, variantName) {
  const variant = clean(variantName, 240)
  if (!variant) return ''

  const normalizedProduct =
    normalizeReferenceText(productName)

  const normalizedVariant =
    normalizeReferenceText(variant)

  if (
    normalizedProduct
    && normalizedVariant.startsWith(normalizedProduct)
  ) {
    return ''
  }

  return `, ${variant}`
}

export async function applyChatOrderDraftUpdate(
  conversationId,
  update,
) {
  return transaction(async client => {
    await ensureDraft(conversationId, client)

    const currentResult = await client.query(
      `SELECT *
       FROM live_chat_order_drafts
       WHERE conversation_id = $1
       FOR UPDATE`,
      [conversationId],
    )

    const current = mapDraft(currentResult.rows[0])

    if (
      current.status === 'created'
      && !update?.startNewOrder
    ) {
      return {
        draft: current,
        changed: false,
        needsNewOrderCommand: true,
      }
    }

    let items = (
      update?.startNewOrder
        ? []
        : [...(current.items ?? [])]
    )

    let changed = Boolean(update?.startNewOrder)

    let deliveryMethod = (
      update?.startNewOrder
        ? null
        : current.deliveryMethod
    )

    let deliveryCity = (
      update?.startNewOrder
        ? null
        : current.deliveryCity
    )

    let deliveryAddress = (
      update?.startNewOrder
        ? null
        : current.deliveryAddress
    )

    if (
      update?.deliveryMethod === 'pickup'
      || update?.deliveryMethod === 'courier'
    ) {
      if (deliveryMethod !== update.deliveryMethod) {
        deliveryMethod = update.deliveryMethod

        if (deliveryMethod === 'pickup') {
          deliveryCity = null
          deliveryAddress = null
        }

        changed = true
      }
    }

    if (
      update?.deliveryCity
      && deliveryCity !== update.deliveryCity
    ) {
      deliveryCity = clean(update.deliveryCity, 160)
      changed = true
    }

    if (
      update?.deliveryAddress
      && deliveryAddress !== update.deliveryAddress
    ) {
      deliveryAddress = clean(update.deliveryAddress, 1000)
      changed = true
    }

    if (update?.cancel) {
      const saved = await client.query(
        `UPDATE live_chat_order_drafts
         SET
           status = 'cancelled',
           confirmed_revision = NULL,
           confirmed_at = NULL,
           updated_at = now()
         WHERE conversation_id = $1
         RETURNING *`,
        [conversationId],
      )

      return {
        draft: mapDraft(saved.rows[0]),
        changed: true,
        cancelled: true,
      }
    }

    for (const operation of update?.operations ?? []) {
      const product = await productRecord(
        client,
        operation,
      )

      if (!product) {
        continue
      }

      const productId = String(product.id)
      const index = items.findIndex(
        item => item.productId === productId,
      )

      if (operation.operation === 'remove') {
        if (index >= 0) {
          items.splice(index, 1)
          changed = true
        }
        continue
      }

      const previous = index >= 0
        ? items[index]
        : null

      const variant = selectVariant(
        product,
        operation,
        previous,
      )

      const quantityValue = (
        operation.quantity
        ?? previous?.quantity
        ?? null
      )

      const selectedUnit = (
        variant.selected?.unit
        ?? operation.unit
        ?? previous?.unit
        ?? product.product_unit
        ?? null
      )

      const next = {
        productId,
        productLegacyId: product.legacy_id
          ? String(product.legacy_id)
          : productId,
        productName: String(product.name),
        categoryName: String(product.category_name),
        variantId: variant.selected?.id ?? null,
        variantLegacyId:
          variant.selected?.legacyId
          ?? variant.selected?.id
          ?? null,
        variantName:
          variant.selected?.name
          ?? null,
        quantity: quantityValue
          ? Math.round(Number(quantityValue) * 1000) / 1000
          : null,
        unit: selectedUnit
          ? displayUnit(selectedUnit)
          : null,
        unitCode: selectedUnit
          ? canonicalUnit(selectedUnit)
          : null,
        price: variant.selected?.price ?? null,
        lineTotal: (
          variant.selected?.price
          && quantityValue
        )
          ? Math.round(
              Number(variant.selected.price)
              * Number(quantityValue)
              * 100,
            ) / 100
          : null,
        variantOptions: variant.options,
      }

      if (index >= 0) {
        items[index] = next
      } else {
        items.push(next)
      }

      changed = true
    }

    items = stableItems(items)

    const nextRevision = (
      changed
        ? current.revision + 1
        : current.revision
    )

    const itemsComplete = (
      items.length > 0
      && items.every(item => (
        item.variantId
        && number(item.quantity) > 0
      ))
    )

    const fulfillmentComplete = (
      deliveryMethod === 'pickup'
      || (
        deliveryMethod === 'courier'
        && Boolean(deliveryCity)
        && Boolean(deliveryAddress)
      )
    )

    const complete = (
      itemsComplete
      && fulfillmentComplete
    )

    let status = complete
      ? 'awaiting_confirmation'
      : 'collecting'

    let confirmedRevision = (
      changed
        ? null
        : current.confirmedRevision
    )

    let confirmedAt = (
      changed
        ? null
        : current.confirmedAt
    )

    if (
      update?.confirm
      && complete
    ) {
      confirmedRevision = nextRevision
      confirmedAt = new Date().toISOString()
      status = 'awaiting_contact'
    }

    const saved = await client.query(
      `UPDATE live_chat_order_drafts
       SET
         status = $2,
         items = $3::jsonb,
         delivery_method = $4,
         delivery_city = $5,
         delivery_address = $6,
         revision = $7,
         confirmed_revision = $8,
         confirmed_at = $9,
         order_id = CASE
           WHEN $10::boolean THEN NULL
           ELSE order_id
         END,
         updated_at = now()
       WHERE conversation_id = $1
       RETURNING *`,
      [
        conversationId,
        status,
        JSON.stringify(items),
        deliveryMethod,
        deliveryCity,
        deliveryAddress,
        nextRevision,
        confirmedRevision,
        confirmedAt,
        Boolean(update?.startNewOrder),
      ],
    )

    return {
      draft: mapDraft(saved.rows[0]),
      changed,
      itemsComplete,
      fulfillmentComplete,
      complete,
      confirmed: (
        confirmedRevision === nextRevision
      ),
    }
  })
}

function simpleConfirmation(value) {
  const text = String(value ?? '')
    .trim()
    .toLocaleLowerCase('ru')
    .replace(/ё/g, 'е')
    .replace(/[.!?]+$/gu, '')
    .replace(/\s+/g, ' ')
    .trim()

  return (
    /^(?:все верно|верно|правильно|да(?: все верно)?|оформляй|оформить|подтверждаю|согласен|согласна)$/u
  ).test(text)
}

export async function applyImplicitChatOrderSignals(
  conversationId,
  content,
  draft,
) {
  if (!draft || draft.status === 'created') {
    return null
  }

  const fulfillmentText = String(content ?? '')
    .trim()
    .toLocaleLowerCase('ru')
    .replace(/ё/g, 'е')

  const implicitDeliveryMethod = (
    /самовывоз/iu.test(fulfillmentText)
      ? 'pickup'
      : /доставк/iu.test(fulfillmentText)
        ? 'courier'
        : null
  )

  if (
    implicitDeliveryMethod
    && implicitDeliveryMethod !== draft.deliveryMethod
  ) {
    return applyChatOrderDraftUpdate(
      conversationId,
      {
        startNewOrder: false,
        cancel: false,
        confirm: false,
        deliveryMethod: implicitDeliveryMethod,
        operations: [],
      },
    )
  }

  if (
    draft.status === 'awaiting_confirmation'
    && simpleConfirmation(content)
  ) {
    return applyChatOrderDraftUpdate(
      conversationId,
      {
        startNewOrder: false,
        cancel: false,
        confirm: true,
        operations: [],
      },
    )
  }

  const missing = (draft.items ?? []).filter(
    item => !item.quantity,
  )

  if (
    missing.length === 1
    && !draft.confirmedRevision
  ) {
    const match = String(content ?? '').match(
      /(?:^|\s)(\d+(?:[.,]\d+)?)\s*(фут(?:ов|а)?|фут²|дм²|дм2|м²|м2|шт\.?)?(?:\s|$)/iu,
    )

    if (match) {
      const quantityValue = Number(
        match[1].replace(',', '.'),
      )

      if (
        Number.isFinite(quantityValue)
        && quantityValue > 0
      ) {
        return applyChatOrderDraftUpdate(
          conversationId,
          {
            startNewOrder: false,
            cancel: false,
            confirm: false,
            operations: [{
              operation: 'upsert',
              productId: missing[0].productId,
              productName: missing[0].productName,
              variantId: missing[0].variantId,
              quantity: quantityValue,
              unit: match[2] ?? missing[0].unit,
            }],
          },
        )
      }
    }
  }

  return null
}

export function orderDraftMissingFields(draft) {
  const items = Array.isArray(draft?.items)
    ? draft.items
    : []

  return items.flatMap(item => {
    const problems = []

    if (!item.variantId) {
      problems.push('variant')
    }

    if (!(number(item.quantity) > 0)) {
      problems.push('quantity')
    }

    return problems.length
      ? [{
          productId: item.productId,
          productName: item.productName,
          problems,
          variantOptions:
            item.variantOptions ?? [],
        }]
      : []
  })
}

export function formatChatOrderDraftReply(
  draft,
  {
    created = false,
    needsContact = false,
    needsNewOrderCommand = false,
  } = {},
) {
  if (needsNewOrderCommand) {
    return (
      'Предыдущий заказ уже создан. '
      + 'Если хотите оформить ещё один, напишите '
      + '«новый заказ» и перечислите товары.'
    )
  }

  if (!draft) {
    return 'Черновик заказа пока пуст.'
  }

  if (draft.status === 'cancelled') {
    return 'Черновик заказа отменён. Заказ не создан.'
  }

  const items = Array.isArray(draft.items)
    ? draft.items
    : []

  if (!items.length) {
    return (
      'Черновик заказа пуст. '
      + 'Напишите названия товаров, которые хотите заказать.'
    )
  }

  const lines = items.map(item => {
    const qty = item.quantity
      ? `${quantity(item.quantity)} ${item.unit || 'ед.'}`
      : 'количество не указано'

    const variant = compactVariantSuffix(
      item.productName,
      item.variantName,
    )

    const total = item.lineTotal !== null
      && item.lineTotal !== undefined
      ? ` — ${money(item.lineTotal)}`
      : ''

    return `• ${item.productName}${variant} — ${qty}${total}`
  })

  const total = items.reduce(
    (sum, item) => (
      sum + (number(item.lineTotal) ?? 0)
    ),
    0,
  )

  const missing = orderDraftMissingFields(draft)

  if (missing.length) {
    const questions = missing.map(item => {
      const units = [
        ...new Set(
          (item.variantOptions ?? [])
            .map(option => displayUnit(option.unit))
            .filter(Boolean),
        ),
      ]

      if (
        item.problems.includes('variant')
        && item.problems.includes('quantity')
      ) {
        return (
          `• ${item.productName} — выберите единицу`
          + (
            units.length
              ? ` (${units.join(' или ')})`
              : ''
          )
          + ' и укажите количество.'
        )
      }

      if (item.problems.includes('variant')) {
        return (
          `• ${item.productName} — выберите единицу`
          + (
            units.length
              ? `: ${units.join(' или ')}`
              : '.'
          )
        )
      }

      const row = items.find(value => (
        value.productId === item.productId
      ))

      return (
        `• ${item.productName} — укажите количество`
        + (row?.unit ? ` в ${row.unit}` : '')
        + '.'
      )
    })

    return [
      'Состав заказа:',
      '',
      ...lines,
      '',
      'Нужно уточнить:',
      ...questions,
    ].join('\n')
  }

  if (!draft.deliveryMethod) {
    return [
      'Состав заказа:',
      ...lines,
      '',
      `Предварительная сумма: ${money(total)}.`,
      '',
      'Как вы хотите получить заказ: доставка или самовывоз?',
    ].join('\n')
  }

  if (
    draft.deliveryMethod === 'courier'
    && !draft.deliveryCity
    && !draft.deliveryAddress
  ) {
    return [
      'Состав заказа:',
      '',
      ...lines,
      '',
      `Предварительная сумма: ${money(total)}.`,
      '',
      'Для доставки укажите город и адрес.',
    ].join('\n')
  }

  if (
    draft.deliveryMethod === 'courier'
    && !draft.deliveryCity
  ) {
    return [
      'Состав заказа:',
      '',
      ...lines,
      '',
      `Предварительная сумма: ${money(total)}.`,
      '',
      'Укажите город доставки.',
    ].join('\n')
  }

  if (
    draft.deliveryMethod === 'courier'
    && !draft.deliveryAddress
  ) {
    return [
      'Состав заказа:',
      '',
      ...lines,
      '',
      `Предварительная сумма: ${money(total)}.`,
      '',
      'Укажите адрес доставки.',
    ].join('\n')
  }

  const fulfillmentLabel = (
    draft.deliveryMethod === 'pickup'
      ? 'Самовывоз'
      : 'Доставка'
  )

  const fulfillmentLine = (
    draft.deliveryMethod === 'courier'
      ? `Доставка: ${draft.deliveryCity}, ${draft.deliveryAddress}.`
      : 'Получение: Самовывоз.'
  )

  const summary = [
    'Состав заказа:',
    '',
    ...lines,
    '',
    fulfillmentLine,
    `Предварительная сумма: ${money(total)}.`,
  ]

  if (created) {
    return [
      'Заказ создан.',
      '',
      ...lines,
      '',
      fulfillmentLine,
      `Предварительная сумма: ${money(total)}.`,
      'Менеджер подтвердит наличие и финальную стоимость.',
    ].join('\n')
  }

  if (needsContact || draft.status === 'awaiting_contact') {
    return [
      ...summary,
      '',
      'Чтобы создать заказ, напишите ваше имя и контактный телефон.',
    ].join('\n')
  }

  return [
    'Проверьте заказ:',
    '',
    ...lines,
    '',
    fulfillmentLine,
    `Предварительная сумма: ${money(total)}.`,
    '',
    'Если всё верно — напишите «всё верно».',
    'Если нужно что-то изменить — просто напишите изменение.',
  ].join('\n')
}

export async function createChatOrderIfReady({
  conversationId,
  draft,
  name,
  phone,
}) {
  if (
    !draft
    || draft.status !== 'awaiting_contact'
    || draft.orderId
    || draft.confirmedRevision !== draft.revision
    || !(
      draft.deliveryMethod === 'pickup'
      || (
        draft.deliveryMethod === 'courier'
        && Boolean(draft.deliveryCity)
        && Boolean(draft.deliveryAddress)
      )
    )
    || !name
    || !phone
  ) {
    return {
      created: false,
      draft,
    }
  }

  const missing = orderDraftMissingFields(draft)

  if (missing.length || !draft.items.length) {
    return {
      created: false,
      draft,
    }
  }

  const result = await createOrder({
    source: 'ai_chat',
    name,
    phone,
    privacyConsent: true,
    deliveryMethod: draft.deliveryMethod,
    city:
      draft.deliveryMethod === 'courier'
        ? draft.deliveryCity
        : null,
    deliveryAddress:
      draft.deliveryMethod === 'courier'
        ? draft.deliveryAddress
        : null,
    idempotencyKey:
      `ai-chat:${conversationId}:${draft.revision}`,
    comment: 'Заказ создан покупателем через AI-чат.',
    items: draft.items.map(item => ({
      productId:
        item.productLegacyId
        ?? item.productId,
      variantId:
        item.variantLegacyId
        ?? item.variantId,
      quantity: item.quantity,
    })),
  })

  const saved = await query(
    `UPDATE live_chat_order_drafts
     SET
       status = 'created',
       order_id = $2,
       updated_at = now()
     WHERE conversation_id = $1
       AND order_id IS NULL
     RETURNING *`,
    [
      conversationId,
      result.order.id,
    ],
  )

  await query(
    `UPDATE live_chat_conversations
     SET
       customer_id = COALESCE(
         customer_id,
         $2
       ),
       updated_at = now()
     WHERE id = $1`,
    [
      conversationId,
      result.customer?.id ?? null,
    ],
  )

  return {
    created: true,
    duplicate: Boolean(result.duplicate),
    draft: mapDraft(saved.rows[0]) ?? draft,
    orderId: result.order.id,
  }
}
