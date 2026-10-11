
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  getFallbackAiPrompt,
  getPublishedAiPrompt,
} from './ai-prompt-store.mjs'
import { routeBusinessPrompt } from './ai-prompt-routing.mjs'

const currentDirectory = path.dirname(fileURLToPath(import.meta.url))
const corePath = path.resolve(
  currentDirectory,
  '../prompts/ozelif-assistant-core.md',
)

const protectedCore = fs.readFileSync(corePath, 'utf8').trim()

export function getMoscowWorkingHoursContext(now = new Date()) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('ru-RU', {
      timeZone: 'Europe/Moscow',
      weekday: 'long',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    }).formatToParts(now).map(({ type, value }) => [type, value]),
  )
  const weekday = parts.weekday
  const weekend = weekday === 'суббота' || weekday === 'воскресенье'
  const minutes = Number(parts.hour) * 60 + Number(parts.minute)
  const withinHours = !weekend && minutes >= 10 * 60 && minutes < 18 * 60
  const regularStatus = weekend
    ? 'Сегодня по обычному графику выходной.'
    : withinHours
      ? 'Сейчас по обычному графику рабочее время.'
      : 'Сейчас по обычному графику нерабочее время.'

  return [
    'Магазин и склад OZELIF: понедельник–пятница, 10:00–18:00 по московскому времени.',
    'Суббота и воскресенье — выходные по обычному графику.',
    `Сейчас в Москве: ${weekday}, ${parts.day}.${parts.month}.${parts.year}, ${parts.hour}:${parts.minute}. ${regularStatus}`,
    'Праздничные изменения графика не подтверждены. Перед визитом в праздничный день посоветуй уточнить часы у менеджера.',
  ].join('\n')
}

export async function buildOzelifAssistantInstructions({
  pathname = '/',
  intentType = null,
} = {}) {
  const safePath = String(pathname || '/').slice(0, 300)
  const published = await getPublishedAiPrompt()
  const routed = routeBusinessPrompt(
    published.content,
    intentType,
  )

  return [
    protectedCore,
    '',
    '# РЕДАКТИРУЕМЫЙ БИЗНЕС-ПРОМПТ',
    routed.content,
    '',
    '# КОНТЕКСТ ТЕКУЩЕГО ЗАПРОСА',
    `Текущая страница сайта: ${safePath}`,
    getMoscowWorkingHoursContext(),
  ].join('\n')
}

export function getOzelifAssistantPrompt() {
  return getFallbackAiPrompt()
}

export function getProtectedAiPromptCore() {
  return protectedCore
}
