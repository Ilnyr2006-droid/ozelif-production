const CAMPAIGN = /^[1-9]\d{0,18}$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
function parseDay(value) {
  if (typeof value !== 'string' || !DATE.test(value)) throw Error('invalid_order_date');
  const ms = Date.parse(value + 'T00:00:00Z');
  if (!Number.isFinite(ms) || new Date(ms).toISOString().slice(0, 10) !== value) throw Error('invalid_order_date');
  return ms;
}
export function validateOrderEvidenceRange({ campaignId, dateFrom, dateTo }) {
  if (typeof campaignId !== 'string' || !CAMPAIGN.test(campaignId)) throw Error('invalid_campaign_id');
  const from = parseDay(dateFrom), to = parseDay(dateTo);
  if (from > to || to - from > 91 * 86400000) throw Error('invalid_order_period');
  return { campaignId, dateFrom, dateTo };
}
// A UTM value comes from a visitor and is not proof of a Direct campaign association.
// EXISTS prevents repeated attribution/outbox/history rows from multiplying order counts.
export const MARKETING_ORDER_SUMMARY_SQL = `
WITH matched AS (
  SELECT o.id, o.status, o.total_amount, o.currency,
    EXISTS (SELECT 1 FROM order_status_history h WHERE h.order_id=o.id AND h.new_status='paid') AS ever_paid,
    EXISTS (SELECT 1 FROM metrika_purchase_outbox m WHERE m.order_id=o.id AND m.status='sent') AS purchase_sent
  FROM orders o
  WHERE o.created_at >= ($1::date::timestamp AT TIME ZONE 'Europe/Moscow')
    AND o.created_at < (($2::date + 1)::timestamp AT TIME ZONE 'Europe/Moscow')
    AND EXISTS (SELECT 1 FROM ad_attribution a WHERE a.entity_type='order'
                AND a.entity_id=o.id::text AND a.attribution->>'utm_campaign'=$3)
)
SELECT count(*)::integer AS created_orders,
  count(*) FILTER (WHERE status='cancelled')::integer AS cancelled_orders,
  count(*) FILTER (WHERE status <> 'cancelled' AND (status='paid' OR ever_paid))::integer AS crm_paid_orders,
  count(*) FILTER (WHERE status='paid')::integer AS currently_paid_orders,
  count(*) FILTER (WHERE status <> 'cancelled' AND (status='paid' OR ever_paid))::integer AS ever_paid_orders,
  count(*) FILTER (WHERE status <> 'cancelled' AND (status='paid' OR ever_paid) AND currency IS DISTINCT FROM 'RUB')::integer AS non_rub_paid_orders,
  coalesce(sum(total_amount) FILTER (WHERE status <> 'cancelled' AND (status='paid' OR ever_paid) AND currency='RUB'),0)::text AS crm_paid_revenue_rub,
  count(*) FILTER (WHERE purchase_sent)::integer AS purchase_outbox_sent
FROM matched
`;
export async function readOrderEvidence(query, { campaignId, dateFrom, dateTo }) {
  const args = validateOrderEvidenceRange({ campaignId, dateFrom, dateTo });
  const result = await query(MARKETING_ORDER_SUMMARY_SQL, [args.dateFrom, args.dateTo, args.campaignId]);
  if (!result || !Array.isArray(result.rows) || result.rows.length !== 1) throw Error('order_evidence_db_unavailable');
  const row = result.rows[0];
  const num = value => { const n = Number(value); if (!Number.isSafeInteger(n) || n < 0) throw Error('invalid_order_aggregate'); return n; };
  const money = Number(row.crm_paid_revenue_rub);
  if (!Number.isFinite(money) || money < 0) throw Error('invalid_order_aggregate');
  const createdOrders = num(row.created_orders), cancelledOrders = num(row.cancelled_orders);
  const paidOrders = num(row.crm_paid_orders), currentlyPaidOrders = num(row.currently_paid_orders), everPaidOrders = num(row.ever_paid_orders);
  const purchaseOutboxSent = num(row.purchase_outbox_sent);
  const nonRubPaidOrders = num(row.non_rub_paid_orders);
  if (paidOrders > createdOrders || currentlyPaidOrders > paidOrders || everPaidOrders > createdOrders || cancelledOrders > createdOrders || purchaseOutboxSent > createdOrders || nonRubPaidOrders > paidOrders) throw Error('invalid_order_aggregate');
  return {
    schemaVersion: 1, source: 'ozelif_crm_aggregate', campaignId: args.campaignId, dateFrom: args.dateFrom, dateTo: args.dateTo,
    counterId: '112275551', goalId: '609951402', attributedBy: 'utm_campaign_exact',
    campaignAttributionVerified: false, attributionEvidence: 'client_supplied_utm_campaign_unverified',
    dateTimezone: 'Europe/Moscow', createdOrders, cancelledOrders, attributedOrders: createdOrders,
    paidOrders, currentlyPaidOrders, everPaidOrders, nonRubPaidOrders, paidRevenueRub: Math.round(money * 100) / 100, purchaseOutboxSent,
    goalEventMatched: false, checkoutGoalVerified: false, purchasePaymentEvidence: 'crm_status_history_only',
    note: 'Campaign match uses an unverified visitor-supplied UTM value, not proof of a Direct campaign. paidOrders and paidRevenueRub include non-cancelled orders currently or previously marked paid in CRM; currentlyPaidOrders counts only the current paid status. CRM history is not proof of settlement. Revenue includes RUB only. Outbox sent does not prove report attribution or settlement.',
    sampled: false
  };
}
