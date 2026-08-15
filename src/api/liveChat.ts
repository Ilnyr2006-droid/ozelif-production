import { createClientId } from '../utils/clientId'

export type LiveChatMessage = { id: string; role: 'user' | 'assistant' | 'manager' | 'system'; content: string; createdAt: string; metadata?: Record<string, unknown> }
export type LiveConversation = {
  id: string
  status: 'open' | 'human' | 'closed'
  aiEnabled: boolean
  visitorName?: string | null
  visitorPhone?: string | null
  customerId?: string | null
}

type Session = { conversationId: string; token: string; conversation: LiveConversation }
const ID_KEY = 'ozelif_live_chat_id'; const TOKEN_KEY = 'ozelif_live_chat_token'; const VISITOR_KEY = 'ozelif_live_chat_visitor'
function visitorId() { const existing = localStorage.getItem(VISITOR_KEY); if (existing) return existing; const id = createClientId(); localStorage.setItem(VISITOR_KEY, id); return id }
async function json<T>(url: string, init: RequestInit = {}) { const response = await fetch(url, { ...init, headers: { Accept: 'application/json', ...(init.body ? { 'Content-Type': 'application/json' } : {}), ...(init.headers ?? {}) } }); const body = await response.json().catch(() => null); if (!response.ok) throw new Error(body?.error ?? `HTTP ${response.status}`); return body as T }
function headers(token: string) { return { 'X-Ozelif-Live-Chat-Token': token } }
export function resetLiveChatSession() {
  localStorage.removeItem(ID_KEY)
  localStorage.removeItem(TOKEN_KEY)
  localStorage.removeItem(VISITOR_KEY)
}

export function getStoredLiveChatReference() {
  const conversationId = localStorage.getItem(ID_KEY)
  const token = localStorage.getItem(TOKEN_KEY)

  if (!conversationId || !token) return null

  return {
    conversationId,
    token,
  }
}

export async function ensureLiveChatSession(): Promise<Session> { const result = await json<{ conversationId: string; token: string; conversation: LiveConversation }>('/api/live-chat/session', { method: 'POST', body: JSON.stringify({ conversationId: localStorage.getItem(ID_KEY), token: localStorage.getItem(TOKEN_KEY), visitorId: visitorId(), path: window.location.pathname }) }); localStorage.setItem(ID_KEY, result.conversationId); localStorage.setItem(TOKEN_KEY, result.token); return result }
export async function pollLiveChat(session: Session, after = 0) { return json<{ conversation: LiveConversation; messages: LiveChatMessage[] }>(`/api/live-chat/conversations/${encodeURIComponent(session.conversationId)}/messages?after=${after}`, { headers: headers(session.token) }) }
export async function sendLiveChatMessage(session: Session, content: string, assistantRequest?: unknown, clientMessageId = createClientId()) { return json<{ conversation: LiveConversation; userMessage: LiveChatMessage; assistant: { reply?: string; actions?: Array<{ label: string; href: string }>; message?: LiveChatMessage } | null; assistantError?: string | null; duplicate?: boolean }>(`/api/live-chat/conversations/${encodeURIComponent(session.conversationId)}/messages`, { method: 'POST', headers: headers(session.token), body: JSON.stringify({ content, path: window.location.pathname, assistantRequest, clientMessageId }) }) }
