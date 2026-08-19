function cleanChatId(value) {
  const text = String(value ?? '').trim()
  return /^-?\d+$/.test(text) ? text : null
}

export function adminTelegramRecipients(
  subscriptionRows = [],
  staticChatId = null,
) {
  const ids = new Set()

  for (const row of subscriptionRows) {
    const chatId = cleanChatId(
      row?.chat_id
      ?? row?.telegram_chat_id
      ?? row?.telegramChatId,
    )

    if (chatId) {
      ids.add(chatId)
    }
  }

  const configured = cleanChatId(staticChatId)
  if (configured) {
    ids.add(configured)
  }

  return [...ids].map(chatId => ({
    chat_id: chatId,
  }))
}
