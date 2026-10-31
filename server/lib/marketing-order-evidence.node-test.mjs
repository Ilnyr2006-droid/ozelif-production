import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import {createMarketingOrderEvidenceRouter,readEvidenceInTransaction} from '../routes/marketing-order-evidence.mjs';
import {MARKETING_ORDER_SUMMARY_SQL,readOrderEvidence,validateOrderEvidenceRange} from './marketing-order-evidence.mjs';

test('CRM summary is aggregate-only, campaign-scoped and reads no customer PII',async()=>{
 const r=await readOrderEvidence(async(sql,values)=>{
  assert.deepEqual(values,['2026-10-01','2026-10-14','715543180']);
  assert(!/customer_phone|customer_email|customer_name/i.test(sql));
  return {rows:[{created_orders:'3',cancelled_orders:'1',ever_paid_orders:'2',crm_paid_orders:'1',currently_paid_orders:'1',non_rub_paid_orders:0,crm_paid_revenue_rub:'1000.00',purchase_outbox_sent:'1'}]};
 },{campaignId:'715543180',dateFrom:'2026-10-01',dateTo:'2026-10-14'});
 assert.equal(r.createdOrders,3);assert.equal(r.paidOrders,1);
 assert.equal(r.purchaseOutboxSent,1);assert.equal(r.goalEventMatched,false);
 assert.equal(r.goalExists,null); assert.equal(r.goalActivityVerified,null); assert.equal(r.orderGoalVerified,false);
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
  databaseReads++;return {rows:[{created_orders:2,cancelled_orders:0,ever_paid_orders:1,crm_paid_orders:1,currently_paid_orders:1,non_rub_paid_orders:0,crm_paid_revenue_rub:'900.00',purchase_outbox_sent:0}]};
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


test('SQL uses scoped parameters, no multiplying joins and explicit CRM semantics', () => {
  assert.match(MARKETING_ORDER_SUMMARY_SQL, /a\.attribution->>'utm_campaign'=\$3/);
  assert.match(MARKETING_ORDER_SUMMARY_SQL, /currency='RUB'/);
  assert.match(MARKETING_ORDER_SUMMARY_SQL, /status='cancelled'/);
  assert.match(MARKETING_ORDER_SUMMARY_SQL, /AT TIME ZONE 'Europe\/Moscow'/);
  assert.doesNotMatch(MARKETING_ORDER_SUMMARY_SQL, /\bJOIN\b/i);
  assert.doesNotMatch(MARKETING_ORDER_SUMMARY_SQL, /\b(INSERT|UPDATE|DELETE)\b/i);
});
test('empty period and unknown campaign return honest zeroes', async () => {
 const data = await readOrderEvidence(async () => ({rows:[{created_orders:0,cancelled_orders:0,crm_paid_orders:0,currently_paid_orders:0,ever_paid_orders:0,non_rub_paid_orders:0,crm_paid_revenue_rub:0,purchase_outbox_sent:0}]}), {campaignId:'999999',dateFrom:'2026-10-01',dateTo:'2026-10-01'});
 assert.equal(data.createdOrders,0); assert.equal(data.paidRevenueRub,0);
 assert.equal(data.campaignAttributionVerified,false); assert.equal(data.checkoutGoalVerified,false);
 assert.equal(data.goalEventMatched,false); assert.equal(data.attributedOrders,0);
});
test('database errors are generic and invalid bearer tokens do not query', async () => {
 const app=express(); let reads=0; const secret='x'.repeat(48);
 app.use('/api/internal/direct',createMarketingOrderEvidenceRouter({secret,queryFn:async()=>{reads++;throw new Error('sensitive db detail')}}));
 const server=app.listen(0,'127.0.0.1');
 try {
  await new Promise(resolve=>server.once('listening',resolve));
  const path=`http://127.0.0.1:${server.address().port}/api/internal/direct/order-evidence?campaignId=1&dateFrom=2026-01-01&dateTo=2026-01-01`;
  assert.equal((await fetch(path,{headers:{authorization:'Bearer wrong'}})).status,401); assert.equal(reads,0);
  const response=await fetch(path,{headers:{authorization:'Bearer '+secret}});
  assert.equal(response.status,503); assert.deepEqual(await response.json(),{error:'data_unavailable'}); assert.equal(reads,1);
 } finally {await new Promise(resolve=>server.close(resolve));}
});


test('transaction is read-only, has local statement timeout, and releases on error', async () => {
 const statements=[]; let released=0;
 const dbPool={connect:async()=>({query:async(sql)=>{statements.push(sql); if(sql.includes('WITH matched')) throw Error('timeout')},release:()=>released++})};
 await assert.rejects(readEvidenceInTransaction(dbPool,{campaignId:'1',dateFrom:'2026-01-01',dateTo:'2026-01-01'}));
 assert.equal(statements[0],'BEGIN READ ONLY'); assert.match(statements[1],/SET LOCAL statement_timeout/);
 assert.equal(statements.at(-1),'ROLLBACK'); assert.equal(released,1);
});
test('concurrency limit rejects extra request and releases slot after completion', async () => {
 const app=express(); const secret='x'.repeat(48); let release, entered;
 const started=new Promise(resolve=>entered=resolve);
 const wait=new Promise(resolve=>release=resolve);
 const row={created_orders:0,cancelled_orders:0,crm_paid_orders:0,currently_paid_orders:0,ever_paid_orders:0,non_rub_paid_orders:0,crm_paid_revenue_rub:0,purchase_outbox_sent:0};
 app.use('/api/internal/direct',createMarketingOrderEvidenceRouter({secret,maxConcurrent:1,queryFn:async()=>{entered(); await wait; return {rows:[row]}}}));
 const server=app.listen(0,'127.0.0.1');
 try {
  await new Promise(resolve=>server.once('listening',resolve));
  const url=`http://127.0.0.1:${server.address().port}/api/internal/direct/order-evidence?campaignId=1&dateFrom=2026-01-01&dateTo=2026-01-01`;
  const opts={headers:{authorization:'Bearer '+secret}};
  const first=fetch(url,opts); await started;
  assert.equal((await fetch(url,opts)).status,503);
  release(); assert.equal((await first).status,200);
  assert.equal((await fetch(url,opts)).status,200);
 } finally {release(); await new Promise(resolve=>server.close(resolve));}
});


test('pool wait times out and a late connection is released', async () => {
 let resolve, releases = 0;
 const dbPool = { connect: () => new Promise(r => { resolve = r; }) };
 await assert.rejects(readEvidenceInTransaction(dbPool, {}, { connectionTimeoutMs: 10 }), /order_evidence_connection_timeout/);
 resolve({ release: () => releases++ });
 await new Promise(r => setImmediate(r));
 assert.equal(releases, 1);
});
