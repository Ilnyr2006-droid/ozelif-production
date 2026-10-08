const INTENT_SECTION_MAP = Object.freeze({
  general: [5, 6],
  contacts: [5, 6],
  delivery: [5, 6, 7],
  wholesale: [5, 6, 7, 8],
  production: [5, 6, 9],
  product: [5, 10, 11, 12, 13],
})

const COMPACT_CORE_TITLES = Object.freeze([
  'Роль и цель',
  'Приоритет источников',
  'Обязательные ограничения',
  'Стиль ответа',
  'Проверка перед ответом',
])

const COMPACT_SHARED_TITLES = Object.freeze([
  ...COMPACT_CORE_TITLES,
  'Справочные сведения OZELIF',
])

const COMPACT_INTENT_TITLE_MAP = Object.freeze({
  general: COMPACT_CORE_TITLES,
  contacts: [
    ...COMPACT_SHARED_TITLES,
    'Когда нужен менеджер',
  ],
  delivery: COMPACT_SHARED_TITLES,
  wholesale: [
    ...COMPACT_SHARED_TITLES,
    'Когда нужен менеджер',
  ],
  production: [
    ...COMPACT_SHARED_TITLES,
    'Когда нужен менеджер',
  ],
  product: [
    ...COMPACT_SHARED_TITLES,
    'Логика консультации и продажи',
    'Экспертные ориентиры',
    'Возражения',
    'Когда нужен менеджер',
  ],
})

function cleanIntent(value) {
  return String(value ?? '').trim().toLowerCase()
}

function cleanHeading(value) {
  return String(value ?? '')
    .trim()
    .replace(/\s+/gu, ' ')
    .toLocaleLowerCase('ru')
}

function splitCompactPromptSections(value) {
  const content = String(value ?? '').trim()
  if (!content) return new Map()

  const heading = /^##\s+(.+)$/gmu
  const matches = [...content.matchAll(heading)]
  const sections = new Map()

  for (let index = 0; index < matches.length; index += 1) {
    const match = matches[index]
    const start = match.index
    const end = matches[index + 1]?.index ?? content.length

    if (start == null) continue

    sections.set(
      cleanHeading(match[1]),
      content.slice(start, end).trim(),
    )
  }

  return sections
}

function routeCompactBusinessPrompt(content, intent) {
  const selectedTitles = COMPACT_INTENT_TITLE_MAP[intent]
  if (!selectedTitles) return null

  const sections = splitCompactPromptSections(content)
  const requiredTitles = [
    ...COMPACT_SHARED_TITLES,
    'Логика консультации и продажи',
    'Экспертные ориентиры',
    'Возражения',
    'Когда нужен менеджер',
  ]
  const isCompactPrompt = requiredTitles.every(
    title => sections.has(cleanHeading(title)),
  )

  if (!isCompactPrompt) return null

  const selected = selectedTitles
    .map(title => sections.get(cleanHeading(title)))
    .filter(Boolean)
    .join('\n\n---\n\n')
    .trim()

  const routed = selectedTitles.length === sections.size
    ? content
    : [
        '# МАРШРУТИЗИРОВАННЫЙ БИЗНЕС-КОНТЕКСТ OZELIF',
        '',
        `Интент текущего запроса: ${intent}.`,
        'Ниже переданы только релевантные разделы опубликованного бизнес-промпта.',
        '',
        selected,
      ].join('\n')

  return {
    content: routed,
    mode: 'routed_compact',
    intent,
    sectionNumbers: [],
    sectionTitles: [...selectedTitles],
    originalChars: content.length,
    routedChars: routed.length,
  }
}

const SECTION_TITLE_RULES = Object.freeze([
  [5, /(?:подтвержденн\p{L}*\s+информац\p{L}*\s+о\s+компан|о\s+компан|компан\p{L}*\s+ozelif)/iu],
  [6, /(?:контакт|реквизит)/iu],
  [7, /(?:доставк|оплат)/iu],
  [8, /(?:оптов\p{L}*\s+услов)/iu],
  [9, /(?:швейн\p{L}*\s+производ)/iu],
  [10, /(?:категор\p{L}*.*консультац|категор\p{L}*\s+товар)/iu],
  [11, /(?:экспертн\p{L}*\s+логик\p{L}*\s+подбор|подбор\p{L}*\s+кож)/iu],
  [12, /(?:единиц\p{L}*\s+площад|расчет\p{L}*|расчёт\p{L}*)/iu],
  [13, /(?:алгоритм\p{L}*\s+продаж|сценар\p{L}*\s+продаж)/iu],
])

function inferredSectionNumber(title) {
  const text = String(title ?? '').trim()

  for (const [number, pattern] of SECTION_TITLE_RULES) {
    if (pattern.test(text)) return number
  }

  return null
}

export function splitNumberedPromptSections(value) {
  const content = String(value ?? '').trim()
  if (!content) return new Map()

  const heading = /^#{1,2}\s+(?:(\d+)\.\s+)?(.+)$/gmu
  const matches = [...content.matchAll(heading)]
  const sections = new Map()

  for (let index = 0; index < matches.length; index += 1) {
    const match = matches[index]
    const explicit = Number(match[1])
    const number = Number.isInteger(explicit)
      ? explicit
      : inferredSectionNumber(match[2])
    const start = match.index
    const end = (
      matches[index + 1]?.index
      ?? content.length
    )

    if (!Number.isInteger(number) || start == null) continue

    sections.set(
      number,
      content.slice(start, end).trim(),
    )
  }

  return sections
}

export function routeBusinessPrompt(value, intentType) {
  const content = String(value ?? '').trim()
  const intent = cleanIntent(intentType)
  const selectedNumbers = INTENT_SECTION_MAP[intent]

  if (!content || !selectedNumbers) {
    return {
      content,
      mode: 'full',
      intent: intent || null,
      sectionNumbers: [],
      originalChars: content.length,
      routedChars: content.length,
    }
  }

  const compact = routeCompactBusinessPrompt(content, intent)
  if (compact) return compact

  const sections = splitNumberedPromptSections(content)
  const missing = selectedNumbers.filter(
    number => !sections.has(number),
  )

  // Safety first: if an administrator materially changed the prompt
  // structure, retain the full published prompt rather than silently
  // dropping business knowledge.
  if (missing.length) {
    return {
      content,
      mode: 'full_structure_fallback',
      intent,
      sectionNumbers: [],
      missingSectionNumbers: missing,
      originalChars: content.length,
      routedChars: content.length,
    }
  }

  const selected = selectedNumbers
    .map(number => sections.get(number))
    .filter(Boolean)
    .join('\n\n---\n\n')
    .trim()

  const routed = [
    '# МАРШРУТИЗИРОВАННЫЙ БИЗНЕС-КОНТЕКСТ OZELIF',
    '',
    `Интент текущего запроса: ${intent}.`,
    'Ниже переданы только релевантные разделы опубликованного бизнес-промпта.',
    '',
    selected,
  ].join('\n')

  return {
    content: routed,
    mode: 'routed',
    intent,
    sectionNumbers: [...selectedNumbers],
    originalChars: content.length,
    routedChars: routed.length,
  }
}

export function promptSectionsForIntent(intentType) {
  const sections = INTENT_SECTION_MAP[cleanIntent(intentType)]
  return sections ? [...sections] : null
}
