import { contacts, telegram, whatsapp } from '../data'

export type AssistantRole = 'assistant' | 'user'

export type AssistantAction = {
  label: string
  href: string
}

export type AssistantMessage = {
  id: string
  role: AssistantRole
  content: string
  timestamp: string
  actions?: AssistantAction[]
}

export type AssistantReply = Pick<AssistantMessage, 'content' | 'actions'>

type AssistantApiReply = {
  reply: string
  actions?: AssistantAction[]
}

export const AI_ASSISTANT_STORAGE_KEY = 'ozelif-ai-chat-v1'
export const AI_ASSISTANT_MAX_MESSAGES = 30
export const AI_ASSISTANT_MAX_MESSAGE_LENGTH = 1000

export const AI_ASSISTANT_RULES = `
Отвечай по-русски, кратко и полезно. Помогай выбрать материал по назначению,
цвету, толщине и типу сырья. Используй только подтверждённые данные сайта OZELIF.
Не выдумывай наличие, цены, сроки, характеристики или дату доставки. При сомнении
направляй к менеджеру. Не собирай лишние персональные данные.
`.trim()

export const welcomeMessage = (): AssistantMessage => ({
  id: 'welcome',
  role: 'assistant',
  timestamp: new Date().toISOString(),
  content: 'Здравствуйте! Я AI-ассистент OZELIF. Помогу подобрать натуральную кожу или дублёночный материал, расскажу о доставке, оплате и контактах. Что вы ищете?',
})

export const quickQuestions = [
  'Подобрать кожу для одежды',
  'Подобрать дублёночный материал',
  'Условия доставки',
  'Связаться с менеджером',
]

const managerActions: AssistantAction[] = [
  { label: 'WhatsApp', href: whatsapp },
  { label: 'Telegram', href: telegram },
  { label: 'Контакты', href: '/contacts' },
]

export function getLocalAssistantReply(question: string): AssistantReply {
  const normalized = question.toLowerCase()

  if (/(дубл|меринос|тоскана|керли|мех)/.test(normalized)) {
    return {
      content: 'В каталоге есть дублёночный материал разных типов. Откройте раздел, а для подбора по изделию, цвету и фактуре напишите менеджеру.',
      actions: [{ label: 'Дублёночный материал', href: '/dublyonka' }, ...managerActions],
    }
  }

  if (/(достав|оплат|самовывоз|сдэк|сdek|курьер)/.test(normalized)) {
    return {
      content: 'Доступны самовывоз в Москве, курьерская доставка по Москве от 350 ₽ и отправка СДЭК по России и в другие страны. Для регионов применяется предоплата. Условия для конкретного заказа уточнит менеджер.',
      actions: [{ label: 'Доставка и оплата', href: '/delivery' }, ...managerActions],
    }
  }

  if (/(контакт|менеджер|телефон|ватсап|whatsapp|telegram|телеграм)/.test(normalized)) {
    const managers = contacts.slice(1).map(contact => `${contact.name}: ${contact.phone}`).join('; ')
    return {
      content: `Связаться с менеджерами OZELIF: ${managers}. Выберите удобный способ связи или откройте страницу контактов.`,
      actions: managerActions,
    }
  }

  if (/(опт|оптов|парт|производств|бренд)/.test(normalized)) {
    return {
      content: 'OZELIF работает с розничными и оптовыми заказами. Условия зависят от вида материала и объёма партии; точные условия подскажет менеджер.',
      actions: [{ label: 'Оптовые условия', href: '/kozhaoptom' }, ...managerActions],
    }
  }

  if (/(швей|пошив|лекал|образец|коллекц)/.test(normalized)) {
    return {
      content: 'Для вопросов о швейном производстве откройте страницу направления или напишите менеджеру. Он уточнит задачу и подходящий материал.',
      actions: [{ label: 'Швейное производство', href: '/production' }, ...managerActions],
    }
  }

  if (/(кож|одежд|куртк|пальто|плащ|замш|галантер|обув)/.test(normalized)) {
    return {
      content: 'В разделе «Одежная кожа» можно посмотреть материалы для одежды, головных уборов и перчаток. Для точного выбора расскажите менеджеру о будущем изделии, цвете и нужной фактуре.',
      actions: [{ label: 'Одежная кожа', href: '/odejnayakozha' }, ...managerActions],
    }
  }

  return {
    content: 'Я пока не могу точно ответить на этот вопрос. Напишите менеджеру OZELIF — он поможет с подбором и наличием.',
    actions: managerActions,
  }
}

export async function requestAssistantReply(messages: AssistantMessage[], page: string): Promise<AssistantReply> {
  const controller = new AbortController()
  const timeout = window.setTimeout(() => controller.abort(), 15_000)

  try {
    const response = await fetch('/api/assistant', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({
        messages: messages.map(({ role, content }) => ({ role, content })),
        page,
      }),
    })

    if (!response.ok) throw new Error(`Assistant endpoint returned ${response.status}`)
    const payload: unknown = await response.json()
    if (!isAssistantApiReply(payload)) throw new Error('Assistant endpoint returned invalid JSON')
    return { content: payload.reply, actions: payload.actions }
  } finally {
    window.clearTimeout(timeout)
  }
}

function isAssistantApiReply(payload: unknown): payload is AssistantApiReply {
  if (!payload || typeof payload !== 'object') return false
  const candidate = payload as { reply?: unknown; actions?: unknown }
  if (typeof candidate.reply !== 'string') return false
  if (candidate.actions !== undefined && (!Array.isArray(candidate.actions) || candidate.actions.some(action => (
    !action || typeof action !== 'object' || typeof (action as AssistantAction).label !== 'string' || !isSafeAssistantHref((action as AssistantAction).href)
  )))) return false
  return true
}

function isSafeAssistantHref(href: unknown) {
  return typeof href === 'string' && (/^https:\/\//.test(href) || /^\/(odejnayakozha|dublyonka|delivery|contacts|production|kozhaoptom)(?:[/?#]|$)/.test(href))
}

export function createMessage(role: AssistantRole, content: string, actions?: AssistantAction[]): AssistantMessage {
  return { id: `${role}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, role, content, timestamp: new Date().toISOString(), actions }
}
