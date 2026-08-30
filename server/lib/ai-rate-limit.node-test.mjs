import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildAiRateLimitPlan,
  enforceAiRateLimit,
  isLoopbackAiRateLimitIp,
  normalizeAiRateLimitIp,
} from './ai-rate-limit.mjs'

const conversationId =
  '11111111-1111-4111-8111-111111111111'

const config = {
  windowSeconds: 600,
  conversationLimit: 24,
  ipLimit: 72,
}

test(
  'web live chat is limited by conversation and real IP',
  () => {
    const plan =
      buildAiRateLimitPlan({
        conversationId,
        ip: '203.0.113.44',
        config,
      })

    assert.equal(
      plan.bypass,
      false,
    )

    assert.deepEqual(
      plan.buckets.map(
        bucket => bucket.type,
      ),
      [
        'conversation',
        'ip',
      ],
    )

    assert.equal(
      plan.buckets[0].limit,
      24,
    )

    assert.equal(
      plan.buckets[1].limit,
      72,
    )
  },
)

test(
  'Telegram loopback users do not share one IP bucket',
  () => {
    const first =
      buildAiRateLimitPlan({
        conversationId:
          '11111111-1111-4111-8111-111111111111',
        ip: '127.0.0.1',
        config,
      })

    const second =
      buildAiRateLimitPlan({
        conversationId:
          '22222222-2222-4222-8222-222222222222',
        ip: '::ffff:127.0.0.1',
        config,
      })

    assert.deepEqual(
      first.buckets.map(
        bucket => bucket.type,
      ),
      ['conversation'],
    )

    assert.deepEqual(
      second.buckets.map(
        bucket => bucket.type,
      ),
      ['conversation'],
    )

    assert.notEqual(
      first.buckets[0].key,
      second.buckets[0].key,
    )
  },
)

test(
  'only local eval can bypass the limiter',
  () => {
    assert.equal(
      buildAiRateLimitPlan({
        conversationId: null,
        ip: '127.0.0.1',
        evalRequest: true,
        config,
      }).bypass,
      true,
    )

    const external =
      buildAiRateLimitPlan({
        conversationId,
        ip: '203.0.113.55',
        evalRequest: true,
        config,
      })

    assert.equal(
      external.bypass,
      false,
    )

    assert.deepEqual(
      external.buckets.map(
        bucket => bucket.type,
      ),
      [
        'conversation',
        'ip',
      ],
    )
  },
)

test(
  'normalizes loopback IPv4-mapped IPv6 addresses',
  () => {
    assert.equal(
      normalizeAiRateLimitIp(
        '::ffff:127.0.0.1',
      ),
      '127.0.0.1',
    )

    assert.equal(
      isLoopbackAiRateLimitIp(
        '::ffff:127.0.0.1',
      ),
      true,
    )
  },
)

test(
  'persistent limiter blocks when a database bucket exceeds its limit',
  async () => {
    const plan =
      buildAiRateLimitPlan({
        conversationId,
        ip: '127.0.0.1',
        config: {
          ...config,
          conversationLimit: 2,
        },
      })

    let count = 0
    const queryFn =
      async (_sql, params) => {
        count += 1

        assert.equal(
          params[1],
          'conversation',
        )

        return {
          rows: [{
            request_count:
              count,
            retry_after_seconds:
              500,
          }],
        }
      }

    assert.equal(
      (
        await enforceAiRateLimit(
          queryFn,
          plan,
        )
      ).allowed,
      true,
    )

    assert.equal(
      (
        await enforceAiRateLimit(
          queryFn,
          plan,
        )
      ).allowed,
      true,
    )

    const blocked =
      await enforceAiRateLimit(
        queryFn,
        plan,
      )

    assert.equal(
      blocked.allowed,
      false,
    )

    assert.equal(
      blocked.blockedBy,
      'conversation',
    )

    assert.equal(
      blocked.retryAfterSeconds,
      500,
    )
  },
)
