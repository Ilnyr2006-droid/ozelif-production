import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildConversionDecision,
  isExplicitManagerRequest,
  leadScore,
} from './ai-conversion.mjs'

test('does not ask for a phone on a greeting', () => {
  const result = buildConversionDecision({
    message: 'Привет',
    intentType: 'general',
    hasPhone: false,
    offerAlreadyShown: false,
  })

  assert.equal(result.shouldOfferContact, false)
  assert.equal(result.shouldRequestManager, false)
})

test('offers contact once for a strong wholesale request', () => {
  const result = buildConversionDecision({
    message: 'Нужно 1500 дм² кожи оптом',
    intentType: 'wholesale',
    hasPhone: false,
    offerAlreadyShown: false,
  })

  assert.equal(result.shouldOfferContact, true)
  assert.equal(result.offer?.type, 'contact')
  assert.ok(result.score >= 68)

  const repeated = buildConversionDecision({
    message: 'Нужно 1500 дм² кожи оптом',
    intentType: 'wholesale',
    hasPhone: false,
    offerAlreadyShown: true,
  })

  assert.equal(repeated.shouldOfferContact, false)
})

test('product browsing alone does not force contact capture', () => {
  const result = buildConversionDecision({
    message: 'Покажи коричневую замшу',
    intentType: 'product',
    hasPhone: false,
    offerAlreadyShown: false,
  })

  assert.equal(result.shouldOfferContact, false)
})

test('high-intent customer with saved phone is prioritized for manager', () => {
  const result = buildConversionDecision({
    message: 'Нужно сшить 20 кожаных курток',
    intentType: 'production',
    hasPhone: true,
  })

  assert.equal(result.shouldRequestManager, true)
  assert.equal(result.disableAiForHandoff, false)
})

test('explicit human request bypasses AI', () => {
  assert.equal(
    isExplicitManagerRequest(
      'Позовите менеджера, хочу поговорить с человеком',
    ),
    true,
  )

  const result = buildConversionDecision({
    message: 'Позовите менеджера, хочу поговорить с человеком',
    intentType: 'general',
    hasPhone: false,
  })

  assert.equal(result.shouldRequestManager, true)
  assert.equal(result.disableAiForHandoff, true)
  assert.equal(leadScore({
    message: 'Позовите менеджера',
    intentType: 'general',
  }), 100)
})
