// @vitest-environment node
import { readFile } from 'node:fs/promises'
import { describe, expect, it } from 'vitest'

function agentBlock(robots, agent) {
  const lines = robots.split(/\r?\n/)
  const wanted = `user-agent: ${agent}`.toLowerCase()

  const start = lines.findIndex(
    line => line.trim().toLowerCase() === wanted,
  )

  if (start < 0) return ''

  const block = []

  for (let index = start + 1; index < lines.length; index += 1) {
    const line = lines[index]

    if (/^\s*User-agent\s*:/i.test(line)) {
      break
    }

    block.push(line)
  }

  return block.join('\n')
}

describe('OpenAI search crawl controls', () => {
  it('explicitly allows OAI-SearchBot and ChatGPT-User', async () => {
    const robots = await readFile('public/robots.txt', 'utf8')

    for (const agent of ['OAI-SearchBot', 'ChatGPT-User']) {
      const block = agentBlock(robots, agent)
      expect(block).toMatch(/^Allow:\s*\/\s*$/im)
      expect(block).not.toMatch(/^Disallow:\s*\/\s*$/im)
    }

    expect(robots).toContain(
      'Sitemap: https://ozelifkoja.ru/sitemap.xml',
    )
  })

  it('keeps llms.txt factual and points to public HTML', async () => {
    const llms = await readFile('public/llms.txt', 'utf8')

    expect(llms).toContain(
      'Авторитетные сведения о компании, категориях, товарах, ценах и характеристиках находятся на соответствующих публичных HTML-страницах сайта.',
    )
    expect(llms).toContain(
      'Москва, Краснобогатырская улица, 24',
    )
    expect(llms).toContain('Формат продаж: розница и опт')
    expect(llms).toContain(
      'Актуальные цены и характеристики публикуются в карточках товаров.',
    )
  })
})
