import crypto from 'node:crypto'

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu

const DEFAULT_WINDOW_SECONDS = 10 * 60
const DEFAULT_CONVERSATION_LIMIT = 24
const DEFAULT_IP_LIMIT = 72

function positiveInteger(
  value,
  fallback,
) {
  const parsed = Number(value)

  return Number.isFinite(parsed)
    && parsed > 0
      ? Math.floor(parsed)
      : fallback
}

export function aiRateLimitConfig() {
  return {
    windowSeconds:
      positiveInteger(
        process.env
          .AI_RATE_LIMIT_WINDOW_SECONDS,
        DEFAULT_WINDOW_SECONDS,
      ),

    conversationLimit:
      positiveInteger(
        process.env
          .AI_RATE_LIMIT_CONVERSATION_REQUESTS,
        DEFAULT_CONVERSATION_LIMIT,
      ),

    ipLimit:
      positiveInteger(
        process.env
          .AI_RATE_LIMIT_IP_REQUESTS,
        DEFAULT_IP_LIMIT,
      ),
  }
}

export function normalizeAiRateLimitIp(
  value,
) {
  const text = String(value ?? '')
    .split(',')[0]
    .trim()
    .replace(/^::ffff:/iu, '')

  return text || 'unknown'
}

export function isLoopbackAiRateLimitIp(
  value,
) {
  const ip =
    normalizeAiRateLimitIp(value)

  return (
    ip === '127.0.0.1'
    || ip === '::1'
    || ip === 'localhost'
  )
}

export function requestAiRateLimitIp(
  request,
) {
  return normalizeAiRateLimitIp(
    request?.ip
      ?? request?.headers
        ?.['x-forwarded-for']
      ?? request?.socket
        ?.remoteAddress
      ?? 'unknown',
  )
}

function hashedBucketKey(
  type,
  value,
) {
  return crypto
    .createHash('sha256')
    .update(
      `ozelif-ai-rate-limit-v1:${type}:${value}`,
      'utf8',
    )
    .digest('hex')
}

function normalizedConversationId(
  value,
) {
  const text = String(value ?? '')
    .trim()
    .toLowerCase()

  return UUID_PATTERN.test(text)
    ? text
    : null
}

/*
 * Public web traffic gets two independent protections:
 * - one bucket for the live-chat conversation;
 * - one broader bucket for the real client IP.
 *
 * Telegram reaches /api/assistant through the local live-chat bridge.
 * For a loopback request with a valid conversation ID, only the
 * conversation bucket is used. This prevents every Telegram user from
 * sharing the same 127.0.0.1 counter.
 *
 * Local real-model evals may bypass the production limiter only when
 * BOTH conditions are true:
 * - X-Ozelif-Eval: 1;
 * - the actual request is loopback.
 * An external client cannot bypass the IP limit by spoofing the header.
 */
export function buildAiRateLimitPlan({
  conversationId,
  ip,
  evalRequest = false,
  config = aiRateLimitConfig(),
} = {}) {
  const normalizedIp =
    normalizeAiRateLimitIp(ip)

  const conversation =
    normalizedConversationId(
      conversationId,
    )

  const loopback =
    isLoopbackAiRateLimitIp(
      normalizedIp,
    )

  if (evalRequest && loopback) {
    return {
      bypass: true,
      reason: 'trusted_local_eval',
      buckets: [],
      config,
    }
  }

  const buckets = []

  if (conversation) {
    buckets.push({
      type: 'conversation',
      key:
        hashedBucketKey(
          'conversation',
          conversation,
        ),
      limit:
        config.conversationLimit,
    })
  }

  /*
   * Do not add the shared loopback IP bucket when an internal bridge
   * already supplied a real conversation. This is the Telegram fix.
   */
  if (
    normalizedIp !== 'unknown'
    && !(
      conversation
      && loopback
    )
  ) {
    buckets.push({
      type: 'ip',
      key:
        hashedBucketKey(
          'ip',
          normalizedIp,
        ),
      limit:
        config.ipLimit,
    })
  }

  /*
   * A local non-eval call without conversation identity is still limited.
   */
  if (!buckets.length) {
    buckets.push({
      type: 'ip',
      key:
        hashedBucketKey(
          'ip',
          normalizedIp,
        ),
      limit:
        config.ipLimit,
    })
  }

  return {
    bypass: false,
    reason: null,
    buckets,
    config,
  }
}

const CONSUME_BUCKET_SQL = `
  WITH cleanup AS (
    DELETE FROM ai_rate_limit_buckets
    WHERE expires_at <= now()
    RETURNING bucket_key
  ),
  consumed AS (
    INSERT INTO ai_rate_limit_buckets (
      bucket_key,
      bucket_type,
      window_started_at,
      request_count,
      expires_at,
      updated_at
    )
    VALUES (
      $1,
      $2,
      now(),
      1,
      now()
        + (
            $3::int
            * interval '1 second'
          ),
      now()
    )
    ON CONFLICT (bucket_key)
    DO UPDATE SET
      bucket_type =
        EXCLUDED.bucket_type,
      request_count =
        ai_rate_limit_buckets.request_count
        + 1,
      updated_at = now()
    RETURNING
      request_count,
      expires_at
  )
  SELECT
    request_count,
    GREATEST(
      1,
      CEIL(
        EXTRACT(
          EPOCH FROM (
            expires_at - now()
          )
        )
      )::int
    ) AS retry_after_seconds
  FROM consumed
`

export async function enforceAiRateLimit(
  queryFn,
  plan,
) {
  if (plan?.bypass) {
    return {
      allowed: true,
      bypass: true,
      blockedBy: null,
      retryAfterSeconds: 0,
      buckets: [],
    }
  }

  const buckets =
    Array.isArray(plan?.buckets)
      ? plan.buckets
      : []

  const windowSeconds =
    positiveInteger(
      plan?.config?.windowSeconds,
      DEFAULT_WINDOW_SECONDS,
    )

  const results = []

  for (const bucket of buckets) {
    const result =
      await queryFn(
        CONSUME_BUCKET_SQL,
        [
          bucket.key,
          bucket.type,
          windowSeconds,
        ],
      )

    const row =
      result.rows[0] ?? {}

    const count =
      Number(row.request_count ?? 0)

    const retryAfterSeconds =
      positiveInteger(
        row.retry_after_seconds,
        windowSeconds,
      )

    const allowed =
      Number.isFinite(count)
      && count <= bucket.limit

    results.push({
      ...bucket,
      count,
      allowed,
      retryAfterSeconds,
    })

    if (!allowed) {
      return {
        allowed: false,
        bypass: false,
        blockedBy:
          bucket.type,
        retryAfterSeconds,
        buckets: results,
      }
    }
  }

  return {
    allowed: true,
    bypass: false,
    blockedBy: null,
    retryAfterSeconds: 0,
    buckets: results,
  }
}
