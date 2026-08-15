import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const read = relativePath => fs.readFileSync(path.join(root, relativePath), 'utf8')
const systemd = read('ops/production/ozelif-admin-api.service')
const nginx = read('ops/production/ozelif-8091.nginx.conf')
const envExample = read('ops/production/deployment.example.env')
const compose = read('docker-compose.admin.yml')

for (const setting of [
  'EnvironmentFile=/opt/ozelif-admin/.env.admin',
  'NoNewPrivileges=true',
  'ProtectSystem=strict',
  'ReadWritePaths=/opt/ozelif-admin/uploads',
]) assert.match(systemd, new RegExp(setting.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))

for (const setting of [
  'listen 8091;',
  'root /var/www/ozelif-8091;',
  'allow 127.0.0.1;',
  'deny all;',
  'proxy_pass http://127.0.0.1:8093;',
  'try_files $uri $uri/ /index.html;',
  'location = /info {',
  'location = /info/ {',
  'return 301 https://ozelifkoja.ru/delivery;',
  'location ~ ^/[a-z0-9-]+/tproduct/[^/]+/?$',
]) assert.match(nginx, new RegExp(setting.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))

assert.doesNotMatch(envExample, /(PASSWORD|SECRET|API_KEY)\s*=/)
assert.match(compose, /127\.0\.0\.1:\$\{POSTGRES_PORT:-54329\}:5432/)
console.log('Deployment configuration checks passed.')
