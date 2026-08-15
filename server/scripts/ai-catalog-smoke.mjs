
import 'dotenv/config'
import { closePool } from '../lib/db.mjs'
import {
  getPublishedCatalogSummary,
  searchPublishedProducts,
} from '../lib/ai-catalog.mjs'

const query = process.argv.slice(2).join(' ').trim() || 'черная кожа для сумки'

try {
  const summary = await getPublishedCatalogSummary()
  const result = await searchPublishedProducts(query, { limit: 5 })

  console.log({
    summary,
    query: result.query,
    terms: result.terms,
    items: result.items.map(item => ({
      id: item.id,
      name: item.name,
      category: item.category,
      variants: item.variants,
      score: item.score,
    })),
  })
} finally {
  if (typeof closePool === 'function') {
    await closePool()
  }
}
