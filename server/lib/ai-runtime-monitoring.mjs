const PROMPT_CACHE_MS = 60_000

let promptCache = {
  expiresAt: 0,
  value: {
    id: null,
    version: null,
  },
}

function finite(value) {
  const parsed = Number(value)
  return Number.isFinite(parsed)
    ? parsed
    : 0
}

function integer(value) {
  return Math.max(
    0,
    Math.round(finite(value)),
  )
}

export function normalizedAiUsage(value) {
  const usage =
    value
    && typeof value === 'object'
      ? value
      : {}

  return {
    inputTokens:
      integer(usage.input_tokens),
    cachedInputTokens:
      integer(
        usage
          ?.input_tokens_details
          ?.cached_tokens,
      ),
    outputTokens:
      integer(usage.output_tokens),
    reasoningTokens:
      integer(
        usage
          ?.output_tokens_details
          ?.reasoning_tokens,
      ),
    totalTokens:
      integer(usage.total_tokens),
  }
}

function envPrice(
  key,
  fallback,
) {
  const value =
    Number(process.env[key])

  return Number.isFinite(value)
    && value >= 0
      ? value
      : fallback
}

/*
 * Defaults follow the pricing supplied for the currently deployed Luna
 * model. They are environment-overridable so monitoring can be updated
 * without changing source code when model pricing changes.
 */
export function estimateAiCostUsd(usage) {
  const normalized =
    normalizedAiUsage(usage)

  const inputPerMillion =
    envPrice(
      'OPENAI_INPUT_USD_PER_MILLION',
      0.20,
    )

  const cachedPerMillion =
    envPrice(
      'OPENAI_CACHED_INPUT_USD_PER_MILLION',
      0.02,
    )

  const outputPerMillion =
    envPrice(
      'OPENAI_OUTPUT_USD_PER_MILLION',
      1.20,
    )

  const cached =
    Math.min(
      normalized.inputTokens,
      normalized.cachedInputTokens,
    )

  const uncached =
    Math.max(
      0,
      normalized.inputTokens - cached,
    )

  return (
    (
      uncached * inputPerMillion
      + cached * cachedPerMillion
      + normalized.outputTokens
        * outputPerMillion
    )
    / 1_000_000
  )
}

export async function publishedPromptIdentity(
  queryFn,
  {
    now = Date.now(),
  } = {},
) {
  if (
    promptCache.expiresAt > now
  ) {
    return promptCache.value
  }

  const result =
    await queryFn(
      `SELECT id, version
       FROM ai_prompt_versions
       WHERE status = 'published'
       ORDER BY published_at DESC NULLS LAST,
                created_at DESC
       LIMIT 1`,
    )

  const row =
    result.rows[0] ?? {}

  promptCache = {
    expiresAt:
      now + PROMPT_CACHE_MS,
    value: {
      id:
        row.id ?? null,
      version:
        row.version == null
          ? null
          : Number(row.version),
    },
  }

  return promptCache.value
}

export function resetPromptIdentityCache() {
  promptCache = {
    expiresAt: 0,
    value: {
      id: null,
      version: null,
    },
  }
}

export async function recordAiRuntimeEvent(
  queryFn,
  {
    conversationId = null,
    channel = 'web',
    model = null,
    prompt = null,
    responseId = null,
    intent = null,
    catalogSearch = false,
    latencyMs = 0,
    usage = null,
    fallback = false,
    emptyRetryCount = 0,
    incompleteRetryCount = 0,
    recommendationCount = 0,
    errorText = null,
    metadata = {},
  } = {},
) {
  try {
    const identity =
      prompt
      ?? await publishedPromptIdentity(
        queryFn,
      )

    const normalized =
      normalizedAiUsage(usage)

    const cost =
      estimateAiCostUsd(usage)

    await queryFn(
      `INSERT INTO ai_runtime_events (
         conversation_id,
         channel,
         model,
         prompt_version_id,
         prompt_version,
         response_id,
         intent,
         catalog_search,
         latency_ms,
         input_tokens,
         cached_input_tokens,
         output_tokens,
         reasoning_tokens,
         total_tokens,
         estimated_cost_usd,
         fallback,
         empty_retry_count,
         incomplete_retry_count,
         recommendation_count,
         error_text,
         metadata
       )
       VALUES (
         $1::uuid,
         $2,
         $3,
         $4::uuid,
         $5,
         $6,
         $7,
         $8,
         $9,
         $10,
         $11,
         $12,
         $13,
         $14,
         $15,
         $16,
         $17,
         $18,
         $19,
         $20,
         $21::jsonb
       )`,
      [
        conversationId || null,
        String(channel || 'web')
          .slice(0, 40),
        model || null,
        identity?.id || null,
        identity?.version ?? null,
        responseId || null,
        intent || null,
        Boolean(catalogSearch),
        integer(latencyMs),
        normalized.inputTokens,
        normalized.cachedInputTokens,
        normalized.outputTokens,
        normalized.reasoningTokens,
        normalized.totalTokens,
        cost,
        Boolean(fallback),
        integer(emptyRetryCount),
        integer(incompleteRetryCount),
        integer(recommendationCount),
        errorText
          ? String(errorText).slice(0, 1000)
          : null,
        JSON.stringify(
          metadata
          && typeof metadata === 'object'
            ? metadata
            : {},
        ),
      ],
    )

    return {
      ok: true,
      cost,
      usage: normalized,
      prompt: identity,
    }
  } catch (error) {
    console.error(
      '[ai-runtime-monitoring]',
      error instanceof Error
        ? error.message
        : error,
    )

    return {
      ok: false,
    }
  }
}
