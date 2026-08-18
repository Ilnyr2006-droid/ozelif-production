import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const currentDirectory = path.dirname(fileURLToPath(import.meta.url))
const envSource = fs.readFileSync(
  path.join(currentDirectory, 'env.mjs'),
  'utf8',
)

function fallbackValue(name) {
  if (name === 'DATABASE_URL') {
    return 'postgresql://ozelif_test:ozelif_test@127.0.0.1:1/ozelif_test'
  }

  if (/SECRET/i.test(name)) {
    return 'ozelif-test-secret-0123456789-abcdefghijklmnopqrstuvwxyz'
  }

  if (/OPENAI_API_KEY/i.test(name)) {
    return 'sk-test-ozelif-catalog'
  }

  if (/VECTOR_STORE/i.test(name)) {
    return 'vs_test_ozelif_catalog'
  }

  if (/URL|ORIGIN/i.test(name)) {
    return 'http://127.0.0.1:8091'
  }

  if (/PORT/i.test(name)) {
    return '8093'
  }

  if (/TTL|HOURS|MINUTES|SECONDS|LIMIT|SIZE/i.test(name)) {
    return '24'
  }

  if (/SSL|SECURE|ENABLED/i.test(name)) {
    return 'false'
  }

  if (/COOKIE/i.test(name)) {
    return 'ozelif_test_session'
  }

  if (/DIR|PATH/i.test(name)) {
    return '/tmp/ozelif-test'
  }

  if (/HOST/i.test(name)) {
    return '127.0.0.1'
  }

  if (/EMAIL/i.test(name)) {
    return 'test@example.com'
  }

  return `test-${name.toLocaleLowerCase('en-US').replaceAll('_', '-')}`
}

const requiredEnvironmentNames = [
  ...envSource.matchAll(
    /required\(\s*['"`]([A-Z0-9_]+)['"`]\s*\)/g,
  ),
].map(match => match[1])

for (const name of requiredEnvironmentNames) {
  if (!process.env[name]) {
    process.env[name] = fallbackValue(name)
  }
}

process.env.NODE_ENV = 'test'

const {
  expandCatalogSearchTerms,
  normalizeCatalogQuery,
} = await import('./ai-catalog.mjs')

test('normalizes Russian search query', () => {
  assert.equal(
    normalizeCatalogQuery('  Чёрная   кожа для СУМКИ! '),
    'черная кожа для сумки',
  )
})

test('adds useful catalog synonyms', () => {
  const terms = expandCatalogSearchTerms('черная замша для сумки')

  assert.ok(terms.includes('черная'))
  assert.ok(terms.includes('черн'))
  assert.ok(terms.includes('black'))
  assert.ok(terms.includes('замша'))
  assert.ok(terms.includes('suede'))
  assert.ok(terms.includes('сумки'))
  assert.ok(terms.includes('галантерея'))
})

test('normalizes decimal comma in thickness queries', () => {
  assert.equal(
    normalizeCatalogQuery('кожа 0,8 мм'),
    'кожа 0.8 мм',
  )
})
