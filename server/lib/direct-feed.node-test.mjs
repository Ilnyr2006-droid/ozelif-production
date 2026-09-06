import test from 'node:test'
import assert from 'node:assert/strict'
import { renderDirectFeed } from './direct-feed.mjs'
const item = { identifier: '123', slug: 'leather', name: 'Кожа & Наппа', description: '<p>Материал</p>', primary_image: '/x.jpg', category_slug: 'odejnayakozha', category_name: 'Одежная кожа', variant_identifier: '456', variant_name: 'Чёрная', price: '25.50', stock_quantity: 2, unit: 'дм²', attributes: { color: 'Чёрный' } }
test('known stock, escaped XML, price and variant landing agree', () => {
  const result = renderDirectFeed([item])
  assert.equal(result.count, 1)
  assert.match(result.xml, /available="true"/)
  assert.match(result.xml, /id="456"/)
  assert.match(result.xml, /variant=456/)
  assert.match(result.xml, /Кожа &amp; Наппа/)
  assert.match(result.xml, /<price>25.50<\/price>/)
})
test('unknown inventory is excluded, zero inventory is unavailable, bad price is excluded', () => {
  const result = renderDirectFeed([{ ...item, stock_quantity: null }, { ...item, stock_quantity: 0 }, { ...item, price: null }])
  assert.equal(result.count, 1)
  assert.equal(result.excluded.unknownStock, 1)
  assert.equal(result.excluded.invalidPrice, 1)
  assert.match(result.xml, /available="false"/)
})
