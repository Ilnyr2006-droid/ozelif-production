import express from 'express'
import { query, transaction } from '../lib/db.mjs'
import { requirePermission } from '../lib/admin-auth.mjs'
import { changeOrderStatus } from '../lib/order-crm.mjs'
function asyncRoute(handler) { return (req,res,next) => Promise.resolve(handler(req,res,next)).catch(next) }
function positive(value, fallback, max) { const n = Number(value); return Number.isInteger(n) && n > 0 ? Math.min(n, max) : fallback }
export function createAdminCrmRouter() {
  const router = express.Router(); router.use(requirePermission('crm:read'))
  router.get('/orders', asyncRoute(async (req,res) => { const limit=positive(req.query.limit,25,100); const offset=Math.max(0,Number(req.query.offset)||0); const q=String(req.query.q??'').trim(); const status=String(req.query.status??'').trim(); const result=await query(`SELECT o.id,o.public_number,o.status,o.total_amount,o.currency,o.delivery_city,o.delivery_address,o.desired_delivery_date,o.customer_email_snapshot,o.customer_comment,o.source,o.delivery_method,o.delivery_company,o.tracking_number,o.created_at,o.updated_at,c.name AS customer_name,c.original_phone,c.email AS customer_email,coalesce((select string_agg(concat(i.product_name_snapshot, ' ×', i.quantity), ', ' order by i.id) from order_items i where i.order_id=o.id),'—') AS items_summary FROM orders o JOIN customers c ON c.id=o.customer_id WHERE ($1='' OR o.public_number::text ILIKE '%'||$1||'%' OR c.name ILIKE '%'||$1||'%' OR c.original_phone ILIKE '%'||$1||'%') AND ($2='' OR o.status=$2) ORDER BY o.created_at DESC LIMIT $3 OFFSET $4`,[q,status,limit,offset]); const total=await query(`SELECT count(*)::int AS total FROM orders o JOIN customers c ON c.id=o.customer_id WHERE ($1='' OR o.public_number::text ILIKE '%'||$1||'%' OR c.name ILIKE '%'||$1||'%' OR c.original_phone ILIKE '%'||$1||'%') AND ($2='' OR o.status=$2)`,[q,status]); res.json({items:result.rows,total:total.rows[0].total,limit,offset}) }))
  router.get('/orders/:id', asyncRoute(async (req,res) => { const order=await query(`SELECT o.*,c.name AS customer_name,c.original_phone,c.normalized_phone,c.email,(SELECT count(*)::int FROM telegram_customer_links t WHERE t.customer_id=c.id AND t.revoked_at IS NULL) AS telegram_linked FROM orders o JOIN customers c ON c.id=o.customer_id WHERE o.id=$1`,[req.params.id]); if(!order.rowCount)return res.status(404).json({error:'not_found'}); const [items,history,chats,outbox]=await Promise.all([query('SELECT * FROM order_items WHERE order_id=$1',[req.params.id]),query('SELECT * FROM order_status_history WHERE order_id=$1 ORDER BY created_at,id',[req.params.id]),query('SELECT id,status,last_message_at FROM live_chat_conversations WHERE customer_id=$1 ORDER BY last_message_at DESC',[order.rows[0].customer_id]),query('SELECT event_type,status,attempts,last_error,created_at,processed_at FROM notification_outbox WHERE aggregate_type=\'order\' AND aggregate_id=$1 ORDER BY created_at DESC',[req.params.id])]);res.json({item:order.rows[0],items:items.rows,history:history.rows,chats:chats.rows,outbox:outbox.rows}) }))
  router.patch('/orders/:id/status', requirePermission('crm:write'), asyncRoute(async (req,res)=>res.json({item:await changeOrderStatus(req.params.id,req.body,req.admin?.id,query)})))
  router.delete(
    '/orders/:id',
    requirePermission('crm:write'),
    asyncRoute(async (req, res) => {
      await transaction(async client => {
        const existing = await client.query(
          `SELECT id
           FROM orders
           WHERE id = $1
           FOR UPDATE`,
          [req.params.id],
        )

        if (!existing.rowCount) {
          const error = new Error('Заказ не найден')
          error.status = 404
          throw error
        }

        await client.query(
          `DELETE FROM order_access_sessions
           WHERE order_id = $1`,
          [req.params.id],
        )

        await client.query(
          `DELETE FROM telegram_link_tokens
           WHERE order_id = $1`,
          [req.params.id],
        )

        await client.query(
          `DELETE FROM notification_outbox
           WHERE aggregate_type = 'order'
             AND aggregate_id = $1`,
          [req.params.id],
        )

        await client.query(
          `DELETE FROM order_status_history
           WHERE order_id = $1`,
          [req.params.id],
        )

        await client.query(
          `DELETE FROM order_items
           WHERE order_id = $1`,
          [req.params.id],
        )

        await client.query(
          `DELETE FROM orders
           WHERE id = $1`,
          [req.params.id],
        )
      })

      res.status(204).end()
    }),
  )

  router.get('/customers', asyncRoute(async (_req,res)=>{const result=await query(`SELECT c.id,c.name,c.original_phone,c.email,c.source,c.created_at,count(o.id)::int AS orders_count,coalesce(sum(o.total_amount),0) AS total_amount,max(o.created_at) AS last_order_at,(select count(*)::int from live_chat_conversations lc where lc.customer_id=c.id) AS chats_count,exists(select 1 from telegram_customer_links t where t.customer_id=c.id and t.revoked_at is null) AS telegram_linked FROM customers c LEFT JOIN orders o ON o.customer_id=c.id WHERE c.deleted_at IS NULL GROUP BY c.id ORDER BY max(o.created_at) DESC NULLS LAST,c.created_at DESC LIMIT 200`);res.json({items:result.rows})}))


  router.delete(
    '/customers/:id',
    requirePermission('crm:write'),
    asyncRoute(async (req, res) => {
      const customer = await query(
        `SELECT id
         FROM customers
         WHERE id = $1
           AND deleted_at IS NULL
         LIMIT 1`,
        [req.params.id],
      )

      if (!customer.rowCount) {
        const error = new Error(
          'Клиент не найден',
        )

        error.status = 404
        throw error
      }

      const result = await query(
        `SELECT COUNT(*)::integer AS count
         FROM orders
         WHERE customer_id = $1`,
        [req.params.id],
      )

      const orderCount = Number(
        result.rows[0]?.count ?? 0,
      )

      if (orderCount > 0) {
        const error = new Error(
          `Нельзя удалить клиента: `
          + `у него осталось заказов — ${orderCount}. `
          + `Сначала удалите все его заказы.`,
        )

        error.status = 409
        error.code = 'CUSTOMER_HAS_ORDERS'

        throw error
      }

      await query(
        `UPDATE customers
         SET
           deleted_at = now(),
           updated_at = now()
         WHERE id = $1
           AND deleted_at IS NULL`,
        [req.params.id],
      )

      res.status(204).end()
    }),
  )


  router.get('/customers/:id', asyncRoute(async (req,res)=>{const customer=await query(`SELECT c.id,c.name,c.original_phone,c.normalized_phone,c.email,c.source,c.created_at,c.updated_at,(select count(*)::int from live_chat_conversations lc where lc.customer_id=c.id) AS chats_count FROM customers c WHERE c.id=$1 AND c.deleted_at IS NULL`,[req.params.id]);if(!customer.rowCount)return res.status(404).json({error:'not_found'});const [orders,chats]=await Promise.all([query(`SELECT id,public_number,status,total_amount,currency,created_at FROM orders WHERE customer_id=$1 ORDER BY created_at DESC LIMIT 100`,[req.params.id]),query(`SELECT id,visitor_name AS "visitorName",visitor_phone AS "visitorPhone",status,last_message_at AS "lastMessageAt",created_at AS "createdAt" FROM live_chat_conversations WHERE customer_id=$1 ORDER BY last_message_at DESC NULLS LAST,created_at DESC LIMIT 100`,[req.params.id])]);res.json({item:customer.rows[0],orders:orders.rows,chats:chats.rows})}))

  router.get(
    '/wholesale-leads',
    asyncRoute(async (req, res) => {
      const limit = positive(req.query.limit, 100, 500)
      const offset = Math.max(
        0,
        Number(req.query.offset) || 0,
      )
      const q = String(req.query.q ?? '').trim()
      const status = String(
        req.query.status ?? '',
      ).trim()

      const result = await query(
        `
          SELECT
            id::text,
            public_number::text,
            name,
            phone,
            normalized_phone,
            company,
            city,
            category,
            volume,
            comment,
            source,
            status,
            page_path,
            created_at,
            updated_at
          FROM wholesale_leads
          WHERE (
            $1 = ''
            OR public_number::text ILIKE '%' || $1 || '%'
            OR name ILIKE '%' || $1 || '%'
            OR phone ILIKE '%' || $1 || '%'
            OR company ILIKE '%' || $1 || '%'
            OR city ILIKE '%' || $1 || '%'
            OR category ILIKE '%' || $1 || '%'
          )
          AND (
            $2 = ''
            OR status = $2
          )
          ORDER BY
            CASE WHEN status = 'new' THEN 0 ELSE 1 END,
            created_at DESC
          LIMIT $3
          OFFSET $4
        `,
        [q, status, limit, offset],
      )

      const total = await query(
        `
          SELECT COUNT(*)::integer AS total
          FROM wholesale_leads
          WHERE (
            $1 = ''
            OR public_number::text ILIKE '%' || $1 || '%'
            OR name ILIKE '%' || $1 || '%'
            OR phone ILIKE '%' || $1 || '%'
            OR company ILIKE '%' || $1 || '%'
            OR city ILIKE '%' || $1 || '%'
            OR category ILIKE '%' || $1 || '%'
          )
          AND (
            $2 = ''
            OR status = $2
          )
        `,
        [q, status],
      )

      const newCount = await query(
        `
          SELECT COUNT(*)::integer AS total
          FROM wholesale_leads
          WHERE status = 'new'
        `,
      )

      res.json({
        items: result.rows,
        total: total.rows[0]?.total ?? 0,
        newCount: newCount.rows[0]?.total ?? 0,
        limit,
        offset,
      })
    }),
  )

  router.patch(
    '/wholesale-leads/:id/status',
    requirePermission('crm:write'),
    asyncRoute(async (req, res) => {
      const allowedStatuses = new Set([
        'new',
        'contacted',
        'qualified',
        'completed',
        'cancelled',
      ])

      const status = String(
        req.body?.status ?? '',
      ).trim()

      if (!allowedStatuses.has(status)) {
        return res.status(400).json({
          error: 'Недопустимый статус заявки',
        })
      }

      const result = await query(
        `
          UPDATE wholesale_leads
          SET
            status = $2,
            updated_at = now()
          WHERE id = $1
          RETURNING
            id::text,
            public_number::text,
            name,
            phone,
            normalized_phone,
            company,
            city,
            category,
            volume,
            comment,
            source,
            status,
            page_path,
            created_at,
            updated_at
        `,
        [req.params.id, status],
      )

      if (!result.rowCount) {
        return res.status(404).json({
          error: 'Заявка не найдена',
        })
      }

      res.json({
        item: result.rows[0],
      })
    }),
  )

  router.delete(
    '/wholesale-leads/:id',
    requirePermission('crm:write'),
    asyncRoute(async (req, res) => {
      const result = await query(
        `
          DELETE FROM wholesale_leads
          WHERE id = $1
          RETURNING id
        `,
        [req.params.id],
      )

      if (!result.rowCount) {
        return res.status(404).json({
          error: 'Заявка не найдена',
        })
      }

      res.status(204).end()
    }),
  )


  router.get(
    '/production-leads',
    asyncRoute(async (req, res) => {
      const q = String(req.query.q ?? '').trim()
      const status = String(
        req.query.status ?? '',
      ).trim()

      const result = await query(
        `
          SELECT
            id::text,
            public_number::text,
            name,
            phone,
            normalized_phone,
            product_type,
            quantity,
            comment,
            source,
            status,
            page_path,
            created_at,
            updated_at
          FROM production_leads
          WHERE (
            $1 = ''
            OR name ILIKE '%' || $1 || '%'
            OR phone ILIKE '%' || $1 || '%'
            OR product_type ILIKE '%' || $1 || '%'
            OR quantity ILIKE '%' || $1 || '%'
          )
          AND (
            $2 = ''
            OR status = $2
          )
          ORDER BY
            CASE WHEN status = 'new' THEN 0 ELSE 1 END,
            created_at DESC
          LIMIT 200
        `,
        [q, status],
      )

      const total = await query(
        `
          SELECT COUNT(*)::integer AS total
          FROM production_leads
          WHERE (
            $1 = ''
            OR name ILIKE '%' || $1 || '%'
            OR phone ILIKE '%' || $1 || '%'
            OR product_type ILIKE '%' || $1 || '%'
            OR quantity ILIKE '%' || $1 || '%'
          )
          AND (
            $2 = ''
            OR status = $2
          )
        `,
        [q, status],
      )

      const newCount = await query(
        `
          SELECT COUNT(*)::integer AS total
          FROM production_leads
          WHERE status = 'new'
        `,
      )

      res.json({
        items: result.rows,
        total: total.rows[0]?.total ?? 0,
        newCount:
          newCount.rows[0]?.total ?? 0,
      })
    }),
  )

  router.patch(
    '/production-leads/:id/status',
    requirePermission('crm:write'),
    asyncRoute(async (req, res) => {
      const allowedStatuses = new Set([
        'new',
        'contacted',
        'estimating',
        'completed',
        'cancelled',
      ])

      const status = String(
        req.body?.status ?? '',
      ).trim()

      if (!allowedStatuses.has(status)) {
        return res.status(400).json({
          error: 'Недопустимый статус заявки',
        })
      }

      const result = await query(
        `
          UPDATE production_leads
          SET
            status = $2,
            updated_at = now()
          WHERE id = $1
          RETURNING *
        `,
        [req.params.id, status],
      )

      if (!result.rowCount) {
        return res.status(404).json({
          error: 'Заявка не найдена',
        })
      }

      res.json({
        item: result.rows[0],
      })
    }),
  )

  router.delete(
    '/production-leads/:id',
    requirePermission('crm:write'),
    asyncRoute(async (req, res) => {
      const result = await query(
        `
          DELETE FROM production_leads
          WHERE id = $1
          RETURNING id
        `,
        [req.params.id],
      )

      if (!result.rowCount) {
        return res.status(404).json({
          error: 'Заявка не найдена',
        })
      }

      res.status(204).end()
    }),
  )


  router.get(
    '/manager-leads',
    asyncRoute(async (req, res) => {
      const q = String(
        req.query.q ?? '',
      ).trim()

      const status = String(
        req.query.status ?? '',
      ).trim()

      const result = await query(
        `
          SELECT
            id::text,
            public_number::text,
            name,
            phone,
            normalized_phone,
            comment,
            source,
            status,
            page_path,
            created_at,
            updated_at
          FROM manager_leads
          WHERE (
            $1 = ''
            OR public_number::text
              ILIKE '%' || $1 || '%'
            OR name
              ILIKE '%' || $1 || '%'
            OR phone
              ILIKE '%' || $1 || '%'
            OR comment
              ILIKE '%' || $1 || '%'
          )
          AND (
            $2 = ''
            OR status = $2
          )
          ORDER BY
            CASE
              WHEN status = 'new'
              THEN 0
              ELSE 1
            END,
            created_at DESC
          LIMIT 200
        `,
        [q, status],
      )

      const total = await query(
        `
          SELECT
            COUNT(*)::integer AS total
          FROM manager_leads
          WHERE (
            $1 = ''
            OR public_number::text
              ILIKE '%' || $1 || '%'
            OR name
              ILIKE '%' || $1 || '%'
            OR phone
              ILIKE '%' || $1 || '%'
            OR comment
              ILIKE '%' || $1 || '%'
          )
          AND (
            $2 = ''
            OR status = $2
          )
        `,
        [q, status],
      )

      const newCount = await query(
        `
          SELECT
            COUNT(*)::integer AS total
          FROM manager_leads
          WHERE status = 'new'
        `,
      )

      res.json({
        items: result.rows,
        total:
          total.rows[0]?.total ?? 0,
        newCount:
          newCount.rows[0]?.total ?? 0,
      })
    }),
  )

  router.patch(
    '/manager-leads/:id/status',
    requirePermission('crm:write'),
    asyncRoute(async (req, res) => {
      const allowedStatuses =
        new Set([
          'new',
          'contacted',
          'completed',
          'cancelled',
        ])

      const status = String(
        req.body?.status ?? '',
      ).trim()

      if (
        !allowedStatuses.has(status)
      ) {
        return res.status(400).json({
          error:
            'Недопустимый статус заявки',
        })
      }

      const result = await query(
        `
          UPDATE manager_leads
          SET
            status = $2,
            updated_at = now()
          WHERE id = $1
          RETURNING
            id::text,
            public_number::text,
            name,
            phone,
            normalized_phone,
            comment,
            source,
            status,
            page_path,
            created_at,
            updated_at
        `,
        [
          req.params.id,
          status,
        ],
      )

      if (!result.rowCount) {
        return res.status(404).json({
          error:
            'Заявка не найдена',
        })
      }

      res.json({
        item: result.rows[0],
      })
    }),
  )

  router.delete(
    '/manager-leads/:id',
    requirePermission('crm:write'),
    asyncRoute(async (req, res) => {
      const result = await query(
        `
          DELETE FROM manager_leads
          WHERE id = $1
          RETURNING id
        `,
        [req.params.id],
      )

      if (!result.rowCount) {
        return res.status(404).json({
          error:
            'Заявка не найдена',
        })
      }

      res.status(204).end()
    }),
  )

  return router
}
