import assert from 'node:assert/strict'
import test from 'node:test'

process.env.DATABASE_URL ??=
  'postgresql://ozelif_test:ozelif_test@127.0.0.1:1/ozelif_test'
process.env.ADMIN_SESSION_SECRET ??=
  'ozelif-test-secret-0123456789-abcdefghijklmnopqrstuvwxyz'

const {
  buildOzelifAssistantInstructions,
  getMoscowWorkingHoursContext,
  getOzelifAssistantPrompt,
  getProtectedAiPromptCore,
} = await import('./ai-system-prompt.mjs')

test('contains the required company knowledge', () => {
  const prompt = getOzelifAssistantPrompt()

  for (const phrase of [
    'Краснобогатырская улица, 24',
    '+7 (960) 881-87-25',
    '100% предоплата',
    '10 изделий одной модели',
    'натуральной кожи OZELIF',
    'дублёночный материал и фурнитуру',
    'никогда не подменяй подтверждённые данные догадками',
  ]) {
    assert.ok(
      prompt.includes(phrase),
      `Системный промпт не содержит обязательную фразу: ${phrase}`,
    )
  }
})

test('keeps non-invention and no-repeat requirements in protected core', () => {
  const prompt = getProtectedAiPromptCore()

  for (const phrase of [
    'обязательные условия',
    'с обязательным условием',
    'Страну, производителя и происхождение называй только из проверенных данных',
    'Используй всю историю текущего диалога',
    'Я не нашёл точного совпадения в опубликованном каталоге',
  ]) {
    assert.ok(prompt.includes(phrase), `В защищённом промпте нет правила: ${phrase}`)
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
    /AI-консультант магазина натуральной кожи OZELIF/,
  )
})

test('reports regular Moscow hours and Sunday closure from the supplied time', () => {
  const sunday = getMoscowWorkingHoursContext(
    new Date('2026-10-11T05:57:00Z'),
  )
  assert.match(sunday, /понедельник–пятница, 10:00–18:00/)
  assert.match(sunday, /воскресенье, 11\.10\.2026, 08:57/)
  assert.match(sunday, /Сегодня по обычному графику выходной/)

  const monday = getMoscowWorkingHoursContext(
    new Date('2026-10-12T08:00:00Z'),
  )
  assert.match(monday, /понедельник, 12\.10\.2026, 11:00/)
  assert.match(monday, /Сейчас по обычному графику рабочее время/)
})
