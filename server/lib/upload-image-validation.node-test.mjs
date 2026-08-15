import assert from 'node:assert/strict'
import test from 'node:test'
import { detectImageFormat, validateCatalogImage } from './upload-image-validation.mjs'

const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10])
const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
const webp = Buffer.from('RIFF\x10\x00\x00\x00WEBPVP8 ', 'binary')
const avif = Buffer.concat([Buffer.from('\x00\x00\x00\x18ftypavif', 'binary'), Buffer.from('mif1avif', 'ascii')])

test('detects allowed image signatures', () => {
  assert.equal(detectImageFormat(jpeg), 'jpeg')
  assert.equal(detectImageFormat(png), 'png')
  assert.equal(detectImageFormat(webp), 'webp')
  assert.equal(detectImageFormat(avif), 'avif')
})

test('accepts a matching image MIME type and extension', () => {
  assert.deepEqual(validateCatalogImage({ buffer: webp, originalname: 'leather.webp', mimetype: 'image/webp' }), {
    valid: true,
    format: 'webp',
    extension: '.webp',
    mimeType: 'image/webp',
  })
})

test('rejects an image with a spoofed MIME type or extension', () => {
  assert.equal(validateCatalogImage({ buffer: jpeg, originalname: 'leather.png', mimetype: 'image/png' }).valid, false)
  assert.equal(validateCatalogImage({ buffer: Buffer.from('<svg/>'), originalname: 'leather.svg', mimetype: 'image/svg+xml' }).valid, false)
})
