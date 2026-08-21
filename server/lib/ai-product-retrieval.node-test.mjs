
import assert from 'node:assert/strict'
import test from 'node:test'

process.env.DATABASE_URL ??=
  'postgresql://ozelif_test:ozelif_test@127.0.0.1:1/ozelif_test'
process.env.ADMIN_SESSION_SECRET ??=
  'ozelif-test-secret-0123456789-abcdefghijklmnopqrstuvwxyz'

const {
  applyExplicitProductConstraints,
  buildProductClarificationQuestion,
  buildRecommendationReason,
  inferExplicitCategorySlug,
  inferExplicitColor,
  inferExplicitThicknessMm,
  inferExplicitUse,
  mergeCandidateProducts,
  parseVectorSearchMatches,
  rankProductRecommendations,
  selectExactProductScope,
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

test('rejects explicit multi-color product for a pure black request', () => {
  const result = applyExplicitProductConstraints(
    [
      {
        id: '1',
        name: 'Soft Black',
        attributes: {
          Цвет: 'Черный',
        },
      },
      {
        id: '2',
        name: 'Soft White-Black',
        attributes: {
          Цвет: 'White-Black',
        },
      },
    ],
    'нужна черная кожа',
  )

  assert.deepEqual(
    result.products.map(item => item.name),
    ['Soft Black'],
  )
})

test('detects product use and ranks suitable clothing leather first', () => {
  assert.equal(
    inferExplicitUse('кожа для женской куртки'),
    'jacket',
  )

  const ranked = rankProductRecommendations(
    [
      {
        id: '1',
        name: 'Generic Black',
        categorySlug: 'dublyonka',
        description: 'Материал для дубленок',
        attributes: { Цвет: 'Черный' },
        variants: [],
      },
      {
        id: '2',
        name: 'Jacket Black',
        categorySlug: 'odejnayakozha',
        description: 'Мягкая кожа для одежды и курток',
        attributes: { Цвет: 'Черный', Толщина: '0,8 мм' },
        variants: [{ priceRub: 100 }],
      },
    ],
    'мягкая черная кожа 0,8 мм для куртки',
    [],
  )

  assert.equal(ranked[0].name, 'Jacket Black')
  assert.match(
    ranked[0].recommendationReason,
    /куртки|верхней одежды/,
  )
})

test('ranks clothing leather above shearling for a skirt request', () => {
  assert.equal(
    inferExplicitUse('нужна чёрная кожа для юбки'),
    'light_clothing',
  )

  const ranked = rankProductRecommendations(
    [
      {
        id: '1',
        name: 'Кёрли Black&Silky',
        categorySlug: 'dublyonka',
        description: 'Дублёночный материал для верхней одежды',
        attributes: { Цвет: 'Чёрный' },
        variants: [{ priceRub: 86.67 }],
      },
      {
        id: '2',
        name: 'Nappa Black',
        categorySlug: 'odejnayakozha',
        description: 'Мягкая натуральная кожа',
        attributes: { Цвет: 'Чёрный', Толщина: '0,7 мм' },
        variants: [{ priceRub: 46.33 }],
      },
    ],
    'нужна чёрная кожа для юбки',
    [],
  )

  assert.equal(ranked[0].name, 'Nappa Black')
  assert.match(ranked[0].recommendationReason, /юбки/u)
})

test('builds a deterministic recommendation reason', () => {
  const reason = buildRecommendationReason(
    {
      name: 'Soft Black',
      categorySlug: 'odejnayakozha',
      description: 'Мягкая кожа для одежды',
      attributes: {
        Цвет: 'Черный',
        Толщина: '0,8 мм',
      },
      variants: [{ priceRub: 100 }],
    },
    'черная кожа 0,8 мм для куртки',
  )

  assert.match(reason, /чёрный цвет/)
  assert.match(reason, /0,8 мм/)
})

test('asks one useful question only for an under-specified selection', () => {
  const question = buildProductClarificationQuestion(
    'покажи черную кожу',
    [
      { name: 'Soft Black' },
      { name: 'Vip Black' },
    ],
  )

  assert.match(question, /Что вы планируете изготовить/)

  assert.equal(
    buildProductClarificationQuestion(
      'Amazon Black',
      [{ name: 'Amazon Black' }],
    ),
    null,
  )
})

test('exact product scope removes unsolicited analogs', () => {
  const products = [
    { name: 'Amazon Black' },
    { name: 'Vip Black' },
    { name: 'Soft Black' },
  ]

  assert.deepEqual(
    selectExactProductScope(
      products,
      'Сколько стоит Amazon Black?',
    ).map(item => item.name),
    ['Amazon Black'],
  )
})

test('exact product scope keeps alternatives when explicitly requested', () => {
  const products = [
    { name: 'Amazon Black' },
    { name: 'Vip Black' },
    { name: 'Soft Black' },
  ]

  assert.deepEqual(
    selectExactProductScope(
      products,
      'Amazon Black и похожие аналоги',
    ).map(item => item.name),
    ['Amazon Black', 'Vip Black', 'Soft Black'],
  )
})
