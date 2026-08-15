
import assert from 'node:assert/strict'
import test from 'node:test'
import {
  buildProductVectorDocument,
  productVectorContentHash,
  productVectorFilename,
} from './product-vector-document.mjs'

const product = {
  id: '11111111-1111-1111-1111-111111111111',
  legacyId: '814535079882',
  name: 'Napato Black',
  slug: 'napato-black',
  categoryName: 'Одежная кожа',
  categorySlug: 'odejnayakozha',
  sku: 'Арт-NAPATOBLACK',
  description: 'Мягкая натуральная кожа.',
  attributes: {
    __managed: true,
    Цвет: 'Чёрный',
    'Тип сырья': 'Овчина',
    Пустое: '',
  },
  variants: [
    { unit: 'фут²', isActive: true },
    { unit: 'дм²', isActive: true },
  ],
}

test('builds semantic product document without prices', () => {
  const document = buildProductVectorDocument(product)

  assert.match(document, /Napato Black/)
  assert.match(document, /Цвет: Чёрный/)
  assert.match(document, /Тип сырья: Овчина/)
  assert.match(document, /Единицы продажи: фут², дм²/)
  assert.doesNotMatch(document, /__managed/)
  assert.doesNotMatch(document, /Пустое/)
  assert.doesNotMatch(document, /₽|\$/)
})

test('content hash changes when characteristics change', () => {
  const first = buildProductVectorDocument(product)
  const second = buildProductVectorDocument({
    ...product,
    attributes: {
      ...product.attributes,
      Цвет: 'Коричневый',
    },
  })

  assert.notEqual(
    productVectorContentHash(first),
    productVectorContentHash(second),
  )
})

test('uses stable filename containing product id', () => {
  assert.equal(
    productVectorFilename(product),
    'ozelif-product-11111111-1111-1111-1111-111111111111-napato-black.md',
  )
})
