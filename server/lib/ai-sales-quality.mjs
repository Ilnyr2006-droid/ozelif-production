const SALES_OVERCLAIM_PATTERNS = [
  {
    id: 'ideal_fit',
    pattern:
      /(?<![\p{L}\p{N}_])идеальн\p{L}*\s+подход\p{L}*(?![\p{L}\p{N}_])/giu,
  },
  {
    id: 'excellent_fit',
    pattern:
      /(?<![\p{L}\p{N}_])отличн\p{L}*\s+подход\p{L}*(?![\p{L}\p{N}_])/giu,
  },
  {
    id: 'best_choice',
    pattern:
      /(?<![\p{L}\p{N}_])(?:сам\p{L}*\s+)?лучш\p{L}*\s+(?:выбор\p{L}*|вариант\p{L}*)(?![\p{L}\p{N}_])/giu,
  },
  {
    id: 'ideal_choice',
    pattern:
      /(?<![\p{L}\p{N}_])идеальн\p{L}*\s+(?:выбор\p{L}*|вариант\p{L}*)(?![\p{L}\p{N}_])/giu,
  },
  {
    id: 'ideal_for',
    pattern:
      /(?<![\p{L}\p{N}_])идеальн\p{L}*\s+для\s+/giu,
  },
  {
    id: 'hundred_percent_fit',
    pattern:
      /(?<![\p{L}\p{N}_])100\s*%\s*подход\p{L}*(?![\p{L}\p{N}_])/giu,
  },
  {
    id: 'guaranteed_fit',
    pattern:
      /(?<![\p{L}\p{N}_])гарантированн\p{L}*\s+подход\p{L}*(?![\p{L}\p{N}_])/giu,
  },
  {
    id: 'certain_fit',
    pattern:
      /(?<![\p{L}\p{N}_])точно\s+подход\p{L}*(?![\p{L}\p{N}_])/giu,
  },
]

const GENERIC_CLOSINGS = [
  /(?:\s+|^)(?:если\s+вас\s+интересует)[\s\S]{0,280}$/iu,
  /(?:\s+|^)(?:если\s+вам\s+интерес(?:ен|на|ны))[^.!?]{0,280}[.!?]*$/iu,
  /(?:\s+|^)(?:если\s+у\s+вас\s+есть\s+(?:дополнительные|другие)\s+вопросы)[\s\S]{0,240}$/iu,
  /(?:\s+|^)(?:если\s+вам\s+(?:нужно|нужна|потребуется)\s+(?:больше|дополнительн\p{L}*)\s+информаци\p{L}*)[\s\S]{0,260}$/iu,
  /(?:\s+|^)(?:с\s+радостью\s+помог\p{L}*)[!.]*$/iu,
]

function replaceOverclaims(value) {
  let text = String(value ?? '')

  text = text
    .replace(
      /(?<![\p{L}\p{N}_])(?:идеальн\p{L}*|отличн\p{L}*)\s+подойд\p{L}*(?![\p{L}\p{N}_])/giu,
      'подходит',
    )
    .replace(
      /(?<![\p{L}\p{N}_])(?:идеальн\p{L}*|отличн\p{L}*)\s+подход\p{L}*(?![\p{L}\p{N}_])/giu,
      'подходит',
    )
    .replace(
      /(?<![\p{L}\p{N}_])(?:сам\p{L}*\s+)?лучш\p{L}*\s+(?:выбор\p{L}*|вариант\p{L}*)(?![\p{L}\p{N}_])/giu,
      'подходящий вариант',
    )
    .replace(
      /(?<![\p{L}\p{N}_])идеальн\p{L}*\s+(?:выбор\p{L}*|вариант\p{L}*)(?![\p{L}\p{N}_])/giu,
      'подходящий вариант',
    )
    .replace(
      /(?<![\p{L}\p{N}_])идеальн\p{L}*\s+для\s+/giu,
      'подходит для ',
    )
    .replace(
      /(?<![\p{L}\p{N}_])100\s*%\s*подход\p{L}*(?![\p{L}\p{N}_])/giu,
      'подходит',
    )
    .replace(
      /(?<![\p{L}\p{N}_])(?:гарантированн\p{L}*|точно)\s+подойд\p{L}*(?![\p{L}\p{N}_])/giu,
      'подходит по опубликованным характеристикам',
    )
    .replace(
      /(?<![\p{L}\p{N}_])(?:гарантированн\p{L}*|точно)\s+подход\p{L}*(?![\p{L}\p{N}_])/giu,
      'подходит по опубликованным характеристикам',
    )

  return text
}

function stripGenericClosing(value) {
  let text = String(value ?? '').trim()

  for (const pattern of GENERIC_CLOSINGS) {
    text = text.replace(pattern, '').trim()
  }

  return text
}

export function normalizeAssistantPlainText(value) {
  return String(value ?? '')
    .replace(/```[\w-]*\n?([\s\S]*?)```/gu, '$1')
    .replace(/`([^`\n]+)`/gu, '$1')
    .replace(/\*\*([^*\n]+)\*\*/gu, '$1')
    .replace(/__([^_\n]+)__/gu, '$1')
    .replace(/(?<!\*)\*([^*\n]+)\*(?!\*)/gu, '$1')
    .replace(/(?<!_)_([^_\n]+)_(?!_)/gu, '$1')
    .replace(/^#{1,6}\s+/gmu, '')
    .replace(/^\s*[-*+]\s+/gmu, '• ')
    .replace(
      /([.;!?])\s+-\s+(?=[\p{L}\p{N}])/gu,
      '$1\n• ',
    )
    .replace(
      /,\s*\n+\s*(?=\d{1,5}(?:\D|$))/gu,
      ', ',
    )
}

function normalizeNumberedRecommendations(value) {
  return String(value ?? '')
    .replace(
      /[ \t]+(?=(?:[2-9]|[1-9]\d+)\.\s+(?:\*\*|[«"'A-ZА-ЯЁ]))/gu,
      '\n',
    )
    .replace(/\n{3,}/g, '\n\n')
}

export function findSalesQualityViolations(value) {
  const text = String(value ?? '')
  const violations = []

  for (const item of SALES_OVERCLAIM_PATTERNS) {
    item.pattern.lastIndex = 0

    if (item.pattern.test(text)) {
      violations.push(item.id)
    }
  }

  for (let index = 0; index < GENERIC_CLOSINGS.length; index += 1) {
    GENERIC_CLOSINGS[index].lastIndex = 0

    if (GENERIC_CLOSINGS[index].test(text)) {
      violations.push(`generic_closing_${index + 1}`)
    }
  }

  return [...new Set(violations)]
}

export function sanitizeSalesReply(value) {
  const original = String(value ?? '').trim()
  if (!original) return ''

  const sanitized = stripGenericClosing(
    normalizeAssistantPlainText(
      normalizeNumberedRecommendations(
        replaceOverclaims(original),
      ),
    ),
  )
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n[ \t]+/g, '\n')
    .trim()

  return sanitized
}
