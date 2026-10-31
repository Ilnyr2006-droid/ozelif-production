# Stage 2: separate HTTPS hosting + real Logs API verification

As of 2026-10-31 the official Yandex Metrika TEST counter and goal are
created. **This branch is NOT deployed to production or to staging.**

| Item | Value |
|---|---|
| Only allowed hostname | stage2-test.ozelifkoja.ru |
| Counter | 113963518 |
| Goal | 677252576 |
| Goal event name | ozelif_stage2_test_order_created |
| Event parameter | ozelif_order_ref |
| Production counter (NEVER use) | 112275551 |

The self-contained page is `stage2-test/index.html`; automated safety checks
are `node --test stage2-test/index.node-test.mjs`. All six checks passed locally (including alternate-CDN fallback and no-repeat checks).
This fixture **does not create CRM orders** and does not demonstrate payment,
campaign attribution or verified ROAS.

## Safe hosting setup

Use a NEW isolated HTTPS static hosting project under your control (no specific provider required). Set:
- GitHub repository: `Ilnyr2006-droid/ozelif-production`
- Branch: `feature/order-goal-reconciliation-stage2-20261031`
- **Root Directory: `stage2-test`**, not the main website or API
- No build command; serve `stage2-test/index.html` as the site's `/index.html`
- Production domain: **DO NOT USE** `ozelifkoja.ru`
- Set custom hostname `stage2-test.ozelifkoja.ru`, create the DNS record
  provided by the hosting platform, and confirm working HTTPS.
- Disable indexing via `X-Robots-Tag: noindex, nofollow` and keep access
  to the one-off page private.

The fixture refuses to run on any other hostname or HTTP; it cannot safely
send a goal on a preview hostname. Do not alter this safety check.
No DNS control or hosting-deploy credentials have been supplied to this MCP
session, so code being present in GitHub **does not mean the site is live**.

## Browser send (one real attempt only)

1. Check HTTPS at `https://stage2-test.ozelifkoja.ru/` and that the
   visible counter is 113963518.
2. Browser network must successfully load
   `https://mc.yandex.ru/metrika/tag.js?id=113963518` OR the supported fallback
   `https://mc.yandex.com/metrika/tag.js?id=113963518`. The page now disables
   its send button until the tag script loads, and rejects events if both fail.
3. Click the one-time send button once. A cryptographically random 128-bit
   `ozelif_order_ref` is stored in browser localStorage before the send;
   second clicks / page reloads cannot retry in the same browser session.
   Do not reset browser storage to retry after an uncertain outcome.
4. The callback confirms only that the Metrika JS callback executed,
   **not** provider ingestion, settlement or actual checkout.

In isolated Chrome on the project Mac, we validated that the page serves
over a locally simulated HTTPS `stage2-test.ozelifkoja.ru` origin using a
browser-only DNS override. **This is not public hosting.** That browser failed
to fetch `mc.yandex.ru` (`ERR_CONNECTION_CLOSED`); direct TLS to
both `mc.yandex.ru` and the official `mc.yandex.com` alternative also failed.
**No real test goal was sent.** Both script downloads failed with
`ERR_CONNECTION_CLOSED` on 2026-10-31; the browser correctly disabled the
button and did not queue a goal. This is a network restriction on that Mac,
not evidence of a Yandex API or goal configuration error.

## Logs API

Logs API events are available only for previous dates; an event dated
2026-10-31 can be requested **no earlier than 2026-11-01**.

A safe dry-run was performed on test counter 113963518 for the prior day,
2026-10-30:
- `logrequests/evaluate` returned `possible: true`.
- Log export ID `62727158` reached `processed`.
- Downloaded part 0 has the expected six field names and 0 rows
  (the counter was created on 2026-10-31).
This proves the Logs API export handshake works, **not** goal/ref matching.

After one successful real browser event, request hits for the corresponding
completed day using this exact field list:

`ym:pv:watchID,ym:pv:visitID,ym:pv:date,ym:pv:counterID,ym:pv:goalsID,ym:pv:params`

Verify that goal `677252576` and the same opaque
`ozelif_order_ref` appear in ONE record. The shape of `ym:pv:params`
must be determined from **actual** Logs rows. Redact raw visitor data,
cookies, URLs, phone numbers and email; never paste entire raw exports into
ChatGPT or the repository. Do not enable production checkout or claim
`orderGoalVerified` before the actual check.

Official docs:
- https://yandex.ru/dev/metrika/ru/logs/openapi/createLogRequest_1
- https://yandex.ru/dev/metrika/ru/logs/practice/quick-start
- https://yandex.ru/dev/metrika/ru/logs/fields/hits
- https://yandex.ru/support/metrica/ru/objects/reachgoal
- https://yandex.com/support/metrica/ru/general/alternative-domain
