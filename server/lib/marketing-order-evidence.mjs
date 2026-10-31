const CAMPAIGN=/^[1-9]\d{0,18}$/;
const DATE=/^\d{4}-\d{2}-\d{2}$/;
function parseDay(value){
 if(typeof value!=='string'||!DATE.test(value))throw Error('invalid_order_date');
 const ms=Date.parse(value+'T00:00:00Z');
 if(!Number.isFinite(ms)||new Date(ms).toISOString().slice(0,10)!==value)throw Error('invalid_order_date');
 return ms;
}
export function validateOrderEvidenceRange({campaignId,dateFrom,dateTo}){
 if(typeof campaignId!=='string'||!CAMPAIGN.test(campaignId))throw Error('invalid_campaign_id');
 const from=parseDay(dateFrom),to=parseDay(dateTo);
 if(from>to||to-from>91*86400000)throw Error('invalid_order_period');
 return {campaignId,dateFrom,dateTo};
}
export const MARKETING_ORDER_SUMMARY_SQL=`
WITH matched AS (
  SELECT o.status, o.total_amount,
    EXISTS(
      SELECT 1 FROM order_status_history h
      WHERE h.order_id=o.id AND h.new_status='paid'
    ) OR o.status='paid' AS recorded_paid,
    m.status AS purchase_outbox_status
  FROM orders o
  JOIN ad_attribution a
    ON a.entity_type='order' AND a.entity_id=o.id::text
  LEFT JOIN metrika_purchase_outbox m ON m.order_id=o.id
  WHERE o.created_at >= $1::date
    AND o.created_at < ($2::date + INTERVAL '1 day')
    AND a.attribution->>'utm_campaign'=$3
)
SELECT
  count(*) FILTER (WHERE status<>'cancelled')::integer AS created_orders,
  count(*) FILTER (WHERE status<>'cancelled' AND recorded_paid)::integer AS crm_paid_orders,
  coalesce(sum(total_amount) FILTER (WHERE status<>'cancelled' AND recorded_paid),0)::text AS crm_paid_revenue_rub,
  count(*) FILTER (WHERE status<>'cancelled' AND recorded_paid AND purchase_outbox_status='sent')::integer AS purchase_outbox_sent
FROM matched
`;
export async function readOrderEvidence(query,{campaignId,dateFrom,dateTo}){
 const args=validateOrderEvidenceRange({campaignId,dateFrom,dateTo});
 const r=await query(MARKETING_ORDER_SUMMARY_SQL,[args.dateFrom,args.dateTo,args.campaignId]);
 if(!r||!Array.isArray(r.rows)||r.rows.length!==1)throw Error('order_evidence_db_unavailable');
 const row=r.rows[0];
 const num=(v)=>{const n=Number(v);if(!Number.isSafeInteger(n)||n<0)throw Error('invalid_order_aggregate');return n;};
 const money=Number(row.crm_paid_revenue_rub);
 if(!Number.isFinite(money)||money<0)throw Error('invalid_order_aggregate');
 const createdOrders=num(row.created_orders),paidOrders=num(row.crm_paid_orders);
 const purchaseOutboxSent=num(row.purchase_outbox_sent);
 if(paidOrders>createdOrders||purchaseOutboxSent>paidOrders)throw Error('invalid_order_aggregate');
 return {
  schemaVersion:1,source:'ozelif_crm_aggregate',
  campaignId:args.campaignId,dateFrom:args.dateFrom,dateTo:args.dateTo,
  counterId:'112275551',goalId:'609951402',
  attributedBy:'utm_campaign_exact',
  createdOrders,paidOrders,paidRevenueRub:Math.round(money*100)/100,
  purchaseOutboxSent,goalEventMatched:false,checkoutGoalVerified:false,
  purchasePaymentEvidence:'crm_status_history_only',
  note:'Contains only aggregated CRM order status and outbox delivery. Neither confirms payment gateway settlement nor matches an individual Metrika goal event.',
  sampled:false
 };
}
