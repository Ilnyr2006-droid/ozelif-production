import { createLiveChatRouter } from './routes/live-chat.mjs'
import { createAdminLiveChatsRouter } from './routes/admin-live-chats.mjs'
import { createAdminAiPromptRouter } from './routes/admin-ai-prompt.mjs'
import express from 'express'
import helmet from 'helmet'
import multer from 'multer'
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { env } from './lib/env.mjs'
import { pool, query } from './lib/db.mjs'
import { clearSessionCookie, createSessionToken, hashSessionToken, readSessionToken, sessionCookie, verifyPassword } from './lib/security.mjs'
import { currentAdmin, requireAdmin, requirePermission } from './lib/admin-auth.mjs'
import { deprecatedApi } from './lib/api-deprecation.mjs'

fs.mkdirSync(env.uploadDir, { recursive: true })
import { createAdminV2Router } from './routes/admin-v2.mjs'
import { createAdminV3Router, createPublicProductRouter } from './routes/admin-v3.mjs'
import { createAdminV4Router } from './routes/admin-v4.mjs'
import { createAdminV5Router } from './routes/admin-v5.mjs'
import { createAiCatalogRouter } from './routes/ai-catalog.mjs'
import { createAiAssistantRouter } from './routes/ai-assistant.mjs'
import { jsonErrorHandler, jsonNotFoundHandler } from './lib/http-errors.mjs'
import { createPublicCatalogRouter } from './routes/public-catalog.mjs'
import { createPublicCatalogRepository } from './lib/public-catalog.mjs'
import { createPublicProductSeoRouter } from './routes/public-product-seo.mjs'
import { createPublicCategorySeoRouter } from './routes/public-category-seo.mjs'
import { createPublicSitemapRouter } from './routes/public-sitemap.mjs'
import { normalizeCatalogSlug } from './lib/catalog-slug.mjs'
import { createDashboardChatMetricsRepository } from './lib/dashboard-chat-metrics.mjs'
import { createTrafficAnalyticsRepository } from './lib/traffic-analytics.mjs'
import { validateCatalogImage } from './lib/upload-image-validation.mjs'
import { createYandexReviewsRouter } from './routes/yandex-reviews.mjs'
import { createYandexReviewsService } from './lib/yandex-reviews.mjs'
import { createOrdersRouter } from './routes/orders.mjs'
import { createAdminCrmRouter } from './routes/admin-crm.mjs'
import { createAdminNativeAnalyticsRouter } from './routes/admin-native-analytics.mjs'
import { createAdminAiMonitoringRouter } from './routes/admin-ai-monitoring.mjs'
import { createAdminMetabaseRouter } from './routes/admin-metabase.mjs'
import { createTelegramRouter } from './routes/telegram.mjs'
import { createWholesaleLeadsRouter } from './routes/wholesale-leads.mjs'
import { createProductionLeadsRouter } from './routes/production-leads.mjs'
import { createManagerLeadsRouter } from './routes/manager-leads.mjs'

const app = express()
const dashboardChatMetrics = createDashboardChatMetricsRepository({ query })
const trafficAnalytics = createTrafficAnalyticsRepository({ query })
const yandexReviews = createYandexReviewsService({ sourceUrl: env.yandexReviewsSourceUrl })
const publicCatalogRepository = createPublicCatalogRepository({ query })
const analyticsEvents = new Set([
  'page_view',
  'product_view',
  'variant_select',
  'add_to_cart',
  'cart_open',
  'checkout_start',
  'checkout_success',
  'checkout_error',
  'catalog_filter',
  'search_no_results',
  'contact_click',
  'heartbeat',
])
const analyticsMetadataKeys = new Set([
  'category',
  'quantity',
  'itemCount',
  'productId',
  'filter',
  'value',
  'query',
  'channel',
])
app.set('trust proxy', 1)
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }))
app.use(express.json({ limit: '1mb' }))

// Live chat routes require request.body from express.json().
app.use('/api/live-chat', createLiveChatRouter())
app.use('/api/admin/live-chats', createAdminLiveChatsRouter())
app.use('/uploads', express.static(env.uploadDir))

const upload = multer({
  storage: multer.diskStorage({
    destination: env.uploadDir,
    filename: (_req, file, cb) => cb(null, `${Date.now()}-${crypto.randomUUID()}${path.extname(file.originalname).toLowerCase()}`),
  }),
  limits: { fileSize: 12 * 1024 * 1024 },
})
const wrap = fn => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next)
const slugify = normalizeCatalogSlug

async function audit(adminId, action, entityType, entityId, beforeData, afterData) {
  await query(`INSERT INTO audit_log (admin_user_id, action, entity_type, entity_id, before_data, after_data) VALUES ($1,$2,$3,$4,$5,$6)`, [adminId, action, entityType, entityId, beforeData, afterData])
}

app.get('/api/health', wrap(async (_req, res) => res.json({ ok: true, databaseTime: (await query('SELECT now() AS t')).rows[0].t })))
app.post('/api/admin/login', wrap(async (req, res) => {
  const identifier = String(
    req.body?.username ?? req.body?.email ?? '',
  ).trim().toLowerCase()
  const password = String(req.body?.password ?? '')

  const result = await query(
    `SELECT *
     FROM admin_users
     WHERE is_active = true
       AND (
         lower(username) = $1
         OR lower(email) = $1
       )
     LIMIT 1`,
    [identifier],
  )
  const user = result.rows[0]
  if (!user || !(await verifyPassword(password, user.password_hash))) return res.status(401).json({ error: 'Неверный логин или пароль' })
  const token = createSessionToken()
  await query(`INSERT INTO admin_sessions (user_id, token_hash, expires_at) VALUES ($1,$2,now()+($3||' days')::interval)`, [user.id, hashSessionToken(token), env.sessionDays])
  res.setHeader('Set-Cookie', sessionCookie(token, env.sessionDays * 86400))
  res.json({ user: { id: user.id, email: user.email, name: user.name, role: user.role } })
}))
app.post('/api/admin/logout', wrap(async (req, res) => {
  const token = readSessionToken(req)
  if (token) await query('DELETE FROM admin_sessions WHERE token_hash = $1', [hashSessionToken(token)])
  res.setHeader('Set-Cookie', clearSessionCookie())
  res.status(204).end()
}))
app.get('/api/admin/session', wrap(async (req, res) => {
  const user = await currentAdmin(req)
  if (!user) return res.status(401).json({ error: 'unauthorized' })
  res.json({ user })
}))
app.get('/api/admin/dashboard', requirePermission('dashboard:read'), wrap(async (_req, res) => {
  const [baseMetrics, chatMetrics] = await Promise.all([
    query(`SELECT
    (SELECT count(*)::int FROM visitor_sessions WHERE last_seen_at >= current_date) visitors_today,
    (SELECT count(*)::int FROM analytics_events WHERE event_name='page_view' AND created_at >= current_date) page_views_today,
    (SELECT count(*)::int FROM analytics_events WHERE event_name='product_view' AND created_at >= current_date) product_views_today,
    (SELECT count(*)::int FROM analytics_events WHERE event_name='add_to_cart' AND created_at >= current_date) add_to_cart_today,
    (SELECT count(*)::int FROM categories) categories_count,
    (SELECT count(*)::int FROM products) products_count,
    (SELECT count(*)::int FROM products WHERE primary_image IS NULL OR primary_image='') products_without_image,
    (SELECT count(*)::int FROM products WHERE base_price IS NULL) products_without_price
    `),
    dashboardChatMetrics.getMetrics(),
  ])
  const metrics = { ...baseMetrics.rows[0], ...chatMetrics }
  const recentActivity = (await query('SELECT action, entity_type, entity_id, created_at FROM audit_log ORDER BY created_at DESC LIMIT 8')).rows
  res.json({ metrics, recentActivity })
}))

app.get(
  '/api/admin/analytics/traffic',
  requirePermission('dashboard:read'),
  wrap(async (_req, res) => {
    res.json(await trafficAnalytics.getTrafficAnalytics())
  }),
)

app.get('/api/admin/catalogs', requirePermission('catalog:read'), wrap(async (_req, res) => {
  const items = (await query(`SELECT c.*, count(p.id)::int products_count FROM categories c LEFT JOIN products p ON p.category_id=c.id GROUP BY c.id ORDER BY c.sort_order,c.created_at`)).rows
  res.json({ items })
}))
app.post('/api/admin/catalogs', requirePermission('catalog:write'), wrap(async (req, res) => {
  const name = String(req.body?.name ?? '').trim()
  const slug = slugify(req.body?.slug || name)
  if (!name || !slug) return res.status(400).json({ error: 'Укажите название и адрес каталога' })
  const item = (await query(`INSERT INTO categories (name,slug,description,cover_image,is_published,show_on_home,show_in_menu) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`, [name,slug,String(req.body?.description ?? ''),req.body?.coverImage || null,Boolean(req.body?.isPublished),req.body?.showOnHome !== false,req.body?.showInMenu !== false])).rows[0]
  await audit(req.admin.id,'create','category',item.id,null,item)
  res.status(201).json({ item })
}))
app.get('/api/admin/products', requirePermission('catalog:read'), wrap(async (_req, res) => {
  const items = (await query(`SELECT p.*,c.name category_name,c.slug category_slug FROM products p JOIN categories c ON c.id=p.category_id ORDER BY p.updated_at DESC LIMIT 300`)).rows
  res.json({ items })
}))
app.post('/api/admin/products', requirePermission('catalog:write'), wrap(async (req, res) => {
  const name = String(req.body?.name ?? '').trim()
  const slug = slugify(req.body?.slug || name)
  const categoryId = String(req.body?.categoryId ?? '')
  if (!name || !slug || !categoryId) return res.status(400).json({ error: 'Укажите каталог, название и адрес товара' })
  const item = (await query(`INSERT INTO products (category_id,name,slug,description,sku,base_price,old_price,unit,stock_quantity,min_order,primary_image,is_published) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *`, [categoryId,name,slug,String(req.body?.description ?? ''),req.body?.sku || null,req.body?.basePrice || null,req.body?.oldPrice || null,req.body?.unit || null,req.body?.stockQuantity || null,req.body?.minOrder || null,req.body?.primaryImage || null,Boolean(req.body?.isPublished)])).rows[0]
  await audit(req.admin.id,'create','product',item.id,null,item)
  res.status(201).json({ item })
}))
app.post('/api/admin/uploads', requirePermission('catalog:upload'), upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Файл не получен' })

  const filePath = req.file.path
  const header = fs.readFileSync(filePath, { encoding: null }).subarray(0, 256)
  const validation = validateCatalogImage({
    buffer: header,
    originalname: req.file.originalname,
    mimetype: req.file.mimetype,
  })

  if (!validation.valid) {
    fs.unlinkSync(filePath)
    return res.status(400).json({ error: validation.error })
  }

  const filename = `${Date.now()}-${crypto.randomUUID()}${validation.extension}`
  fs.renameSync(filePath, path.join(env.uploadDir, filename))
  res.status(201).json({ url: `/uploads/${filename}` })
})
app.get('/api/admin/chats', requirePermission('chat:read'), wrap(async (_req, res) => res.json({ items: (await query('SELECT * FROM chat_sessions ORDER BY last_message_at DESC LIMIT 200')).rows })))
app.post('/api/analytics/events', wrap(async (req, res) => {
  const sessionId = String(req.body?.sessionId ?? '').slice(0,120)
  const eventName = String(req.body?.eventName ?? '').slice(0,80)
  const pathValue = String(req.body?.path ?? '').slice(0,500)
  if (!sessionId || !analyticsEvents.has(eventName)) return res.status(400).json({ error: 'invalid_event' })
  const incomingMetadata = req.body?.metadata && typeof req.body.metadata === 'object'
    ? req.body.metadata
    : {}
  const metadata = Object.fromEntries(
    Object.entries(incomingMetadata)
      .filter(([key]) => analyticsMetadataKeys.has(key))
      .flatMap(([key, value]) => {
        if (typeof value === 'string') return [[key, value.slice(0, 120)]]
        if (typeof value === 'boolean') return [[key, value]]
        if (typeof value === 'number' && Number.isFinite(value)) return [[key, value]]
        return []
      }),
  )
  await query(`INSERT INTO visitor_sessions (id,first_path,last_path,referrer,user_agent) VALUES ($1,$2,$2,$3,$4) ON CONFLICT (id) DO UPDATE SET last_seen_at=now(),last_path=excluded.last_path`, [sessionId,pathValue || null,String(req.body?.referrer ?? '').slice(0,500) || null,String(req.headers['user-agent'] ?? '').slice(0,500) || null])
  if (eventName !== 'heartbeat') {
    await query(
      `INSERT INTO analytics_events
        (session_id,event_name,path,entity_type,entity_id,metadata)
       VALUES ($1,$2,$3,$4,$5,$6)`,
      [
        sessionId,
        eventName,
        pathValue || null,
        req.body?.entityType || null,
        req.body?.entityId || null,
        metadata,
      ],
    )
  }

  res.status(204).end()
}))
app.get('/api/public/catalogs', wrap(async (_req, res) => res.json({ items: (await query(`SELECT * FROM categories WHERE is_published=true ORDER BY sort_order,created_at`)).rows })))
app.use('/api/yandex-reviews', createYandexReviewsRouter({ service: yandexReviews }))
app.use('/api/admin/v2', createAdminV2Router())
app.use('/api/ai/catalog', createAiCatalogRouter())
app.use('/api/assistant', createAiAssistantRouter())
app.use('/api/admin/v3', deprecatedApi({ successor: '/api/admin/v5/products' }), createAdminV3Router())
app.use('/api/admin/v4', deprecatedApi({ successor: '/api/admin/v5/products' }), createAdminV4Router())
app.use('/api/admin/v5', createAdminV5Router())
app.use('/api/admin/ai-prompt', createAdminAiPromptRouter())
app.use('/api/public/products', createPublicProductRouter())
app.use('/api/public/catalog/v1', createPublicCatalogRouter({ repository: publicCatalogRepository }))
app.use(createPublicSitemapRouter({ query, siteUrl: env.siteUrl }))


app.use(
  '/api/production-leads',
  createProductionLeadsRouter(),
)
app.use(
  '/api/wholesale-leads',
  createWholesaleLeadsRouter(),
)
app.use(
  '/api/manager-leads',
  createManagerLeadsRouter(),
)
app.use('/api/orders', createOrdersRouter())
app.use('/api/admin/crm', createAdminCrmRouter())
app.use('/api/admin/native-analytics', createAdminNativeAnalyticsRouter())
app.use('/api/admin/ai-monitoring', createAdminAiMonitoringRouter())
app.use('/api/admin/metabase', createAdminMetabaseRouter())
app.use('/api/telegram', createTelegramRouter())
// Nginx sends only product detail URLs here. Product metadata is therefore
// rendered from the published PostgreSQL record at request time, including
// products added after the latest frontend build.
app.use(createPublicProductSeoRouter({
  repository: publicCatalogRepository,
  frontendRoot: env.frontendRoot,
}))
app.use(createPublicCategorySeoRouter({
  repository: publicCatalogRepository,
  frontendRoot: env.frontendRoot,
}))

app.use(jsonNotFoundHandler)
app.use(jsonErrorHandler)

const server = app.listen(env.port,'127.0.0.1',()=>console.log(`OZELIF admin API: http://127.0.0.1:${env.port}`))
process.on('SIGTERM',()=>server.close(()=>pool.end().finally(()=>process.exit(0))))
process.on('SIGINT',()=>server.close(()=>pool.end().finally(()=>process.exit(0))))
