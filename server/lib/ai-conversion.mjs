const EXPLICIT_MANAGER = [
  /(?<![\p{L}\p{N}_])(?:позови|позовите|подключи|подключите|переключи|переключите)(?![\p{L}\p{N}_])[^.!?]{0,80}(?:менеджер|человек|консультант)\p{L}*/iu,
  /(?<![\p{L}\p{N}_])(?:хочу|нужен|нужна|нужно)(?![\p{L}\p{N}_])[^.!?]{0,60}(?:менеджер|человек|жив\p{L}*\s+консультант)\p{L}*/iu,
  /(?<![\p{L}\p{N}_])(?:поговорить|связаться)(?![\p{L}\p{N}_])[^.!?]{0,60}(?:с менеджером|с человеком|с консультантом)/iu,
  /(?<![\p{L}\p{N}_])(?:позвоните|перезвоните|свяжитесь со мной)(?![\p{L}\p{N}_])/iu,
]

const TRANSACTIONAL = [
  /(?<![\p{L}\p{N}_])куп\p{L}*/iu,
  /(?<![\p{L}\p{N}_])заказ\p{L}*/iu,
  /(?<![\p{L}\p{N}_])оформ\p{L}*/iu,
  /(?<![\p{L}\p{N}_])беру(?![\p{L}\p{N}_])/iu,
  /(?<![\p{L}\p{N}_])нужн\p{L}*\s+\d/iu,
  /(?<![\p{L}\p{N}_])(?:цена|стоимость|стоит|наличи\p{L}*)(?![\p{L}\p{N}_])/iu,
]

const QUANTITY = [
  /(?<![\p{L}\p{N}_])\d+(?:[.,]\d+)?\s*(?:дм²|дм2|м²|м2|шт|штук|шк\p{L}*|издел\p{L}*)/iu,
  /(?<![\p{L}\p{N}_])(?:опт|оптом|парт\p{L}*|тираж\p{L}*)(?![\p{L}\p{N}_])/iu,
]

function matchesAny(text, patterns) {
  return patterns.some(pattern => pattern.test(text))
}

function clampScore(value) {
  return Math.max(0, Math.min(100, Math.round(value)))
}

export function isExplicitManagerRequest(value) {
  const text = String(value ?? '').trim()
  if (!text) return false
  return matchesAny(text, EXPLICIT_MANAGER)
}

export function leadScore({
  message,
  intentType,
} = {}) {
  const text = String(message ?? '').trim()
  const intent = String(intentType ?? 'general').trim().toLowerCase()

  if (isExplicitManagerRequest(text)) return 100

  const baseByIntent = {
    general: 5,
    contacts: 20,
    delivery: 35,
    product: 42,
    wholesale: 78,
    production: 82,
  }

  let score = baseByIntent[intent] ?? 10

  if (matchesAny(text, TRANSACTIONAL)) {
    score += 22
  }

  if (matchesAny(text, QUANTITY)) {
    score += 16
  }

  return clampScore(score)
}

function offerForIntent(intentType) {
  switch (intentType) {
    case 'wholesale':
      return {
        type: 'contact',
        title: 'Получить оптовое предложение',
        text: 'Оставьте номер — менеджер увидит запрос и сможет уточнить цену, объём и доступные варианты.',
      }
    case 'production':
      return {
        type: 'contact',
        title: 'Рассчитать пошив',
        text: 'Оставьте номер — менеджер подключится к запросу по модели, тиражу, материалам и срокам.',
      }
    case 'product':
      return {
        type: 'contact',
        title: 'Уточнить наличие и условия',
        text: 'Оставьте номер — менеджер сможет проверить детали по выбранной коже и связаться с вами.',
      }
    default:
      return {
        type: 'contact',
        title: 'Связаться с менеджером',
        text: 'Оставьте номер — менеджер увидит ваш запрос и сможет продолжить консультацию.',
      }
  }
}

export function buildConversionDecision({
  message,
  intentType,
  hasPhone = false,
  offerAlreadyShown = false,
} = {}) {
  const intent = String(intentType ?? 'general').trim().toLowerCase()
  const explicitManagerRequest = isExplicitManagerRequest(message)
  const score = leadScore({ message, intentType: intent })

  if (explicitManagerRequest) {
    return {
      score,
      intent,
      explicitManagerRequest: true,
      shouldOfferContact: false,
      shouldRequestManager: true,
      disableAiForHandoff: true,
      offer: null,
    }
  }

  const shouldOfferContact = (
    !hasPhone
    && !offerAlreadyShown
    && score >= 68
  )

  const shouldRequestManager = (
    hasPhone
    && score >= 80
  )

  return {
    score,
    intent,
    explicitManagerRequest: false,
    shouldOfferContact,
    shouldRequestManager,
    disableAiForHandoff: false,
    offer: shouldOfferContact
      ? offerForIntent(intent)
      : null,
  }
}
