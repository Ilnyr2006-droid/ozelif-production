import assert from 'node:assert/strict'
import test from 'node:test'

process.env.DATABASE_URL ??= 'postgres://example:example@127.0.0.1:5432/example'
process.env.ADMIN_SESSION_SECRET ??= 'test-secret'

const { requirePermission } = await import('./admin-auth.mjs')

function responseRecorder() {
  return {
    statusCode: null,
    body: null,
    status(code) {
      this.statusCode = code
      return this
    },
    json(body) {
      this.body = body
      return this
    },
  }
}

test('returns 403 for an authenticated role without a required permission', async () => {
  const response = responseRecorder()
  let nextCalls = 0

  await requirePermission('pricing:write')(
    { admin: { id: 'test', role: 'catalog_manager' } },
    response,
    () => { nextCalls += 1 },
  )

  assert.equal(response.statusCode, 403)
  assert.deepEqual(response.body, { error: 'forbidden' })
  assert.equal(nextCalls, 0)
})

test('continues for a role with the required permission', async () => {
  const response = responseRecorder()
  let nextCalls = 0

  await requirePermission('catalog:write')(
    { admin: { id: 'test', role: 'catalog_manager' } },
    response,
    () => { nextCalls += 1 },
  )

  assert.equal(response.statusCode, null)
  assert.equal(nextCalls, 1)
})
