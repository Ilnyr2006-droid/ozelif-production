import path from 'node:path'

const imageFormats = Object.freeze({
  jpeg: { extension: '.jpg', mimeType: 'image/jpeg', extensions: new Set(['.jpg', '.jpeg']) },
  png: { extension: '.png', mimeType: 'image/png', extensions: new Set(['.png']) },
  webp: { extension: '.webp', mimeType: 'image/webp', extensions: new Set(['.webp']) },
  avif: { extension: '.avif', mimeType: 'image/avif', extensions: new Set(['.avif']) },
})

function startsWith(buffer, bytes) {
  return buffer.length >= bytes.length && bytes.every((byte, index) => buffer[index] === byte)
}

function isAvif(buffer) {
  if (buffer.length < 12 || buffer.toString('ascii', 4, 8) !== 'ftyp') return false

  const brands = [
    buffer.toString('ascii', 8, 12),
    ...Array.from({ length: Math.floor((buffer.length - 16) / 4) }, (_value, index) => buffer.toString('ascii', 16 + index * 4, 20 + index * 4)),
  ]

  return brands.includes('avif') || brands.includes('avis')
}

export function detectImageFormat(buffer) {
  if (startsWith(buffer, [0xff, 0xd8, 0xff])) return 'jpeg'
  if (startsWith(buffer, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return 'png'
  if (buffer.length >= 12 && buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP') return 'webp'
  if (isAvif(buffer)) return 'avif'
  return null
}

export function validateCatalogImage({ buffer, originalname, mimetype }) {
  const format = detectImageFormat(buffer)
  if (!format) return { valid: false, error: 'Допустимы только изображения JPEG, PNG, WebP или AVIF' }

  const definition = imageFormats[format]
  const extension = path.extname(String(originalname ?? '')).toLowerCase()
  if (!definition.extensions.has(extension)) {
    return { valid: false, error: 'Расширение файла не соответствует формату изображения' }
  }

  if (String(mimetype ?? '').toLowerCase() !== definition.mimeType) {
    return { valid: false, error: 'Тип загружаемого файла не соответствует содержимому' }
  }

  return { valid: true, format, extension: definition.extension, mimeType: definition.mimeType }
}
