
import assert from 'node:assert/strict'
import test from 'node:test'

process.env.DATABASE_URL ??=
  'postgresql://ozelif_test:ozelif_test@127.0.0.1:1/ozelif_test'
process.env.ADMIN_SESSION_SECRET ??=
  'ozelif-test-secret-0123456789-abcdefghijklmnopqrstuvwxyz'

const {
  inferExplicitCategorySlug,
  mergeCandidateProducts,
  parseVectorSearchMatches,
} = await import('./ai-product-retrieval.mjs')

test('parses product ids from vector search attributes', () => {
  const matches = parseVectorSearchMatches({
    data: [{
      file_id: 'file-123',
      score: 0.81,
      attributes: {
        product_id: '11111111-1111-4111-8111-111111111111',
      },
      content: [{
        type: 'text',
        text: 'Napato Black',
      }],
    }],
  })

  assert.deepEqual(matches, [{
    productId: '11111111-1111-4111-8111-111111111111',
    fileId: 'file-123',
    filename: null,
    score: 0.81,
    rank: 0,
    content: 'Napato Black',
  }])
})

test('merges semantic candidates before lexical fallback', () => {
  const merged = mergeCandidateProducts(
    [{ id: '1', name: 'Semantic' }],
    [
      { id: '1', name: 'Duplicate' },
      { id: '2', name: 'Lexical' },
    ],
    6,
  )

  assert.deepEqual(merged, [
    { id: '1', name: 'Semantic' },
    { id: '2', name: 'Lexical' },
  ])
})

test('detects one explicit catalog category', () => {
  assert.equal(
    inferExplicitCategorySlug(
      'Покажи натуральную замшу коричневого цвета',
    ),
    'zamsha',
  )

  assert.equal(
    inferExplicitCategorySlug(
      'Нужна обувная кожа черного цвета',
    ),
    'obuvnayakozha',
  )

  assert.equal(
    inferExplicitCategorySlug(
      'Сравни замшу и одежную кожу',
    ),
    null,
  )
})
