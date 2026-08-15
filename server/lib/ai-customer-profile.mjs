import { normalizePhone } from './phone.mjs'

const TOOL_NAME = 'capture_customer_profile'

export const CUSTOMER_PROFILE_TOOL = {
  type: 'function',
  name: TOOL_NAME,
  description: [
    'Сохраняет имя и/или телефон самого покупателя.',
    'Вызывай только когда покупатель явно сообщил эти данные как свои.',
    'Не считай телефоном цену, размер, количество, артикул,',
    'номер заказа или контакт другого человека.',
    'Не угадывай имя и не извлекай его из названий товаров.',
  ].join(' '),
  strict: true,
  parameters: {
    type: 'object',
    additionalProperties: false,
    properties: {
      name: {
        anyOf: [
          {
            type: 'string',
            description: 'Явно сообщённое имя покупателя.',
          },
          {
            type: 'null',
          },
        ],
      },
      phone: {
        anyOf: [
          {
            type: 'string',
            description: 'Явно сообщённый телефон покупателя.',
          },
          {
            type: 'null',
          },
        ],
      },
    },
    required: [
      'name',
      'phone',
    ],
  },
}

function normalizeName(value) {
  if (typeof value !== 'string') return null

  const name = value
    .trim()
    .replace(/\s+/gu, ' ')
    .slice(0, 160)

  if (name.length < 2) return null
  if (/\d/u.test(name)) return null
  if (/https?:|@/iu.test(name)) return null

  const words = name.split(' ')

  if (words.length > 5) return null

  if (!/^[\p{L}\p{M}'’ -]+$/u.test(name)) {
    return null
  }

  return name
}

export function normalizeCustomerProfileUpdate(value) {
  if (
    !value
    || typeof value !== 'object'
    || Array.isArray(value)
  ) {
    return null
  }

  const name = normalizeName(value.name)
  const phone = normalizePhone(value.phone)

  if (!name && !phone) return null

  return {
    ...(name ? { name } : {}),
    ...(phone ? { phone } : {}),
  }
}

export function extractCustomerProfileToolCalls(body) {
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

    const candidate = normalizeCustomerProfileUpdate(parsed)

    if (candidate) {
      update = {
        ...(update ?? {}),
        ...candidate,
      }
    }

    functionOutputs.push({
      type: 'function_call_output',
      call_id: item.call_id,
      output: JSON.stringify({
        ok: Boolean(candidate),
        savedFields: candidate
          ? Object.keys(candidate)
          : [],
      }),
    })
  }

  return {
    update,
    functionOutputs,
  }
}
