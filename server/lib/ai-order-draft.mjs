const TOOL_NAME = 'update_chat_order_draft'

export const ORDER_DRAFT_TOOL = {
  type: 'function',
  name: TOOL_NAME,
  description: [
    'Обновляет черновик заказа покупателя в AI-чате.',
    'Инструмент НЕ создаёт заказ и НЕ подтверждает наличие.',
    'Используй его, когда покупатель хочет заказать, добавить,',
    'убрать товар, изменить количество или подтвердить заказ.',
    'В одном вызове можно обновить несколько товаров.',
    'Ты отвечаешь за понимание естественного языка: сокращений, опечаток, транслита, разговорных названий и ссылок вроде «первый/второй».',
    'Для позиции, уже находящейся в черновике, используй target=draft и ТОЧНЫЙ productId из текущего черновика.',
    'Для нового товара используй target=catalog и только productId из ПРОВЕРЕННЫХ ТОВАРОВ.',
    'Если количество однозначно связано с товаром, quantityResolution=resolved и quantityEvidence должен быть ДОСЛОВНЫМ коротким фрагментом последнего сообщения покупателя, где видны ссылка на товар и число.',
    'Если несколько количеств нельзя однозначно сопоставить товарам, quantityResolution=ambiguous и не устанавливай quantity ни для одной неоднозначной позиции.',
    'Никогда не придумывай PRODUCT_ID, VARIANT_ID, количество или quantityEvidence.',
  ].join(' '),
  strict: true,
  parameters: {
    type: 'object',
    additionalProperties: false,
    properties: {
      startNewOrder: {
        type: 'boolean',
        description:
          'true только если покупатель явно хочет начать новый заказ после уже созданного.',
      },
      cancel: {
        type: 'boolean',
        description:
          'true только если покупатель явно отменяет текущий незавершённый заказ.',
      },
      confirm: {
        type: 'boolean',
        description:
          'true только если покупатель явно подтверждает/просит оформить текущий состав.',
      },
      quantityResolution: {
        type: 'string',
        enum: ['none', 'resolved', 'ambiguous'],
        description:
          'none = в этом сообщении нет сопоставления количества; resolved = модель уверенно сопоставила каждое переданное quantity конкретной позиции; ambiguous = сопоставление неоднозначно, quantity не устанавливать.',
      },
      deliveryMethod: {
        anyOf: [
          {
            type: 'string',
            enum: ['pickup', 'courier'],
          },
          { type: 'null' },
        ],
        description:
          'Способ получения: pickup = самовывоз, courier = доставка. До выбора способа заказ нельзя оформлять.',
      },
      deliveryCity: {
        anyOf: [
          { type: 'string' },
          { type: 'null' },
        ],
        description:
          'Город доставки. Заполняй только для courier. Не придумывай город.',
      },
      deliveryAddress: {
        anyOf: [
          { type: 'string' },
          { type: 'null' },
        ],
        description:
          'Адрес доставки. Заполняй только для courier. Не придумывай адрес.',
      },
      operations: {
        type: 'array',
        maxItems: 10,
        items: {
          type: 'object',
          additionalProperties: false,
          properties: {
            operation: {
              type: 'string',
              enum: ['upsert', 'remove'],
            },
            target: {
              type: 'string',
              enum: ['draft', 'catalog'],
              description:
                'draft = существующая позиция текущего заказа; catalog = новый товар из ПРОВЕРЕННЫХ ТОВАРОВ.',
            },
            productId: {
              anyOf: [
                { type: 'string' },
                { type: 'null' },
              ],
            },
            productName: {
              anyOf: [
                { type: 'string' },
                { type: 'null' },
              ],
            },
            variantId: {
              anyOf: [
                { type: 'string' },
                { type: 'null' },
              ],
            },
            quantity: {
              anyOf: [
                {
                  type: 'number',
                  exclusiveMinimum: 0,
                },
                { type: 'null' },
              ],
            },
            unit: {
              anyOf: [
                { type: 'string' },
                { type: 'null' },
              ],
            },
            quantityEvidence: {
              anyOf: [
                { type: 'string' },
                { type: 'null' },
              ],
              description:
                'Если quantity задан, скопируй сюда короткий ДОСЛОВНЫЙ фрагмент последнего сообщения покупателя, который связывает ссылку на эту позицию и это число. Не перефразируй.',
            },
          },
          required: [
            'operation',
            'target',
            'productId',
            'productName',
            'variantId',
            'quantity',
            'unit',
            'quantityEvidence',
          ],
        },
      },
    },
    required: [
      'startNewOrder',
      'cancel',
      'confirm',
      'quantityResolution',
      'deliveryMethod',
      'deliveryCity',
      'deliveryAddress',
      'operations',
    ],
  },
}

function clean(value, limit = 180) {
  const text = String(value ?? '').trim()
  return text ? text.slice(0, limit) : null
}

function positiveNumber(value) {
  if (value === null || value === undefined) {
    return null
  }

  const number = Number(value)

  return (
    Number.isFinite(number)
    && number > 0
  )
    ? Math.round(number * 1000) / 1000
    : null
}

export function normalizeOrderDraftUpdate(value) {
  if (
    !value
    || typeof value !== 'object'
    || Array.isArray(value)
  ) {
    return null
  }

  const operations = Array.isArray(value.operations)
    ? value.operations
        .slice(0, 10)
        .flatMap(item => {
          if (
            !item
            || typeof item !== 'object'
            || Array.isArray(item)
          ) {
            return []
          }

          const operation = (
            item.operation === 'remove'
              ? 'remove'
              : 'upsert'
          )

          const target = (
            item.target === 'draft'
            || item.target === 'catalog'
              ? item.target
              : null
          )

          const productId = clean(item.productId)
          const productName = clean(item.productName)
          const variantId = clean(item.variantId)
          const quantity = positiveNumber(item.quantity)
          const unit = clean(item.unit, 60)
          const quantityEvidence = clean(
            item.quantityEvidence,
            240,
          )

          if (!productId && !productName) {
            return []
          }

          return [{
            operation,
            target,
            productId,
            productName,
            variantId,
            quantity,
            unit,
            quantityEvidence,
          }]
        })
    : []

  const normalized = {
    startNewOrder: value.startNewOrder === true,
    cancel: value.cancel === true,
    confirm: value.confirm === true,
    quantityResolution: (
      value.quantityResolution === 'resolved'
      || value.quantityResolution === 'ambiguous'
        ? value.quantityResolution
        : 'none'
    ),
    deliveryMethod:
      value.deliveryMethod === 'pickup'
      || value.deliveryMethod === 'courier'
        ? value.deliveryMethod
        : null,
    deliveryCity: clean(value.deliveryCity, 160),
    deliveryAddress: clean(value.deliveryAddress, 1000),
    operations,
  }

  if (
    !normalized.startNewOrder
    && !normalized.cancel
    && !normalized.confirm
    && normalized.quantityResolution === 'none'
    && !normalized.deliveryMethod
    && !normalized.deliveryCity
    && !normalized.deliveryAddress
    && !normalized.operations.length
  ) {
    return null
  }

  return normalized
}

export function extractOrderDraftToolCalls(body) {
  const output = Array.isArray(body?.output)
    ? body.output
    : []

  const functionOutputs = []
  let update = null

  for (const item of output) {
    if (
      item?.type !== 'function_call'
      || item?.name !== TOOL_NAME
      || typeof item.call_id !== 'string'
    ) {
      continue
    }

    let parsed = null

    try {
      parsed = JSON.parse(
        typeof item.arguments === 'string'
          ? item.arguments
          : '{}',
      )
    } catch {
      parsed = null
    }

    const candidate = normalizeOrderDraftUpdate(parsed)

    if (candidate) {
      update = candidate
    }

    functionOutputs.push({
      type: 'function_call_output',
      call_id: item.call_id,
      output: JSON.stringify({
        ok: Boolean(candidate),
        note:
          'Backend проверит target, PRODUCT_ID, VARIANT_ID, quantity и дословный quantityEvidence. Черновик будет сохранён только после этой проверки. Заказ ещё не создан.',
      }),
    })
  }

  return {
    update,
    functionOutputs,
  }
}

export function formatOrderDraftContext(draft) {
  if (
    !draft
    || typeof draft !== 'object'
    || !Array.isArray(draft.items)
    || !draft.items.length
  ) {
    return 'Черновик заказа пока пуст.'
  }

  const lines = draft.items.map((item, index) => {
    const parts = [
      `${index + 1}. PRODUCT_ID=${item.productId}`,
      `Название=${item.productName}`,
    ]

    if (item.variantId) {
      parts.push(`VARIANT_ID=${item.variantId}`)
    }

    if (item.variantName) {
      parts.push(`вариант=${item.variantName}`)
    }

    if (item.quantity) {
      parts.push(`количество=${item.quantity}`)
    } else {
      parts.push('количество=НЕ УКАЗАНО')
    }

    if (item.unit) {
      parts.push(`единица=${item.unit}`)
    }

    if (
      Array.isArray(item.variantOptions)
      && item.variantOptions.length
      && !item.variantId
    ) {
      parts.push(
        'варианты='
        + item.variantOptions
            .slice(0, 6)
            .map(option => (
              `VARIANT_ID=${option.id};`
              + `${option.name || 'вариант'};`
              + `${option.unit || 'ед.'}`
            ))
            .join(' | '),
      )
    }

    return parts.join('; ')
  })

  return [
    `Статус=${draft.status ?? 'collecting'}`,
    `Ревизия=${draft.revision ?? 0}`,
    `Получение=${
      draft.deliveryMethod === 'pickup'
        ? 'САМОВЫВОЗ'
        : draft.deliveryMethod === 'courier'
          ? 'ДОСТАВКА'
          : 'НЕ ВЫБРАНО'
    }`,
    `Город доставки=${draft.deliveryCity || 'НЕ УКАЗАН'}`,
    `Адрес доставки=${draft.deliveryAddress || 'НЕ УКАЗАН'}`,
    ...lines,
    'Служебные PRODUCT_ID/VARIANT_ID нельзя показывать покупателю.',
  ].join('\n')
}
