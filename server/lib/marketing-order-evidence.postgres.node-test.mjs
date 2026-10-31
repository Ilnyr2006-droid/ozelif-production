import test from 'node:test';
import assert from 'node:assert/strict';
import { readOrderEvidence } from './marketing-order-evidence.mjs';

// Deliberately use a dedicated test-only variable, never the production DATABASE_URL.
const testUrl = process.env.ORDER_EVIDENCE_TEST_DATABASE_URL;
test('PostgreSQL aggregation uses isolated fixtures and does not multiply orders', { skip: !testUrl && 'ORDER_EVIDENCE_TEST_DATABASE_URL is not set' }, async () => {
  const endpoint = new URL(testUrl);
  assert.ok(['127.0.0.1', 'localhost', '[::1]'].includes(endpoint.hostname), 'test database must be local');
  assert.equal(endpoint.pathname, '/evidence_test', 'test database must be dedicated to this suite');
  assert.ok(endpoint.port && endpoint.port !== '5432', 'test database must use an explicit non-default port');
  const { Client } = await import('pg');
  const client = new Client({ connectionString: testUrl });
  await client.connect();
  try {
    await client.query(`CREATE TEMP TABLE orders (id text, status text, total_amount numeric, currency text, created_at timestamptz)`);
    await client.query(`CREATE TEMP TABLE ad_attribution (entity_type text, entity_id text, attribution jsonb)`);
    await client.query(`CREATE TEMP TABLE order_status_history (order_id text, new_status text)`);
    await client.query(`CREATE TEMP TABLE metrika_purchase_outbox (order_id text, status text)`);
    await client.query(`INSERT INTO orders VALUES
      ('1','paid',1000,'RUB','2026-10-01T00:00:00+03'),
      ('2','cancelled',2000,'RUB','2026-10-02T00:00:00+03'),
      ('3','assembling',3000,'RUB','2026-10-03T00:00:00+03'),
      ('4','paid',4000,'USD','2026-10-04T00:00:00+03'),
      ('5','paid',5000,'RUB','2026-10-05T00:00:00+03'),
      ('6','paid',6000,'RUB','2026-11-01T00:00:00+03')`);
    await client.query(`INSERT INTO ad_attribution VALUES
      ('order','1','{"utm_campaign":"123"}'), ('order','1','{"utm_campaign":"123"}'),
      ('order','2','{"utm_campaign":"123"}'), ('order','3','{"utm_campaign":"123"}'),
      ('order','4','{"utm_campaign":"123"}'), ('order','5','{"utm_campaign":"999"}'),
      ('order','6','{"utm_campaign":"123"}')`);
    await client.query(`INSERT INTO order_status_history VALUES ('3','paid'),('3','paid')`);
    await client.query(`INSERT INTO metrika_purchase_outbox VALUES ('1','sent'),('1','sent'),('3','uncertain')`);
    const query = (sql, params) => client.query(sql, params);
    const params = { campaignId: '123', dateFrom: '2026-10-01', dateTo: '2026-10-31' };
    const actual = await readOrderEvidence(query, params);
    assert.equal(actual.createdOrders, 4);
    assert.equal(actual.cancelledOrders, 1);
    assert.equal(actual.paidOrders, 3);
    assert.equal(actual.currentlyPaidOrders, 2);
    assert.equal(actual.everPaidOrders, 3);
    assert.equal(actual.paidRevenueRub, 4000);
    assert.equal(actual.nonRubPaidOrders, 1);
    assert.equal(actual.purchaseOutboxSent, 1);
    assert.equal(actual.campaignAttributionVerified, false);
    assert.equal(actual.goalEventMatched, false);
    assert.equal(actual.goalExists, null);
    assert.equal(actual.goalActivityVerified, null);
    assert.equal(actual.orderGoalVerified, false);
    assert.equal(actual.checkoutGoalVerified, false);
    const empty = await readOrderEvidence(query, { ...params, campaignId: '777' });
    assert.equal(empty.createdOrders, 0);
    assert.equal(empty.paidOrders, 0);

    // Exercise the HTTP router against this same dedicated connection, retaining its temp tables.
    // The route's transaction uses the actual PostgreSQL connection and SET LOCAL.
    process.env.DATABASE_URL = 'postgresql://127.0.0.1:1/unavailable';
    process.env.ADMIN_SESSION_SECRET = 'isolated-test-only';
    const { default: express } = await import('express');
    const { createMarketingOrderEvidenceRouter, createOrderEvidencePool } = await import('../routes/marketing-order-evidence.mjs');
    const boundedPool = createOrderEvidencePool({ connectionString: testUrl, max: 1, connectionTimeoutMillis: 100 });
    const held = await boundedPool.connect();
    try {
      const attempts = await Promise.allSettled(Array.from({ length: 30 }, () => boundedPool.connect()));
      assert.equal(attempts.filter(x => x.status === 'rejected').length, 30);
      assert.equal(boundedPool.waitingCount, 0);
      assert.equal(boundedPool.totalCount, 1);
    } finally { held.release(); await boundedPool.end(); }
    const secret = 'endpoint-test-secret-with-adequate-length';
    const dbPool = { connect: async () => ({ query: (...args) => client.query(...args), release() {} }) };
    const app = express();
    app.use('/api/internal/direct', createMarketingOrderEvidenceRouter({ secret, dbPool }));
    const server = app.listen(0, '127.0.0.1');
    try {
      await new Promise(resolve => server.once('listening', resolve));
      const url = `http://127.0.0.1:${server.address().port}/api/internal/direct/order-evidence?campaignId=123&dateFrom=2026-10-01&dateTo=2026-10-31`;
      assert.equal((await fetch(url)).status, 401);
      assert.equal((await fetch(url, { headers: { authorization: 'Bearer wrong' } })).status, 401);
      const response = await fetch(url, { headers: { authorization: `Bearer ${secret}` } });
      assert.equal(response.status, 200);
      const body = await response.json();
      assert.equal(body.createdOrders, 4);
      assert.equal(body.cancelledOrders, 1);
      assert.equal(body.paidOrders, 3);
      assert.equal(body.paidRevenueRub, 4000);
      assert.equal(body.nonRubPaidOrders, 1);
      assert.equal(body.purchaseOutboxSent, 1);
      assert.equal(body.campaignAttributionVerified, false);
      assert.equal(body.goalEventMatched, false);
      assert.equal(body.checkoutGoalVerified, false);
      assert.doesNotMatch(JSON.stringify(body), /customer|phone|email|address/i);
    } finally {
      await new Promise(resolve => server.close(resolve));
    }
  } finally {
    await client.end();
  }
});
