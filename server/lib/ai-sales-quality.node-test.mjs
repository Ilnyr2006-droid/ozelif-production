import assert from 'node:assert/strict'
import test from 'node:test'

import {
  findSalesQualityViolations,
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

  assert.match(reply, /\n2\. \*\*Andas/u)
  assert.match(reply, /\n3\. \*\*Soft/u)
})

test('removes generic product-interest closing', () => {
  const reply = sanitizeSalesReply(
    '1. **Vip Black** — 393 ₽. '
      + 'Если вас интересует какой-то из этих товаров, '
      + 'дайте знать, и я помогу с дальнейшими шагами.',
  )

  assert.equal(reply, '1. **Vip Black** — 393 ₽.')
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
