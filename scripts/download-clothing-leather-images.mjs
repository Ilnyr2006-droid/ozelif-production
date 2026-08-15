import { createHash } from 'node:crypto'
import { execFile } from 'node:child_process'
import { access, mkdir, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises'
import { promisify } from 'node:util'
import { basename, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const exec = promisify(execFile)
const root = resolve(fileURLToPath(new URL('..', import.meta.url)))
const sourcePath = resolve(`${root}/data/source/store-11012911-202607191359.csv`)
const outputDirectory = resolve(`${root}/public/images/catalog/clothing-leather`)
const manifestPath = resolve(`${root}/data/catalog/clothing-leather-images.json`)
const temporaryDirectory = resolve(`${root}/.tmp/clothing-leather-images`)
const magick = process.env.MAGICK_BIN || 'magick'
const CARD_WIDTHS = [480, 720, 960, 1280]
const FULL_WIDTHS = [960, 1440, 1920]
const CARD_SIZES = '(max-width: 639px) calc(100vw - 40px), (max-width: 1023px) calc((100vw - 80px) / 2), (max-width: 1439px) calc((100vw - 400px) / 3), 252px'
const FULL_SIZES = '(max-width: 639px) calc(100vw - 40px), (max-width: 899px) 46vw, 52vw'
const WEBP = { quality: 90, method: 6, smartSubsample: false, nearLossless: false }

function parseCsv(source) {
  const rows = []; let row = []; let value = ''; let quoted = false
  for (let index = 0; index < source.length; index += 1) {
    const character = source[index]
    if (character === '"') { if (quoted && source[index + 1] === '"') { value += '"'; index += 1 } else quoted = !quoted }
    else if (character === ';' && !quoted) { row.push(value); value = '' }
    else if ((character === '\n' || character === '\r') && !quoted) { if (character === '\r' && source[index + 1] === '\n') index += 1; row.push(value); rows.push(row); row = []; value = '' }
    else value += character
  }
  if (value || row.length) { row.push(value); rows.push(row) }
  return rows.filter(rowItem => rowItem.some(Boolean))
}

const clean = value => value?.trim() || null
const imageUrls = value => [...new Set(String(value ?? '').match(/https?:\/\/[^\s,;"']+/g) ?? [])]
const sha256 = buffer => createHash('sha256').update(buffer).digest('hex')
const fileExists = path => access(path).then(() => true).catch(() => false)
const publicPath = path => `/${path.replace(`${root}/public/`, '')}`
const outputName = width => `w${width}-v2.webp`

async function dimensions(path) {
  const { stdout } = await exec(magick, ['identify', '-format', '%w %h', path])
  const [width, height] = stdout.trim().split(/\s+/).map(Number)
  if (!width || !height) throw new Error(`Could not read image dimensions for ${path}`)
  return { width, height }
}
async function runWebp(input, width, output) {
  await exec(magick, [input, '-auto-orient', '-strip', '-resize', `${width}x>`, '-define', `webp:method=${WEBP.method}`, '-define', 'webp:use-sharp-yuv=true', '-quality', String(WEBP.quality), output])
}
function targetWidths(sourceWidth, wanted) {
  return [...new Set([...wanted.filter(width => width < sourceWidth), sourceWidth])].sort((left, right) => left - right)
}
function setFor(widths, variants, sizes) {
  const available = widths.map(width => variants.get(width))
  const last = available.at(-1)
  if (!last) throw new Error('Responsive image set has no variants')
  return { src: last.src, srcSet: available.map(item => `${item.src} ${item.width}w`).join(', '), sizes, width: last.width, height: last.height, variants: available }
}

const raw = (await readFile(sourcePath, 'utf8')).replace(/^\uFEFF/, '')
const [header, ...records] = parseCsv(raw)
const columns = Object.fromEntries(header.map((name, index) => [name, index]))
const get = (record, column) => record[columns[column]] ?? ''
const parents = records.filter(record => !clean(get(record, 'Parent UID')) && /\/odejnayakozha(?:\/[^/?]+)?\/tproduct\//.test(get(record, 'Url')))
if (parents.length !== 88) throw new Error(`Expected 88 clothing leather products, found ${parents.length}`)

await rm(temporaryDirectory, { recursive: true, force: true })
await mkdir(temporaryDirectory, { recursive: true })
await mkdir(outputDirectory, { recursive: true })
await mkdir(resolve(manifestPath, '..'), { recursive: true })
for (const entry of await readdir(outputDirectory, { withFileTypes: true })) if (entry.isDirectory() && /^\d+$/.test(entry.name)) await rm(resolve(outputDirectory, entry.name), { recursive: true, force: true })

const hashes = new Map()
const errors = []; const duplicates = []; const products = []
for (const record of parents) {
  const id = get(record, 'Tilda UID'); const title = get(record, 'Title'); const sources = imageUrls(get(record, 'Photo'))
  if (!sources.length) { errors.push({ id, error: 'No source image URL' }); products.push({ id, title, sourceImageUrls: [], gallery: [] }); continue }
  const gallery = []
  for (const [index, sourceUrl] of sources.entries()) {
    try {
      const response = await fetch(sourceUrl, { redirect: 'follow', headers: { 'user-agent': 'OZELIF image importer/2.0' } })
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      const buffer = Buffer.from(await response.arrayBuffer())
      if (!buffer.length) throw new Error('Empty response body')
      const digest = sha256(buffer)
      const duplicateOf = hashes.get(digest)
      if (duplicateOf) { duplicates.push({ id, sourceUrl, duplicateOf: duplicateOf.sourceUrl }); gallery.push({ ...duplicateOf, sourceUrl, alt: `${title} — натуральная одежная кожа` }); continue }
      const productDirectory = resolve(outputDirectory, id)
      const input = resolve(temporaryDirectory, `${id}-${index}-${basename(new URL(sourceUrl).pathname) || 'source'}`)
      await mkdir(productDirectory, { recursive: true }); await writeFile(input, buffer)
      const source = await dimensions(input)
      const allWidths = [...new Set([...targetWidths(source.width, CARD_WIDTHS), ...targetWidths(source.width, FULL_WIDTHS)])].sort((left, right) => left - right)
      const variants = new Map()
      for (const width of allWidths) {
        const output = resolve(productDirectory, outputName(width))
        await runWebp(input, width, output)
        const outputDimensions = await dimensions(output)
        variants.set(width, { src: publicPath(output), width: outputDimensions.width, height: outputDimensions.height, bytes: (await stat(output)).size })
      }
      const media = {
        card: setFor(targetWidths(source.width, CARD_WIDTHS), variants, CARD_SIZES),
        full: setFor(targetWidths(source.width, FULL_WIDTHS), variants, FULL_SIZES),
        sourceUrl,
        sourceWidth: source.width,
        sourceHeight: source.height,
        sourceBytes: buffer.length,
        alt: `${title} — натуральная одежная кожа`,
        sha256: digest,
      }
      hashes.set(digest, media); gallery.push(media)
    } catch (error) { errors.push({ id, sourceUrl, error: error instanceof Error ? error.message : String(error) }) }
  }
  products.push({ id, title, sourceImageUrls: sources, gallery })
}

const outputFiles = [...new Set(products.flatMap(product => product.gallery.flatMap(image => [...image.card.variants, ...image.full.variants].map(variant => resolve(`${root}/public${variant.src}`)))))]
const existingFiles = await Promise.all(outputFiles.map(async path => ({ path, exists: await fileExists(path), size: await fileExists(path) ? (await stat(path)).size : 0 })))
const missingFiles = existingFiles.filter(file => !file.exists).map(file => file.path)
const report = {
  generatedAt: new Date().toISOString(),
  encoding: { webp: WEBP, avif: { enabled: false, reason: 'AVIF at the previous quality 45 visibly softened fine leather grain; WebP is the production format for catalog product photography.' } },
  productCount: products.length,
  sourceImageCount: products.reduce((sum, product) => sum + product.sourceImageUrls.length, 0),
  downloadedImages: hashes.size,
  uniqueFiles: hashes.size,
  derivativeFiles: outputFiles.length,
  duplicateSources: duplicates,
  errors,
  productsWithoutImage: products.filter(product => !product.gallery.length).map(product => product.id),
  totalBytes: existingFiles.reduce((sum, file) => sum + file.size, 0),
  products,
}
if (errors.length || missingFiles.length || report.productsWithoutImage.length) throw new Error(JSON.stringify({ errors, missingFiles, productsWithoutImage: report.productsWithoutImage }, null, 2))
await writeFile(manifestPath, `${JSON.stringify(report, null, 2)}\n`)
await rm(temporaryDirectory, { recursive: true, force: true })
console.log(JSON.stringify({ downloadedImages: report.downloadedImages, uniqueFiles: report.uniqueFiles, derivativeFiles: report.derivativeFiles, duplicates: duplicates.length, errors: errors.length, totalBytes: report.totalBytes, productsWithoutImage: report.productsWithoutImage.length, avif: report.encoding.avif.enabled }, null, 2))
