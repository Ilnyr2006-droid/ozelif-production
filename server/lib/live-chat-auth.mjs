export function readPublicToken(request) {
  const header = request.get('X-Ozelif-Live-Chat-Token')
  if (header) return header
  // Temporary compatibility for clients which have not moved to the header yet.
  return request.body?.token ?? request.query?.token ?? null
}

export function normalizeClientMessageId(value) {
  const text = String(value ?? '').trim()
  return /^[A-Za-z0-9_-]{8,160}$/.test(text) ? text : null
}
