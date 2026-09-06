export function sanitizeAttribution(input) {
  const result = {}
  for (const key of ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'yclid', 'clientId']) {
    const value = String(input?.[key] ?? '')
    if ((['yclid', 'clientId'].includes(key) ? /^\d{1,40}$/ : /^[a-zA-Z0-9_|.-]{1,160}$/).test(value)) result[key] = value
  }
  return result
}
export async function saveAttribution(query, type, id, input) {
  const value = sanitizeAttribution(input)
  if (!Object.keys(value).length) return
  // Analytics must not turn a saved order into a failed checkout.
  try { await query('INSERT INTO ad_attribution(entity_type,entity_id,attribution) VALUES($1,$2,$3) ON CONFLICT DO NOTHING', [type, String(id), value]) } catch { console.error('ad_attribution_save_failed', type) }
}
export async function enqueuePaidPurchase(client, order) {
  if (order.status !== 'paid') return
  const attribution = await client.query("SELECT attribution FROM ad_attribution WHERE entity_type='order' AND entity_id=$1", [String(order.id)])
  const clientId = sanitizeAttribution(attribution.rows[0]?.attribution).clientId
  if (!clientId) return
  const result = await client.query(`SELECT COALESCE(v.legacy_id,v.id::text) id,i.product_name_snapshot name,i.category_name_snapshot category,i.price_snapshot price,i.quantity FROM order_items i LEFT JOIN product_variants v ON v.id=i.variant_id WHERE i.order_id=$1`, [order.id])
  const products = result.rows.map(p => ({ id: p.id, name: p.name, category: p.category, price: Number(p.price), quantity: Number(p.quantity) }))
  const revenue = Number(order.total_amount)
  if (!products.length || products.some(p => !p.id || p.price <= 0 || !Number.isFinite(p.price) || !Number.isFinite(p.quantity) || p.quantity <= 0) || !Number.isFinite(revenue) || revenue <= 0) return
  await client.query('INSERT INTO metrika_purchase_outbox(order_id,payload) VALUES($1,$2) ON CONFLICT DO NOTHING', [order.id, { clientId, order_id: String(order.public_number), revenue, currency: 'RUB', products }])
}
