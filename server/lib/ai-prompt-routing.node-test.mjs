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
  path.resolve(currentDirectory, '../prompts/ozelif-assistant-system.md'),
  'utf8',
).trim()

test('routes the current compact production prompt without fallback', () => {
  const general = routeBusinessPrompt(fallbackPrompt, 'general')
  const product = routeBusinessPrompt(fallbackPrompt, 'product')

  assert.equal(general.mode, 'routed_compact')
  assert.equal(product.mode, 'routed_compact')
  assert.match(general.content, /Обязательные ограничения/u)
  assert.doesNotMatch(general.content, /Справочные сведения OZELIF/u)
  assert.doesNotMatch(general.content, /Экспертные ориентиры/u)
  assert.match(product.content, /Логика консультации и продажи/u)
  assert.match(product.content, /Экспертные ориентиры/u)
  assert.match(product.content, /Возражения/u)
})

test('keeps verified company facts in every factual compact intent', () => {
  for (const intent of [
    'contacts',
    'delivery',
    'wholesale',
    'production',
    'product',
  ]) {
    const routed = routeBusinessPrompt(fallbackPrompt, intent)

    assert.equal(routed.mode, 'routed_compact')
    assert.match(routed.content, /Краснобогатырская улица, 24/u)
    assert.match(routed.content, /Итоговую стоимость доставки не обещай/u)
  }
})

test('routes manager-dependent intents with handoff rules', () => {
  for (const intent of ['contacts', 'wholesale', 'production', 'product']) {
    const routed = routeBusinessPrompt(fallbackPrompt, intent)

    assert.match(routed.content, /Когда нужен менеджер/u)
  }

  const delivery = routeBusinessPrompt(fallbackPrompt, 'delivery')
  assert.doesNotMatch(delivery.content, /Когда нужен менеджер/u)
})

test('general compact context is materially smaller than the full prompt', () => {
  const routed = routeBusinessPrompt(fallbackPrompt, 'general')
  const ratio = routed.routedChars / routed.originalChars

  assert.ok(
    ratio < 0.5,
    `general prompt ratio should be < 0.5, got ${ratio}`,
  )
})

test('unknown intent keeps full prompt for compatibility', () => {
  const routed = routeBusinessPrompt(fallbackPrompt, null)

  assert.equal(routed.mode, 'full')
  assert.equal(routed.content, fallbackPrompt)
})

const numberedPrompt = `
# 5. Подтверждённая информация о компании
Компания OZELIF.

# 6. Контакты и реквизиты
Москва.

# 7. Доставка и оплата
СДЭК.

# 8. Оптовые условия
От одной пачки.

# 9. Швейное производство OZELIF
10 изделий одной модели.

# 10. Категории и профессиональная консультация
Одежная кожа.

# 11. Экспертная логика подбора кожи
Толщина и назначение.

# 12. Единицы площади и расчёты
Фут² и дм².

# 13. Алгоритм продажи
Уточнить задачу.
`.trim()

test('keeps compatibility with numbered business prompts', () => {
  const sections = splitNumberedPromptSections(numberedPrompt)
  const wholesale = routeBusinessPrompt(numberedPrompt, 'wholesale')
  const product = routeBusinessPrompt(numberedPrompt, 'product')

  for (const number of [5, 6, 7, 8, 9, 10, 11, 12, 13]) {
    assert.ok(sections.has(number), `section ${number} should exist`)
  }

  assert.equal(wholesale.mode, 'routed')
  assert.deepEqual(wholesale.sectionNumbers, [5, 6, 7, 8])
  assert.match(wholesale.content, /Оптовые условия/u)
  assert.doesNotMatch(wholesale.content, /Швейное производство/u)

  assert.equal(product.mode, 'routed')
  assert.deepEqual(product.sectionNumbers, [5, 10, 11, 12, 13])
  assert.match(product.content, /Экспертная логика/u)
  assert.doesNotMatch(product.content, /Оптовые условия/u)
})

test('missing required numbered section safely falls back to full prompt', () => {
  const changedPrompt = `
# 5. Компания
OZELIF

# 6. Контакты
Москва
  `.trim()

  const routed = routeBusinessPrompt(changedPrompt, 'production')

  assert.equal(routed.mode, 'full_structure_fallback')
  assert.equal(routed.content, changedPrompt)
})

test('numeric section map remains explicit for legacy prompts', () => {
  assert.deepEqual(promptSectionsForIntent('delivery'), [5, 6, 7])
  assert.equal(promptSectionsForIntent('something-new'), null)
})
