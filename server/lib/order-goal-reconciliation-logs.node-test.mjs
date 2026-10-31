import test from 'node:test';
import assert from 'node:assert/strict';
import { reconcileMetrikaHitsExport } from './order-goal-reconciliation-logs.mjs';

const ref = 'a'.repeat(32);
const OTHER_REF = 'b'.repeat(32);
const fields = [
  'ym:pv:watchID', 'ym:pv:visitID', 'ym:pv:date',
  'ym:pv:counterID', 'ym:pv:goalsID', 'ym:pv:params'
];
const manifest = {
  source: 'metrika_logs_api', dataType: 'hits', counterId: '112275551',
  dateFrom: '2026-10-01', dateTo: '2026-10-14',
  completeThroughDate: '2026-10-15', status: 'processed',
  partsExpected: 1, partsLoaded: 1, fields
};
const hit = (watch, overrides = {}) => ({
  'ym:pv:watchID': watch,
  'ym:pv:visitID': '18446744073709551615',
  'ym:pv:date': '2026-10-12',
  'ym:pv:counterID': 112275551,
  'ym:pv:goalsID': [609951402],
  'ym:pv:params': JSON.stringify({ ozelif_order_ref: ref }),
  ...overrides
});
const check = (rows, partialManifest = {}) => reconcileMetrikaHitsExport({
  orderRef: ref, manifest: { ...manifest, ...partialManifest }, rows
});

test('one matching goal/ref in the same Logs API event is observed, not a verified order', () => {
  assert.deepEqual(check([hit('18446744073709551615')]), {
    status: 'event_observed', matchedEvents: 1, providerEventObserved: true,
    orderGoalVerified: false, campaignAttributionVerified: false,
    paymentGatewayVerified: false, verifiedRoas: null
  });
});
test('a different goal or a different opaque ref does not become an observed event', () => {
  const result = check([
    hit('1', { 'ym:pv:goalsID': [12] }),
    hit('2', { 'ym:pv:params': JSON.stringify({ ozelif_order_ref: OTHER_REF }) })
  ]);
  assert.equal(result.status, 'not_observed_in_export');
  assert.equal(result.matchedEvents, 0);
  assert.equal(result.providerEventObserved, false);
});
test('repeated rows are idempotent, distinct watch IDs for the same ref are duplicates', () => {
  assert.equal(check([hit('1'), hit('1')]).status, 'event_observed');
  const multiple = check([hit('1'), hit('1'), hit('2')]);
  assert.equal(multiple.status, 'duplicate_events');
  assert.equal(multiple.matchedEvents, 2);
  assert.equal(multiple.orderGoalVerified, false);
});
test('two different assertions about the same watch ID are conflicts, never verified', () => {
  const result = check([hit('1'), hit('1', {
    'ym:pv:params': JSON.stringify({ ozelif_order_ref: OTHER_REF })
  })]);
  assert.equal(result.status, 'conflicting_event');
  assert.equal(result.matchedEvents, null);
});
test('missing export part, wrong status, wrong counter or absent field fail closed', () => {
  for (const change of [
    { partsExpected: 2 }, { status: 'processing' }, { counterId: '999' },
    { completeThroughDate: '2026-10-13' }, { fields: fields.slice(1) },
    { source: 'browser' }, { dataType: 'visits' }
  ]) {
    const result = check([hit('1')], change);
    assert.equal(result.status, 'incomplete_export', JSON.stringify(change));
    assert.equal(result.matchedEvents, null);
  }
});
test('wrong counter, invalid timestamps and unreadable parameters contaminate export', () => {
  for (const invalid of [
    hit('2', { 'ym:pv:counterID': 999 }),
    hit('2', { 'ym:pv:date': '2026-10-30' }),
    hit('2', { 'ym:pv:params': 'not-json' }),
    hit('2', { 'ym:pv:params': '[1,2]' }),
    hit('2', { 'ym:pv:goalsID': '[609951402]' }),
    hit('2', { 'ym:pv:visitID': 18446744073709552000 }),
    hit('2', { 'ym:pv:watchID': '18446744073709551616' })
  ]) {
    const result = check([hit('1'), invalid]);
    assert.equal(result.status, 'incomplete_export', JSON.stringify(invalid));
    assert.equal(result.matchedEvents, null);
  }
});
test('a valid empty completed snapshot does not prove an order or permanent absence', () => {
  const result = check([]);
  assert.equal(result.status, 'not_observed_in_export');
  assert.equal(result.providerEventObserved, false);
  assert.equal(result.orderGoalVerified, false);
});
test('invalid opaque identifiers cannot be used for reconciliation', () => {
  assert.throws(() => reconcileMetrikaHitsExport({
    orderRef: 'real-order-number-123', manifest, rows: []
  }), /invalid_order_ref/);
});
