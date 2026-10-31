import test from 'node:test';
import assert from 'node:assert/strict';
import { createOrderGoalRef, reconcileOrderGoalRows } from './order-goal-reconciliation.mjs';

const ref = 'a'.repeat(32);
const row = (id, goalIds = [609951402], params = JSON.stringify({ ozelif_order_ref: ref })) => ({ watchId: id, goalIds, params });

test('opaque references use 128 random bits and never contain an order ID', () => {
  const a = createOrderGoalRef(), b = createOrderGoalRef();
  assert.match(a, /^[a-f0-9]{32}$/); assert.notEqual(a, b);
});
test('matches only goal and opaque identifier in the same event row', () => {
  assert.deepEqual(reconcileOrderGoalRows(ref, [row('1')]), { status: 'observed', matchedEvents: 1 });
  assert.equal(reconcileOrderGoalRows(ref, [row('1', [1]), row('2', [609951402], '{}')]).status, 'not_observed');
});
test('repeated export rows do not become duplicate events; separate events do', () => {
  assert.equal(reconcileOrderGoalRows(ref, [row('1'), row('1')]).status, 'observed');
  assert.equal(reconcileOrderGoalRows(ref, [row('1'), row('2')]).status, 'duplicate_events');
  assert.equal(reconcileOrderGoalRows(ref, [row('1'), row('1', [1])]).status, 'conflicting_event');
});
test('incomplete and malformed evidence never proves observation', () => {
  assert.equal(reconcileOrderGoalRows(ref, [row('1'), row('2', [], 'invalid')]).status, 'incomplete_input');
  assert.equal(reconcileOrderGoalRows(ref, [{ watchId: 123, goalIds: [609951402], params: '{}' }]).status, 'incomplete_input');
  assert.throws(() => reconcileOrderGoalRows('order-25', []), /invalid_reconciliation_input/);
});
