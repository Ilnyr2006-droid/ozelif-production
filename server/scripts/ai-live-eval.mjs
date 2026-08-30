import fs from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { execFileSync } from 'node:child_process'

import '../lib/env.mjs'
import { query } from '../lib/db.mjs'

const __dirname =
  path.dirname(
    fileURLToPath(import.meta.url),
  )

const scenarioPath =
  path.resolve(
    __dirname,
    '../evals/ai-sales-scenarios.json',
  )

function argValue(name) {
  const prefix = `--${name}=`
  const item =
    process.argv.find(value =>
      value.startsWith(prefix),
    )

  return item
    ? item.slice(prefix.length)
    : null
}

const dryRun =
  process.argv.includes('--dry-run')

const limitValue =
  Number(argValue('limit'))

const limit =
  Number.isFinite(limitValue)
  && limitValue > 0
    ? Math.floor(limitValue)
    : null

const baseUrl =
  String(
    argValue('base-url')
    ?? process.env.AI_EVAL_BASE_URL
    ?? 'http://127.0.0.1:8093',
  ).replace(/\/+$/u, '')

function regex(value) {
  return new RegExp(
    String(value),
    'iu',
  )
}

function checksFor(
  scenario,
  body,
) {
  const reply =
    String(body?.reply ?? '')

  const expect =
    scenario.expect ?? {}

  const checks = []

  if (
    typeof expect.catalogSearch
      === 'boolean'
  ) {
    checks.push({
      name: 'catalogSearch',
      passed:
        Boolean(
          body?.meta?.catalogSearch,
        )
        === expect.catalogSearch,
      actual:
        body?.meta?.catalogSearch,
      expected:
        expect.catalogSearch,
    })
  }

  if (
    Number.isFinite(
      Number(expect.minProducts),
    )
  ) {
    checks.push({
      name: 'minProducts',
      passed:
        (
          Array.isArray(body?.products)
            ? body.products.length
            : 0
        )
        >= Number(expect.minProducts),
      actual:
        Array.isArray(body?.products)
          ? body.products.length
          : 0,
      expected:
        Number(expect.minProducts),
    })
  }

  for (
    const pattern
    of expect.mustMatch ?? []
  ) {
    checks.push({
      name:
        `mustMatch:${pattern}`,
      passed:
        regex(pattern).test(reply),
    })
  }

  for (
    const pattern
    of expect.mustNotMatch ?? []
  ) {
    checks.push({
      name:
        `mustNotMatch:${pattern}`,
      passed:
        !regex(pattern).test(reply),
    })
  }

  if (expect.orderDraftUpdate) {
    checks.push({
      name: 'orderDraftUpdate',
      passed:
        Boolean(
          body?.orderDraftUpdate,
        ),
    })
  }

  if (expect.profileUpdate) {
    checks.push({
      name: 'profileUpdate',
      passed:
        Boolean(
          body?.profileUpdate,
        ),
    })
  }

  checks.push({
    name: 'nonEmptyReply',
    passed:
      reply.trim().length > 0,
  })

  checks.push({
    name: 'noMarkdownBold',
    passed:
      !reply.includes('**'),
  })

  return checks
}

function usage(body) {
  return {
    input:
      Number(
        body?.meta?.usage
          ?.input_tokens
        ?? 0,
      ),
    output:
      Number(
        body?.meta?.usage
          ?.output_tokens
        ?? 0,
      ),
  }
}

function cost(body) {
  const input =
    usage(body).input
  const output =
    usage(body).output
  const cached =
    Number(
      body?.meta?.usage
        ?.input_tokens_details
        ?.cached_tokens
      ?? 0,
    )

  const uncached =
    Math.max(
      0,
      input - cached,
    )

  return (
    (
      uncached * 0.20
      + cached * 0.02
      + output * 1.20
    )
    / 1_000_000
  )
}

async function promptVersion() {
  const result =
    await query(
      `SELECT version
       FROM ai_prompt_versions
       WHERE status = 'published'
       ORDER BY published_at DESC NULLS LAST,
                created_at DESC
       LIMIT 1`,
    )

  return result.rows[0]?.version
    == null
      ? null
      : Number(
          result.rows[0].version,
        )
}

async function main() {
  const scenarios =
    JSON.parse(
      await fs.readFile(
        scenarioPath,
        'utf8',
      ),
    )

  const selected =
    limit
      ? scenarios.slice(0, limit)
      : scenarios

  console.log(
    `AI eval scenarios: ${scenarios.length}`,
  )
  console.log(
    `Selected: ${selected.length}`,
  )

  if (dryRun) {
    for (const item of selected) {
      if (
        !item.id
        || !item.category
        || !Array.isArray(
          item.messages,
        )
        || !item.messages.length
      ) {
        throw new Error(
          `Invalid scenario: ${
            item.id ?? 'unknown'
          }`,
        )
      }
    }

    console.log(
      'DRY_RUN=OK',
    )
    return
  }

  let commitSha = null

  try {
    commitSha =
      execFileSync(
        'git',
        ['rev-parse', '--short', 'HEAD'],
        {
          cwd:
            path.resolve(
              __dirname,
              '../..',
            ),
          encoding:
            'utf8',
        },
      ).trim()
  } catch {
    // optional metadata
  }

  const version =
    await promptVersion()

  const run =
    (
      await query(
        `INSERT INTO ai_eval_runs (
           prompt_version,
           commit_sha,
           scenario_count
         )
         VALUES ($1, $2, $3)
         RETURNING id`,
        [
          version,
          commitSha,
          selected.length,
        ],
      )
    ).rows[0]

  const results = []

  try {
    for (const scenario of selected) {
      const started =
        performance.now()

      let body = null
      let requestError = null

      try {
        const response =
          await fetch(
            `${baseUrl}/api/assistant`,
            {
              method: 'POST',
              headers: {
                'Content-Type':
                  'application/json',
                'X-Ozelif-Eval':
                  '1',
                ...(scenario.liveChat
                  ? {
                      'X-Ozelif-Live-Chat':
                        '1',
                    }
                  : {}),
              },
              body:
                JSON.stringify({
                  messages:
                    scenario.messages,
                  message:
                    scenario.messages
                      .at(-1)
                      ?.content,
                  path:
                    scenario.path
                    ?? '/',
                  channel:
                    'eval',
                  orderDraft:
                    scenario.orderDraft
                    ?? null,
                  profile:
                    scenario.profile
                    ?? {},
                }),
              signal:
                AbortSignal.timeout(
                  60_000,
                ),
            },
          )

        const text =
          await response.text()

        if (!response.ok) {
          throw new Error(
            `HTTP ${response.status}: ${
              text.slice(0, 400)
            }`,
          )
        }

        body =
          JSON.parse(text)
      } catch (error) {
        requestError =
          error instanceof Error
            ? error.message
            : String(error)
      }

      const latency =
        Math.round(
          performance.now()
          - started,
        )

      const checks =
        requestError
          ? [{
              name:
                'request',
              passed:
                false,
              error:
                requestError,
            }]
          : checksFor(
              scenario,
              body,
            )

      const passed =
        checks.every(
          item => item.passed,
        )

      const item = {
        scenario,
        body,
        checks,
        passed,
        latency,
      }

      results.push(item)

      const currentUsage =
        usage(body)

      await query(
        `INSERT INTO ai_eval_results (
           run_id,
           scenario_key,
           category,
           passed,
           latency_ms,
           reply,
           checks,
           meta
         )
         VALUES (
           $1,
           $2,
           $3,
           $4,
           $5,
           $6,
           $7::jsonb,
           $8::jsonb
         )`,
        [
          run.id,
          scenario.id,
          scenario.category,
          passed,
          latency,
          body?.reply ?? null,
          JSON.stringify(checks),
          JSON.stringify(
            body?.meta ?? {},
          ),
        ],
      )

      console.log(
        `${
          passed ? 'PASS' : 'FAIL'
        } ${scenario.id}`
        + ` ${latency}ms`
        + ` in=${currentUsage.input}`
        + ` out=${currentUsage.output}`,
      )
    }

    const passed =
      results.filter(
        item => item.passed,
      ).length

    const failed =
      results.length - passed

    const avgLatency =
      results.length
        ? (
            results.reduce(
              (sum, item) =>
                sum + item.latency,
              0,
            )
            / results.length
          )
        : 0

    const totalInput =
      results.reduce(
        (sum, item) =>
          sum
          + usage(item.body).input,
        0,
      )

    const totalOutput =
      results.reduce(
        (sum, item) =>
          sum
          + usage(item.body).output,
        0,
      )

    const totalCost =
      results.reduce(
        (sum, item) =>
          sum + cost(item.body),
        0,
      )

    const firstModel =
      results.find(
        item =>
          item.body?.meta?.model,
      )
      ?.body?.meta?.model
      ?? null

    await query(
      `UPDATE ai_eval_runs
       SET
         status = $2,
         model = $3,
         passed_count = $4,
         failed_count = $5,
         avg_latency_ms = $6,
         input_tokens = $7,
         output_tokens = $8,
         estimated_cost_usd = $9,
         completed_at = now()
       WHERE id = $1`,
      [
        run.id,
        failed
          ? 'failed'
          : 'passed',
        firstModel,
        passed,
        failed,
        avgLatency,
        totalInput,
        totalOutput,
        totalCost,
      ],
    )

    console.log()
    console.log(
      `RESULT ${
        passed
      }/${results.length}`
    )
    console.log(
      `AVG_LATENCY_MS ${
        Math.round(avgLatency)
      }`,
    )
    console.log(
      `INPUT_TOKENS ${totalInput}`,
    )
    console.log(
      `OUTPUT_TOKENS ${totalOutput}`,
    )
    console.log(
      `ESTIMATED_COST_USD ${
        totalCost.toFixed(6)
      }`,
    )

    if (failed) {
      console.log()
      console.log('FAILED:')
      for (
        const item
        of results.filter(
          result => !result.passed,
        )
      ) {
        console.log(
          `- ${item.scenario.id}`,
        )
        for (
          const check
          of item.checks.filter(
            value => !value.passed,
          )
        ) {
          console.log(
            `  ${check.name}`,
          )
        }
      }

      process.exitCode = 1
    }
  } catch (error) {
    await query(
      `UPDATE ai_eval_runs
       SET
         status = 'aborted',
         completed_at = now()
       WHERE id = $1`,
      [run.id],
    )

    throw error
  }
}

await main()
