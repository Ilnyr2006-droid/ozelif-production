import crypto from 'node:crypto'
import fs from 'node:fs/promises'
import path from 'node:path'
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { pool } from '../server/lib/db.mjs'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const apply = process.argv.includes('--apply')
const outputRoot = path.join(root, 'public', 'images', 'catalog')
const manifestPath = path.join(root, 'docs', 'catalog-image-localization-report.json')

function safeSegment(value) {
  return String(value ?? '').toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-|-$/g, '')
}

function run(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: ['ignore', 'pipe', 'pipe'] })
    let error = ''
    child.stderr.on('data', chunk => { error += chunk })
    child.on('error', reject)
    child.on('close', code => code === 0 ? resolve() : reject(new Error(`${command} exited ${code}: ${error.slice(0, 500)}`)))
  })
}

async function download(url) {
  const response = await fetch(url, { signal: AbortSignal.timeout(30_000) })
  if (!response.ok) throw new Error(`Image HTTP ${response.status}: ${url}`)
  const buffer = Buffer.from(await response.arrayBuffer())
  if (buffer.length < 1_000) throw new Error(`Image is unexpectedly small: ${url}`)
  return buffer
}

async function main() {
  const client = await pool.connect()
  const generated = []
  try {
    const result = await client.query(`
      SELECT p.id::text, COALESCE(p.legacy_id, p.id::text) AS public_id,
             p.primary_image, c.slug AS category_slug
      FROM products p
      JOIN categories c ON c.id = p.category_id
      WHERE p.is_published = true
        AND c.is_published = true
        AND p.primary_image ~ '^https?://'
      ORDER BY c.slug, p.created_at, p.id
    `)

    if (!apply) {
      console.log(JSON.stringify({ apply: false, imagesToLocalize: result.rowCount }, null, 2))
      return
    }

    for (const row of result.rows) {
      const category = safeSegment(row.category_slug)
      const product = safeSegment(row.public_id)
      if (!category || !product) throw new Error(`Unsafe image path for product ${row.id}`)
      const directory = path.join(outputRoot, category, product)
      await fs.mkdir(directory, { recursive: true })
      const source = await download(row.primary_image)
      const sourcePath = path.join(directory, 'source-image')
      await fs.writeFile(sourcePath, source)

      const files = []
      for (const width of [480, 720, 1280]) {
        const target = path.join(directory, `w${width}.webp`)
        await run('convert', [sourcePath, '-auto-orient', '-strip', '-resize', `${width}x${width}>`, '-quality', width === 1280 ? '86' : '82', target])
        const data = await fs.readFile(target)
        files.push({
          width,
          path: `/${path.relative(path.join(root, 'public'), target).split(path.sep).join('/')}`,
          bytes: data.length,
          sha256: crypto.createHash('sha256').update(data).digest('hex'),
        })
      }
      await fs.rm(sourcePath, { force: true })
      generated.push({ productId: row.id, category, sourceUrl: row.primary_image, primaryImage: files[1].path, files })
    }

    await client.query('BEGIN')
    try {
      for (const item of generated) {
        await client.query(`
          UPDATE products
          SET primary_image = $2,
              attributes = jsonb_set(
                COALESCE(attributes, '{}'::jsonb),
                '{auditSourceImageUrls}',
                to_jsonb(ARRAY[$3]::text[]),
                true
              ),
              updated_at = now()
          WHERE id = $1
            AND primary_image = $3
        `, [item.productId, item.primaryImage, item.sourceUrl])
        await client.query(`UPDATE product_images SET url = $2 WHERE product_id = $1 AND url = $3`, [item.productId, item.primaryImage, item.sourceUrl])
      }
      await client.query('COMMIT')
    } catch (error) {
      await client.query('ROLLBACK')
      throw error
    }

    const report = {
      generatedAt: new Date().toISOString(),
      productCount: generated.length,
      fileCount: generated.reduce((sum, item) => sum + item.files.length, 0),
      totalBytes: generated.flatMap(item => item.files).reduce((sum, file) => sum + file.bytes, 0),
      products: generated,
    }
    await fs.mkdir(path.dirname(manifestPath), { recursive: true })
    await fs.writeFile(manifestPath, `${JSON.stringify(report, null, 2)}\n`)
    console.log(JSON.stringify({ productCount: report.productCount, fileCount: report.fileCount, totalBytes: report.totalBytes, manifestPath }, null, 2))
  } finally {
    client.release()
    await pool.end()
  }
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
})
