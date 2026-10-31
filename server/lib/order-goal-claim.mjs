// Future checkout integration; not installed or enabled in production.
// The first successful checkout owns one opaque referral claim, and retries
// must NOT receive another entitlement to emit the same Metrika goal.
import { randomBytes } from 'node:crypto';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function createOpaqueOrderGoalRef() {
  return randomBytes(16).toString('hex');
}

// Execute INSIDE the existing order-creation DB transaction, after the order
// row exists and before COMMIT. Only call for freshly created website_cart
// orders. Discard the ref if the transaction rolls back.
//
// This marks delivery as *claimed*, not delivered or provider-observed.
// A lost HTTP response may therefore mean no goal. Retrying is deliberately
// not permitted because Metrics reachGoal provides no idempotency guarantee.
export async function claimNewOrderGoalEvent(client, {
  orderId, source, duplicate = false, enabled = false
} = {}) {
  if (!enabled || source !== 'website_cart' || duplicate) return null;
  if (typeof orderId !== 'string' || !UUID.test(orderId) ||
      typeof client?.query !== 'function') throw Error('invalid_order_goal_claim');
  const orderRef = createOpaqueOrderGoalRef();
  const result = await client.query(
    "INSERT INTO order_goal_correlations (order_id, order_ref, delivery_state) VALUES ($1, $2, 'claimed') ON CONFLICT (order_id) DO NOTHING RETURNING order_ref",
    [orderId, orderRef]
  );
  // A pre-existing row is never returned to a new caller: another request
  // could already have sent the event.
  if (result?.rowCount !== 1 || result.rows?.[0]?.order_ref !== orderRef) {
    throw Error('order_goal_claim_conflict');
  }
  return orderRef;
}
