import pg from 'pg'
import { env } from './env.mjs'

const { Pool } = pg

export const pool = new Pool({
  connectionString: env.databaseUrl,
  max: 10,
})

// Idle pooled connections can fail independently of a query. Do not log connection details.
pool.on('error', () => console.error('PostgreSQL idle connection lost'))

export const query = (text, params = []) => pool.query(text, params)

export async function transaction(callback) {
  const client = await pool.connect()

  try {
    await client.query('BEGIN')
    const result = await callback(client)
    await client.query('COMMIT')
    return result
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
}

export async function closePool() {
  await pool.end()
}
