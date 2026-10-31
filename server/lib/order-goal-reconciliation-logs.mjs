// Isolated, fail-closed stage-2 candidate. Not wired to checkout, database, Metrika,
// or the production MCP. Raw Logs API serialization must be tested on a test counter.
const COUNTER_ID = '112275551';
const GOAL_ID = '609951402';
const ORDER_REF = /^[a-f0-9]{32}$/;
const DECIMAL_ID = /^[1-9]\d{0,19}$/;
const MAX_UINT64 = (1n << 64n) - 1n;
const MAX_UINT32 = (1n << 32n) - 1n;
const REQUIRED_FIELDS = [
  'ym:pv:watchID', 'ym:pv:visitID', 'ym:pv:date',
  'ym:pv:counterID', 'ym:pv:goalsID', 'ym:pv:params'
];

function validDay(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const stamp = Date.parse(value + 'T00:00:00Z');
  return Number.isFinite(stamp) && new Date(stamp).toISOString().slice(0, 10) === value;
}
function uint64(value) {
  if (typeof value !== 'string' || !DECIMAL_ID.test(value)) return null;
  const number = BigInt(value);
  return number > 0n && number <= MAX_UINT64 ? value : null;
}
function goalId(value) {
  if (typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 && BigInt(value) <= MAX_UINT32)
    return String(value);
  if (typeof value === 'string' && /^(?:0|[1-9]\d{0,9})$/.test(value) && BigInt(value) <= MAX_UINT32)
    return value;
  return null;
}
function unavailable(status) {
  return {
    status, matchedEvents: null, providerEventObserved: false,
    orderGoalVerified: false, campaignAttributionVerified: false,
    paymentGatewayVerified: false, verifiedRoas: null
  };
}

// manifest MUST originate from a trusted, complete Logs API importer. It cannot
// be supplied by a browser, ChatGPT, or another untrusted caller. Even a complete
// export is a snapshot: late Metrika data can arrive after reconciliation.
export function reconcileMetrikaHitsExport({ orderRef, manifest, rows } = {}) {
  if (typeof orderRef !== 'string' || !ORDER_REF.test(orderRef)) throw Error('invalid_order_ref');
  if (!manifest || !Array.isArray(rows) || rows.length > 100000 ||
      manifest.source !== 'metrika_logs_api' || manifest.dataType !== 'hits' ||
      String(manifest.counterId) !== COUNTER_ID ||
      !validDay(manifest.dateFrom) || !validDay(manifest.dateTo) ||
      !validDay(manifest.completeThroughDate) ||
      manifest.dateFrom > manifest.dateTo || manifest.completeThroughDate < manifest.dateTo ||
      manifest.status !== 'processed' || manifest.partsExpected < 1 ||
      !Number.isSafeInteger(manifest.partsExpected) ||
      manifest.partsExpected !== manifest.partsLoaded ||
      !Array.isArray(manifest.fields) ||
      REQUIRED_FIELDS.some(field => !manifest.fields.includes(field))) {
    return unavailable('incomplete_export');
  }

  const seen = new Map();
  let malformed = false;
  let conflicting = false;
  for (const row of rows) {
    const watch = uint64(row?.['ym:pv:watchID']);
    const visit = uint64(row?.['ym:pv:visitID']);
    const date = row?.['ym:pv:date'];
    const goals = row?.['ym:pv:goalsID'];
    const counter = row?.['ym:pv:counterID'];
    if (!watch || !visit || !validDay(date) ||
        date < manifest.dateFrom || date > manifest.dateTo ||
        String(counter) !== COUNTER_ID || !Array.isArray(goals) ||
        typeof row?.['ym:pv:params'] !== 'string') {
      malformed = true;
      continue;
    }
    const normalizedGoals = goals.map(goalId);
    if (normalizedGoals.some(goal => goal === null)) {
      malformed = true;
      continue;
    }
    let params;
    try { params = JSON.parse(row['ym:pv:params']); }
    catch { malformed = true; continue; }
    if (!params || typeof params !== 'object' || Array.isArray(params) ||
        (params.ozelif_order_ref !== undefined &&
          (typeof params.ozelif_order_ref !== 'string' || !ORDER_REF.test(params.ozelif_order_ref)))) {
      malformed = true;
      continue;
    }
    const ref = params.ozelif_order_ref ?? null;
    const fingerprint = JSON.stringify([
      visit, date, [...new Set(normalizedGoals)].sort(), ref
    ]);
    const isMatch = normalizedGoals.includes(GOAL_ID) && ref === orderRef;
    const previous = seen.get(watch);
    if (previous && previous.fingerprint !== fingerprint) conflicting = true;
    else if (!previous) seen.set(watch, { fingerprint, isMatch });
  }
  if (conflicting) return unavailable('conflicting_event');
  if (malformed) return unavailable('incomplete_export');
  const matched = [...seen.values()].filter(row => row.isMatch).length;
  return {
    status: matched === 0 ? 'not_observed_in_export' :
      matched === 1 ? 'event_observed' : 'duplicate_events',
    matchedEvents: matched,
    providerEventObserved: matched === 1,
    // Browser-supplied refs and even observed events do not establish a
    // server-originated checkout, genuine ad click, or settled payment.
    orderGoalVerified: false,
    campaignAttributionVerified: false,
    paymentGatewayVerified: false,
    verifiedRoas: null
  };
}
