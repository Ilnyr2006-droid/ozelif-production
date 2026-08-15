
import 'dotenv/config'
import { closePool } from '../lib/db.mjs'
import { findLiveProductCandidates } from '../lib/ai-product-retrieval.mjs'

const text = process.argv.slice(2).join(' ').trim()
  || 'нужна мягкая черная кожа для сумки'

try {
  const result = await findLiveProductCandidates(text, {
    limit: 6,
  })

  console.log(JSON.stringify({
    query: text,
    semantic: result.semantic,
    lexical: result.lexical,
    products: result.products.map(product => ({
      id: product.id,
      name: product.name,
      category: product.category,
      variants: product.variants,
      productUrl: product.productUrl,
    })),
  }, null, 2))

  if (!result.products.length) {
    throw new Error('Hybrid product retrieval returned no products')
  }
} finally {
  await closePool()
}
