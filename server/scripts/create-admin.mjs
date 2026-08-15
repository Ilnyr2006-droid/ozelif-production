
import readline from 'node:readline/promises'
import { stdin, stdout } from 'node:process'
import { pool } from '../lib/db.mjs'
import { hashPassword } from '../lib/security.mjs'
const rl = readline.createInterface({ input: stdin, output: stdout })
try {
  const email = (process.env.ADMIN_EMAIL ?? await rl.question('Email: ')).trim().toLowerCase()
  const name = (process.env.ADMIN_NAME ?? await rl.question('Имя: ')).trim() || 'Администратор'
  const password = process.env.ADMIN_PASSWORD ?? await rl.question('Пароль: ')
  const hash = await hashPassword(password)
  const result = await pool.query(`
    INSERT INTO admin_users (email, name, password_hash)
    VALUES ($1, $2, $3)
    ON CONFLICT (email) DO UPDATE SET
      name = excluded.name,
      password_hash = excluded.password_hash,
      is_active = true,
      updated_at = now()
    RETURNING id, email, name, role
  `, [email, name, hash])
  console.log(result.rows[0])
} finally {
  rl.close()
  await pool.end()
}
