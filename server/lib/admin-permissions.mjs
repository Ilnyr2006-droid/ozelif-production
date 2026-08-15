export const ADMIN_ROLES = Object.freeze([
  'owner',
  'catalog_manager',
  'chat_manager',
  'content_editor',
  'viewer',
])

const permissionsByRole = Object.freeze({
  owner: ['*'],
  catalog_manager: ['catalog:read', 'catalog:write', 'catalog:delete', 'catalog:upload'],
  chat_manager: ['chat:read', 'chat:write', 'dashboard:read', 'crm:read'],
  content_editor: ['catalog:read', 'prompt:read', 'prompt:draft'],
  viewer: ['catalog:read', 'dashboard:read'],
})

export function hasPermission(role, permission) {
  const permissions = permissionsByRole[role] ?? []
  return permissions.includes('*') || permissions.includes(permission)
}

export function permissionsForRole(role) {
  return [...(permissionsByRole[role] ?? [])]
}
