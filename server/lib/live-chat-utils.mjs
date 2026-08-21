import crypto from 'node:crypto'

export function createPublicChatToken() {
  return crypto.randomBytes(32).toString('base64url')
}

export function hashPublicChatToken(token) {
  return crypto
    .createHash('sha256')
    .update(String(token ?? ''))
    .digest('hex')
}

export function normalizeChatContent(value) {
  return String(value ?? '')
    .replace(/\r\n/g, '\n')
    .trim()
    .slice(0, 4_000)
}

export function messagesAfterContextReset(messages) {
  const list = Array.isArray(messages) ? messages : []
  let resetIndex = -1

  for (let index = 0; index < list.length; index += 1) {
    if (
      list[index]?.role === 'system'
      && list[index]?.metadata?.type === 'context_reset'
    ) {
      resetIndex = index
    }
  }

  return list.slice(resetIndex + 1)
}

export function assistantHistory(messages) {
  return messages
    .filter(message => (
      message.role === 'user'
      || message.role === 'assistant'
      || message.role === 'manager'
    ))
    .slice(-20)
    .map(message => ({
      role: message.role === 'user' ? 'user' : 'assistant',
      content: String(message.content ?? ''),
    }))
}
