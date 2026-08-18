
import assert from 'node:assert/strict'
import test from 'node:test'

process.env.DATABASE_URL ??=
  'postgresql://ozelif_test:ozelif_test@127.0.0.1:1/ozelif_test'
process.env.ADMIN_SESSION_SECRET ??=
  'ozelif-test-secret-0123456789-abcdefghijklmnopqrstuvwxyz'

const {
  applyExplicitProductConstraints,
  inferExplicitCategorySlug,
  inferExplicitColor,
  inferExplicitThicknessMm,
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

test('detects one explicit color without confusing alternatives', () => {
  assert.equal(
    inferExplicitColor('Нужна мягкая черная кожа'),
    'black',
  )

  assert.equal(
    inferExplicitColor('Черная или коричневая кожа'),
    null,
  )
})

test('parses explicit thickness in millimeters', () => {
  const single = inferExplicitThicknessMm(
    'Нужна кожа толщиной 0,8 мм',
  )

  assert.equal(single.target, 0.8)

  const range = inferExplicitThicknessMm(
    'Нужна кожа 0.7-0.9 мм',
  )

  assert.deepEqual(range, {
    min: 0.7,
    max: 0.9,
  })
})

test('hard color constraint removes Brown and Taba from black query', () => {
  const result = applyExplicitProductConstraints(
    [
      {
        id: '1',
        name: 'Soft Black',
        description: 'Черная одежная кожа',
        attributes: { Толщина: '0,8 мм' },
      },
      {
        id: '2',
        name: 'Lucas Brown',
        description: 'Коричневая кожа',
        attributes: { Толщина: '0,8 мм' },
      },
      {
        id: '3',
        name: 'Lucas Taba',
        description: 'Taba leather',
        attributes: { Толщина: '0,8 мм' },
      },
    ],
    'мягкая черная кожа 0,8 мм для куртки',
  )

  assert.deepEqual(
    result.products.map(item => item.name),
    ['Soft Black'],
  )
})

test('known thickness mismatch is removed while unknown metadata stays eligible', () => {
  const result = applyExplicitProductConstraints(
    [
      {
        id: '1',
        name: 'Black 0.8',
        attributes: {
          Цвет: 'Black',
          Толщина: '0,8 мм',
        },
      },
      {
        id: '2',
        name: 'Black 1.4',
        attributes: {
          Цвет: 'Black',
          Толщина: '1,4 мм',
        },
      },
      {
        id: '3',
        name: 'Black unknown',
        attributes: {
          Цвет: 'Black',
        },
      },
    ],
    'черная кожа 0,8 мм',
  )

  assert.deepEqual(
    result.products.map(item => item.name),
    ['Black 0.8', 'Black unknown'],
  )
})
