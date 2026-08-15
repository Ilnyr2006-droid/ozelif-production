import assert from 'node:assert/strict'
import test from 'node:test'
import { deprecatedApi } from './api-deprecation.mjs'

test('marks a legacy API response without changing its handler flow', () => {
  const headers = new Map()
  let nextCalls = 0

  deprecatedApi({ successor: '/api/admin/v5/products' })(
    {},
    { setHeader: (name, value) => headers.set(name, value) },
    () => { nextCalls += 1 },
  )

  assert.equal(headers.get('Deprecation'), 'true')
  assert.equal(headers.get('Link'), '</api/admin/v5/products>; rel="successor-version"')
  assert.equal(headers.get('Cache-Control'), 'no-store')
  assert.equal(nextCalls, 1)
})
