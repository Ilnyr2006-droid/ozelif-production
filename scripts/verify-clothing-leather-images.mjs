import { createHash } from 'node:crypto'
import { readFile, stat } from 'node:fs/promises'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(fileURLToPath(new URL('..', import.meta.url)))
const manifest = JSON.parse(await readFile(resolve(`${root}/data/catalog/clothing-leather-images.json`), 'utf8'))
const failures = []; const checksums = new Map(); const scannedPaths = new Set(); let fileCount = 0; let totalBytes = 0
const maxCardCssWidth = 354
const requiredCardWidthAtDpr2 = Math.ceil(maxCardCssWidth * 2)

if (manifest.encoding.webp.quality < 85) failures.push(`WebP quality is below 85: ${manifest.encoding.webp.quality}`)
for (const product of manifest.products) {
  if (!product.gallery.length) failures.push(`Product ${product.id} has no primary image`)
  if (product.gallery.length !== product.sourceImageUrls.length) failures.push(`Product ${product.id} gallery does not match source URLs`)
  for (const image of product.gallery) {
    if (!product.sourceImageUrls.includes(image.sourceUrl)) failures.push(`Product ${product.id} is linked to an incorrect gallery source`)
    for (const set of [image.card, image.full]) {
      if (!set.width || !set.height || !set.src || !set.srcSet || !set.sizes) failures.push(`Missing responsive metadata for ${product.id}`)
      if (set.width > image.sourceWidth || set.height > image.sourceHeight) failures.push(`Upscaled responsive image for ${product.id}`)
      for (const variant of set.variants) {
        if (variant.width > image.sourceWidth || variant.height > image.sourceHeight) failures.push(`Upscaled derivative for ${product.id}: ${variant.src}`)
        const path = resolve(`${root}/public${variant.src}`)
        if (scannedPaths.has(path)) continue
        scannedPaths.add(path)
        try {
          const buffer = await readFile(path); const digest = createHash('sha256').update(buffer).digest('hex')
          if (checksums.has(digest)) failures.push(`Duplicate output file content: ${variant.src} and ${checksums.get(digest)}`)
          if (variant.bytes < 1024) failures.push(`Anomalously small derivative: ${variant.src}`)
          checksums.set(digest, variant.src); fileCount += 1; totalBytes += (await stat(path)).size
        } catch { failures.push(`Missing local image file: ${variant.src}`) }
      }
    }
    if (image.sourceWidth >= requiredCardWidthAtDpr2 && image.card.width < requiredCardWidthAtDpr2) failures.push(`Card can receive too-small resource at DPR 2 for ${product.id}`)
    if (image.sourceWidth < requiredCardWidthAtDpr2 && image.card.width !== image.sourceWidth) failures.push(`Low-resolution source was not kept at native size for ${product.id}`)
    if (image.sourceWidth >= 960 && image.full.width < 960) failures.push(`Full product image is too small for ${product.id}`)
  }
}
if (manifest.errors.length) failures.push(`Download errors: ${manifest.errors.length}`)
if (failures.length) throw new Error(failures.join('\n'))
console.log(JSON.stringify({ products: manifest.products.length, imageSources: manifest.sourceImageCount, uniqueSourceFiles: manifest.uniqueFiles, outputFiles: fileCount, totalBytes, duplicateSources: manifest.duplicateSources.length, lowResolutionSources: manifest.products.flatMap(product => product.gallery).filter(image => image.sourceWidth < requiredCardWidthAtDpr2).length, avif: manifest.encoding.avif.enabled, errors: manifest.errors.length }, null, 2))
