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
  assert.match(result.xml, /<picture>https:\/\/ozelifkoja\.ru\/x\.jpg\?v=20260907<\/picture>/)
  assert.match(result.xml, /<url>https:\/\/ozelifkoja\.ru\/odejnayakozha\/tproduct\/123-leather\?variant=456<\/url>/)
})
test('offer title excludes duplicated variant, units and technical shade', () => {
  const result = renderDirectFeed([{
    ...item,
    name: 'Chelsea Black',
    variant_name: 'Chelsea Black - дм2 - Оттенок черного',
    category_name: 'Натуральная кожа',
    unit: 'дм²',
    attributes: { color: 'Черный', thickness: '0.8-0.9', shade: 'Оттенок черного' },
  }])
  assert.match(result.xml, /<name>Натуральная кожа Chelsea Black<\/name>/)
  assert.doesNotMatch(result.xml, /<name>[^<]*(?:дм2|фут2|Оттенок)[^<]*<\/name>/)
  assert.match(result.xml, /<description>[^<]*Единица продажи: дм²; Цвет: Черный; Толщина: 0.8-0.9; Оттенок: Оттенок черного\.<\/description>/)
  assert.match(result.xml, /<param name="Единица продажи">дм²<\/param>/)
  assert.match(result.xml, /<param name="Оттенок">Оттенок черного<\/param>/)
})
test('offer title treats е and ё as the same category spelling', () => {
  const result = renderDirectFeed([{
    ...item,
    name: 'Дубленочный материал Кёрли Orange',
    category_name: 'Дублёночный материал',
  }])
  assert.match(result.xml, /<name>Дубленочный материал Кёрли Orange<\/name>/)
  assert.doesNotMatch(result.xml, /<name>Дублёночный материал Дубленочный материал/)
})
test('feed excludes technical source fields and keeps only dm² material variants', () => {
  const result = renderDirectFeed([
    { ...item, identifier: 'pair', variant_identifier: 'foot', unit: 'фут2', price: 230, attributes: { sourceImageUrls: ['https://source.example/image.jpg'], priceSource: 'imported', color: 'Черный' } },
    { ...item, identifier: 'pair', variant_identifier: 'dm', unit: 'дм2', price: 25, attributes: { sourceImageUrls: ['https://source.example/image.jpg'], priceSource: 'imported', color: 'Черный' } },
  ])
  assert.equal(result.count, 1)
  assert.match(result.xml, /id="dm"/)
  assert.doesNotMatch(result.xml, /id="foot"/)
  assert.match(result.xml, /<param name="Единица продажи">дм²<\/param>/)
  assert.doesNotMatch(result.xml, /sourceImageUrls|priceSource/)
})
test('dublyonka category is treated as material even with the ё spelling', () => {
  const result = renderDirectFeed([
    { ...item, identifier: 'shearling', category_name: 'Дублёночный материал', variant_identifier: 'shearling-foot', unit: 'фут²', price: 240 },
    { ...item, identifier: 'shearling', category_name: 'Дублёночный материал', variant_identifier: 'shearling-dm', unit: 'дм²', price: 26 },
  ])
  assert.equal(result.count, 1)
  assert.match(result.xml, /id="shearling-dm"/)
  assert.doesNotMatch(result.xml, /id="shearling-foot"/)
})
test('legacy material variants without a stored unit get one dm² offer per product', () => {
  const result = renderDirectFeed([
    { ...item, identifier: 'legacy', variant_identifier: 'legacy-foot', unit: null, price: 930 },
    { ...item, identifier: 'legacy', variant_identifier: 'legacy-dm', unit: null, price: 100 },
  ])
  assert.equal(result.count, 1)
  assert.match(result.xml, /id="legacy-dm"/)
  assert.match(result.xml, /<param name="Единица продажи">дм²<\/param>/)
})
test('unknown inventory is excluded, zero inventory is unavailable, bad price is excluded', () => {
  const result = renderDirectFeed([{ ...item, stock_quantity: null }, { ...item, stock_quantity: 0 }, { ...item, price: null }])
  assert.equal(result.count, 1)
  assert.equal(result.excluded.unknownStock, 1)
  assert.equal(result.excluded.invalidPrice, 1)
  assert.match(result.xml, /available="false"/)
})
