import { readFile, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { CATALOG_SEO_LANDINGS } from '../server/lib/catalog-seo-landings.mjs'

const START = '<!-- AUTO:CATALOG_SEO_LANDINGS:START -->'
const END = '<!-- AUTO:CATALOG_SEO_LANDINGS:END -->'
const SITE = 'https://ozelifkoja.ru'
const llmsPath = fileURLToPath(new URL('../public/llms.txt', import.meta.url))
const checkOnly = process.argv.includes('--check')

function generatedBlock() {
  const lines = CATALOG_SEO_LANDINGS.map(landing => (
    `- ${landing.title}: ${SITE}${landing.path} — ` +
    `SEO-подкатегория раздела «${landing.categoryName}» с актуальными товарами, ` +
    'характеристиками и ценами из публичного каталога OZELIF.'
  ))

  return [
    START,
    '## SEO-подкатегории каталога',
    '',
    'Список ниже генерируется автоматически из единого реестра SEO-посадочных, который также используется sitemap.',
    '',
    ...lines,
    END,
  ].join('\n')
}

function stripLegacyLandingLines(source) {
  const landingUrls = new Set(
    CATALOG_SEO_LANDINGS.map(landing => `${SITE}${landing.path}`),
  )

  return source
    .split('\n')
    .filter(line => ![...landingUrls].some(url => line.includes(url)))
    .join('\n')
}

function renderNext(source) {
  let text = String(source).replace(/\r\n/g, '\n')

  const startIndex = text.indexOf(START)
  const endIndex = text.indexOf(END)

  if (startIndex >= 0 || endIndex >= 0) {
    if (startIndex < 0 || endIndex < 0 || endIndex < startIndex) {
      throw new Error('llms.txt contains a broken generated-block marker pair')
    }

    text = [
      text.slice(0, startIndex).trimEnd(),
      text.slice(endIndex + END.length).trimStart(),
    ]
      .filter(Boolean)
      .join('\n\n')
  }

  text = stripLegacyLandingLines(text)
    .replace(/\n{3,}/g, '\n\n')
    .trim()

  const anchor = '\n## Данные каталога'
  const block = generatedBlock()

  if (text.includes(anchor)) {
    return `${text.replace(anchor, `\n\n${block}${anchor}`)}\n`
  }

  return `${text}\n\n${block}\n`
}

const current = await readFile(llmsPath, 'utf8')
const next = renderNext(current)

if (checkOnly) {
  if (current !== next) {
    console.error(
      `${path.relative(process.cwd(), llmsPath)} is stale. ` +
      'Run: npm run llms:generate',
    )
    process.exit(1)
  }

  console.log(
    `llms.txt is synchronized with ${CATALOG_SEO_LANDINGS.length} SEO landings.`,
  )
  process.exit(0)
}

await writeFile(llmsPath, next)

console.log(
  `Generated llms.txt from ${CATALOG_SEO_LANDINGS.length} SEO landings.`,
)
