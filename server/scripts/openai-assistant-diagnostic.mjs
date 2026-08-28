import 'dotenv/config'
import { openAiRequest } from '../lib/openai-vector-store.mjs'

const preferred = [
  String(process.env.OPENAI_ASSISTANT_MODEL ?? '').trim(),
  String(process.env.OPENAI_MODEL ?? '').trim(),
  'gpt-5-mini',
  'gpt-4.1-mini',
  'gpt-4o-mini',
].filter(Boolean)

const modelsBody = await openAiRequest('/models')
const available = new Set(
  (modelsBody?.data ?? []).map(item => String(item?.id ?? '')),
)

const selectedModel = [...new Set(preferred)]
  .find(model => available.has(model))

if (!selectedModel) {
  throw new Error(
    `Нет доступной модели из списка: ${[...new Set(preferred)].join(', ')}`,
  )
}

const response = await openAiRequest('/responses', {
  method: 'POST',
  json: {
    model: selectedModel,
    store: false,
    instructions: 'Ответь одним словом: OK',
    input: 'Проверка соединения.',
    max_output_tokens: 160,
  },
  timeoutMs: 40_000,
})

const outputText = typeof response?.output_text === 'string'
  ? response.output_text
  : (response?.output ?? [])
      .flatMap(item => item?.content ?? [])
      .filter(item => item?.type === 'output_text')
      .map(item => item?.text ?? '')
      .join(' ')
      .trim()

if (!outputText) {
  throw new Error('Responses API вернул пустой текст')
}

console.log(JSON.stringify({
  ok: true,
  selectedModel,
  responseId: response.id ?? null,
  outputText,
  usage: response.usage ?? null,
}))
