# Isolated stage-2 test counter: operator checklist

**Never run this test with production Metrika counter 112275551 or on
https://ozelifkoja.ru. Do not modify any live checkout, real order, production
goal, Yandex Direct campaign, payment pipeline or stage-1 API.**

This directory contains only a standalone static HTTPS test page. It does not
call the OZELIF server or create CRM orders. It makes exactly one **attempted**
synthetic goal event per browser storage, not a confirmed delivery and not
cryptographically guaranteed exactly-once across tabs. Repeat/collision tests
must be run using isolated sessions and counted as potentially ambiguous.

## Operator steps (Yandex account)

1. Set up an **independent HTTPS staging hostname** under your control. Do
   not serve the fixture on the production webshop or copy the existing
   production Metrika tag into its HTML. Add appropriate no-index protection.
2. In https://metrika.yandex.ru choose **Добавить счётчик**. Name it
   `OZELIF stage2 test ONLY`, supply the staging **hostname**, not
   ozelifkoja.ru, and configure privacy defaults. Keep the counter separate
   from the existing 112275551. Save its numeric **test counter ID**.
3. On that test counter, choose **Цели → Добавить цель → Целевое событие**.
   Use the exact identifier `ozelif_stage2_test_order_created` with condition
   `совпадает`. Record the numeric ID of that TEST goal, not production
   goal 609951402.
4. Publish `isolated-goal-test.html` on the staging hostname over HTTPS.
   The page refuses production hostnames and production counter 112275551.
   Paste the test counter ID into the page, initialize, then click **Отправить
   ОДНО тестовое событие** exactly once. Save the 32-character opaque ref
   in a restricted local test note; it contains no customer data.
5. Check the test counter goal activity only. To check **actual Logs API**
   serialization, use the independent `metrika:read` token with explicit
   access to the TEST counter and a date range including the test event.
   Read the hits Logs API documentation and fetch exactly
   `ym:pv:watchID,ym:pv:visitID,ym:pv:date,ym:pv:counterID,ym:pv:goalsID,ym:pv:params`.
   Confirm *all* export parts are processed, downloaded and parsed. Keep
   watch/visit IDs as **strings**, not JS Number. Redact raw rows, URL,
   client ID, IP address, unrelated parameters and order ref before sharing.
6. Validate whether the target goal ID and opaque ref occur in the **same**
   hit record and determine the JSON shape of `ym:pv:params`.
   Capture only the **redacted shape** of params (objects/arrays/keys/types),
   per-field types, presence of IDs and counts. Do not assume JSON object
   serialization from synthetic fixture code.
7. Do not activate `order-goal-claim.mjs`, run migration 105, enable
   checkout, or connect the new flow to the public site until the above
   evidence and a transactional isolated-DB and browser retry test are
   independently reviewed. Historical orders remain unmatched.

### How to decide

- Same goal + ref in the same actual hit: proceed with isolated checkout/DB
  integration, but NOT a verified purchase/paid advertising claim.
- Missing ref or separate rows / undocumented encoding: **STOP** and
  redesign the correlation mechanism.
- Logs unavailable/incomplete, duplicate watch IDs or late events:
  mark unknown or conflict, never claim a verified match.

References:
- https://yandex.ru/support/metrica/ru/general/creating-counter
- https://yandex.ru/support/metrica/ru/general/goal-js-event
- https://yandex.ru/support/metrica/ru/objects/reachgoal
- https://yandex.ru/dev/metrika/ru/logs/fields/hits

**What to return for next step:** test counter ID, test goal ID, staging
hostname, and only sanitized schema information from the test export. Do NOT
share Yandex OAuth tokens, browser cookies, visitor data or raw Logs API rows.
