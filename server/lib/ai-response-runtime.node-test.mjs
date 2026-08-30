import assert from 'node:assert/strict'
import test from 'node:test'

import {
  mergeOpenAiUsage,
  responseIncompleteReason,
  retryOutputTokenLimit,
  shouldRetryIncompleteResponse,
} from './ai-response-runtime.mjs'

test('aggregates usage across multiple OpenAI responses', () => {
  assert.deepEqual(
    mergeOpenAiUsage(
      {
        input_tokens: 100,
        output_tokens: 20,
        total_tokens: 120,
        input_tokens_details: {
          cached_tokens: 40,
        },
        output_tokens_details: {
          reasoning_tokens: 8,
        },
      },
      {
        input_tokens: 70,
        output_tokens: 30,
        total_tokens: 100,
        input_tokens_details: {
          cached_tokens: 20,
        },
        output_tokens_details: {
          reasoning_tokens: 10,
        },
      },
    ),
    {
      input_tokens: 170,
      output_tokens: 50,
      total_tokens: 220,
      input_tokens_details: {
        cached_tokens: 60,
      },
      output_tokens_details: {
        reasoning_tokens: 18,
      },
    },
  )
})

test('recognizes incomplete responses and increases retry budget', () => {
  const body = {
    status: 'incomplete',
    incomplete_details: {
      reason: 'max_output_tokens',
    },
  }

  assert.equal(
    shouldRetryIncompleteResponse(body),
    true,
  )
  assert.equal(
    responseIncompleteReason(body),
    'max_output_tokens',
  )
  assert.equal(
    retryOutputTokenLimit(520),
    900,
  )
})

test('completed response does not retry', () => {
  assert.equal(
    shouldRetryIncompleteResponse({
      status: 'completed',
      incomplete_details: null,
    }),
    false,
  )
})
