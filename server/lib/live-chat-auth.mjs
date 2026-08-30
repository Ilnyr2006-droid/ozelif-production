export const LIVE_CHAT_TOKEN_HEADER =
  'X-Ozelif-Live-Chat-Token'

export function readPublicToken(
  request,
) {
  const value =
    request?.get?.(
      LIVE_CHAT_TOKEN_HEADER,
    )
    ?? request?.headers
      ?.['x-ozelif-live-chat-token']
    ?? null

  const token =
    String(value ?? '').trim()

  return token || null
}

export function normalizeClientMessageId(
  value,
) {
  const text =
    String(value ?? '').trim()

  return /^[A-Za-z0-9_-]{8,160}$/
    .test(text)
      ? text
      : null
}
