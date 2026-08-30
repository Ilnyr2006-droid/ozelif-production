import express from 'express'

import {
  requireAdmin,
} from '../lib/admin-auth.mjs'
import { query } from '../lib/db.mjs'

function daysValue(value) {
  const number = Number(value)

  if (!Number.isFinite(number)) {
    return 30
  }

  return Math.min(
    90,
    Math.max(
      1,
      Math.floor(number),
    ),
  )
}

function number(value) {
  const parsed = Number(value)
  return Number.isFinite(parsed)
    ? parsed
    : 0
}

function rate(part, total) {
  return total > 0
    ? Math.round(
        part / total * 10_000,
      ) / 100
    : 0
}

export function createAdminAiMonitoringRouter() {
  const router = express.Router()

  router.use(requireAdmin)

  router.get(
    '/',
    async (
      request,
      response,
      next,
    ) => {
      try {
        const days =
          daysValue(
            request.query.days,
          )

        const [
          runtime,
          models,
          daily,
          funnel,
          latestEval,
          latestEvalFailures,
        ] = await Promise.all([
          query(
            `SELECT
               COUNT(*)::int AS requests,
               COUNT(*) FILTER (
                 WHERE fallback
               )::int AS fallbacks,
               COUNT(*) FILTER (
                 WHERE empty_retry_count > 0
               )::int AS empty_retries,
               COUNT(*) FILTER (
                 WHERE incomplete_retry_count > 0
               )::int AS incomplete_retries,
               COALESCE(
                 AVG(latency_ms),
                 0
               ) AS avg_latency_ms,
               COALESCE(
                 percentile_cont(0.95)
                   WITHIN GROUP (
                     ORDER BY latency_ms
                   ),
                 0
               ) AS p95_latency_ms,
               COALESCE(
                 SUM(input_tokens),
                 0
               ) AS input_tokens,
               COALESCE(
                 SUM(cached_input_tokens),
                 0
               ) AS cached_input_tokens,
               COALESCE(
                 SUM(output_tokens),
                 0
               ) AS output_tokens,
               COALESCE(
                 SUM(reasoning_tokens),
                 0
               ) AS reasoning_tokens,
               COALESCE(
                 SUM(total_tokens),
                 0
               ) AS total_tokens,
               COALESCE(
                 SUM(estimated_cost_usd),
                 0
               ) AS estimated_cost_usd,
               COUNT(*) FILTER (
                 WHERE recommendation_count > 0
               )::int AS recommendation_responses,
               COUNT(DISTINCT conversation_id)
                 FILTER (
                   WHERE conversation_id IS NOT NULL
                 )::int AS conversations
             FROM ai_runtime_events
             WHERE created_at >=
               now() - ($1::int || ' days')::interval
               AND channel <> 'eval'`,
            [days],
          ),

          query(
            `SELECT
               model,
               prompt_version,
               channel,
               COUNT(*)::int AS requests
             FROM ai_runtime_events
             WHERE created_at >=
               now() - ($1::int || ' days')::interval
               AND channel <> 'eval'
             GROUP BY
               model,
               prompt_version,
               channel
             ORDER BY requests DESC`,
            [days],
          ),

          query(
            `WITH dates AS (
               SELECT generate_series(
                 CURRENT_DATE - ($1::int - 1),
                 CURRENT_DATE,
                 interval '1 day'
               )::date AS day
             ),
             totals AS (
               SELECT
                 created_at::date AS day,
                 COUNT(*)::int AS requests,
                 COALESCE(
                   AVG(latency_ms),
                   0
                 ) AS latency_ms,
                 COALESCE(
                   SUM(estimated_cost_usd),
                   0
                 ) AS cost_usd
               FROM ai_runtime_events
               WHERE created_at >=
                 CURRENT_DATE - ($1::int - 1)
                 AND channel <> 'eval'
               GROUP BY created_at::date
             )
             SELECT
               dates.day,
               COALESCE(
                 totals.requests,
                 0
               )::int AS requests,
               COALESCE(
                 totals.latency_ms,
                 0
               ) AS latency_ms,
               COALESCE(
                 totals.cost_usd,
                 0
               ) AS cost_usd
             FROM dates
             LEFT JOIN totals
               ON totals.day = dates.day
             ORDER BY dates.day`,
            [days],
          ),

          query(
            `WITH ai_conversations AS (
               SELECT DISTINCT conversation_id
               FROM ai_runtime_events
               WHERE created_at >=
                 now() - ($1::int || ' days')::interval
                 AND channel <> 'eval'
                 AND conversation_id IS NOT NULL
             )
             SELECT
               COUNT(*)::int AS conversations,
               COUNT(*) FILTER (
                 WHERE c.recommendation_clicked_at
                   IS NOT NULL
               )::int AS clicked,
               COUNT(*) FILTER (
                 WHERE c.contact_captured_at
                   IS NOT NULL
               )::int AS contacts,
               COUNT(*) FILTER (
                 WHERE c.manager_requested_at
                   IS NOT NULL
               )::int AS manager_requests,
               COUNT(*) FILTER (
                 WHERE EXISTS (
                   SELECT 1
                   FROM orders o
                   WHERE o.source = 'ai_chat'
                     AND o.idempotency_key LIKE
                       'ai-chat:'
                       || c.id::text
                       || ':%'
                 )
               )::int AS orders
             FROM ai_conversations ac
             JOIN live_chat_conversations c
               ON c.id = ac.conversation_id`,
            [days],
          ),

          query(
            `SELECT
               id,
               status,
               model,
               prompt_version,
               commit_sha,
               scenario_count,
               passed_count,
               failed_count,
               avg_latency_ms,
               input_tokens,
               output_tokens,
               estimated_cost_usd,
               started_at,
               completed_at
             FROM ai_eval_runs
             ORDER BY started_at DESC
             LIMIT 1`,
          ),

          query(
            `SELECT
               scenario_key,
               category,
               reply,
               checks,
               latency_ms
             FROM ai_eval_results
             WHERE run_id = (
               SELECT id
               FROM ai_eval_runs
               ORDER BY started_at DESC
               LIMIT 1
             )
               AND passed = false
             ORDER BY id
             LIMIT 10`,
          ),
        ])

        const summary =
          runtime.rows[0] ?? {}
        const conversion =
          funnel.rows[0] ?? {}

        const requests =
          number(summary.requests)
        const conversations =
          number(
            conversion.conversations,
          )

        response.setHeader(
          'Cache-Control',
          'no-store, private',
        )

        response.json({
          periodDays: days,

          runtime: {
            requests,
            fallbacks:
              number(summary.fallbacks),
            fallbackRate:
              rate(
                number(summary.fallbacks),
                requests,
              ),
            emptyRetries:
              number(summary.empty_retries),
            incompleteRetries:
              number(
                summary.incomplete_retries,
              ),
            averageLatencyMs:
              number(
                summary.avg_latency_ms,
              ),
            p95LatencyMs:
              number(
                summary.p95_latency_ms,
              ),
            inputTokens:
              number(
                summary.input_tokens,
              ),
            cachedInputTokens:
              number(
                summary.cached_input_tokens,
              ),
            outputTokens:
              number(
                summary.output_tokens,
              ),
            reasoningTokens:
              number(
                summary.reasoning_tokens,
              ),
            totalTokens:
              number(
                summary.total_tokens,
              ),
            estimatedCostUsd:
              number(
                summary.estimated_cost_usd,
              ),
            recommendationResponses:
              number(
                summary
                  .recommendation_responses,
              ),
            recommendationRate:
              rate(
                number(
                  summary
                    .recommendation_responses,
                ),
                requests,
              ),
          },

          funnel: {
            conversations,
            recommendationClicks:
              number(conversion.clicked),
            recommendationClickRate:
              rate(
                number(conversion.clicked),
                conversations,
              ),
            contacts:
              number(conversion.contacts),
            contactRate:
              rate(
                number(conversion.contacts),
                conversations,
              ),
            managerRequests:
              number(
                conversion.manager_requests,
              ),
            managerRequestRate:
              rate(
                number(
                  conversion.manager_requests,
                ),
                conversations,
              ),
            orders:
              number(conversion.orders),
            orderRate:
              rate(
                number(conversion.orders),
                conversations,
              ),
          },

          models:
            models.rows.map(row => ({
              model:
                row.model ?? 'unknown',
              promptVersion:
                row.prompt_version == null
                  ? null
                  : number(
                      row.prompt_version,
                    ),
              channel:
                row.channel,
              requests:
                number(row.requests),
            })),

          daily:
            daily.rows.map(row => ({
              date: row.day,
              requests:
                number(row.requests),
              averageLatencyMs:
                number(row.latency_ms),
              estimatedCostUsd:
                number(row.cost_usd),
            })),

          latestEval:
            latestEval.rows[0]
              ?? null,

          latestEvalFailures:
            latestEvalFailures.rows,
        })
      } catch (error) {
        next(error)
      }
    },
  )

  return router
}
