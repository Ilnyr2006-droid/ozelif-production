
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
  ].join('\n')
}

export function getOzelifAssistantPrompt() {
  return getFallbackAiPrompt()
}

export function getProtectedAiPromptCore() {
  return protectedCore
}
