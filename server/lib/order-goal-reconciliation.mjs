import { randomBytes } from 'node:crypto';

const REF = /^[a-f0-9]{32}$/;
const WATCH = /^(?:0|[1-9]\d{0,19})$/;
const GOAL_ID = '609951402';

// Opaque, independently random and never derived from order or customer data.
export function createOrderGoalRef() {
  return randomBytes(16).toString('hex');
}

// Candidate parser: actual Logs API serialization must be validated on an
// isolated counter before wiring this into checkout or production processing.
export function reconcileOrderGoalRows(orderRef, rows) {
  if (typeof orderRef !== 'string' || !REF.test(orderRef) || !Array.isArray(rows)) {
    throw Error('invalid_reconciliation_input');
  }
  const seen = new Map();
  let malformed = false;
  for (const row of rows) {
    const id = row?.watchId;
    if (typeof id !== 'string' || !WATCH.test(id) || !Array.isArray(row?.goalIds) || typeof row?.params !== 'string') {
      malformed = true;
      continue;
    }
    let params;
    try { params = JSON.parse(row.params); } catch { malformed = true; continue; }
    if (!params || typeof params !== 'object' || Array.isArray(params)) { malformed = true; continue; }
    const matches = row.goalIds.some(goal => String(goal) === GOAL_ID) && params.ozelif_order_ref === orderRef;
    if (seen.has(id) && seen.get(id) !== matches) return { status: 'conflicting_event', matchedEvents: null };
    seen.set(id, matches);
  }
  if (malformed) return { status: 'incomplete_input', matchedEvents: null };
  const matchedEvents = [...seen.values()].filter(Boolean).length;
  return { status: matchedEvents === 0 ? 'not_observed' : matchedEvents === 1 ? 'observed' : 'duplicate_events', matchedEvents };
}
