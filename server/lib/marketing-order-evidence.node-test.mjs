import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import {createMarketingOrderEvidenceRouter} from '../routes/marketing-order-evidence.mjs';
import {readOrderEvidence,validateOrderEvidenceRange} from './marketing-order-evidence.mjs';

test('CRM summary is aggregate-only, campaign-scoped and reads no customer PII',async()=>{
 const r=await readOrderEvidence(async(sql,values)=>{
  assert.deepEqual(values,['2026-10-01','2026-10-14','715543180']);
  assert(!/customer_phone|customer_email|customer_name/i.test(sql));
  return {rows:[{created_orders:'3',crm_paid_orders:'1',crm_paid_revenue_rub:'1000.00',purchase_outbox_sent:'1'}]};
 },{campaignId:'715543180',dateFrom:'2026-10-01',dateTo:'2026-10-14'});
 assert.equal(r.createdOrders,3);assert.equal(r.paidOrders,1);
 assert.equal(r.purchaseOutboxSent,1);assert.equal(r.goalEventMatched,false);
 assert(!JSON.stringify(r).includes('customer'));
});
test('date bounds reject invalid calendar dates and range above 92 days',()=>{
 for(const v of [
 {campaignId:'715543180',dateFrom:'2026-02-30',dateTo:'2026-10-14'},
 {campaignId:'0',dateFrom:'2026-10-01',dateTo:'2026-10-14'},
 {campaignId:'715543180',dateFrom:'2025-01-01',dateTo:'2026-10-14'}
 ])assert.throws(()=>validateOrderEvidenceRange(v));
});
test('endpoint is disabled by default, requires independent bearer token and sends only aggregates',async()=>{
 const secret='a'.repeat(48);
 let databaseReads=0;
 const app=express();
 app.use('/disabled',createMarketingOrderEvidenceRouter({secret:null,queryFn:async()=>{databaseReads++}}));
 app.use('/api/internal/direct',createMarketingOrderEvidenceRouter({secret,queryFn:async()=>{
  databaseReads++;return {rows:[{created_orders:2,crm_paid_orders:1,crm_paid_revenue_rub:'900.00',purchase_outbox_sent:0}]};
 }}));
 const server=app.listen(0,'127.0.0.1');
 try{
  await new Promise(resolve=>server.once('listening',resolve));
  const origin='http://127.0.0.1:'+server.address().port;
  const disabled=await fetch(origin+'/disabled/order-evidence');
  assert.equal(disabled.status,404);
  const path='/api/internal/direct/order-evidence?campaignId=715543180&dateFrom=2026-10-01&dateTo=2026-10-14';
  const unauthorized=await fetch(origin+path);
  assert.equal(unauthorized.status,401);
  assert.equal(databaseReads,0);
  const bad=await fetch(origin+path.replace('715543180','0'),{headers:{Authorization:'Bearer '+secret}});
  assert.equal(bad.status,400);assert.equal(databaseReads,0);
  const valid=await fetch(origin+path,{headers:{Authorization:'Bearer '+secret}});
  assert.equal(valid.status,200);
  const evidence=await valid.json();
  assert.equal(evidence.createdOrders,2);
  assert.equal(evidence.checkoutGoalVerified,false);
  assert.equal(valid.headers.get('cache-control'),'private, no-store, max-age=0');
  assert.equal(databaseReads,1);
 } finally {await new Promise(resolve=>server.close(resolve));}
});
