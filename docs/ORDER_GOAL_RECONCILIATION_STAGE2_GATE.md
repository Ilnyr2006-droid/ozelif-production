# OZELIF Stage 2 — per-order Metrika correlation gate (NOT deployed)

State on 2026-10-31: **isolated code, draft SQL migration, standalone test page and tests only**. The current production
stage-1 API is read-only and must stay unchanged. No production order, goal
configuration, checkout, campaign or Metrika counter has been changed.

## Existing, verified behaviour

- The browser currently calls `goal('order_created')` after a successful
  `POST /api/orders/checkout`. It sends **no order reference**; therefore a historical
  goal reach is not directly linkable to an individual saved order.
- The server has saved first-party UTM and potentially Metrika ClientID, but
  neither a shared date nor ClientID proves an individual goal event matches an
  order, nor that it came from a particular paid ad.
- Existing `metrika_purchase_outbox` is a different **paid ecommerce purchase**
  transport; do not count it as proof of the `order_created` goal or send a second
  copy of the checkout goal.
- The stage-1 aggregate API and MCP must continue reporting
  `orderGoalVerified: false` and `verifiedRoas: null`.

## Implemented in this branch

`server/lib/order-goal-reconciliation-logs.mjs` is a standalone parser for **normalized**
Metrika Logs API hits with a trusted completeness manifest. It verifies exact
counter `112275551`, goal `609951402`, opaque reference and the same event row,
and treats UInt64 watch/visit IDs as strings. Incomplete exports, invalid data,
counter mismatches and inconsistent duplicate watch IDs fail closed. Separate
events for one ref become `duplicate_events`; a repeated export of the same
watch ID is counted once. The output intentionally contains no order ID,
event ID, order ref, raw parameters or customer data. It never sets
`orderGoalVerified: true` or asserts attribution/settlement.

`server/lib/order-goal-reconciliation-logs.node-test.mjs` covers the above
with synthetic in-memory data, including a separate test-counter scope.
`server/lib/order-goal-claim.mjs` prepares one-time random ref allocation
inside a new-order transaction, while `server/sql/105_order_goal_correlations.sql`
defines a draft storage table; neither is wired to checkout or applied.
`stage2-test/isolated-goal-test.html` is a standalone test-only page that
rejects production hostnames and counter 112275551. Its code may run only on
an independent HTTPS test site with a separately created test counter.
The setup checklist is `stage2-test/README.md`.

**16/16 isolated tests passed** (10 export parser tests and 6 claim tests).
The HTML JavaScript syntax check passed. These checks **do not** validate
actual Metrika serialization, persistent PostgreSQL transactions or browser
delivery. No real Metrika test counter has been created in this session.

## Why production activation is blocked

Official Logs API describes hits fields `ym:pv:watchID`,
`ym:pv:visitID`, `ym:pv:goalsID` and `ym:pv:params`. Available documentation
shows `reachGoal` accepts additional parameters, but it does not prove that a
particular order-ref payload will appear in the **same hit row** in this
account's Logs API export. Our existing `logrequests/evaluate` success for a
production date range showed only that the requested fields were available.

A genuinely separate **test counter**, a test goal and a test event are
needed to inspect real export format, quoting/encoding, latency, incomplete
processing and late-arriving data. Do not send artificial or replayed goals to
the production counter. Do not create any real paid orders for the test.

## Minimum subsequent implementation (separate review)

1. Decide whether `order_created` means **request saved** (current behaviour) or
   payment; do not conflate them. Validate goal settings on the isolated test
   counter; never silently modify the existing production goal.
2. In an isolated DB, generate an independently random 128-bit
   `order_ref` inside the successful order transaction; enforce uniqueness per
   order and per ref. Repeated checkout with the same idempotency key must
   return the **same** ref, without creating a new event entitlement.
   Existing orders without refs remain `unmatched`.
3. After the order commit, return the ref only to the successful checkout
   response and emit at most one client-side `reachGoal('order_created', {ozelif_order_ref: ref})`
   attempt under a durable, per-order delivery claim. The claim must be
   updated before the attempt; unknown outcomes are **not** auto-replayed.
   The existing bare `goal('order_created')` call must be replaced, not supplemented.
   No public order number, name, phone, email, address, idempotency key or
   cart contents should enter Metrika goal parameters.
4. Build a limited, read-only Logs API importer using the separate
   `metrika:read` credential. Bound date windows, downloaded bytes, parts,
   API retries and rate; keep no raw hits or PII. Confirm all request parts
   are processed/read before constructing the trusted completeness
   manifest for the parser. Results are only point-in-time observations;
   later data may change them.
5. Persist only restricted correlation state and conflict flags with
   necessary unique keys (`order_id`, `order_ref` and event watch ID scoped
   by counter); define retention, deletion and minimal access. Reject a
   ref observed for multiple different orders and every ambiguous replay.
6. Implement server-side, authenticated aggregation with no raw refs and
   a separate read-only MCP tool. Even an observed goal is only a
   provider-observed browser event, **not** independently verified payment
   or Direct campaign attribution. Do not elevate CPA/ROAS until independent
   attribution and payment proofs are separately established.
7. Test isolated DB, browser retries/reloads, parallel tabs, blocked Metrika,
   network uncertainty, contradictory export parts, late hits, DB outage,
   schema mismatch, PII stripping and a real test-counter export. Obtain
   separate authorization before production deployment.

## Official references

- https://yandex.ru/dev/metrika/ru/logs/fields/hits
- https://yandex.ru/dev/metrika/ru/logs/
- https://yandex.ru/support/metrica/ru/objects/reachgoal

**Stop condition:** If the test-counter export cannot reliably reveal the
same goal and opaque ref on the same hit, halt this route and redesign the
measurement channel. Never substitute a time-only, UTM-only or ClientID-only
join as verified order evidence.
