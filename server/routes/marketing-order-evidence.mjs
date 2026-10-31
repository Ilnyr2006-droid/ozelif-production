import { Router } from 'express';
import { createHash, timingSafeEqual } from 'node:crypto';
import pg from 'pg';
import { env } from '../lib/env.mjs';
import { readOrderEvidence, validateOrderEvidenceRange } from '../lib/marketing-order-evidence.mjs';

function sameSecret(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  const hash = s => createHash('sha256').update(s).digest();
  return timingSafeEqual(hash(a), hash(b));
}

// Dedicated capacity prevents this endpoint from queueing against the shared checkout pool.
export function createOrderEvidencePool({ connectionString = env.databaseUrl, connectionTimeoutMillis = 1500, query_timeout = 4000, max = 2 } = {}) {
  const evidencePool = new pg.Pool({ connectionString, connectionTimeoutMillis, query_timeout, max, allowExitOnIdle: true });
  evidencePool.on('error', () => console.error('Order evidence idle connection lost'));
  return evidencePool;
}
const pool = createOrderEvidencePool();

// The setting is scoped to a read-only transaction, never the shared pool.
export async function readEvidenceInTransaction(dbPool, args) {
  const client = await dbPool.connect();
  let failed = false;
  try {
    await client.query('BEGIN READ ONLY');
    await client.query("SET LOCAL statement_timeout = '3s'");
    const result = await readOrderEvidence((sql, params) => client.query(sql, params), args);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    failed = true;
    // Destroying the connection rolls back the transaction. Do not wait for a
    // second network round trip when PostgreSQL is unreachable or stalled.
    throw error;
  } finally {
    client.release(failed);
  }
}

export function createMarketingOrderEvidenceRouter({
  queryFn, dbPool = pool, secret = process.env.OZELIF_MCP_ORDER_READ_TOKEN, maxConcurrent = 2
} = {}) {
  const router = Router();
  let inFlight = 0;
  router.get('/order-evidence', async (req, res) => {
    res.set('Cache-Control', 'private, no-store, max-age=0');
    res.set('X-Robots-Tag', 'noindex, nofollow');
    if (typeof secret !== 'string' || secret.length < 32) return res.status(404).json({ error: 'not_available' });
    const auth = String(req.get('authorization') || '');
    if (!auth.startsWith('Bearer ') || !sameSecret(auth.slice(7), secret)) return res.status(401).json({ error: 'unauthorized' });
    let args;
    try {
      args = validateOrderEvidenceRange({ campaignId: req.query.campaignId, dateFrom: req.query.dateFrom, dateTo: req.query.dateTo });
    } catch {
      return res.status(400).json({ error: 'invalid_request' });
    }
    if (inFlight >= maxConcurrent) return res.status(503).json({ error: 'busy' });
    inFlight++;
    try {
      const result = queryFn ? await readOrderEvidence(queryFn, args) : await readEvidenceInTransaction(dbPool, args);
      return res.json(result);
    } catch {
      // Never return SQL or customer records to clients.
      return res.status(503).json({ error: 'data_unavailable' });
    } finally {
      inFlight--;
    }
  });
  return router;
}
