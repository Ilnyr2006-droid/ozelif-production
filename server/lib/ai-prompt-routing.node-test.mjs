import assert from 'node:assert/strict'
import test from 'node:test'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import {
  promptSectionsForIntent,
  routeBusinessPrompt,
  splitNumberedPromptSections,
} from './ai-prompt-routing.mjs'

const currentDirectory = path.dirname(fileURLToPath(import.meta.url))
const fallbackPrompt = fs.readFileSync(
  path.resolve(
    currentDirectory,
    '../prompts/ozelif-assistant-system.md',
  ),
  'utf8',
).trim()

test('parses numbered business-prompt sections', () => {
  const sections = splitNumberedPromptSections(fallbackPrompt)

  for (const number of [5, 6, 7, 8, 9, 10, 11, 12, 13]) {
    assert.ok(
      sections.has(number),
      `section ${number} should exist`,
    )
  }
})

test('routes wholesale to company, contacts, delivery and wholesale only', () => {
  const routed = routeBusinessPrompt(
    fallbackPrompt,
    'wholesale',
  )

  assert.equal(routed.mode, 'routed')
  assert.deepEqual(routed.sectionNumbers, [5, 6, 7, 8])
  assert.match(routed.content, /Оптовые условия/)
  assert.match(routed.content, /Доставка и оплата/)
  assert.doesNotMatch(routed.content, /Швейное производство OZELIF/)
  assert.ok(routed.routedChars < routed.originalChars)
})

test('routes production without unrelated product-consultation chapters', () => {
  const routed = routeBusinessPrompt(
    fallbackPrompt,
    'production',
  )

  assert.equal(routed.mode, 'routed')
  assert.deepEqual(routed.sectionNumbers, [5, 6, 9])
  assert.match(routed.content, /Швейное производство OZELIF/)
  assert.match(routed.content, /10 изделий одной модели/)
  assert.match(routed.content, /первый образец/)
  assert.doesNotMatch(routed.content, /Экспертная логика подбора кожи/)
})

test('routes product requests to catalog and sales expertise', () => {
  const routed = routeBusinessPrompt(
    fallbackPrompt,
    'product',
  )

  assert.equal(routed.mode, 'routed')
  assert.deepEqual(
    routed.sectionNumbers,
    [5, 10, 11, 12, 13],
  )
  assert.match(routed.content, /Категории и профессиональная консультация/)
  assert.match(routed.content, /Экспертная логика подбора кожи/)
  assert.match(routed.content, /Единицы площади и расчёты/)
  assert.match(routed.content, /Алгоритм продажи/)
  assert.doesNotMatch(routed.content, /Оптовые условия/)
})

test('general intent is materially smaller than the full business prompt', () => {
  const routed = routeBusinessPrompt(
    fallbackPrompt,
    'general',
  )

  assert.equal(routed.mode, 'routed')
  assert.deepEqual(routed.sectionNumbers, [5, 6])

  const ratio = routed.routedChars / routed.originalChars
  assert.ok(
    ratio < 0.35,
    `general prompt ratio should be < 0.35, got ${ratio}`,
  )
})

test('unknown intent keeps full prompt for compatibility', () => {
  const routed = routeBusinessPrompt(
    fallbackPrompt,
    null,
  )

  assert.equal(routed.mode, 'full')
  assert.equal(routed.content, fallbackPrompt)
})

test('missing required section safely falls back to full prompt', () => {
  const changedPrompt = `
# 5. Компания
OZELIF

# 6. Контакты
Москва
  `.trim()

  const routed = routeBusinessPrompt(
    changedPrompt,
    'production',
  )

  assert.equal(
    routed.mode,
    'full_structure_fallback',
  )
  assert.equal(routed.content, changedPrompt)
})

test('section map is explicit', () => {
  assert.deepEqual(
    promptSectionsForIntent('delivery'),
    [5, 6, 7],
  )
  assert.equal(
    promptSectionsForIntent('something-new'),
    null,
  )
})

test('routes an unnumbered admin business prompt by heading names', () => {
  const unnumbered = `
# Подтверждённая информация о компании
Компания OZELIF.

# Контакты и реквизиты
Москва.

# Доставка и оплата
СДЭК.

# Оптовые условия
От одной пачки.

# Швейное производство OZELIF
10 изделий одной модели.

# Категории и профессиональная консультация
Одежная кожа.

# Экспертная логика подбора кожи
Толщина и назначение.

# Единицы площади и расчёты
Фут² и дм².

# Алгоритм продажи
Уточнить задачу.
  `.trim()

  const general = routeBusinessPrompt(
    unnumbered,
    'general',
  )
  const product = routeBusinessPrompt(
    unnumbered,
    'product',
  )

  assert.equal(general.mode, 'routed')
  assert.deepEqual(general.sectionNumbers, [5, 6])
  assert.doesNotMatch(general.content, /СДЭК/u)

  assert.equal(product.mode, 'routed')
  assert.deepEqual(
    product.sectionNumbers,
    [5, 10, 11, 12, 13],
  )
  assert.match(product.content, /Экспертная логика/u)
  assert.doesNotMatch(product.content, /Оптовые условия/u)
})
