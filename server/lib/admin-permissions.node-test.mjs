import assert from 'node:assert/strict'
import test from 'node:test'
import { ADMIN_ROLES, hasPermission, permissionsForRole } from './admin-permissions.mjs'

test('declares the supported admin roles', () => {
  assert.deepEqual(ADMIN_ROLES, [
    'owner', 'catalog_manager', 'chat_manager', 'content_editor', 'viewer',
  ])
})

test('grants permissions according to the role matrix', () => {
  assert.equal(hasPermission('owner', 'pricing:write'), true)
  assert.equal(hasPermission('catalog_manager', 'catalog:write'), true)
  assert.equal(hasPermission('catalog_manager', 'pricing:write'), false)
  assert.equal(hasPermission('chat_manager', 'chat:write'), true)
  assert.equal(hasPermission('chat_manager', 'catalog:delete'), false)
  assert.equal(hasPermission('content_editor', 'prompt:draft'), true)
  assert.equal(hasPermission('content_editor', 'prompt:publish'), false)
  assert.equal(hasPermission('viewer', 'dashboard:read'), true)
  assert.equal(hasPermission('viewer', 'catalog:write'), false)
  assert.equal(hasPermission('unknown', 'dashboard:read'), false)
  assert.deepEqual(permissionsForRole('unknown'), [])
})
