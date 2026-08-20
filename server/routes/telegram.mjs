import express from 'express'
import { env } from '../lib/env.mjs'
import { query } from '../lib/db.mjs'
import { findLatestOrderStatusByPhone } from '../lib/customer-order-status.mjs'
import { requirePermission } from '../lib/admin-auth.mjs'
import { handleTelegramUpdate, processTelegramOutbox, telegramEnabled } from '../lib/telegram-bot.mjs'
function asyncRoute(handler) { return (req,res,next) => Promise.resolve(handler(req,res,next)).catch(next) }
export function createTelegramRouter({ processOutbox = processTelegramOutbox, lookupOrderStatus = findLatestOrderStatusByPhone, queryFn = query } = {}) { const router=express.Router(); router.get('/health', (_req,res)=>res.json({ ok:true, enabled:telegramEnabled() })); router.post('/order-status', asyncRoute(async (req,res)=>{ if (!env.telegramWebhookSecret || req.get('X-Telegram-Bot-Api-Secret-Token') !== env.telegramWebhookSecret) return res.status(401).json({error:'unauthorized'}); const order = await lookupOrderStatus(queryFn, req.body?.phone); res.json({ found: Boolean(order), order }); })); router.post('/webhook', asyncRoute(async (req,res)=>{ if (!telegramEnabled()) return res.status(503).json({error:'telegram_not_configured'}); if (!env.telegramWebhookSecret || req.get('X-Telegram-Bot-Api-Secret-Token') !== env.telegramWebhookSecret) return res.status(401).json({error:'unauthorized'}); await handleTelegramUpdate(req.body); res.status(204).end() })); router.post('/outbox/process', requirePermission('crm:write'), asyncRoute(async (_req,res)=>res.json(await processOutbox()))); return router }
