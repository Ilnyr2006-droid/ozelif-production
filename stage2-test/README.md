# OZELIF Stage2 TEST — isolated Yandex Metrika integration

**Prepared; not publicly deployed. Do not put this code on ozelifkoja.ru.**

The dedicated Yandex Metrika counter **113963518** and exact-match event goal
**677252576** (`ozelif_stage2_test_order_created`) are already created.
The live store uses counter **112275551**, which MUST NOT be used for this test.

Only production-ready fixture in this directory is **`index.html`**.
Its hostname check is pinned to `https://stage2-test.ozelifkoja.ru`.
It does NOT use actual CRM checkout, payment or customer details.
It sends at most one *attempted* synthetic goal per local browser profile,
never asserts successful provider ingestion, and stores only a random 128-bit ref.
This does not cryptographically guarantee exactly once across multiple tabs or devices.

## Test & deploy

- Run `node --test stage2-test/index.node-test.mjs`: **6/6 passed**.
- Use an independently configured HTTPS static hosting project, serving
  `stage2-test/index.html` at `/index.html`, and map only
  `stage2-test.ozelifkoja.ru` to this service. DNS and HTTPS hosting
  configuration are not available through the current ChatGPT tools.
- Do not point this staging project at the existing OZELIF frontend or server,
  don't deploy the branch to the live webshop, and don't touch campaign spend.
- The page tries official `mc.yandex.ru` and `mc.yandex.com` Metrika tag
  hosts, keeping the send button disabled until a script load succeeds.
- A Mac Chrome isolation test reached the test page over HTTPS with an
  in-browser hostname override. Both Metrika script hosts failed to load
  with `ERR_CONNECTION_CLOSED`; **no test event was sent**.

## Logs API evidence

An actual Logs API export #**62727158** on counter 113963518 for 2026-10-30
was processed, with the requested six columns and zero rows. This confirms
Logs API access only, not actual event ref matching. The counter was created
on 2026-10-31. Events for 2026-10-31 require a later completed-day export.

After a future real event, download every part for the corresponding day and
correlate the numeric goal ID and opaque ref in the **same event**. Never send
raw visitor records, OAuth tokens, session parameters or PII to ChatGPT.
Do not claim `orderGoalVerified=true`, verified CPA or verified ROAS from this
probe. Follow **`DEPLOY_AND_LOGS.md`** for the complete isolated runbook.

## Checkout integration gate

The checkout claim module and SQL migration 105 elsewhere in this PR are
**not wired to production**. Do not run the migration or deploy checkout
changes before actual provider serialization and isolated PostgreSQL tests.
