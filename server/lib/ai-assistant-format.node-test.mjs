
import assert from 'node:assert/strict'
import test from 'node:test'
import {
  assistantProductContext,
  compactProductContext,
  deterministicCatalogReply,
  enforceCriticalIntentFacts,
  productActions,
  sanitizeUnverifiedStockClaims,
} from './ai-assistant-format.mjs'

const product = {
  id: '11111111-1111-4111-8111-111111111111',
  name: 'Napato Black',
  category: 'Одежная кожа',
  productUrl: '/odejnayakozha/tproduct/1-napato-black',
  description: 'Мягкая натуральная кожа.',
  attributes: {
    Цвет: 'Чёрный',
    Толщина: '0,8 мм',
    __managed: true,
  },
  variants: [
    { priceRub: 430, unit: 'фут²' },
    { priceRub: 47, unit: 'дм²' },
  ],
}

test('builds compact verified product context', () => {
  const context = compactProductContext([product])

  assert.match(context, /PRODUCT_ID=/)
  assert.match(context, /Napato Black/)
  assert.match(context, /430 ₽ за фут²/)
  assert.match(context, /47 ₽ за дм²/)
  assert.doesNotMatch(context, /__managed/)
})

test('returns attributable widget actions', () => {
  assert.deepEqual(productActions([product]), [{
    label: 'Открыть Napato Black',
    href: '/odejnayakozha/tproduct/1-napato-black',
    productId: product.id,
    reason: null,
  }])
})

test('fallback uses only live product data', () => {
  const reply = deterministicCatalogReply([product])

  assert.match(reply, /Napato Black/)
  assert.match(reply, /430 ₽ за фут²/)
})

test('informational intents do not receive a failed-product-search message', () => {
  assert.equal(
    assistantProductContext([], false),
    'Для этого запроса товарный поиск не требуется.',
  )

  assert.equal(
    assistantProductContext([], true),
    'Подходящих опубликованных товаров не найдено.',
  )
})

test('production reply receives missing verified facts', () => {
  const reply = enforceCriticalIntentFacts(
    'Да, такой тираж можно обсудить. Уточните модель и материал.',
    'production',
  )

  assert.match(reply, /10 изделий одной модели/)
  assert.match(reply, /первый образец/)
})

test('production facts are not duplicated', () => {
  const source = (
    'Минимальный заказ — от 10 изделий одной модели. '
    + 'Для новой модели обязателен первый образец.'
  )

  const reply = enforceCriticalIntentFacts(
    source,
    'production',
  )

  assert.equal(
    (reply.match(/10 изделий одной модели/g) ?? []).length,
    1,
  )

  assert.equal(
    (reply.match(/первый образец/g) ?? []).length,
    1,
  )
})

test('non-production reply is not altered', () => {
  const source = 'Размер оптовой скидки обсуждается индивидуально.'

  assert.equal(
    enforceCriticalIntentFacts(source, 'wholesale'),
    source,
  )
})

test('normalizes Grade to Russian Сорт in verified context', () => {
  const context = compactProductContext([{
    ...product,
    stockQuantity: null,
    attributes: {
      Grade: '1',
      Color: 'Black',
    },
  }])

  assert.match(context, /Сорт: 1/)
  assert.doesNotMatch(context, /Grade:/)
  assert.match(context, /Остаток: не опубликован/)
})

test('removes affirmative stock claim when any candidate stock is unpublished', () => {
  const reply = sanitizeUnverifiedStockClaims(
    'Товар доступен. Цена указана в каталоге.',
    [{
      ...product,
      stockQuantity: null,
      variants: product.variants.map(item => ({
        ...item,
        stockQuantity: null,
      })),
    }],
  )

  assert.match(reply, /товар опубликован в каталоге/i)
  assert.doesNotMatch(reply, /товар доступен/i)
})

test('keeps confirmed stock wording when every candidate has stock data', () => {
  const reply = sanitizeUnverifiedStockClaims(
    'Товар доступен.',
    [{
      ...product,
      stockQuantity: 12,
    }],
  )

  assert.equal(reply, 'Товар доступен.')
})

test('hides technical portion and normalizes unit/article labels', () => {
  const context = compactProductContext([{
    ...product,
    recommendationReason:
      'подходит для сумки, чёрный цвет',
    attributes: {
      unit: 'FOT',
      article: 'AMAZONBLACK',
      portion: '1',
      Grade: '1',
    },
  }])

  assert.match(context, /Единица измерения: фут²/)
  assert.match(context, /Артикул: AMAZONBLACK/)
  assert.match(context, /Сорт: 1/)
  assert.match(context, /Почему подходит:/)
  assert.doesNotMatch(context, /portion:/i)
  assert.doesNotMatch(context, /unit:/i)
  assert.doesNotMatch(context, /article:/i)
})

test('prioritizes material and thickness in dense product attributes', () => {
  const context = compactProductContext([{
    ...product,
    attributes: {
      unit: 'FOT',
      color: 'Черный',
      grade: '1',
      origin: 'Турция',
      article: 'NAPATOBLACK',
      portion: '1',
      subtype: ['Винтажная'],
      hideSize: '6-7 фут²',
      material: 'Овчина',
      thickness: '0.8-0.9',
      categories: ['Одежная'],
      normalizedColor: 'Чёрный',
      sourceImageUrls: ['https://example.com/source.jpg'],
    },
  }])

  assert.match(context, /Материал: Овчина/)
  assert.match(context, /Толщина: 0\.8-0\.9/)
  assert.match(context, /Цвет: Черный/)
  assert.match(context, /Тип\/фактура: Винтажная/)
  assert.match(context, /Размер шкуры: 6-7 фут²/)
  assert.doesNotMatch(context, /sourceImageUrls/i)
  assert.doesNotMatch(context, /normalizedColor/i)
})

test('product actions include product id for click attribution', () => {
  const actions = productActions([{
    ...product,
    recommendationReason: 'чёрный цвет',
  }])

  assert.equal(actions[0].productId, product.id)
  assert.equal(actions[0].reason, 'чёрный цвет')
})

test(
  'deterministic catalog fallback does not invent a missing customer field',
  () => {
    const reply =
      deterministicCatalogReply(
        [],
      )

    assert.doesNotMatch(
      reply,
      /что вы планируете изготовить/iu,
    )

    assert.doesNotMatch(
      reply,
      /уточните.{0,80}(?:назначение|цвет|толщин|бюджет)/iu,
    )
  },
)

test(
  'deterministic product fallback does not force another clarification',
  () => {
    const reply =
      deterministicCatalogReply(
        [
          {
            name:
              'Catalog Product',
            variants: [
              {
                priceRub:
                  100,
                unit:
                  'шт.',
              },
            ],
          },
        ],
      )

    assert.doesNotMatch(
      reply,
      /уточните назначение|что вы планируете изготовить/iu,
    )

    assert.match(
      reply,
      /могу сравнить/iu,
    )
  },
)
