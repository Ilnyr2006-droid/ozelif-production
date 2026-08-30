import assert from 'node:assert/strict'
import test from 'node:test'

import {
  estimateAiCostUsd,
  normalizedAiUsage,
  publishedPromptIdentity,
  recordAiRuntimeEvent,
  resetPromptIdentityCache,
} from './ai-runtime-monitoring.mjs'

test('normalizes Responses API usage', () => {
  assert.deepEqual(
    normalizedAiUsage({
      input_tokens: 7000,
      output_tokens: 300,
      total_tokens: 7300,
      input_tokens_details: {
        cached_tokens: 2000,
      },
      output_tokens_details: {
        reasoning_tokens: 80,
      },
    }),
    {
      inputTokens: 7000,
      cachedInputTokens: 2000,
      outputTokens: 300,
      reasoningTokens: 80,
      totalTokens: 7300,
    },
  )
})

test('estimates cost using uncached, cached and output tokens', () => {
  const cost =
    estimateAiCostUsd({
      input_tokens: 7000,
      output_tokens: 300,
      input_tokens_details: {
        cached_tokens: 2000,
      },
    })

  assert.ok(cost > 0)
  assert.ok(cost < 0.01)
})

test('published prompt identity is cached', async () => {
  resetPromptIdentityCache()

  let calls = 0

  const queryFn = async () => {
    calls += 1
    return {
      rows: [{
        id:
          '11111111-1111-4111-8111-111111111111',
        version: '42',
      }],
    }
  }

  const first =
    await publishedPromptIdentity(
      queryFn,
      { now: 1000 },
    )

  const second =
    await publishedPromptIdentity(
      queryFn,
      { now: 2000 },
    )

  assert.equal(first.version, 42)
  assert.equal(second.version, 42)
  assert.equal(calls, 1)
})

test('records normalized runtime event', async () => {
  resetPromptIdentityCache()

  const calls = []

  const queryFn = async (
    sql,
    params,
  ) => {
    calls.push({ sql, params })

    if (
      sql.includes(
        'FROM ai_prompt_versions',
      )
    ) {
      return {
        rows: [{
          id:
            '11111111-1111-4111-8111-111111111111',
          version: '7',
        }],
      }
    }

    return {
      rows: [],
    }
  }

  const result =
    await recordAiRuntimeEvent(
      queryFn,
      {
        model:
          'gpt-5.6-luna',
        intent:
          'product',
        catalogSearch:
          true,
        latencyMs:
          1234,
        usage: {
          input_tokens:
            100,
          output_tokens:
            20,
          total_tokens:
            120,
        },
        recommendationCount:
          3,
      },
    )

  assert.equal(result.ok, true)

  const insert =
    calls.find(call => (
      call.sql.includes(
        'INSERT INTO ai_runtime_events',
      )
    ))

  assert.ok(insert)
  assert.equal(insert.params[4], 7)
  assert.equal(insert.params[8], 1234)
  assert.equal(insert.params[18], 3)
})
