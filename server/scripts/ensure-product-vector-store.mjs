
import 'dotenv/config'
import {
  createProductVectorStore,
  getVectorStore,
} from '../lib/openai-vector-store.mjs'

const existing = String(
  process.env.OPENAI_PRODUCT_VECTOR_STORE_ID ?? '',
).trim()

if (existing) {
  const item = await getVectorStore(existing)
  console.log(JSON.stringify({
    created: false,
    id: item.id,
    name: item.name,
    status: item.status,
  }))
} else {
  const item = await createProductVectorStore('OZELIF Product Index')
  console.log(JSON.stringify({
    created: true,
    id: item.id,
    name: item.name,
    status: item.status,
  }))
}
