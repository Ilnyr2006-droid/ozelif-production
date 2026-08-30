import fs from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import {
  fileURLToPath,
} from 'node:url'
import {
  execFileSync,
} from 'node:child_process'

import '../lib/env.mjs'
import {
  query,
} from '../lib/db.mjs'

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
    process.argv.find(
      value =>
        value.startsWith(prefix),
    )

  return item
    ? item.slice(prefix.length)
    : null
}

const dryRun =
  process.argv.includes(
    '--dry-run',
  )

const limitValue =
  Number(
    argValue('limit'),
  )

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

function productNames(body) {
  return (
    Array.isArray(body?.products)
      ? body.products
      : []
  )
    .map(
      product =>
        String(
          product?.name ?? '',
        ).trim(),
    )
    .filter(Boolean)
}

function orderOperations(body) {
  return Array.isArray(
    body?.orderDraftUpdate
      ?.operations,
  )
    ? body.orderDraftUpdate
        .operations
    : []
}

function checksFor(
  scenario,
  body,
  {
    bodies = [],
  } = {},
) {
  const reply =
    String(
      body?.reply ?? '',
    )

  const expect =
    scenario.expect ?? {}

  const checks = []
  const names =
    productNames(body)

  if (
    typeof expect.catalogSearch
      === 'boolean'
  ) {
    checks.push({
      name:
        'catalogSearch',
      passed:
        Boolean(
          body?.meta
            ?.catalogSearch,
        )
        === expect.catalogSearch,
      actual:
        body?.meta
          ?.catalogSearch,
      expected:
        expect.catalogSearch,
    })
  }

  if (
    typeof expect
      .contextualCatalogSearch
      === 'boolean'
  ) {
    checks.push({
      name:
        'contextualCatalogSearch',
      passed:
        Boolean(
          body?.meta
            ?.contextualCatalogSearch,
        )
        === expect
          .contextualCatalogSearch,
    })
  }

  if (
    Number.isFinite(
      Number(
        expect.minProducts,
      ),
    )
  ) {
    checks.push({
      name:
        'minProducts',
      passed:
        names.length
        >= Number(
          expect.minProducts,
        ),
      actual:
        names.length,
      expected:
        Number(
          expect.minProducts,
        ),
    })
  }

  if (
    Number.isFinite(
      Number(
        expect.maxProducts,
      ),
    )
  ) {
    checks.push({
      name:
        'maxProducts',
      passed:
        names.length
        <= Number(
          expect.maxProducts,
        ),
      actual:
        names.length,
      expected:
        Number(
          expect.maxProducts,
        ),
    })
  }

  for (
    const expectedName
    of expect.mustProducts ?? []
  ) {
    checks.push({
      name:
        `mustProduct:${expectedName}`,
      passed:
        names.some(
          name =>
            name
              .toLocaleLowerCase('ru')
            === String(
              expectedName,
            )
              .toLocaleLowerCase('ru'),
        ),
      actual:
        names,
    })
  }

  for (
    const forbiddenName
    of expect.mustNotProducts ?? []
  ) {
    checks.push({
      name:
        `mustNotProduct:${forbiddenName}`,
      passed:
        !names.some(
          name =>
            name
              .toLocaleLowerCase('ru')
            === String(
              forbiddenName,
            )
              .toLocaleLowerCase('ru'),
        ),
      actual:
        names,
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
        regex(pattern)
          .test(reply),
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
        !regex(pattern)
          .test(reply),
    })
  }

  if (
    expect.orderDraftUpdate
  ) {
    checks.push({
      name:
        'orderDraftUpdate',
      passed:
        Boolean(
          body?.orderDraftUpdate,
        ),
    })
  }

  if (
    Number.isFinite(
      Number(
        expect
          .minOrderOperations,
      ),
    )
  ) {
    checks.push({
      name:
        'minOrderOperations',
      passed:
        orderOperations(body)
          .length
        >= Number(
          expect
            .minOrderOperations,
        ),
      actual:
        orderOperations(body)
          .length,
      expected:
        Number(
          expect
            .minOrderOperations,
        ),
    })
  }

  if (
    expect.profileUpdate
  ) {
    checks.push({
      name:
        'profileUpdate',
      passed:
        Boolean(
          body?.profileUpdate,
        ),
    })
  }

  if (
    expect.referencePriorProduct
  ) {
    const priorBody =
      bodies.length >= 2
        ? bodies[
            bodies.length - 2
          ]
        : null

    const priorNames =
      productNames(priorBody)

    checks.push({
      name:
        'referencePriorProduct',
      passed:
        priorNames.length > 0
        && priorNames.some(
          name =>
            reply
              .toLocaleLowerCase('ru')
              .includes(
                name
                  .toLocaleLowerCase('ru'),
              ),
        ),
      actualPriorProducts:
        priorNames,
    })
  }

  checks.push({
    name:
      'nonEmptyReply',
    passed:
      reply.trim().length > 0,
  })

  checks.push({
    name:
      'noMarkdownBold',
    passed:
      !reply.includes('**'),
  })

  checks.push({
    name:
      'noInlineHyphenList',
    passed:
      !/[.;!?]\s+-\s+[\p{L}\p{N}]/u
        .test(reply),
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
    cached:
      Number(
        body?.meta?.usage
          ?.input_tokens_details
          ?.cached_tokens
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

function aggregateUsage(
  bodies,
) {
  return bodies.reduce(
    (result, body) => {
      const current =
        usage(body)

      result.input +=
        current.input
      result.cached +=
        current.cached
      result.output +=
        current.output

      return result
    },
    {
      input: 0,
      cached: 0,
      output: 0,
    },
  )
}

function costFromUsage(value) {
  const cached =
    Math.min(
      value.input,
      value.cached,
    )

  const uncached =
    Math.max(
      0,
      value.input - cached,
    )

  return (
    (
      uncached * 0.20
      + cached * 0.02
      + value.output * 1.20
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
       ORDER BY
         published_at DESC NULLS LAST,
         created_at DESC
       LIMIT 1`,
    )

  return (
    result.rows[0]?.version
      == null
      ? null
      : Number(
          result.rows[0].version,
        )
  )
}

function scenarioTurns(
  scenario,
) {
  if (
    Array.isArray(
      scenario.generatedTurns,
    )
    && scenario
      .generatedTurns
      .length
  ) {
    return scenario
      .generatedTurns
      .map(
        value =>
          String(
            value ?? '',
          ).trim(),
      )
      .filter(Boolean)
  }

  return null
}

async function callAssistant(
  scenario,
  messages,
) {
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
            messages,
            message:
              messages
                .filter(
                  item =>
                    item.role
                    === 'user',
                )
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

  return JSON.parse(text)
}

async function executeScenario(
  scenario,
) {
  const turns =
    scenarioTurns(
      scenario,
    )

  if (!turns) {
    const started =
      performance.now()

    const body =
      await callAssistant(
        scenario,
        scenario.messages,
      )

    return {
      body,
      bodies: [body],
      latency:
        Math.round(
          performance.now()
          - started,
        ),
      transcript:
        scenario.messages,
    }
  }

  const messages = []
  const bodies = []
  let latency = 0

  for (
    const userText
    of turns
  ) {
    messages.push({
      role: 'user',
      content: userText,
    })

    const started =
      performance.now()

    const body =
      await callAssistant(
        scenario,
        messages,
      )

    latency +=
      Math.round(
        performance.now()
        - started,
      )

    bodies.push(body)

    messages.push({
      role: 'assistant',
      content:
        String(
          body?.reply ?? '',
        ),
    })
  }

  return {
    body:
      bodies.at(-1)
      ?? null,
    bodies,
    latency,
    transcript:
      messages,
  }
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
      ? scenarios.slice(
          0,
          limit,
        )
      : scenarios

  console.log(
    `AI eval scenarios: ${
      scenarios.length
    }`,
  )

  console.log(
    `Selected: ${
      selected.length
    }`,
  )

  if (dryRun) {
    const ids = new Set()

    for (
      const item
      of selected
    ) {
      const turns =
        scenarioTurns(item)

      const validMessages =
        Array.isArray(
          item.messages,
        )
        && item.messages.length

      if (
        !item.id
        || !item.category
        || (
          !turns
          && !validMessages
        )
      ) {
        throw new Error(
          `Invalid scenario: ${
            item.id
            ?? 'unknown'
          }`,
        )
      }

      if (ids.has(item.id)) {
        throw new Error(
          `Duplicate scenario id: ${
            item.id
          }`,
        )
      }

      ids.add(item.id)
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
        [
          'rev-parse',
          '--short',
          'HEAD',
        ],
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
    for (
      const scenario
      of selected
    ) {
      let execution = null
      let requestError = null

      try {
        execution =
          await executeScenario(
            scenario,
          )
      } catch (error) {
        requestError =
          error
          instanceof Error
            ? error.message
            : String(error)
      }

      const body =
        execution?.body
        ?? null

      const bodies =
        execution?.bodies
        ?? []

      const latency =
        execution?.latency
        ?? 0

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
              {
                bodies,
              },
            )

      const passed =
        checks.every(
          item =>
            item.passed,
        )

      const scenarioUsage =
        aggregateUsage(
          bodies,
        )

      const item = {
        scenario,
        body,
        bodies,
        checks,
        passed,
        latency,
        usage:
          scenarioUsage,
        cost:
          costFromUsage(
            scenarioUsage,
          ),
      }

      results.push(item)

      const evalMeta = {
        ...(body?.meta ?? {}),
        evalTurns:
          bodies.map(
            (
              turnBody,
              index,
            ) => ({
              turn:
                index + 1,
              reply:
                turnBody
                  ?.reply
                ?? null,
              products:
                productNames(
                  turnBody,
                ),
              meta:
                turnBody
                  ?.meta
                ?? {},
            }),
          ),
      }

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
          body?.reply
            ?? null,
          JSON.stringify(
            checks,
          ),
          JSON.stringify(
            evalMeta,
          ),
        ],
      )

      console.log(
        `${
          passed
            ? 'PASS'
            : 'FAIL'
        } ${scenario.id}`
        + ` ${latency}ms`
        + ` turns=${
          bodies.length || 1
        }`
        + ` in=${
          scenarioUsage.input
        }`
        + ` out=${
          scenarioUsage.output
        }`,
      )
    }

    const passed =
      results.filter(
        item =>
          item.passed,
      ).length

    const failed =
      results.length
      - passed

    const avgLatency =
      results.length
        ? (
            results.reduce(
              (
                sum,
                item,
              ) =>
                sum
                + item.latency,
              0,
            )
            / results.length
          )
        : 0

    const totalInput =
      results.reduce(
        (
          sum,
          item,
        ) =>
          sum
          + item.usage.input,
        0,
      )

    const totalOutput =
      results.reduce(
        (
          sum,
          item,
        ) =>
          sum
          + item.usage.output,
        0,
      )

    const totalCost =
      results.reduce(
        (
          sum,
          item,
        ) =>
          sum
          + item.cost,
        0,
      )

    const firstModel =
      results.find(
        item =>
          item.body
            ?.meta
            ?.model,
      )
      ?.body
      ?.meta
      ?.model
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
      }/${
        results.length
      }`,
    )

    console.log(
      `AVG_LATENCY_MS ${
        Math.round(
          avgLatency,
        )
      }`,
    )

    console.log(
      `INPUT_TOKENS ${
        totalInput
      }`,
    )

    console.log(
      `OUTPUT_TOKENS ${
        totalOutput
      }`,
    )

    console.log(
      `ESTIMATED_COST_USD ${
        totalCost.toFixed(6)
      }`,
    )

    if (failed) {
      console.log()
      console.log(
        'FAILED:',
      )

      for (
        const item
        of results.filter(
          result =>
            !result.passed,
        )
      ) {
        console.log(
          `- ${
            item.scenario.id
          }`,
        )

        for (
          const check
          of item.checks.filter(
            value =>
              !value.passed,
          )
        ) {
          console.log(
            `  ${
              check.name
            }`,
          )

          if (
            check.actual
            !== undefined
          ) {
            console.log(
              `    actual=${
                JSON.stringify(
                  check.actual,
                )
              }`,
            )
          }

          if (
            check
              .actualPriorProducts
          ) {
            console.log(
              `    priorProducts=${
                JSON.stringify(
                  check
                    .actualPriorProducts,
                )
              }`,
            )
          }
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
      [
        run.id,
      ],
    )

    throw error
  }
}

await main()
