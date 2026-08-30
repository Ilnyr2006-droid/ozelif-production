import assert from 'node:assert/strict'
import test from 'node:test'

import {
  findSalesQualityViolations,
  normalizeAssistantPlainText,
  sanitizeSalesReply,
} from './ai-sales-quality.mjs'

test('softens unsupported suitability superlatives', () => {
  const reply = sanitizeSalesReply(
    'Vip Black идеально подойдет для куртки. '
      + 'Soft Black — лучший вариант.',
  )

  assert.doesNotMatch(reply, /идеальн/iu)
  assert.doesNotMatch(reply, /лучш\p{L}*\s+вариант/iu)
  assert.equal(
    findSalesQualityViolations(reply).length,
    0,
  )
})

test('softens certainty and 100 percent claims', () => {
  const reply = sanitizeSalesReply(
    'Эта кожа гарантированно подойдет. '
      + 'Вторая 100% подходит.',
  )

  assert.doesNotMatch(reply, /гарантированн/iu)
  assert.doesNotMatch(reply, /100\s*%/u)
  assert.equal(
    findSalesQualityViolations(reply).length,
    0,
  )
})

test('removes generic filler closing', () => {
  const reply = sanitizeSalesReply(
    'Amazon Black стоит 437 ₽. '
      + 'Если у вас есть дополнительные вопросы, дайте знать!',
  )

  assert.equal(reply, 'Amazon Black стоит 437 ₽.')
})

test('keeps one useful concrete clarification', () => {
  const reply = sanitizeSalesReply(
    'Есть несколько вариантов. '
      + 'Какой цвет материала вам нужен?',
  )

  assert.match(reply, /Какой цвет материала вам нужен\?$/u)
})

test('puts numbered recommendations on separate lines', () => {
  const reply = sanitizeSalesReply(
    '1. **Vip Black** — 393 ₽. '
      + '2. **Andas Black** — 437 ₽. '
      + '3. **Soft Black** — 437 ₽.',
  )

  assert.match(reply, /\n2\. Andas/u)
  assert.match(reply, /\n3\. Soft/u)
  assert.doesNotMatch(reply, /\*\*/u)
})

test('removes generic product-interest closing', () => {
  const reply = sanitizeSalesReply(
    '1. **Vip Black** — 393 ₽. '
      + 'Если вас интересует какой-то из этих товаров, '
      + 'дайте знать, и я помогу с дальнейшими шагами.',
  )

  assert.equal(reply, '1. Vip Black — 393 ₽.')
})

test('puts two-digit numbered steps on a new line', () => {
  const reply = sanitizeSalesReply(
    '9. Размещение партии. '
      + '10. Согласование срока запуска.',
  )

  assert.match(
    reply,
    /9\. Размещение партии\.\n10\. Согласование/u,
  )
})

test('softens standalone ideal-for wording', () => {
  const reply = sanitizeSalesReply(
    'Full Vegetale Chestnut идеальна для одежды и аксессуаров.',
  )
  assert.doesNotMatch(reply, /идеальн/iu)
  assert.match(reply, /подходит для одежды и аксессуаров/u)
  assert.equal(findSalesQualityViolations(reply).length, 0)
})

test('normalizes markdown formatting to plain text for web chat', () => {
  assert.equal(
    normalizeAssistantPlainText(
      '**Napato Black**\n- Цена: 437 ₽\n`фут²`',
    ),
    'Napato Black\n• Цена: 437 ₽\nфут²',
  )
})

test('sanitizeSalesReply does not expose markdown bold markers', () => {
  const result = sanitizeSalesReply(
    '**Napato Black** подходит по опубликованным характеристикам.',
  )

  assert.equal(
    result,
    'Napato Black подходит по опубликованным характеристикам.',
  )
})

test(
  'turns inline hyphen list items into readable bullet lines',
  () => {
    assert.equal(
      normalizeAssistantPlainText(
        'Доступны:\n• Самовывоз. - Курьерская доставка. - СДЭК.',
      ),
      'Доступны:\n• Самовывоз.\n• Курьерская доставка.\n• СДЭК.',
    )
  },
)

test(
  'keeps a street number on the same line after a comma',
  () => {
    assert.equal(
      normalizeAssistantPlainText(
        'Доставка: Казань, улица Дорожная,\n51.',
      ),
      'Доставка: Казань, улица Дорожная, 51.',
    )
  },
)
