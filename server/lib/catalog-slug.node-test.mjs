import assert from 'node:assert/strict'
import test from 'node:test'
import { isPublicCatalogSlug, normalizeCatalogSlug } from './catalog-slug.mjs'

test('normalizes a Cyrillic category name to a public Latin slug', () => {
  assert.equal(normalizeCatalogSlug('Галантерейная кожа'), 'galantereynaya-kozha')
  assert.equal(normalizeCatalogSlug('Мебельная / кожа'), 'mebelnaya-kozha')
})

test('accepts only URL-safe public catalog slugs', () => {
  assert.equal(isPublicCatalogSlug('mebelnaya-kozha'), true)
  assert.equal(isPublicCatalogSlug('мебельная-кожа'), false)
  assert.equal(isPublicCatalogSlug('bad_slug'), false)
})
