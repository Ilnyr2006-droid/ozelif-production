import assert from 'node:assert/strict'
import test from 'node:test'

process.env.DATABASE_URL ??=
  'postgresql://ozelif_test:ozelif_test@127.0.0.1:1/ozelif_test'
process.env.ADMIN_SESSION_SECRET ??=
  'ozelif-test-secret-0123456789-abcdefghijklmnopqrstuvwxyz'

const {
  buildOzelifAssistantInstructions,
  getOzelifAssistantPrompt,
} = await import('./ai-system-prompt.mjs')

test('contains the required company knowledge', () => {
  const prompt = getOzelifAssistantPrompt()

  for (const phrase of [
    'Краснобогатырская улица, 24',
    '+7 (960) 881-87-25',
    '100% предоплата',
    'от 10 изделий одной модели',
    'Одежная кожа',
    'Дублёночный материал',
    'Галантерейная кожа',
    'Никогда не заменяй живые данные догадкой',
  ]) {
    assert.ok(
      prompt.includes(phrase),
      `Системный промпт не содержит обязательную фразу: ${phrase}`,
    )
  }
})

test('adds the current page to final instructions', async () => {
  const instructions = await buildOzelifAssistantInstructions({
    pathname: '/production',
  })

  assert.match(
    instructions,
    /Текущая страница сайта: \/production/,
  )
  assert.match(
    instructions,
    /ЗАЩИЩЁННОЕ ЯДРО AI-КОНСУЛЬТАНТА OZELIF/,
  )
  assert.match(
    instructions,
    /AI-консультант и продавец/,
  )
})
