
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { query } from './db.mjs'

const currentDirectory = path.dirname(fileURLToPath(import.meta.url))
const fallbackPath = path.resolve(
  currentDirectory,
  '../prompts/ozelif-assistant-system.md',
)

const fallbackPrompt = fs.readFileSync(fallbackPath, 'utf8').trim()

let cache = null
let cacheExpiresAt = 0
const CACHE_TTL_MS = 10_000

function cleanActor(value) {
  const text = String(value ?? '').trim()
  return text ? text.slice(0, 240) : null
}

function validateContent(value) {
  const content = String(value ?? '').trim()

  if (content.length < 500) {
    throw new Error('Промпт должен содержать минимум 500 символов.')
  }

  if (content.length > 60_000) {
    throw new Error('Промпт не должен превышать 60 000 символов.')
  }

  return content
}

export function getFallbackAiPrompt() {
  return fallbackPrompt
}

export function invalidateAiPromptCache() {
  cache = null
  cacheExpiresAt = 0
}

export async function ensureAiPromptSeed() {
  await query(
    `
      INSERT INTO ai_prompt_versions (
        status,
        content,
        notes,
        created_by,
        published_at
      )
      SELECT
        'published',
        $1,
        'Начальная версия из server/prompts/ozelif-assistant-system.md',
        'system',
        now()
      WHERE NOT EXISTS (
        SELECT 1
        FROM ai_prompt_versions
      )
    `,
    [fallbackPrompt],
  )
}

export async function getPublishedAiPrompt({
  force = false,
} = {}) {
  const now = Date.now()

  if (!force && cache && now < cacheExpiresAt) {
    return cache
  }

  try {
    await ensureAiPromptSeed()

    const result = await query(
      `
        SELECT
          id,
          version,
          status,
          content,
          notes,
          created_by AS "createdBy",
          created_at AS "createdAt",
          published_at AS "publishedAt"
        FROM ai_prompt_versions
        WHERE status = 'published'
        ORDER BY published_at DESC NULLS LAST, version DESC
        LIMIT 1
      `,
    )

    const published = result.rows[0]

    if (!published) {
      throw new Error('Published AI prompt was not found')
    }

    cache = published
    cacheExpiresAt = now + CACHE_TTL_MS
    return published
  } catch (error) {
    console.error(
      '[ai-prompt-store]',
      error instanceof Error ? error.message : error,
    )

    return {
      id: null,
      version: null,
      status: 'fallback',
      content: fallbackPrompt,
      notes: 'Файловый fallback',
      createdBy: 'system',
      createdAt: null,
      publishedAt: null,
    }
  }
}

export async function listAiPromptVersions(limit = 30) {
  await ensureAiPromptSeed()

  const safeLimit = Math.max(1, Math.min(Number(limit) || 30, 100))
  const result = await query(
    `
      SELECT
        id,
        version,
        status,
        content,
        notes,
        created_by AS "createdBy",
        created_at AS "createdAt",
        published_at AS "publishedAt",
        archived_at AS "archivedAt"
      FROM ai_prompt_versions
      ORDER BY version DESC
      LIMIT $1
    `,
    [safeLimit],
  )

  return result.rows
}

export async function createAiPromptDraft({
  content,
  notes,
  actor,
}) {
  const validated = validateContent(content)
  const result = await query(
    `
      WITH created AS (
        INSERT INTO ai_prompt_versions (
          status,
          content,
          notes,
          created_by
        )
        VALUES ('draft', $1, $2, $3)
        RETURNING *
      ),
      audit AS (
        INSERT INTO ai_prompt_audit_log (
          prompt_version_id,
          action,
          actor
        )
        SELECT id, 'draft_created', $3
        FROM created
      )
      SELECT
        id,
        version,
        status,
        content,
        notes,
        created_by AS "createdBy",
        created_at AS "createdAt"
      FROM created
    `,
    [
      validated,
      String(notes ?? '').trim().slice(0, 1_000) || null,
      cleanActor(actor),
    ],
  )

  return result.rows[0]
}

export async function publishAiPromptContent({
  content,
  notes,
  actor,
}) {
  const validated = validateContent(content)

  const result = await query(
    `
      WITH archived AS (
        UPDATE ai_prompt_versions
        SET
          status = 'archived',
          archived_at = now()
        WHERE status = 'published'
        RETURNING id
      ),
      created AS (
        INSERT INTO ai_prompt_versions (
          status,
          content,
          notes,
          created_by,
          published_at
        )
        VALUES ('published', $1, $2, $3, now())
        RETURNING *
      ),
      audit AS (
        INSERT INTO ai_prompt_audit_log (
          prompt_version_id,
          action,
          actor
        )
        SELECT id, 'published', $3
        FROM created
      )
      SELECT
        id,
        version,
        status,
        content,
        notes,
        created_by AS "createdBy",
        created_at AS "createdAt",
        published_at AS "publishedAt"
      FROM created
    `,
    [
      validated,
      String(notes ?? '').trim().slice(0, 1_000) || null,
      cleanActor(actor),
    ],
  )

  invalidateAiPromptCache()
  return result.rows[0]
}

export async function publishAiPromptVersion({
  versionId,
  actor,
}) {
  const result = await query(
    `
      WITH selected AS (
        SELECT id, content, notes
        FROM ai_prompt_versions
        WHERE id = $1
        LIMIT 1
      ),
      archived AS (
        UPDATE ai_prompt_versions
        SET
          status = 'archived',
          archived_at = now()
        WHERE status = 'published'
        RETURNING id
      ),
      published AS (
        UPDATE ai_prompt_versions
        SET
          status = 'published',
          published_at = now(),
          archived_at = NULL
        WHERE id = (SELECT id FROM selected)
        RETURNING *
      ),
      audit AS (
        INSERT INTO ai_prompt_audit_log (
          prompt_version_id,
          action,
          actor
        )
        SELECT id, 'published', $2
        FROM published
      )
      SELECT
        id,
        version,
        status,
        content,
        notes,
        created_by AS "createdBy",
        created_at AS "createdAt",
        published_at AS "publishedAt"
      FROM published
    `,
    [versionId, cleanActor(actor)],
  )

  if (!result.rowCount) {
    throw new Error('Версия промпта не найдена.')
  }

  invalidateAiPromptCache()
  return result.rows[0]
}

export async function rollbackAiPromptVersion({
  versionId,
  actor,
}) {
  const result = await query(
    `
      WITH selected AS (
        SELECT content, notes, version
        FROM ai_prompt_versions
        WHERE id = $1
        LIMIT 1
      ),
      archived AS (
        UPDATE ai_prompt_versions
        SET
          status = 'archived',
          archived_at = now()
        WHERE status = 'published'
        RETURNING id
      ),
      created AS (
        INSERT INTO ai_prompt_versions (
          status,
          content,
          notes,
          created_by,
          published_at
        )
        SELECT
          'published',
          content,
          concat('Откат к версии ', version),
          $2,
          now()
        FROM selected
        RETURNING *
      ),
      audit AS (
        INSERT INTO ai_prompt_audit_log (
          prompt_version_id,
          action,
          actor,
          metadata
        )
        SELECT
          id,
          'rollback_published',
          $2,
          jsonb_build_object('source_version_id', $1)
        FROM created
      )
      SELECT
        id,
        version,
        status,
        content,
        notes,
        created_by AS "createdBy",
        created_at AS "createdAt",
        published_at AS "publishedAt"
      FROM created
    `,
    [versionId, cleanActor(actor)],
  )

  if (!result.rowCount) {
    throw new Error('Версия для отката не найдена.')
  }

  invalidateAiPromptCache()
  return result.rows[0]
}
