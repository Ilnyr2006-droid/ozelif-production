import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { pool } from '../lib/db.mjs'

const dir = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../sql',
)

try {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      name text PRIMARY KEY,
      applied_at timestamptz NOT NULL DEFAULT now()
    )
  `)

  const files = (await fs.readdir(dir))
    .filter(name => name.endsWith('.sql'))
    .sort()

  for (const name of files) {
    const applied = await pool.query(
      'SELECT 1 FROM schema_migrations WHERE name = $1',
      [name],
    )

    if (applied.rowCount) {
      console.log(`skip ${name}`)
      continue
    }

    const sql = await fs.readFile(path.join(dir, name), 'utf8')
    const client = await pool.connect()

    try {
      await client.query('BEGIN')
      await client.query(sql)
      await client.query(
        'INSERT INTO schema_migrations (name) VALUES ($1)',
        [name],
      )
      await client.query('COMMIT')
      console.log(`applied ${name}`)
    } catch (error) {
      await client.query('ROLLBACK')
      throw error
    } finally {
      client.release()
    }
  }
} finally {
  await pool.end()
}
