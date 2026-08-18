const INTENT_SECTION_MAP = Object.freeze({
  general: [5, 6],
  contacts: [5, 6],
  delivery: [5, 6, 7],
  wholesale: [5, 6, 7, 8],
  production: [5, 6, 9],
  product: [5, 10, 11, 12, 13],
})

function cleanIntent(value) {
  return String(value ?? '').trim().toLowerCase()
}

export function splitNumberedPromptSections(value) {
  const content = String(value ?? '').trim()
  if (!content) return new Map()

  const heading = /^#{1,2}\s+(\d+)\.\s+.+$/gmu
  const matches = [...content.matchAll(heading)]
  const sections = new Map()

  for (let index = 0; index < matches.length; index += 1) {
    const match = matches[index]
    const number = Number(match[1])
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
