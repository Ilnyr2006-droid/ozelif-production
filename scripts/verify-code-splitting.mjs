import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const dist = path.join(root, 'dist')
const indexHtml = fs.readFileSync(path.join(dist, 'index.html'), 'utf8')
const entryAsset = indexHtml.match(/\/assets\/(?:index|main)-[^"']+\.js/)?.[0]?.replace('/assets/', '')
assert.ok(entryAsset, 'The Vite entry JavaScript asset is missing from dist/index.html')

const assets = fs.readdirSync(path.join(dist, 'assets')).filter(file => file.endsWith('.js'))
const entryBytes = fs.statSync(path.join(dist, 'assets', entryAsset)).size
const routeChunks = assets.filter(file => file !== entryAsset)

assert.ok(routeChunks.length >= 8, `Expected route chunks, found ${routeChunks.length}`)
assert.ok(entryBytes < 700 * 1024, `Initial JavaScript is too large: ${entryBytes} bytes`)
console.log(JSON.stringify({ entryAsset, entryBytes, routeChunks: routeChunks.length }))
