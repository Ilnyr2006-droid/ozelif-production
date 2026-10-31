import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createOpaqueOrderGoalRef, claimNewOrderGoalEvent
} from './order-goal-claim.mjs';

const orderId = 'd33946b2-4a54-4a24-94c1-baa3c6b1c87d';

function fakeClient() {
  let existing = null, calls = 0;
  const client = { async query(sql, args) {
    calls++;
    assert.match(sql, /^INSERT INTO order_goal_correlations/);
    assert.deepEqual(args.slice(0,1), [orderId]);
    if (existing) return {rowCount:0,rows:[]};
    existing = args[1];
    return {rowCount:1,rows:[{order_ref:existing}]};
  }};
  return {client, get calls(){return calls}, get existing(){return existing}};
}
test('opaque order refs are random and do not contain order identity',()=>{
  const a=createOpaqueOrderGoalRef(), b=createOpaqueOrderGoalRef();
  assert.match(a,/^[a-f0-9]{32}$/);
  assert.notEqual(a,b);
  assert.equal(a.includes(orderId),false);
});
test('new website_cart order claims exactly one event in transaction',async()=>{
  const db=fakeClient();
  const out=await claimNewOrderGoalEvent(db.client,{orderId,source:'website_cart',enabled:true});
  assert.match(out,/^[a-f0-9]{32}$/);
  assert.equal(out,db.existing);
  assert.equal(db.calls,1);
});
test('duplicate checkout, AI, and off-by-default paths cannot request another ref',async()=>{
  const db=fakeClient();
  for(const flags of [
    {orderId,source:'website_cart',enabled:false},
    {orderId,source:'website_cart',enabled:true,duplicate:true},
    {orderId,source:'ai_chat',enabled:true}
  ]) assert.equal(await claimNewOrderGoalEvent(db.client,flags),null);
  assert.equal(db.calls,0);
});
test('database unique constraint conflict fails closed, never returns previous ref',async()=>{
  const db=fakeClient();
  await claimNewOrderGoalEvent(db.client,{orderId,source:'website_cart',enabled:true});
  await assert.rejects(claimNewOrderGoalEvent(db.client,{orderId,source:'website_cart',enabled:true}),
    /order_goal_claim_conflict/);
  assert.equal(db.calls,2);
});
test('missing transaction or invalid order ID rejects without database calls',async()=>{
  const db=fakeClient();
  await assert.rejects(claimNewOrderGoalEvent(db.client,{
    orderId:'user-supplied-reference',source:'website_cart',enabled:true}),/invalid_order_goal_claim/);
  await assert.rejects(claimNewOrderGoalEvent(null,{
    orderId,source:'website_cart',enabled:true}),/invalid_order_goal_claim/);
  assert.equal(db.calls,0);
});
test('database write failure propagates and caller must roll back',async()=>{
  const client={async query(){throw Error('db_unavailable')}};
  await assert.rejects(claimNewOrderGoalEvent(client,{orderId,source:'website_cart',enabled:true}),/db_unavailable/);
});
