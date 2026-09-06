import { query, pool } from '../lib/db.mjs'
const secret = process.env.METRIKA_MEASUREMENT_SECRET
try {
  if (!secret) {
    console.log('disabled: METRIKA_MEASUREMENT_SECRET is not configured; no data sent')
  } else {
    await query("UPDATE metrika_purchase_outbox SET status='uncertain' WHERE status='sending' AND created_at<now()-interval '10 minutes'")
    await query("UPDATE metrika_purchase_outbox SET status='expired' WHERE status='pending' AND created_at<now()-interval '12 hours'")
    const rows = await query("UPDATE metrika_purchase_outbox SET status='sending' WHERE order_id IN (SELECT order_id FROM metrika_purchase_outbox WHERE status='pending' ORDER BY created_at LIMIT 50 FOR UPDATE SKIP LOCKED) RETURNING *")
    for (const row of rows.rows) {
      const p = row.payload
      const body = new URLSearchParams({ tid: '112275551', cid: p.clientId, t: 'event', pa: 'purchase', ti: p.order_id, tr: String(p.revenue), cu: 'RUB', ms: secret, et: String(Math.floor(new Date(row.created_at).getTime()/1000)), dl: 'https://ozelifkoja.ru/' })
      p.products.forEach((item, i) => { const prefix = `pr${i+1}`; for (const [key, value] of Object.entries({ id: item.id, nm: item.name, ca: item.category, pr: item.price, qt: item.quantity })) body.set(prefix + key, String(value)) })
      try {
        const common = new URLSearchParams({ tid: '112275551', ms: secret })
        body.delete('ms'); body.delete('tid')
        const page = new URLSearchParams({ cid: p.clientId, t: 'pageview', dl: 'https://ozelifkoja.ru/', et: body.get('et') })
        const conversion = new URLSearchParams({ cid: p.clientId, t: 'event', ea: 'purchase', ev: String(p.revenue), cu: 'RUB', dl: 'https://ozelifkoja.ru/', et: body.get('et') })
        const response = await fetch('https://mc.yandex.ru/collect?' + common, { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: [page, body, conversion].join('\n'), signal: AbortSignal.timeout(15000) })
        const accepted = response.ok && (await response.text()).includes('<!-- OK -->')
        await query("UPDATE metrika_purchase_outbox SET status=$2,sent_at=CASE WHEN $2='sent' THEN now() ELSE NULL END WHERE order_id=$1", [row.order_id, accepted ? 'sent' : 'uncertain'])
      } catch { await query("UPDATE metrika_purchase_outbox SET status='uncertain' WHERE order_id=$1", [row.order_id]) }
    }
    console.log(JSON.stringify((await query('SELECT status,count(*) FROM metrika_purchase_outbox GROUP BY status')).rows))
  }
} finally { await pool.end() }
