import assert from 'node:assert/strict'
import { once } from 'node:events'
import test from 'node:test'
import express from 'express'

process.env.DATABASE_URL ??= 'postgres://example:example@127.0.0.1:5432/example'
process.env.ADMIN_SESSION_SECRET ??= 'test-secret'

const { createTelegramRouter } = await import('./telegram.mjs')

async function withServer(processOutbox, verify) {
  const app = express()
  app.use('/api/telegram', createTelegramRouter({ processOutbox }))
  const server = app.listen(0, '127.0.0.1')
  await once(server, 'listening')

  try {
    await verify(`http://127.0.0.1:${server.address().port}`)
  } finally {
    server.close()
    await once(server, 'close')
  }
}

test('does not allow an unauthenticated caller to process Telegram outbox', async () => {
  let processCalls = 0

  await withServer(async () => {
    processCalls += 1
    return { processed: 0 }
  }, async baseUrl => {
    const response = await fetch(`${baseUrl}/api/telegram/outbox/process`, { method: 'POST' })
    assert.equal(response.status, 401)
    assert.deepEqual(await response.json(), { error: 'unauthorized' })
  })

  assert.equal(processCalls, 0)
})
