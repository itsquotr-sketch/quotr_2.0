# Release-candidate inventory

**Updated:** 22 October 2026. This closeout is the current record. The 21 October closeout, the 19 October plan, the performance pass, the morning acceptance, and the 9 October observations stay below as history. Where they disagree with this closeout, this closeout wins. Section 15 remains the migration procedure that was prepared on 19 October. It is not a list of work still to run.

**Application release:** `010176106f69df59f84d31d4ab40ed8306eb5dab` on `help/public-help-centre`. It is pushed. Its parent is the previous Production application `c00f159461cd520dbed952775ba158792c392751`.

**This document is not the application release.** It lives on `docs/release-candidate-notes`. This documentation commit is not merged into the application branch and is not the Production deployment.

## Closed release — 22 October 2026, Help centre

The owner approved the public Help centre. Production is serving the application SHA above. No migration was applied. The recorded Production schema head remains **112**. No account was created, no email was sent, and no commercial record was created.

| Fact | Value |
| --- | --- |
| Application branch | `help/public-help-centre` |
| Application SHA | `010176106f69df59f84d31d4ab40ed8306eb5dab` |
| Commits | `01017610` — Make the public help centre easier to read and move through. `08801885` — Add a public help centre builders can open without signing in. |
| Parent | `c00f159461cd520dbed952775ba158792c392751`. The difference is the Help pages, their navigation links, local search, and the Help check. |
| Working tree | Clean, and the SHA matches `origin/help/public-help-centre`. |
| Production deployment | `dpl_2DwWB8RNwQDSfarF9fzPrt7YnDfS` |
| Production URL | `https://quotr-2-0-erpadngwq-quotr1.vercel.app` |
| Production status | Ready, target production. Fresh build with Production environment settings. Domains were not assigned until it was Ready. The Preview deployment was not promoted. |
| `app.get-quotr.com` | that Production deployment. Help is `https://app.get-quotr.com/help`. |
| Production webhook alias | `https://quotr-2-0-quotr1.vercel.app` serves the same Production deployment. The live Stripe webhook destination was not changed. |
| Marketing website | `https://get-quotr.com` still returns the marketing site through Cloudflare. Its Vercel alias remains `dpl_D1Cdu9Wpr8WvGvDBbe83fyz1QrHq`. `www.get-quotr.com` was not changed. |
| `quotr-2-0.vercel.app` | unchanged: `dpl_8gsKqiawJdccmfgdibcjzSJSRqV7`. |
| Preview aliases | unchanged. Help Preview remains `quotr-2-0-pq72p24bd-quotr1.vercel.app`. Onboarding Preview remains `quotr-2-0-ot3jieuom-quotr1.vercel.app`. |
| Hardening alias | unchanged: `quotr-2-0-5vp6wvo61-quotr1.vercel.app`. |
| Workflow alias | unchanged: `quotr-2-0-cayf5rl0f-quotr1.vercel.app`. |
| Production schema | Not migrated. The recorded head remains **112**. |
| Production build settings | Production Supabase `lxvnylhsbvudzzupxeqr`, `BILLING_ENVIRONMENT=live`, `NEXT_PUBLIC_SITE_URL=https://app.get-quotr.com`, and the existing Production Google Maps browser key. |

### Focused checks

Signed-out `https://app.get-quotr.com/help` and all eight guides return 200 and do not redirect to login. Search, heading anchors, related guides, and the support mail link work. Signed-out readers see **Sign in**. `/app/dashboard` and `/app/settings/billing` redirect to login. The desktop and 390×640 reading checks were repeated on the live site: row links, search, heading navigation, keyboard focus, wrapping headings, and no horizontal overflow. No existing authorised session was available, so Help was not opened from inside the application and **Back to Quotr** was not clicked while signed in.

## Previous closeout — 22 October 2026, onboarding and legal pages

This section records the onboarding and legal release. It is included in the Help release above. It is not, by itself, the deployment serving the app now.

The owner approved publication of Application Terms and Privacy Notice version `2026-10-22`. That release served `c00f159461cd520dbed952775ba158792c392751`. Production schema head was **112**. No further signup was created, no confirmation email was sent, and Checkout was not submitted.

| Fact | Value |
| --- | --- |
| Application branch | `fix/onboarding-address-benchmarks-terms` |
| Application SHA | `c00f159461cd520dbed952775ba158792c392751` |
| Commit | 2026-10-22 — Send signup confirmation to the onboarding Preview callback. |
| Working tree | Clean, and the SHA matches `origin/fix/onboarding-address-benchmarks-terms`. |
| Included | Approved legal pages, public auth scrolling, signup help buttons, corrected confirmation links, Change email controls, carpenter $60 and labourer $35 benchmarks, and the existing recovery, sign-out, and billing fixes from `330df0b9`, `3ff55e2a`, `0f96d93a`, and `316f1fac`. |
| Production deployment | `dpl_D1Cdu9Wpr8WvGvDBbe83fyz1QrHq` |
| Production URL | `https://quotr-2-0-kkz27lt3t-quotr1.vercel.app` |
| Production status | Ready, target production. Fresh build of this SHA. The Preview deployment `dpl_4iT259t3Sy7whYr9S9i2PuxCF1So` was not promoted. |
| `app.get-quotr.com` | that Production deployment. |
| Production webhook alias | `https://quotr-2-0-quotr1.vercel.app` serves the same Production deployment. The live Stripe webhook destination was not changed. |
| Marketing website | `https://get-quotr.com` returns the marketing site through Cloudflare. `www.get-quotr.com` does not. The domain check is in the next section. `quotr-2-0.vercel.app` remains on `dpl_8gsKqiawJdccmfgdibcjzSJSRqV7`. |
| Onboarding Preview alias | `quotr-2-0-git-fix-onboarding-address-benchmarks-terms-quotr1.vercel.app` restored to Preview `dpl_4iT259t3Sy7whYr9S9i2PuxCF1So`. |
| Hardening alias | unchanged: `dpl_7HV1zMhfbcpNcSp3KeQphXraFTN2`. |
| Workflow alias | unchanged: `dpl_BfK5K8mFV5nMnAGKXxUvmhfAD5cf`. |
| Production schema | `lxvnylhsbvudzzupxeqr` head **112**. The dry-run before apply listed only `112_signup_terms_acceptance.sql`. After apply, local and remote match through 112 and a later dry-run reports up to date. Twelve existing profiles remain without Terms acceptance. |
| Production backup | Latest completed backup before the apply remained available: physical, completed `2026-10-21T17:44:16.682Z`, 8 of 8 completed. |
| Production build settings | Production Supabase `lxvnylhsbvudzzupxeqr`, `BILLING_ENVIRONMENT=live`, `NEXT_PUBLIC_SITE_URL=https://app.get-quotr.com`, and the existing Production Google Maps browser key. |
| Preview schema | `shhpjsoldmqtkdbgrbtm` head **112**. The already-applied Preview objects were recorded in migration history, and the following dry-run reports up to date. |

### Focused checks

Signed-out `/terms` and `/privacy` on `app.get-quotr.com` show version `2026-10-22`, Flowra Limited, NZBN `9429052916465`, Auckland, New Zealand, and `hello@get-quotr.com`. Signup scrolls at desktop and at 390×640. Phone and product-update help buttons open. Resend confirmation, Change email, and Return to login stay reachable, and the retained address stays visible. No signup was submitted. Business address search on `app.get-quotr.com` returned five New Zealand suggestions. The company rates screen is behind sign-in, so its labels were not opened; the deployed source shows Carpenter / builder at a $60 benchmark and Labourer at $35 per person-hour. Production email confirmation stays required. Its callback allow-list includes `app.get-quotr.com/auth/callback`, and the confirmation and recovery templates still use the token hash. No commercial document was rewritten.

The first genuine live subscription webhook remains the open operational watch from the 21 October closeout. Do not manufacture that subscription.

### Marketing domain check — 22 October 2026

No DNS, certificate, alias, or domain assignment was changed for this check.

| Name | Public DNS | Vercel project `quotr-2-0` | What a browser receives |
| --- | --- | --- | --- |
| `get-quotr.com` | Cloudflare nameservers `elsa.ns.cloudflare.com` and `bryce.ns.cloudflare.com`. Proxied A records `104.21.30.227` and `172.67.173.230`. No public CNAME. | Verified production domain, no redirect. Alias `dpl_D1Cdu9Wpr8WvGvDBbe83fyz1QrHq`. | Cloudflare serves the Astro marketing site, title “Builder Estimating & Quoting Software NZ — Quotr”. Favicon and `/_astro/BaseLayout.B9LP2_qi.css` return 200. Nine links point at `https://app.get-quotr.com/signup`, and that address returns the application signup page. |
| `www.get-quotr.com` | Same Cloudflare proxy addresses. No public CNAME. | Not attached. Alias lookup returns 404. | Cloudflare returns 522, and one read returned 523. The marketing page does not load. |
| `app.get-quotr.com` | CNAME `9f773dd5fb451769.vercel-dns-017.com`. | Alias `dpl_D1Cdu9Wpr8WvGvDBbe83fyz1QrHq`. | The application. Included here only to show which name actually uses Vercel. |

The changed Vercel assignment does not receive current apex traffic. Public DNS for `get-quotr.com` ends at Cloudflare, and Cloudflare is serving the marketing origin. Before this release the same Vercel record already named an application deployment, `dpl_8gsKqiawJdccmfgdibcjzSJSRqV7`, not the marketing origin. It now names the current application deployment. The future risk is unchanged in kind: if the apex DNS is later pointed at Vercel, visitors would get the application instead of the marketing site.

`www` is outside that Vercel record, so the assignment did not cause its failure. Cloudflare’s edge answers, and the origin behind `www` times out.

Smallest correction, not applied: in Cloudflare, redirect `www.get-quotr.com` to `https://get-quotr.com` on the existing marketing origin. Do not add `www` to the application project. Leave the apex Vercel record unchanged unless the apex DNS is going to move; removing `get-quotr.com` from the Vercel project is the smaller way to retire that future cutover, and it is separate from the `www` fix.

## Historical closeout — 21 October 2026

This section records the 21 October writeup for `0f96d93a02845ce276df488b30ecfd13b0a49952`. It is not the deployment serving the app now. Schema head on both hosted databases was then **111**. Password recovery and Quote/email delivery have passed owner QA. The Preview sandbox billing journey, including the Dahlia cancellation fix, is recorded below. The remaining item is operational: watch the first genuine live subscription webhook. Do not manufacture that subscription, and do not edit Production billing rows to simulate it.

| Fact | Value |
| --- | --- |
| Application branch | `ui/core-workflow-overhaul` |
| Application SHA | `0f96d93a02845ce276df488b30ecfd13b0a49952` |
| Commit | 2026-10-21 — Record Stripe `cancel_at` as the service end so access stops on that date. |
| Parent | `330df0b9e30f06e300817ce3e3087f7ce892181f` — Redeem password recovery on the server so the reset form can see the session. |
| Production deployment | `dpl_8gsKqiawJdccmfgdibcjzSJSRqV7` |
| Production URL | `https://quotr-2-0-n9rts7b16-quotr1.vercel.app` |
| Production status | Ready, target production, created 2026-10-21 18:33 +1300. Promoted from the committed preview deployment `dpl_BfK5K8mFV5nMnAGKXxUvmhfAD5cf`. The dirty preview upload was not promoted. |
| `app.get-quotr.com` | that Production deployment. Unauthenticated `/app/settings/billing` returns 307 to `/login`; the login page returns 200. |
| Production webhook alias | `https://quotr-2-0-quotr1.vercel.app` serves the same Production deployment. The live Stripe webhook destination was not changed. |
| Marketing domain | `https://get-quotr.com` still returns the marketing title through Cloudflare. It was not retargeted. |
| Workflow alias | `https://quotr-2-0-git-ui-core-workflow-overhaul-quotr1.vercel.app` serves `dpl_BfK5K8mFV5nMnAGKXxUvmhfAD5cf`, the same SHA, Ready, target preview. |
| Hardening alias | unchanged: `dpl_7HV1zMhfbcpNcSp3KeQphXraFTN2` / `quotr-2-0-5vp6wvo61`, Ready, created 2026-09-29. |
| Preview schema | `shhpjsoldmqtkdbgrbtm` head **111**, re-read 21 October 2026 with `npm run db:preview:status`. Local files on this SHA match. Versions 037 and 055 are absent on purpose. |
| Production schema | `lxvnylhsbvudzzupxeqr` head **111**, re-read the same day with `npm run db:production:status`. Local and remote match through 111. No remote-only version. 037 and 055 are absent. This supersedes the 19 October head of 045 in section 2. Do not run the section 15 pending list again. |
| Production billing mode | `BILLING_ENVIRONMENT=live`. `NEXT_PUBLIC_SUPABASE_URL` host is `lxvnylhsbvudzzupxeqr.supabase.co`. `NEXT_PUBLIC_SITE_URL` host is `app.get-quotr.com`. |

### Recovery and email QA

Owner QA on Production passed before the sandbox billing check. Password recovery and Quote/email delivery were accepted on `app.get-quotr.com`. The recovery correction in this release is `330df0b9e30f06e300817ce3e3087f7ce892181f`, which is the parent of the Production SHA. Those journeys were not repeated for this closeout.

### Sandbox billing

One Preview sandbox Checkout was completed for disposable organisation `PREVIEW-STRIPE-CHECK`, Preview user `68086eeb-81e8-418b-90cd-562d13b0ca07`, on Preview database `shhpjsoldmqtkdbgrbtm`. It was not repeated for this closeout.

| Check | Result |
| --- | --- |
| Checkout | Builder, test mode. Stripe subscription `sub_1USrBsR6sbl77rmF5w2qHmtD`, customer `cus_VToScievKJKeES`, `livemode` false. |
| Prices | Existing test prices. Builder `price_1UB0B0R6sbl77rmFZatpKuv3`. Business `price_1UB0BPR6sbl77rmFonhXvUHu`. NZD monthly, tax exclusive. GST 15%. |
| Upgrade | Quotr’s own Builder-to-Business upgrade, not the Customer Portal. Invoice `in_1USrCuR6sbl77rmFhU5FGiEH`, `subscription_update`, 1610 NZD cents, which is the $14 ex-GST difference plus 15% GST. |
| Portal | Test configuration `bpc_1UB4yQR6sbl77rmFZqx8d5xR`. Plan changes disabled. Cancel mode is at period end. Portal settings were not changed. |
| Cancellation request | Portal cancel-at-period-end. Stripe API `2026-08-26.dahlia` stored `cancel_at` and `current_period_end` at 1795235510 (2026-11-21 04:31:50 UTC), `cancel_at_period_end` false, and `cancellation_details.reason` `cancellation_requested`. |
| Applied event | `evt_1USrDXR6sbl77rmFwIU7w4MC` was resent only to the workflow test destination after its processed receipt was released. The subscription row was not hand-edited. |
| Mirror | Plan `business`, status `scheduled_to_cancel`, source `stripe`, `billing_environment` `test`, `cancel_at_period_end` true, `current_period_end` 2026-11-21 04:31:50+00, `cancelled_at` null. The billing page showed Quotr Business, Scheduled to cancel, current period ends 21 Nov 2026. |

### Cancellation fix

`0f96d93a02845ce276df488b30ecfd13b0a49952` changes only `lib/billing/access-policy.ts`, `lib/billing/mirror.ts`, `lib/billing/status.ts`, `lib/billing/types.ts`, and `scripts/verify-billing-1.ts`.

Stripe’s Dahlia cancel-at-period-end sets `cancel_at` and leaves `cancel_at_period_end` false. The parser now treats an open subscription with `cancel_at` as scheduled to cancel, and stores the earlier of `cancel_at` and the paid period end as the service end. A boolean `cancel_at_period_end` still uses the period end. An equal `cancel_at` stays on that instant. A later `cancel_at` does not extend access past the paid period.

Targeted checks in `scripts/verify-billing-1.ts` passed on 21 October 2026:

- `cancel_at_period_end` maps to `scheduled_to_cancel`
- scheduled cancellation is mirrored
- Dahlia `cancel_at` with `cancel_at_period_end` false is scheduled
- earlier `cancel_at` shortens the service end and access
- later `cancel_at` does not extend access past the paid period

The same script still exits because of the separate migration-number assertion below. That failure was not changed.

### Preview webhook destination

Preview deployments share `shhpjsoldmqtkdbgrbtm`, including `org_subscriptions` and `stripe_processed_events`. The first handler to claim an event id wins. One test destination is authoritative.

| Endpoint | State |
| --- | --- |
| `we_1USrp5R6sbl77rmFwsQ6R3Ms` | Authoritative. Enabled, test mode, API `2026-08-26.dahlia`, host `quotr-2-0-git-ui-core-workflow-overhaul-quotr1.vercel.app`, path `/api/webhooks/stripe`. That host serves `dpl_BfK5K8mFV5nMnAGKXxUvmhfAD5cf` at the Production SHA. Its signing secret is a Preview secret scoped to git branch `ui/core-workflow-overhaul`. |
| `we_1UB0GpR6sbl77rmFLLstelbV` | Disabled. Before disable it was enabled, test mode, the same API version, description “Quotr Preview Stripe Test Webhook”, on the hardening host, path `/api/webhooks/stripe`, for `checkout.session.completed`, `customer.subscription.created`, `customer.subscription.deleted`, `customer.subscription.updated`, `invoice.paid`, and `invoice.payment_failed`. It had no other required consumer. The hardening deployment and alias were not deleted. |

The live webhook destination, live Stripe products, and the Preview database were not changed for this fix.

### Separate migration-number assertion

These verifier lines are stale filename checks. They are not a schema mismatch. Production and Preview are at 111, and the local directory on `0f96d93a` ends at `111_deck_concrete_calibration_benchmark.sql`. Versions 037 and 055 remain absent on purpose. The assertions were not edited in the cancellation commit.

| Script | Assertion | Why it fails |
| --- | --- | --- |
| `scripts/verify-billing-1.ts` | “051 timezone remains; 053 role RLS is latest numbered local migration; 049 memberships remain” | It requires the last migration filename to be `053_role_aware_rls_hardening.sql`. The file exists. It is not the last file. |
| `scripts/verify-billing-2.ts` | “047 past_due authority exists locally; 053 role RLS remains; 063 remains and 071 is latest” | It requires the last migration filename to be `071_variation_attachments.sql`. The file exists. It is not the last file. |

Both scripts can still exit 1 after the cancellation checks have passed. Do not treat that exit as a failed release schema.

### Outstanding operational validation

First-genuine-customer webhook monitoring is still open. The cancellation code is deployed. No live subscription was created, and no Production billing row was edited. A live cancellation is proven only when a real customer event arrives on the existing live destination.

When that subscription arrives, inspect these places only:

1. Stripe Dashboard, live mode, Developers → Webhooks, the existing live endpoint. Open the `customer.subscription.created` or `customer.subscription.updated` event and read the delivery attempt and HTTP status. Do not change the endpoint URL.
2. Vercel project `quotr-2-0`, production deployment `dpl_8gsKqiawJdccmfgdibcjzSJSRqV7`, runtime logs for `POST /api/webhooks/stripe` on `quotr-2-0-quotr1.vercel.app` and `app.get-quotr.com`.
3. Supabase project `lxvnylhsbvudzzupxeqr`, table `public.stripe_processed_events`, for that event id with `billing_environment` `live` and status `processed`.
4. Same project, table `public.org_subscriptions`, for `source` `stripe`, `billing_environment` `live`, and the plan, status, `current_period_end`, `cancel_at_period_end`, and `last_stripe_event_id` written by that event.
5. The customer’s billing page at `https://app.get-quotr.com/app/settings/billing`.

## Historical record — 19 October 2026

The sections below are the 19 October record. They described a NO-GO because Production was then at schema 045 and had no Ready deployment of the candidate. That is no longer the current state.

## Current candidate — 19 October 2026, after the performance pass

| Fact | Value |
| --- | --- |
| Application branch | `ui/core-workflow-overhaul`. The pushed candidate is `f42553a490c83089ff3d01eeabb1774725fffe60`. |
| Performance-pass SHA | `edaac4833564cfcf600381e1d1ad1f824b8e7a86` |
| Performance-pass commit | 2026-10-19 — Run the navigation feedback script in the first HTML. |
| Documentation | separate branch `docs/release-candidate-notes`. Prior inventory commit `a0247cb42fdccc3e4c0356d575eccb991404b88d` recorded the morning acceptance. It is not the application SHA. |
| Performance-pass Preview deployment | `dpl_CkhKCmWTfTNwhUn5bB8Pv6VXAxK9` |
| Performance-pass deployment URL | `https://quotr-2-0-4etkibj0g-quotr1.vercel.app` |
| Performance-pass git SHA | `edaac4833564cfcf600381e1d1ad1f824b8e7a86` on `ui/core-workflow-overhaul`, read from the deployment record |
| Created | 2026-10-19 14:40 +1300, Ready, target preview |
| `app.get-quotr.com` | aligned Preview deployment in section 14, `dpl_DXpwuYynyDVRDR6Btoza98QAy1WY` |
| Workflow alias | `https://quotr-2-0-git-ui-core-workflow-overhaul-quotr1.vercel.app` serves that same deployment |
| Hardening alias | unchanged: `dpl_7HV1zMhfbcpNcSp3KeQphXraFTN2` / `quotr-2-0-5vp6wvo61`, Ready, created 2026-09-29. SHA remains `58d7681d6eb8d8e811ad6ec115f6a006bc179642`. |
| Preview schema | local files and remote `shhpjsoldmqtkdbgrbtm` head **111**, re-read 19 October 2026. Versions 037 and 055 are absent on purpose. |
| Production schema | remote `lxvnylhsbvudzzupxeqr` head **045**, re-read 19 October 2026. Remote column empty for 046–111. 037 and 055 absent. |
| Production deployment | still the only Production deployment: `dpl_EVCFu6wXBDvAvSB1oNcmsEzZe5Ji`, **Error**, created 2026-08-05. Not replaced. |

### Known waits

These are remaining waits on the candidate. They are not speed fixes, and no further performance change was made while writing this inventory.

| Wait | Observed |
| --- | --- |
| Create Pricing | about 9 seconds click-to-usable. The morning measurement on `e85029ea` was a median of about 9.17 seconds. The loader experiment was reverted. |
| Create Quote | about 7 seconds. Not remeasured for this inventory. |
| RFQ draft save | about 8.4 seconds click-to-usable on this SHA (8443 ms from Save draft until the saved request was visible). Feedback appeared in 21 ms. One disposable draft. No supplier invitation was sent. |

The same performance pass also measured quote display and presentation, the Subcontractors list and one record, and opening a new price-request form. Those interactions now show a loading line on click. Their usable times remain about 3.4–5.2 seconds, 1.9–3.4 seconds, and 3.4–4.0 seconds. That feedback is not a claim that the reads got faster.

### Acceptance preserved

| Path | Result kept |
| --- | --- |
| Deck | Not reopened. The earlier Preview sign-off stands. |
| Bathroom | Failed on `e85029ea`, as recorded in the morning section below. Closed later the same day by `2b5f74bf` (ask for the wall lining; do not copy a lining onto an unnamed ceiling portion) before this candidate. The commercial calculation was not reopened in the performance pass. |
| Ceiling | Failed before Pricing on `e85029ea`, as recorded below. Closed by `5b300048` (one unspecified ceiling stays on the flat package) and `d7369b12` (the provisional confirmation stays above the mobile pricing bar). Not reopened in the performance pass. |
| Retaining wall | **Passed** on project `ab27a4c6-c964-4bc5-bea4-16343170165c`. Not reopened. |
| Mixed Pricing/Quote | **Passed** on project `6db9a28d-24b7-4e67-b3fc-418d30b5f34b`, draft quote `9ff3c4ad-cf48-44d4-a04e-de44b7a97728`. Not reopened. |
| Focused performance pass | Complete at this application SHA. Scope was quote display, Subcontractors, and a new price-request draft. Production, hardening, schema, and company rates were not changed. |

Signed-in acceptance used disposable projects. No Quote was issued or emailed. Saved acceptance projects `c16b81e5-5ddb-4ba7-9383-29b54370fdad` and `4ffd5cab-8c03-4693-9081-b003b0fd9267` were not modified by the performance pass.

## Morning candidate — 19 October 2026

The table below is the morning record on `e85029ea`. It is not the deployment serving the app now. The Bathroom and Ceiling failures are the observations that the later commits above closed.

| Fact | Value |
| --- | --- |
| Application branch | `ui/core-workflow-overhaul` |
| Application SHA | `e85029eac87bb16d6343213975e13660578a344c` |
| Commit | 2026-10-18 19:49:19 +1300 — Speed up Create Quote by sharing the signed-in organisation and overlapping independent reads. |
| Working tree | clean at that SHA. No further Pricing redirect or project-loading change. |
| Workflow Preview deployment | `dpl_5Td3Gm35VfzjsD2L9zLeaaMLczts` |
| Deployment URL | `https://quotr-2-0-1qhjayb7m-quotr1.vercel.app` |
| Created | 2026-10-18 19:49:40 +1300, Ready, target preview |
| `app.get-quotr.com` | that same deployment at the time of the morning pass |
| Workflow alias | `https://quotr-2-0-git-ui-core-workflow-overhaul-quotr1.vercel.app` → that same deployment at the time of the morning pass |
| Hardening alias | unchanged: `dpl_7HV1zMhfbcpNcSp3KeQphXraFTN2` / `quotr-2-0-5vp6wvo61`, SHA `58d7681d6eb8d8e811ad6ec115f6a006bc179642`, created 2026-09-29 |
| Preview schema | local and remote head **111**. Versions 037 and 055 are still absent on purpose. |
| Production schema | remote head **045**. Pending 046–111 except absent 037 and 055. |
| Production deployment | not redeployed. The 5 August 2026 Error deployment recorded below was not replaced. |

Signed-in acceptance used disposable projects on `app.get-quotr.com`. No Quote was issued or emailed. Benchmark catalogue rates were not edited. One disposable company carpenter override was set through Rates, observed, and then removed. Phone checks used a 390×844 viewport. Primary actions sat above the mobile navigation (action bottom 752, navigation top 771) on Pricing review and on the draft Quote’s Send control. Navigation items overlap the bar because they are the bar.

### Tested journeys

| Path | Project | Result |
| --- | --- | --- |
| Bathroom | `c16b81e5-5ddb-4ba7-9383-29b54370fdad` | **Failed.** Complete strip-out is one labour line. The 1800×900 fibre-cement sheet is Pricing Required at $0 cost and $0 sell, and Mark as reviewed and Create quote stay disabled until a client price is entered. Specified GIB Aqualine was not asked and is not on the estimate. A separate Flooring area added a second unpriced sheet line, an unpriced custom finish-removal line, and extra installation labour. |
| Ceiling | `4ffd5cab-8c03-4693-9081-b003b0fd9267` | **Failed before Pricing.** Portion A was set to standard 10 mm plasterboard. Portion B has no lining and the only choices are named linings. Create estimate stays blocked. The flat $75/m² package and its confirmation control were not reached. |
| Retaining wall | `ab27a4c6-c964-4bc5-bea4-16343170165c` | **Passed.** Excavation required, no bank volume. The line is “Unmeasured bulk excavation — wall face 7.2 m², bank volume unknown”, unit m², Pricing Required. Quote creation stays blocked until that line is priced. |
| Mixed deck and fence | `6db9a28d-24b7-4e67-b3fc-418d30b5f34b` | **Passed.** Company carpenter cost $73/hour won on the labour lines (`Your company rate`, unit cost 73, sell 97.33). Direct cost $2,417.59 and client sell ex GST $3,223.70 match the line totals. Draft quote `9ff3c4ad-cf48-44d4-a04e-de44b7a97728` shows each visible line once and does not show internal cost or margin. |

### Create Pricing performance closeout

The pass is closed at `e85029eac87bb16d6343213975e13660578a344c`. No change was kept. Do not make another Pricing redirect or project-loading optimisation without a new, reproducible blocking cause. Create Pricing remains about 9 seconds click-to-usable. That figure is a remaining wait, not a speed fix.

The action response is a 303 whose body is the Pricing page. The browser does not make a second GET of that page. The usable summary is the commercial summary with a dollar amount. On the signed-off Preview, four journeys gave headers-to-usable about 2.39s, 2.53s, 2.50s, and 2.92s (median about 2.52s) and click-to-usable about 9.14s, 10.13s, 9.18s, and 9.15s (median about 9.17s). An instrumented page render was 2210ms: auth 719ms, then the slowest parallel loader (tabs 1491ms). A loader experiment on a throwaway deployment cut that render to about 1802ms, but four later journeys stayed at response-to-money 2426, 2359, 2871, and 2568 (median about 2.50s) and click-to-usable 9125, 9150, 9674, and 9139 (median about 9.14s). The experiment was reverted. Preview remains `dpl_5Td3Gm35VfzjsD2L9zLeaaMLczts`.

### Owner decisions still open

- Whether the bathroom details path must ask for GIB versus fibre cement before an estimate, and whether an analysed floor rebuild should become a second Flooring area that prices the same sheet and a second removal.
- Whether an unspecified ceiling stored as a nested portion should stay on the flat provisional package instead of requiring a named lining.
- Production remains NO-GO: schema 045, no Ready Production deployment of `edaac483`, and the environment gaps re-read in section 6. Do not deploy Production from this update.

## 1. Candidate mapping (9 October snapshot)

| Fact | Value |
| --- | --- |
| Local branch | `ui/core-workflow-overhaul` |
| Local `HEAD` at inventory start | `1cfa7d24a437f8955143d100083d6e93eaab115e` |
| `origin/ui/core-workflow-overhaul` after `git fetch` | same SHA |
| Working tree at inventory start | clean, no untracked files |
| Commit | 2026-10-09 17:46:50 +1300 — Notify builders when a subcontractor submits a price, and keep the RFQ comparison and pricing decision inside the page that actually scrolls. |
| Latest Ready Preview deployment | `dpl_9fjHt4pATsN6ec3se272NynYChxL` |
| Preview deployment URL | `https://quotr-2-0-4ztccre2a-quotr1.vercel.app` |
| Preview deployment SHA | `1cfa7d24a437f8955143d100083d6e93eaab115e` |
| Preview deployment status | Ready, target preview, created 2026-10-09 17:46:59 +1300 |
| Workflow alias | `https://quotr-2-0-git-ui-core-workflow-overhaul-quotr1.vercel.app` → that same deployment |
| Hardening alias | `https://quotr-2-0-git-hardening-stage-2a-security-quotr1.vercel.app` |
| Hardening deployment | `dpl_7HV1zMhfbcpNcSp3KeQphXraFTN2` (`https://quotr-2-0-5vp6wvo61-quotr1.vercel.app`) |
| Hardening SHA | `58d7681d6eb8d8e811ad6ec115f6a006bc179642` on `hardening/stage-2a-security`, Ready, created 2026-09-29 15:51:06 +1300 |
| Production deployment | `dpl_EVCFu6wXBDvAvSB1oNcmsEzZe5Ji` |
| Production URL | `https://quotr-2-0-judzm2u39-quotr1.vercel.app` |
| Production SHA | `383133d8ccfc0123bff269b5ff1ced0a46fb8888` on `main` |
| Production status | **Error**, created 2026-08-05 00:36:44 UTC. It is the only Production deployment returned. |
| Default Production hostname | `https://quotr-2-0.vercel.app` returned HTTP 404 at inventory time |

Vercel project `quotr-2-0` (`prj_fPvYMlTj74oC5vcFolpkCHJJ8s0i`), team `quotr1`. GitHub repo `quotr_2.0`. Production branch setting is `main`. Node 24.x. Cron count on the project is 0. Root directory is unset.

### Jointly tested pair

The pair recorded on 9 October is below. The pair now serving the workflow Preview is in the current-candidate section: `edaac4833564cfcf600381e1d1ad1f824b8e7a86`, deployment `dpl_CkhKCmWTfTNwhUn5bB8Pv6VXAxK9`, Preview schema **111**. The morning pair `e85029ea` / `dpl_5Td3Gm35VfzjsD2L9zLeaaMLczts` is the acceptance record, not the deployment now aliased to `app.get-quotr.com`.

The 9 October pair was:

- code `1cfa7d24a437f8955143d100083d6e93eaab115e`
- Preview deployment `dpl_9fjHt4pATsN6ec3se272NynYChxL`
- Preview database `quotr_preview` / `shhpjsoldmqtkdbgrbtm`, schema history through **107**

That commit contains `supabase/migrations/107_rfq_price_notification.sql`, and Preview’s migration history includes 107. This inventory does not treat any other mixture as the candidate.

These mixtures were **not** jointly tested as the candidate:

- hardening code `58d7681` with Preview schema 107 (same database, older application)
- candidate code `edaac483` with Production schema 045
- a local Docker database (Docker was not running)

`NEXT_PUBLIC_SITE_URL` on the shared Preview environment was re-read on 19 October 2026. Its host is `quotr-2-0-git-hardening-stage-2a-security-quotr1.vercel.app`. Quote and invite links use that origin (`resolveConfiguredSiteOrigin`). Any *.vercel.app origin other than the hardening alias is treated as ephemeral, including the workflow alias. RFQ public links use `VERCEL_BRANCH_URL` instead, so they stay on the branch that sent them. Signup and recovery mail use the request host, then the branch host, then the deployment host, and do not substitute the hardening alias. A quote or invitation opened from the workflow app can still land on `58d7681` while reading the schema-111 database. That is a different pair from the candidate.

## 2. Schema heads

| Place | History | Head |
| --- | --- | --- |
| Repository files on `edaac483` | 001–036, 038–054, 056–111 | file head **111** |
| Local applied database | **unavailable** | Docker daemon was not running at the morning inventory. It was not started for this update. |
| Local `.env.local` target | hosted Preview | project ref `shhpjsoldmqtkdbgrbtm` (not Production) |
| Preview `shhpjsoldmqtkdbgrbtm` | `npm run db:preview:status` on 19 October 2026: every local version present remotely, remote empty nowhere in that list | **111** |
| Production `lxvnylhsbvudzzupxeqr` | `npm run db:production:status` on 19 October 2026: 001–036 and 038–045 present; remote empty from 046 through 111. Status only. Nothing was pushed. | **045** |

There is no remote-only version on either hosted database. Preview matches the candidate files. Production matches those files through 045 and then stops.

### 037 and 055

Both numbers are absent on purpose. They are not missing files and they are not history drift.

- **037** has no SQL file. Preview and Production both go 036 → 038. The Deck identity gate deferred a materials table and recorded “No migration 037.” `083_organisation_customers.sql` states there is no 037 or 055.
- **055** has no SQL file. Preview and Production both go 054 → 056. `056_bathroom_company_dna_catalogue_seed.sql` reserves 055 for QDISP-SQL-055, the same skip convention as 037. Quote Display left that public-lookup hardening deferred. Do not create 055 to “fill the gap.”

### Pending Production migrations, application order

Apply only after a separate owner rehearsal. Order is the numeric version, not lexicographic filename sort. Skip 055 because it does not exist.

`046, 047, 048, 049, 050, 051, 052, 053, 054, 056, 057, 058, 059, 060, 061, 062, 063, 064, 065, 066, 067, 068, 069, 070, 071, 072, 073, 074, 075, 076, 077, 078, 079, 080, 081, 082, 083, 084, 085, 086, 087, 088, 089, 090, 091, 092, 093, 094, 095, 096, 097, 098, 099, 100, 101, 102, 103, 104, 105, 106, 107, 108, 109, 110, 111`

108 updates calibration-catalogue benchmark productivity only. 109 replaces the fence post-hole concrete catalogue reference. 110 adds `pricing_documents.provisional_ceiling_confirmation`. 111 updates the deck concrete calibration-catalogue reference. None of these write organisation rates.

No new `CREATE EXTENSION` appears in 046–107. `pgcrypto` is already in 001, which Production has. Branding bucket `organisation-branding` is already in 034, which Production has.

| Versions | What they add | Risk to call out |
| --- | --- | --- |
| 046 | Billing tables and RLS | Additive schema. Member SELECT; writes are service role. |
| 047 | `past_due_since` | Additive column. No backfill. |
| 048 | Trial singleton `billing_runtime_config`, provision rewrite, `bootstrap_missing_preview_internal_trials()` | **Ops-critical.** The file does not seed the singleton. Missing or non-`live` config fails signup closed. Immediately after 048, insert `billing_environment = 'live'` on Production. The bootstrap function refuses unless the singleton is `test`, so it must not be used to fill Production. Not a clean rollback once trials exist. |
| 049 | Memberships, invitations, seats; backfill from bound profiles (`member` → `estimator`; never infer Viewer) | **Highest data risk.** Unique owner index fails closed if any org has more than one owner profile. Restrictive policies without membership rows block writes. Not safely reversible. Includes triggers and RLS. Reads `auth.users`. |
| 050 | Clear `profiles.org_id` when a membership is removed | Trigger replace. Reverting reopens access. |
| 051 | Organisation timezone | **Backfill.** NZ settings become `Pacific/Auckland` or `Pacific/Chatham`; other regions stay null. Heuristic. |
| 052 | Calibration catalogue and evidence; `rates.source` | **Backfill** `rates.source = 'explicit_company'` where null, then NOT NULL. Evidence FK. RLS. |
| 053 | Role-aware RLS | Replaces write policies. Estimator and Viewer authority changes. Apply after 049 and 052. |
| 054, 056 | Company DNA and Bathroom catalogue seeds | Data inserts, `ON CONFLICT DO NOTHING`. These write the benchmark tasks whose commercial values still await owner review. |
| 057 | Repeated work-area acceptance | Replaces the type-only duplicate rule with instance uniqueness. |
| 058–059 | Project lifecycle ledger | 058 does not backfill old quotes. 059 copies hosted quote transactions into the ledger. |
| 060–061 | Preview fixture delete bypass for organisations named `PLATFORM-02C %`, service role only | **Do not pause between 060 and 062.** 060/061 widen delete for that name prefix, including append-only quote events. |
| 062 | Removes the 060/061 bypass and restores append-only functions | Required in the same window as 060 and 061. After 062 the bypass is gone. History still contains 060 and 061. |
| 063–073 | Variation domain, wording, immutability, cost build-ups, rate snapshots, delivery, attachments, acceptance, work areas | RLS, triggers, and constraints. Issued rows are immutable. **071** creates private bucket `variation-attachments`. |
| 074–075 | Marketing consent and Loops sync-pending flag | Additive. Existing rows stay opted out / not pending. No scheduler in this repo. |
| 076–077, 081 | Onboarding steps, ABN, unified onboarding authority | Additive. 077 does not rewrite quote or variation snapshots. |
| 078–080 | Project documents and permanent delete | **078** creates private bucket `project-documents`. Storage objects are not removed by project-row cascade. |
| 082 | Estimate write role | Drops and replaces authenticated write policies. Active Owner, Admin, or Estimator only. |
| 083–084 | Customers; manual pricing continuation uniqueness | RLS and triggers. Issued quotes are not updated. |
| 085–086 | Account phone uniqueness | **Auth trigger** `claim_signup_account_phone` AFTER INSERT on `auth.users`. No backfill. A duplicate E.164 rolls the new auth user back. 086 allows a missing phone unless `signup_phone_required` is true. Phone is not a login. |
| 087–089 | Subcontractors | RLS and triggers. **088** creates private bucket `subcontractor-documents`. |
| 090–107 | RFQ, rate book, questions, schedule, pricing application, price notification | RLS, freeze triggers, and immutability. **090** creates private bucket `rfq-response-files` (PDF). Submitted responses and supplier-priced lines are frozen. 107 adds a notification trigger on priced submit. |

Private buckets introduced for Production: `variation-attachments`, `project-documents`, `subcontractor-documents`, `rfq-response-files`.

## 3. Feature and commercial scope

“Signed off on Preview” is used only where this inventory was told the feature is signed off and the candidate checks for that feature passed. Other rows are not signed off. RFQ and Analytics were not reopened for redesign.

| Scope | Status | Evidence | Exact remaining test |
| --- | --- | --- | --- |
| Signup, phone uniqueness, invitations | implemented but QA incomplete | `verify-signup-phone.ts` and `verify-signup-onboarding-handoff.ts` passed on `1cfa7d2`. Preview has 085 and 086. | On the workflow alias, sign up two accounts with the same E.164 number and confirm the second auth user rolls back. Accept one invitation with a free number and one with an already-claimed number. `verify-signup-phone-live.ts` was not run. |
| Onboarding | implemented but QA incomplete | `verify-onboarding-01.ts` and `verify-unified-onboarding-authority.ts` passed. Preview has 076, 077, and 081. | A fresh workflow-alias account completes the required steps and still reaches calibration. |
| Google address entry | implemented but QA incomplete | `verify-address-places.ts` passed. `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` is present on Preview. | In Google Cloud, confirm HTTP referrers cover localhost and the workflow alias, and that Places fills an address there. Referrer restrictions were not visible from Vercel. |
| Customers and subcontractor Contacts | implemented but QA incomplete | `verify-subcontractors-01.ts` passed. Preview has 083 and 087–089. `verify-customers-01.ts` failed on a stale selector, not on a missing page: `ContactsPageFrame` defaults `title = "Contacts"`, and the customers route passes `section="customers"`. | Retarget the `contacts title` assertion to that default, then open Customers and one subcontractor profile on the workflow alias. |
| Project intake | implemented but QA incomplete | `verify-project-intake-01.ts` passed. | Create one project on the workflow alias from an existing customer and one with a typed address. |
| Supported and manual Work Areas | awaiting owner approval | Capability bands live in `lib/work-areas/support-contract.ts` (`supported`, `trial_supported`, `developing`, `component`, `staged`, `unsupported`). Manual continuation uniqueness is 084. | Owner reviews which bands are commercially mature. No redesign in this inventory. |
| Details, Estimate, calibration | awaiting owner approval for rates and productivity values; workflow itself is implemented but QA incomplete | Commercial golden `verify-batch-2b3b-golden-commercial-engine.ts` passed. Catalogue seeds 054 and 056 are already on Preview. | Owner reviews benchmark and productivity values. Separately, walk Details → Estimate once on the workflow alias. Do not re-benchmark in this task. |
| Pricing and Pricing Required | implemented but QA incomplete | `verify-pricing-required-manual-01.ts` and `verify-pricing-required-manual-01-r1.ts` passed. | One manual Work Area on the workflow alias reaches Pricing Required and does not invent a price. |
| RFQs, questions and notifications, itemised responses, supplier-rate book, application to draft Pricing | signed off on Preview | `verify-rfq-01.ts`, `verify-rfq-pricing-01.ts`, `verify-rfq-schedule-01.ts`, and `verify-rfq-schedule-pricing-01.ts` passed without `--live`. Preview schema 107 matches the candidate SHA. | None for redesign. Keep the signed-off behaviour. |
| Quote delivery, public view, acceptance and signature, revisions | implemented but QA incomplete | Product assertions inside the quote verifiers passed. Each script then failed because it still expects the last filename to be `080_project_document_delete.sql`. Variations closure passed separately. Mail links still target the hardening alias. | From the workflow deployment, send one quote and accept it on the public link. Record the host. A pass on the hardening alias does not count. |
| Variations and snapshots | implemented but QA incomplete | `verify-variations-04-final-closure.ts` passed. Preview has 063–073 and 079. | Issue one variation on the workflow alias, accept it on `/v/[token]`, and confirm the issued snapshot does not follow a later draft edit. |
| Builder/Business Analytics | signed off on Preview | `verify-analytics-01.ts` passed. Not reopened. | None for redesign. |
| Entitlement and Viewer access | implemented but QA incomplete | Billing behaviour assertions largely passed. `verify-billing-4.ts` also failed a stale migration head and a registry-size cap. `verify-security-082-estimate-writes.ts` static checks passed. Live Viewer PostgREST was not re-run. | On the workflow alias, a Viewer cannot create a project or edit pricing, and a Builder does not receive Business analytics. |
| Billing | blocked | Preview has Stripe price, tax, portal, secret, and webhook names set (values sensitive, so test vs live was not read). Hardening branch override is `BILLING_ENVIRONMENT=test` and `BILLING_ENFORCEMENT_MODE=strict`. Production has none of the Stripe or billing names. Static `verify-billing-1.ts` and `verify-billing-ui-01.ts` passed. | Owner confirms the Preview secret is test-mode in the Stripe dashboard. Do not create live prices or change Production in this task. |
| Operational email | blocked for Production; Preview presence only | `verify-application-email-01.ts` passed. Preview has Resend key, from addresses, and webhook secret (sensitive). Production has none. `get-quotr.com` MX is Google. SPF is `v=spf1 include:dc-aa8e722993._spfm.get-quotr.com ~all`. DMARC is `p=quarantine`. The nested SPF include returned no TXT here, so Resend’s inclusion is unverified. | Send one invite and one quote from the workflow deployment and record the link host and the From domain. Confirm Resend domain auth in the Resend dashboard. |
| Website-to-app handoff | blocked | `https://get-quotr.com` returned a waitlist page. That copy is not in this repository. The only matching links were `https://get-quotr.com/` and `/#sign-in`. There is no link to `/signup` or to the workflow alias. | Owner chooses the app origin. The marketing page then links to that origin’s `/signup`. Do not invent the domain. |

Voice transcription and benchmark changes were not started.

## 4. Tests

Run on the candidate tree before the documentation commit.

| Check | Result |
| --- | --- |
| `npx tsc --noEmit` | pass, exit 0 |
| `npm run build:safe` | pass, exit 0. Next.js 16.2.9. Compile used `.env.local` and refused a Production Supabase URL. |
| `npm run lint` | ESLint reported **0 errors and 33 warnings** (unused locals in estimate and verify files). This inventory also passed `--max-warnings 0`, which made that invocation exit 1. The project script does not set that cap. Warnings are not a release blocker. |
| Commercial golden `verify-batch-2b3b-golden-commercial-engine.ts` | pass |
| Pricing Required `verify-pricing-required-manual-01.ts` and `-r1` | pass |
| Variations `verify-variations-04-final-closure.ts` | pass |
| RFQ static suite (`verify-rfq-01`, `verify-rfq-pricing-01`, `verify-rfq-schedule-01`, `verify-rfq-schedule-pricing-01`) | pass |
| Analytics `verify-analytics-01.ts` | pass |
| Billing `verify-billing-1.ts`, `verify-billing-ui-01.ts` | pass |
| Onboarding, signup phone, signup handoff, application email, address Places, subcontractors, project intake, security-082 static | pass |

No product-behaviour assertion in this set failed. The red scripts are stale heads, one stale selector, one stale size cap, and a Docker outage.

### Stale assertions

Do not delete these tests. Retarget the head or selector, then re-run. The newest migration file on `edaac483` is `111_deck_concrete_calibration_benchmark.sql`. These scripts were not re-run for this inventory.

| Test | Assertion | Current result | Proposed resolution |
| --- | --- | --- | --- |
| `verify-quote-transaction-01.ts` | `041 quote transaction exists; later migrations follow additively` requires last file `080_project_document_delete.sql` | FAIL | Keep the “041–054 remain” checks. Point the head at 111. |
| `verify-quote-delivery-01.ts` | `042 delivery architecture remains; later billing/membership migrations are additive` also requires last file 080 | FAIL | Same retarget. |
| `verify-quote-acceptance-01.ts` | `044 acceptance remains; later billing/membership migrations follow additively` also requires last file 080 | FAIL | Same retarget. |
| `verify-billing-2.ts` | `047 past_due authority exists locally; 053 role RLS remains; 063 remains and 071 is latest` | FAIL | Keep 047 and 063 present. Point the head at 111. |
| `verify-billing-3.ts` | `053 role RLS is latest numbered local migration; 048 trial remains` | FAIL | Keep 048 present. Point the head at 111. |
| `verify-billing-4.ts` | `049 memberships remain and 053 role RLS is latest numbered local migration` | FAIL | Keep 049–053 present. Point the head at 111. |
| `verify-beta-launch.ts` | `latest migration is 057 repeated work area acceptance` | FAIL | Keep “no 037” and “046–053 present”, which passed. Point the head at 111. |
| `verify-security-053.ts` | `latest migration is 056 Bathroom DNA catalogue seed` | FAIL | Keep “053 remains”. Point the head at 111. |
| `verify-customers-01.ts` | `contacts title` requires the literal `title="Contacts"` in `ContactsPageFrame.tsx` | FAIL | Assert the default parameter `title = "Contacts"` and `section="customers"`. The page still renders Contacts. |
| `verify-billing-4.ts` | `permission registry stays small` requires fewer than 40 `/"[a-z.]+"/` matches in `lib/team/permissions.ts` | FAIL | Count `ORG_PERMISSIONS` (16 names) and still require `team.invite` and `billing.manage`. The file now repeats those names across role sets and helpers, so the old cap is stale. |

### Environment-dependent

| Test | Assertion | Current result | Proposed resolution |
| --- | --- | --- | --- |
| `verify-batch-2a5-tenant-isolation.ts` | `local Postgres container reachable` | FAIL. Docker is not running. The script refuses remote URLs. | Start Docker and `supabase start`, then re-run. Do not point it at Preview or Production. |

The 2A.5 script has no Preview mode. Separate opt-in Preview checks exist: `verify-security-053.ts --live` and `verify-security-082-estimate-writes.ts --live`. They were **not run**. `--live` creates Preview auth users and organisations. Static security-082 passed. Static security-053 failed only on the stale 056 head.

### Not run

- Every other `scripts/verify-*.ts` outside the set above.
- RFQ `--live`, signup-phone live, and any check that sends mail, calls Stripe, or calls a paid model.
- A second full `npm run lint` without `--max-warnings 0`. The warning list itself was produced by ESLint.

## 5. Preview QA data

`scripts/preview-fixture-retention.ts` listed **23** organisations named `Schedule price QA %` on Preview. Every one has at least one submitted RFQ response, so product immutability blocks deletion. Twelve also have quote events. The script did not report an active schedule-application blocker on these rows. Identifiers:

| Organisation | Blockers |
| --- | --- |
| `fd8cd43d-1557-43d4-894c-ec089d9439bd` Schedule price QA 022093ad | submitted responses 1 |
| `aa0784f2-0838-43ad-a2d7-c4d5072b1fc4` Schedule price QA 70c12055 | submitted responses 1 |
| `210865f4-82fc-43fa-9bb4-48ea8a36bf7b` Schedule price QA 2a1d45d8 | submitted responses 1 |
| `814b6dc3-ea91-4360-a0c8-5fc63a337ff7` Schedule price QA 01a24cfc | submitted responses 1 |
| `a76b15da-78d6-479a-81c3-01724c5cb63e` Schedule price QA 5925b23c | submitted responses 1, quote events 1 |
| `ac273e5d-8535-47bb-8216-964e0bfacf73` Schedule price QA a8a1f6f9 | submitted responses 2, quote events 1 |
| `7d38134e-6bbc-47e4-a010-d76e46ae45e5` Schedule price QA c95737cd | submitted responses 2, quote events 1 |
| `53cad9c4-3dd3-4dcb-9b44-d1a949d5a0e0` Schedule price QA 467a3671 | submitted responses 1 |
| `3d57d631-5575-4942-a1c1-81c224bd5603` Schedule price QA a468affa | submitted responses 1 |
| `0b222dc7-7cea-4239-87fc-81cc7a095827` Schedule price QA 58e1a32f | submitted responses 2, quote events 1 |
| `9018c385-047c-44b4-997f-a5cd8acb5a28` Schedule price QA c09b896a | submitted responses 2 |
| `b0aebbc7-c416-4ba5-bd9d-8ecdcd6f3401` Schedule price QA 4fe29281 | submitted responses 2 |
| `24ceba34-440e-4dff-afd3-fc48d8389c62` Schedule price QA bd495b7b | submitted responses 2 |
| `da9d746b-e1e2-415b-bd13-d93e425428a2` Schedule price QA a240e839 | submitted responses 2 |
| `2b98d6db-73b3-4d32-a61f-2e65747a632c` Schedule price QA 3d8e92fe | submitted responses 3, quote events 1 |
| `4c8aaf17-e314-441a-9d96-dd0cf9ccfc9c` Schedule price QA fd1c363a | submitted responses 3, quote events 1 |
| `ab7f64bb-3001-4fee-9818-edb60b753efe` Schedule price QA d3adf553 | submitted responses 2, quote events 1 |
| `46acf5ad-ae96-4903-86a2-36016ad3f752` Schedule price QA 85d2853e | submitted responses 3, quote events 1 |
| `38fe7547-2c91-415e-844a-aea5f387ac55` Schedule price QA c92bced2 | submitted responses 3, quote events 1 |
| `6d650f41-149c-4a01-b0e3-5e5ff79fd4c7` Schedule price QA abb2b95a | submitted responses 3, quote events 1 |
| `dd91beef-28d8-420e-9318-6b199275b92d` Schedule price QA a19148c7 | submitted responses 3, quote events 1 |
| `f0fea349-dffd-4eb2-a49a-76e8babb67cf` Schedule price QA a2d96360 | submitted responses 2 |
| `a29dc971-7f34-4ff0-932f-54580f6e37e0` Schedule price QA f8c19ea3 | submitted responses 3, quote events 1 |

**Retention plan, not executed.** Keep these organisations. Do not disable triggers, do not set `session_replication_role`, and do not reintroduce the 060 bypass. Migration 062 removed that bypass. New disposable runs need a fresh organisation name that is not `Schedule price QA`, and owner demos should ignore this prefix. Deletion becomes possible only if a future product rule allows it without rewriting submitted responses or quote events. Production was not queried for these names.

## 6. Environment and domains

Presence and target only. Secret values were not printed. Sensitive Vercel values were not readable through `env pull` and are marked sensitive. A Preview branch pull does not replace the shared Preview set; branch rows below are overrides. Shared Preview variables still apply to both branch deployments unless noted.

| Name | Preview (shared) | Workflow branch override | Hardening branch override | Production |
| --- | --- | --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | `shhpjsoldmqtkdbgrbtm` | same Preview ref | same Preview ref | `lxvnylhsbvudzzupxeqr` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | present | inherited | inherited | present |
| `SUPABASE_SERVICE_ROLE_KEY` | present, sensitive | override present, sensitive | no override seen | present, sensitive |
| `NEXT_PUBLIC_SITE_URL` | host `quotr-2-0-git-hardening-stage-2a-security-quotr1.vercel.app`, re-read 19 October | inherited | inherited | **unset**, re-read 19 October |
| Resend key, from addresses, webhook secret | present, sensitive | inherited | inherited | **unset** |
| Stripe secret, webhook, three prices, NZ GST tax rate, portal configuration | present, sensitive | inherited | inherited | **unset** |
| `BILLING_ENVIRONMENT` | present, sensitive (literal not read) | no override seen | `test` | **unset** |
| `BILLING_ENFORCEMENT_MODE` | unset on the shared pull | no override seen | `strict` | **unset** |
| `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` | present | inherited | inherited | **unset** |
| `ANTHROPIC_API_KEY` | present, sensitive | inherited | inherited | present, sensitive |
| `ANTHROPIC_MODEL` | present, sensitive | inherited | inherited | present, sensitive |
| `NEXT_PUBLIC_FEEDBACK_EMAIL` | present, sensitive | inherited | inherited | present, sensitive |
| `SCOPE_DISCOVERY_ENABLED` | unset on the shared pull | no override seen | present, sensitive | unset |
| `LOOPS_API_KEY` | present, sensitive | inherited | inherited | unset |
| `QUOTE_DELIVERY_PROVIDER` | unset | unset | unset | unset |

Development environment variable count was 0. No `lib/` or `app/` read of `LOOPS_API_KEY` was found. Migration 075 only stores a sync-pending flag. Project cron count is 0. There is no `vercel.json` cron and no `pg_cron` in the migrations. Quote notification flush is an authenticated POST, not a schedule.

Stripe mode (test vs live) on the shared Preview secret is **unverified** because the value is sensitive. Do not infer test from the hardening `BILLING_ENVIRONMENT=test` override alone. The app rejects `live` when `VERCEL_ENV=preview`, and the workflow deployment is Ready, but that does not prove which Stripe secret is stored.

### Domains, DNS, auth, webhooks

| Surface | What was verified | What is unverified |
| --- | --- | --- |
| Vercel domains on this project | `app.get-quotr.com` is an alias of the workflow Preview and, on 19 October, answered 307 to `/login`. The workflow branch alias did the same. | `get-quotr.com` was not re-fetched. The 9 October waitlist finding is unchanged until someone loads it again. |
| Public DNS | Not re-queried for this update. | `beta.get-quotr.com`, nested SPF, and Resend DKIM remain unverified. |
| Production app | `quotr-2-0.vercel.app` is 404. The only Production deployment is Error. | — |
| Supabase Auth Site URL and redirect allow-list, on both `shhpjsoldmqtkdbgrbtm` and `lxvnylhsbvudzzupxeqr` | Read 19 October. Full hosts and paths are in section 11. Both Site URLs are the hardening alias. `app.get-quotr.com` is on neither allow-list. | The approved Production origin is still unset, so these lists do not yet match a live domain. |
| Mail URLs | Code: auth callbacks use `/auth/callback`; quotes use `/q/[token]`; variations use `/v/[token]`; RFQs use `/r/[token]`. | Resend and Supabase SMTP dashboard endpoints were not opened. |
| Webhook routes in this app | `/api/webhooks/stripe` and `/api/webhooks/resend` exist. | Whether Stripe or Resend is pointed at the workflow host, the hardening host, or Production. Production has no webhook secrets. |
| Signup links | Marketing page links are `/` and `/#sign-in` only. | No `get-quotr.com` link to this app’s `/signup` was found. |

### Production Error deployment

Build log for `dpl_EVCFu6wXBDvAvSB1oNcmsEzZe5Ji` on 2026-08-05:

`Missing required environment variables: NEXT_PUBLIC_SUPABASE_URL, …`  
`Failed to collect page data for /`  
`npm run build` exited 1.

`assertRequiredEnv()` throws in production builds when `NEXT_PUBLIC_SUPABASE_URL` or `NEXT_PUBLIC_SUPABASE_ANON_KEY` is missing. Both names are **present now**. A Production env pull on 19 October showed the URL ref `lxvnylhsbvudzzupxeqr`. The Error deployment was never replaced. Current settings would get past that particular build check. They would not make a safe release: site URL, billing, Stripe, Resend, Loops, and Google are still unset on Production, `BILLING_ENFORCEMENT_MODE` is unset, and the database is still at 045. Stripe test versus live on Preview is still unreadable because the secret cannot be pulled. Nothing was deployed to confirm a newer build.

## 7. Ordered blockers

| # | Blocker | Owner | Evidence that closes it |
| --- | --- | --- | --- |
| 1 | No Ready Production deployment. Re-read 19 October: the only one is still Error `dpl_EVCFu6wXBDvAvSB1oNcmsEzZe5Ji` from 5 August 2026, aliases `quotr-2-0-quotr1.vercel.app` and the `main` git alias. It is not `edaac483`. | Owner | A later Ready Production deployment of the approved SHA, after the rows below are closed. Do not deploy from this inventory. |
| 2 | Production schema is 045. Re-read 19 October with `db:production:status`, and the preflight query again returned schema head 045. The candidate database is 111. Delta is 046–111 except absent 037 and 055. | Owner | A usable backup or PITR point, which section 11 did not find, then a rehearsed apply in the order in section 2. 048 live singleton inserted before 049. 060–062 not left half-applied. Preview bootstrap function not called. |
| 3 | Production env, re-read 19 October, has Supabase URL ref `lxvnylhsbvudzzupxeqr`, anon key, and service role. It has no site URL, Stripe, billing mode, Resend, Loops, or Google key. | Owner | Names present on Production only, live Stripe mode confirmed in the dashboard, site URL equal to the approved domain. Preview values must not be copied. |
| 4 | `get-quotr.com` was a waitlist on 9 October and was not re-fetched. It does not, in that record, link to `/signup`. `app.get-quotr.com` now serves this Preview and redirects to `/login`; that is not the Production domain. | Owner | A page load of the approved origin showing this app’s signup, plus a marketing link to that URL. |
| 5 | Auth Site URL and redirect allow-lists were read on 19 October. Both projects use the hardening alias as Site URL. Production’s allow-list has an old deployment host, localhost, and the hardening callback. | Owner | Replace those Production values with the approved origin’s `/auth/callback` only when that origin is chosen. Leave the Preview list on the workflow host. |
| 6 | Quote and invite links on Preview still use the hardening host, re-read 19 October, while the candidate is `edaac483` on schema 111. | Owner | A decision, then one workflow-alias send whose public link stays on that deployment. Do not move the hardening alias as part of this inventory. |
| 7 | Preview Stripe secret mode was not readable. | Owner | Stripe dashboard shows the Preview secret is test mode. |
| 8 | Resend alignment with Google MX / SPF is unverified. | Owner | Resend domain status for `get-quotr.com`, plus one delivered invite and one delivered quote. |
| 9 | Google key restrictions are unverified, and Production has no key. | Owner | Referrer list includes the approved origin before a Production key is used. |
| 10 | Rates, productivity values, and Work Area commercial maturity await owner review. | Owner | Written accept or deferral. Not a code change in this task. |
| 11 | Release scripts are red on stale heads and one UI selector. | Engineering, after this inventory | Retarget as in section 4 and re-run. Do not delete the tests. |
| 12 | Local tenant-isolation suite did not run. | Engineering | Docker up, then `verify-batch-2a5-tenant-isolation.ts`. Optional later: security-053 and security-082 `--live` on Preview only. |

## 8. Staged release runbook

Do not run this section now. Production migrations, a Production deploy, the hardening alias, and the `app.get-quotr.com` assignment stay as they are.

### Preparation

Stop unless every line is true.

- Application SHA is still `edaac4833564cfcf600381e1d1ad1f824b8e7a86`, or a later SHA that has been paired again with schema 111 and written into this inventory.
- `npm run db:production:status` still shows remote head 045 and an empty remote column from 046.
- A Production backup or PITR point with a timestamp exists. The 19 October read does not satisfy this line. See section 11.
- Owner profiles are counted. The 19 October aggregate is 8 organisations with one owner each and 0 with more than one. `049` creates `organisation_memberships_one_owner_uidx`. More than one owner profile in one organisation stops the rehearsal.
- Preview and Production Auth Site URL and redirect allow-lists have been read. The current Production Site URL is already the hardening alias; a later change uses the approved origin.
- The full commercial catalogue is still not a prerequisite. The unverified paths in sections 3 and 4 stay listed until they are run.

### Migration rehearsal

Apply only the ordered list in section 2. Skip 037 and 055. Check, then continue. Stop on any failed check.

| After | Check before the next version |
| --- | --- |
| 046–047 | Billing tables exist. `past_due_since` exists. No signup yet. |
| 048 | Stop the push here. `048` creates the singleton and does not insert it. Ops then inserts one row with `billing_environment = 'live'`. `db push` has no stop-at flag, so this insert is a separate step before 049. Do not call `bootstrap_missing_preview_internal_trials()`. |
| 049 | One owner membership per organisation. A missing membership must not be left as the way a user writes data. Not safely reversible. |
| 050–053 | Removed members lose `profiles.org_id`. Role policies are the 053 policies. Estimator and Viewer behaviour is the intended authority. |
| 051 | Timezone backfill is accepted: NZ settings become `Pacific/Auckland` or `Pacific/Chatham`; other regions stay null. |
| 052 | `rates.source` is `explicit_company` where it was null, then NOT NULL. This does not edit the rate amounts. |
| 054, 056 | Catalogue seeds applied with `ON CONFLICT DO NOTHING`. Benchmark values remain an owner decision. |
| 057–059 | Repeated work areas use instance identity. 059 copied hosted quote transactions into the lifecycle ledger. |
| 060–062 | One uninterrupted `db push` for these three files. Each file commits on its own, so a pause after 060 or 061 leaves the delete bypass in place. After 062, `preview_lifecycle_fixture_cleanup(uuid)` and `preview_fixture_org(uuid)` are absent, and `enforce_quote_events_append_only` raises `quote_events are append-only`. |
| 063–073 | Variation immutability holds. Private bucket `variation-attachments` exists after 071. |
| 074–075 | Consent stays opted out. The sync-pending flag exists. There is still no cron and no `LOOPS_API_KEY` reader in this repo. |
| 076–082 | Onboarding and ABN columns exist. 082 write policies allow only an active Owner, Admin, or Estimator. |
| 083–084 | Customers exist. Manual pricing continuation uniqueness holds. Issued quotes were not rewritten. |
| 085–086 | `claim_signup_account_phone` is AFTER INSERT on `auth.users`. A duplicate E.164 rolls the new user back. A missing phone is allowed unless `signup_phone_required` is true. |
| 087–089 | Subcontractors exist. Private bucket `subcontractor-documents` exists after 088. |
| 090–107 | Private bucket `rfq-response-files` exists after 090. Submitted responses and supplier-priced lines are frozen. 107 notifies on a priced submit. |
| 108–111 | Calibration-catalogue productivity only. 110 adds `pricing_documents.provisional_ceiling_confirmation`. No organisation rate, quote, variation, or issued snapshot was rewritten. Head is 111. |

`pgcrypto` is already in 001. Branding bucket `organisation-branding` is already in 034, which Production has. New private buckets are `variation-attachments`, `project-documents`, `subcontractor-documents`, and `rfq-response-files`.

### Production configuration

Set Production names only. Do not copy Preview secrets.

- `NEXT_PUBLIC_SITE_URL` is the approved Production origin, not the hardening alias and not `app.get-quotr.com` while that host is the Preview.
- `BILLING_ENVIRONMENT=live`. Stripe secret, webhook, three prices, NZ GST tax rate, and portal configuration are live-mode. Preview’s secret mode is still unread, so it is not evidence for Production.
- Resend key, from addresses, and webhook secret. `QUOTE_DELIVERY_PROVIDER` is unset in both environments today; decide it before the first Production quote email.
- Google key restricted to the approved origin.
- Leave `LOOPS_API_KEY` unset unless a scheduler exists. Migration 075 only stores a flag.

### Deployment

Deploy Production from `edaac4833564cfcf600381e1d1ad1f824b8e7a86` only after the migration head is 111 and the configuration checks above passed. Do not deploy `58d7681` onto schema 111. Do not deploy the candidate onto schema 045. Do not deploy as part of this inventory.

### Smoke checks

On the approved origin, before the domain cutover: signup, a duplicate E.164 rejected, a Viewer cannot create a project or edit pricing, one quote link host, one variation link host, and one price-request draft that is not sent to a supplier.

### Domain transition

Point the approved origin at the Ready Production deployment. Marketing `get-quotr.com` links to that origin’s `/signup`. Leave the hardening alias on `58d7681`. Move `app.get-quotr.com` off the workflow Preview only in this stage, and only onto the Ready Production deployment.

### Rollback and stop points

Stop before 046 if the backup or the owner count is missing. Stop after 048 if the live singleton is missing. Stop inside 060–062 if 062 has not been applied. Stop before deploy if the schema head is not 111 or the site URL is unset.

Database rollback is restore of the backup taken before 046. There is no down-migration. Memberships, rate provenance, phone claims, storage objects, and issued quote or variation rows are not safely reversible. There is no previous Ready Production deployment to alias back to. Do not alias Production at the Error deployment and call that a rollback. Leave the hardening alias on `58d7681`.

## 9. Go / no-go for the proper domain

| Gate | Result |
| --- | --- |
| Candidate SHA is the Ready workflow deployment | yes — `f42553a490c83089ff3d01eeabb1774725fffe60` on `dpl_DXpwuYynyDVRDR6Btoza98QAy1WY`. The workflow alias and `app.get-quotr.com` both resolve to that deployment. Section 14. |
| That SHA is paired with Preview schema 111 | yes, re-read 19 October |
| Working tree was clean and matched origin at inventory start | yes |
| Candidate labelled frozen | **no** |
| Production deployment Ready on that SHA | **no** |
| Production schema 111 | **no** — still 045, re-read 19 October |
| Production site URL, Stripe live, billing live, Resend, Google | **no** |
| Auth redirects read and matching the approved origin | **read** — both Site URLs are the hardening alias |
| Marketing signup link to the app | **no** |
| Quote links proven on the workflow branch alias | **yes** — section 13. Invite, Quote, variation, and RFQ hosts are `quotr-2-0-git-ui-core-workflow-overhaul-quotr1.vercel.app` |
| Owner review of rates and Work Area maturity | **no** |
| **Decision** | **NO-GO** |

## 10. Smallest next action

Leave Production and the hardening alias untouched. Do not apply 046 and do not create a Production deployment. The domain release stays **NO-GO**. Preview hosts are aligned in section 14. Section 15 records the Pro daily backups now listed for Production. PITR stays off. The live site, Auth, Stripe, billing, and Resend values are still unset. Production stays **NO-GO** until those values are entered and checked. The next step is that owner configuration, plus a separate copy of the one existing Storage object, before any stage in section 15.5 is run.

## 11. Production preflight — 19 October 2026

Reads only. No restore, no migration, no Auth change, no env change, and no secret value is recorded here. Application candidate `edaac4833564cfcf600381e1d1ad1f824b8e7a86`. Inventory base `be0a376b8e6dba103b8a839a3cea9fe4768bb0e4`. The owner query also returned schema head `045`, so the counts are from Production `lxvnylhsbvudzzupxeqr`.

The preflight rehearsal decision was **NO-GO** because Production had no PITR point. Section 12 then ran the migrations on a separate local copy. Production itself is still **NO-GO**.

### 11.1 Backup and PITR

`GET /v1/projects/lxvnylhsbvudzzupxeqr/database/backups` returned HTTP 200:

| Field | Value |
| --- | --- |
| Region | `ap-northeast-1` |
| `pitr_enabled` | false |
| `walg_enabled` | true |
| `physical_backup_data` | empty object, no earliest or latest timestamp |
| `backups` | empty list, count 0 |
| Selected add-ons | empty. PITR is offered as 7, 14, or 28 days and is not selected |

There is no recovery timestamp and no retention window in force. `supabase backups restore --project-ref lxvnylhsbvudzzupxeqr --timestamp <unix>` is the PITR restore command. It was not run. With PITR disabled and the backup list empty, that command has no timestamp to target. WAL-G reported as enabled, without a base-backup timestamp, is not a usable customer recovery point.

### 11.2 Migration 049 owner backfill

Counts only. No names, emails, or other personal data.

| Owner profiles in the organisation | Organisations | Bound profile rows |
| --- | ---: | ---: |
| Zero | 0 | 0 |
| One | 8 | 8 |
| More than one | 0 | 0 |

Eight profiles exist. All eight are bound, and all eight have role `owner`. Unbound profiles, null roles, roles outside `owner` / `admin` / `estimator` / `viewer` / `member`, and bound profiles whose organisation id is missing are all 0. Admin, estimator, viewer, and legacy `member` rows are all 0.

The backfill inserts one active membership for every profile with `org_id` set. On this data that is 8 active owner memberships. `organisation_memberships_one_owner_uidx` would accept that. The `profiles_role_check` added before the insert would accept the current roles. No foreign key would fail.

Rows that would stop 049 or create a membership the backfill comment does not intend, all currently 0:

- More than one `owner` profile in one organisation fails the unique owner index and rolls 049 back.
- A role outside the five allowed values fails `profiles_role_check` before the insert.
- A bound profile whose `org_id` is not an `organisations.id` fails the membership foreign key.
- A null role passes the check and the `else` branch inserts an active `estimator`.
- A legacy `member` becomes an active `estimator`. That mapping is what 049 comments. It affects 0 Production rows.
- An organisation with bound non-owner profiles and zero owners succeeds and leaves active memberships with no owner.

### 11.3 Auth Site URL and redirect allow-lists

Read from `supabase config pull --dry-run` for each project. Nothing was written.

| Project | Site URL | Additional redirect URLs |
| --- | --- | --- |
| Preview `shhpjsoldmqtkdbgrbtm` | `https://quotr-2-0-git-hardening-stage-2a-security-quotr1.vercel.app` | `http://localhost:3000/auth/callback`; `https://quotr-2-0-git-hardening-stage-2a-security-quotr1.vercel.app/auth/callback`; `https://quotr-2-0-git-ui-core-workflow-overhaul-quotr1.vercel.app/**` |
| Production `lxvnylhsbvudzzupxeqr` | `https://quotr-2-0-git-hardening-stage-2a-security-quotr1.vercel.app` | `https://quotr-2-0-5f7fdzeub-quotr1.vercel.app/`; `http://localhost:3000/auth/callback`; `https://quotr-2-0-git-hardening-stage-2a-security-quotr1.vercel.app/auth/callback` |

Paths the candidate builds:

| Flow | Path |
| --- | --- |
| Signup, login confirmation, and password recovery | `{origin}/auth/callback`, with `next=/reset-password` for recovery. App pages are `/signup`, `/login`, and `/forgot-password`. Those three are not post-auth return targets. |
| Invite | `{origin}/auth/callback?next=/invite/…`, then `/invite/{token}` and `/invite/continue` |
| Quote access | `/q/{token}` |
| Variation access | `/v/{token}` and `/v/{token}/response` |
| Price-request access | `/r/{token}` |

`app.get-quotr.com` is the temporary Vercel mapping: it and the workflow alias serve Preview deployment `dpl_CkhKCmWTfTNwhUn5bB8Pv6VXAxK9`. At this read it was not an Auth Site URL and it was not on either redirect allow-list. Section 12 records the later Preview allow-list addition. The intended Production mapping is the approved Production origin, with `NEXT_PUBLIC_SITE_URL` and the Production Auth Site URL and `/auth/callback` set to that origin. That origin is unset. The hardening alias remains the Site URL on both projects.

### 11.4 Missing Production environment names

`vercel env list production` on 19 October. Values were not recorded. `assertRequiredEnv()` throws during a production build only when `NEXT_PUBLIC_SUPABASE_URL` or `NEXT_PUBLIC_SUPABASE_ANON_KEY` is missing. Both are set, so they are not in this table.

| Name | Set on Production | When it is required | What uses it |
| --- | --- | --- | --- |
| `NEXT_PUBLIC_SITE_URL` | unset | Before live signup, invite, recovery, and quote email | `resolveConfiguredSiteOrigin` returns null on hosted production when this is missing, localhost, or an ephemeral `*.vercel.app` host. `getAuthCallbackOrigin` then uses `http://localhost:3000`. Invite and quote links use `getAuthSiteOrigin`. |
| `BILLING_ENVIRONMENT` | unset | Before live signup and payment | `resolveBillingEnvironment` throws on hosted production unless the value is `live`. The protected app reads it through `getOrgBillingState`. The database singleton is separate and is the insert in section 11.5. |
| `BILLING_ENFORCEMENT_MODE` | unset | Optional for launch | Unset resolves to `compatibility`. Unknown values throw. |
| `STRIPE_SECRET_KEY` | unset | Before live payment | `getStripe()` throws when a client is constructed without it. |
| `STRIPE_WEBHOOK_SECRET` | unset | Before live payment | Stripe webhook verification. |
| `STRIPE_PRICE_BUILDER_MONTHLY`, `STRIPE_PRICE_BUSINESS_BASE_MONTHLY`, `STRIPE_PRICE_BUSINESS_SEAT_MONTHLY` | unset | Before live payment | `readStripePriceConfig` returns null when all three are unset and throws when only some are set. |
| `STRIPE_TAX_RATE_NZ_GST` | unset | Before live payment | NZ GST on checkout. |
| `STRIPE_PORTAL_CONFIGURATION_ID` | unset | Before live payment | Billing portal. |
| `RESEND_API_KEY` | unset | Before live email | Quote, team, and price-request sends. |
| `RESEND_FROM_EMAIL`, `RESEND_TEAM_FROM_EMAIL`, `RESEND_QUOTE_FROM_EMAIL` | unset | Before live email | From addresses. Team and quote fall back to `RESEND_FROM_EMAIL` when their own name is unset. |
| `RESEND_WEBHOOK_SECRET` | unset | Before live email delivery events | `/api/webhooks/resend`. |
| `QUOTE_DELIVERY_PROVIDER` | unset | Optional for launch | Unset selects the Resend provider. `mock` selects the mock provider. |
| `LOOPS_API_KEY` | unset | Optional for launch | No reader in the candidate source. Migration 075 only stores `marketing_loops_sync_pending`. No cron. |
| `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` | unset | Optional for launch | Places autocomplete. Typed addresses still work when it is empty. |

### 11.5 Migration 048, the live row, 049, and 060–062

`048_billing_checkout_trial.sql` creates `billing_runtime_config` and `billing_runtime_environment()`. The file does not insert a row. Zero rows or more than one row make that function raise `BILLING:RUNTIME_ENV_UNCONFIGURED`. `bootstrap_missing_preview_internal_trials()` raises `BILLING:BOOTSTRAP_PREVIEW_TEST_ONLY` unless the singleton is `test`, so it cannot populate Production and must not be called there.

The live row is an operator insert after 048 has committed and before signup:

`insert into public.billing_runtime_config (id, billing_environment) values (true, 'live');`

`supabase db push` applies every pending file and has no stop-at flag. One push from 046 through 111 would pass 048 and continue into 049 with the singleton still empty. The rehearsal therefore stops after 048, runs that insert, confirms exactly one `live` row, and only then continues at 049. 049 does not read the singleton. The pause keeps signup from running while the database fail-closes, and it keeps the Preview trial bootstrap out of the chain.

060 replaces the append-only quote triggers with a `service_role` delete exception for organisations whose name matches `PLATFORM-02C %`, through `preview_fixture_org(uuid)`. 061 adds `preview_lifecycle_fixture_cleanup(uuid)` and deletes fixture projects before profiles. 062 restores `enforce_quote_events_append_only`, `enforce_quote_acceptance_evidence_append_only`, and `prevent_quote_item_snapshot_mutation`, then drops both cleanup functions.

060, 061, and 062 can run in one uninterrupted `db push`. Each file is its own committed migration, so they are not one database transaction. Stopping after 060 or 061 leaves the bypass open. The check that it is closed, run only after 062, is: `preview_lifecycle_fixture_cleanup(uuid)` and `preview_fixture_org(uuid)` are both absent, and `enforce_quote_events_append_only` raises `quote_events are append-only` with no fixture branch. Those functions are not on Production at schema 045, so that check waits until after 062.

## 12. Callback allow-list and isolated rehearsal — 19 October 2026

Production was not migrated and not deployed. `db:production:status` after the rehearsal still shows remote head 045 and an empty remote column from 046 through 111.

### 12.1 Public account entry on app.get-quotr.com

`/signup`, `/login`, `/forgot-password`, and `/reset-password` each returned HTTP 200. Signup is the server-action form “Create your Quotr account”. On this Preview host the candidate builds:

| Flow | Redirect URL |
| --- | --- |
| Signup | `https://app.get-quotr.com/auth/callback?next=/app/setup?mode=basics` |
| Password recovery | `https://app.get-quotr.com/auth/callback?next=/reset-password` |
| Invite signup submitted on this host | `https://app.get-quotr.com/auth/callback?next=/invite/{token}` |

Invite emails use `getAuthSiteOrigin()`, which on Preview is the hardening alias from `NEXT_PUBLIC_SITE_URL`. That link is `https://quotr-2-0-git-hardening-stage-2a-security-quotr1.vercel.app/invite/{token}`. It is an application link, not a Supabase redirect. The site URL was not changed.

GoTrue v2.197.0 accepts a `redirect_to` only when the host matches the Site URL or the allow-list glob matches. Otherwise it substitutes the Site URL. The missing `app.get-quotr.com` entry therefore blocked the callback: a verify request with an invalid token and no account creation returned 303 to `https://quotr-2-0-git-hardening-stage-2a-security-quotr1.vercel.app/` for the signup, recovery, and invite callback URLs. The same request with the hardening callback stayed on `/auth/callback`.

Preview allow-list before:

`http://localhost:3000/auth/callback`, `https://quotr-2-0-git-hardening-stage-2a-security-quotr1.vercel.app/auth/callback`, `https://quotr-2-0-git-ui-core-workflow-overhaul-quotr1.vercel.app/**`

Added only `https://app.get-quotr.com/auth/callback*`. The `*` matches the encoded `next` query. Site URL stayed `https://quotr-2-0-git-hardening-stage-2a-security-quotr1.vercel.app`.

After the same invalid-token verify:

| Redirect | HTTP | Host and path |
| --- | --- | --- |
| Signup, recovery, and invite callbacks | 303 | `app.get-quotr.com` `/auth/callback` |
| Hardening callback | 303 | `quotr-2-0-git-hardening-stage-2a-security-quotr1.vercel.app` `/auth/callback` |

Production Auth was read again after the patch. Site URL and allow-list were unchanged: Site URL is still the hardening alias, and the allow-list is still `https://quotr-2-0-5f7fdzeub-quotr1.vercel.app/`, `http://localhost:3000/auth/callback`, and the hardening `/auth/callback`. The Vercel domain assignment was not changed. Section 13 records the later workflow-branch link origin. The invite, Quote, and variation hosts in this section were the hosts before that change.

### 12.2 Isolated migration rehearsal

Production PITR is still absent. A read-only `supabase db dump` of `lxvnylhsbvudzzupxeqr` produced a public schema snapshot and a separate data snapshot. Each dump is consistent by itself. They were taken one after the other, not inside one database transaction. The restored counts matched the preflight, so the copy was fit to rehearse.

The data snapshot was filtered before restore. The local database received `public` rows, `auth.users`, `auth.identities`, and `storage.buckets`. Session, refresh-token, and other auth credential tables were dropped from the restore file, and the full data file was deleted. No row contents are recorded here.

The target was a new local Supabase database, project id `rehearsal-db`, started with an empty migration directory. Before any migration it had 8 organisations, 8 profiles, 8 owner profiles, 0 unbound profiles, 0 organisations with more than one owner, 9 auth users, and neither `billing_runtime_config` nor `organisation_memberships`. The ninth auth user has no profile, so 049 does not give that user a membership.

Migrations then ran in numeric order on that local database only. 048 does not call `bootstrap_missing_preview_internal_trials()`. After 048 the rehearsal inserted one `billing_runtime_config` row with `billing_environment = 'live'`. The check was 1 row, 1 live, 0 test. 060, 061, and 062 ran consecutively. None failed. No signup, payment, email, or webhook was sent.

| Version | ms | Version | ms | Version | ms |
| --- | ---: | --- | ---: | --- | ---: |
| 046 | 288 | 047 | 157 | 048 | 171 |
| live row | 158 | 049 | 474 | 050 | 140 |
| 051 | 144 | 052 | 252 | 053 | 236 |
| 054 | 146 | 056 | 133 | 057 | 150 |
| 058 | 350 | 059 | 139 | 060 | 166 |
| 061 | 150 | 062 | 149 | 063 | 491 |
| 064 | 153 | 065 | 133 | 066 | 145 |
| 067 | 260 | 068 | 205 | 069 | 237 |
| 070 | 151 | 071 | 343 | 072 | 268 |
| 073 | 237 | 074 | 166 | 075 | 174 |
| 076 | 146 | 077 | 132 | 078 | 282 |
| 079 | 151 | 080 | 146 | 081 | 182 |
| 082 | 168 | 083 | 241 | 084 | 137 |
| 085 | 216 | 086 | 146 | 087 | 358 |
| 088 | 356 | 089 | 140 | 090 | 603 |
| 091 | 165 | 092 | 151 | 093 | 226 |
| 094 | 186 | 095 | 148 | 096 | 164 |
| 097 | 179 | 098 | 156 | 099 | 149 |
| 100 | 151 | 101 | 303 | 102 | 206 |
| 103 | 205 | 104 | 194 | 105 | 136 |
| 106 | 139 | 107 | 146 | 108 | 185 |
| 109 | 134 | 110 | 139 | 111 | 127 |

66 steps, 0 failures, 13359 ms in total. 055 is absent and was skipped. Head on the isolated copy is 111: `pricing_documents.provisional_ceiling_confirmation` exists. Final checks: `preview_lifecycle_fixture_cleanup(uuid)` and `preview_fixture_org(uuid)` are absent, `enforce_quote_events_append_only` contains `quote_events are append-only` and does not mention `preview_fixture_org`, and there are 8 active owner memberships across 8 organisations.

The local database and the export files were removed after those checks. This logical copy is not a Production restore point. It excluded session and refresh-token data. Production remains **NO-GO**. Migration 046 was not applied to Production. Section 13 states the recovery option that is still required.

## 13. Preview link origin and Production recovery — 19 October 2026

Production migration 046 was not applied. Live billing was not configured. Production was not deployed. No domain was moved onto Production. No customer email was sent and no commercial document was issued.

### 13.1 Isolated rehearsal limits

The rehearsal in section 12 ran on a disposable local database, project id `rehearsal-db`. It is not a Production restore point.

- The schema dump and the data dump were two sequential read-only dumps, not one transaction.
- The restored data was `public` rows, `auth.users`, `auth.identities`, and `storage.buckets`. Session, refresh-token, and other auth credential tables were removed before restore. The full data file was deleted.
- The local database and the export directory were removed with `supabase stop --no-backup`. Nothing from that copy can be restored onto `lxvnylhsbvudzzupxeqr`.
- Production schema head was still 045 after the rehearsal.

### 13.2 Preview link origins

The workflow branch alias is a `*.vercel.app` host. The previous origin check treated every such host, other than the hardening alias, as a temporary deployment URL and fell back to the hardening host. `f42553a490c83089ff3d01eeabb1774725fffe60` accepts `https://quotr-2-0-git-ui-core-workflow-overhaul-quotr1.vercel.app` as a stable Preview origin. The hardening constant is unchanged.

`NEXT_PUBLIC_SITE_URL` for Preview on git branch `ui/core-workflow-overhaul` is `https://quotr-2-0-git-ui-core-workflow-overhaul-quotr1.vercel.app`. The shared Preview value was left as it was. Production environment variables were not changed.

Preview deployment `dpl_2XZXfurwfKVqAEo3eAeowrmQwvDd` is Ready, target preview, created 2026-10-19 16:17 +1300. Its git SHA is `f42553a490c83089ff3d01eeabb1774725fffe60` on `ui/core-workflow-overhaul`. Its unique URL is `https://quotr-2-0-4k6o7g1n2-quotr1.vercel.app`. The stable workflow alias resolves to that deployment. Signup HTML on the alias and on the unique URL is the same document, SHA-256 prefix `3b22be5880ed`.

`scripts/verify-application-email-01.ts` passed with `NEXT_PUBLIC_SITE_URL` set to that alias and `VERCEL_BRANCH_URL` set to the same host. Generated hosts:

| Link | Host and path |
| --- | --- |
| Invite | `quotr-2-0-git-ui-core-workflow-overhaul-quotr1.vercel.app` `/invite/{token}` |
| Quote | same host `/q/{token}` |
| Variation | same host `/v/{token}` and `/v/{token}/response` |
| RFQ | same host `/r/{token}`, from `VERCEL_BRANCH_URL` |

A signup started on `https://app.get-quotr.com` keeps that request host for the Auth callback: `https://app.get-quotr.com/auth/callback?next=/app/setup?mode=basics`. A Preview Auth verify request with an invalid token, type `signup`, and that `redirect_to` returned HTTP 303 to `app.get-quotr.com` `/auth/callback`. No account was created.

`app.get-quotr.com` still resolves to `dpl_CkhKCmWTfTNwhUn5bB8Pv6VXAxK9` (`https://quotr-2-0-4etkibj0g-quotr1.vercel.app`, SHA `edaac4833564cfcf600381e1d1ad1f824b8e7a86`). Signup HTML on the domain and on that unique URL is the same document, SHA-256 prefix `b6f633f99577`. The hardening alias still resolves to `dpl_7HV1zMhfbcpNcSp3KeQphXraFTN2`.

### 13.3 Recovery option still required

Read again on 19 October 2026 for `lxvnylhsbvudzzupxeqr`. Nothing was enabled and no restore was run.

| Current setup | Value |
| --- | --- |
| Organization `quotr` (`rkstzmnnkcorevoazhny`) plan | `free` |
| `pitr_enabled` | false |
| Selected add-ons | empty |
| `backups` | empty list |
| `physical_backup_data` | empty, no earliest or latest timestamp |
| `walg_enabled` | true, with no base-backup timestamp |

Free projects do not receive platform daily backups. WAL-G without a base-backup timestamp is not a restore point. `supabase backups restore` has no timestamp to target.

The option still required before Production migration is an owner-approved paid backup. The smallest platform option is the Pro plan at $25 per month. Pro includes 7 days of daily backups. The first backup is the next daily backup after the plan change, so the upgrade itself is not yet a restore point. Verify it with `GET /v1/projects/lxvnylhsbvudzzupxeqr/database/backups`: the `backups` list must contain a backup and a timestamp before 046. Do not call the restore endpoint.

PITR is the finer option and is also unpaid until the owner approves it. It requires Pro, the Small compute add-on, and one retention tier. This project's add-on catalog prices Small at $0.0206 per hour, about $15 per month. PITR prices are $100 per month for 7 days (`pitr_7`, $0.137 per hour), $200 per month for 14 days (`pitr_14`, $0.274 per hour), and $400 per month for 28 days (`pitr_28`, $0.55 per hour). PITR is outside the spend cap. Enabling it stops the separate daily backups. It can restore only to a time after it is enabled. It is usable when `pitr_enabled` is true and `physical_backup_data` has both an earliest and a latest recovery timestamp. After that base backup, WAL files are archived about every two minutes, so the recovery point objective is two minutes. A restore takes the project offline for a duration that depends on database size and WAL volume. That restore was not run.

### 13.4 Remaining Production environment and Auth work

Production Auth was read again and left unchanged. Site URL is `https://quotr-2-0-git-hardening-stage-2a-security-quotr1.vercel.app`. The allow-list is `https://quotr-2-0-5f7fdzeub-quotr1.vercel.app/`, `http://localhost:3000/auth/callback`, and `https://quotr-2-0-git-hardening-stage-2a-security-quotr1.vercel.app/auth/callback`.

Before a Production deployment, set the Production Auth Site URL and `/auth/callback` allow-list to the approved Production origin. The names in section 11.4 are still unset on Production: `NEXT_PUBLIC_SITE_URL`, `BILLING_ENVIRONMENT`, the Stripe secret, webhook, three prices, NZ GST rate, and portal configuration, and the Resend key, from addresses, and webhook secret. `BILLING_ENVIRONMENT` must be `live`. `QUOTE_DELIVERY_PROVIDER`, `BILLING_ENFORCEMENT_MODE`, `LOOPS_API_KEY`, and `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` stay optional as recorded in that section.

Production remains **NO-GO**.

## 14. Aligned Preview candidate — 19 October 2026

`f42553a490c83089ff3d01eeabb1774725fffe60` was pushed to `ui/core-workflow-overhaul`. The git Preview deployment is Ready.

| Fact | Value |
| --- | --- |
| Application SHA | `f42553a490c83089ff3d01eeabb1774725fffe60` |
| Deployment | `dpl_DXpwuYynyDVRDR6Btoza98QAy1WY` |
| Unique URL | `https://quotr-2-0-5ozcfhrgf-quotr1.vercel.app` |
| Created | 2026-10-19 16:40 +1300, Ready, target preview |
| Workflow alias | `https://quotr-2-0-git-ui-core-workflow-overhaul-quotr1.vercel.app` → that deployment |
| `app.get-quotr.com` | that same deployment |
| Signup HTML | SHA-256 prefix `bd1168ebce33` on the unique URL, the workflow alias, and `app.get-quotr.com` |
| Hardening alias | unchanged: `dpl_7HV1zMhfbcpNcSp3KeQphXraFTN2` |

Immediately after the push, `app.get-quotr.com` already resolved to `dpl_DXpwuYynyDVRDR6Btoza98QAy1WY`. The workflow alias still resolved to the earlier upload `dpl_2XZXfurwfKVqAEo3eAeowrmQwvDd` (`https://quotr-2-0-4k6o7g1n2-quotr1.vercel.app`, signup prefix `3b22be5880ed`). That earlier upload is the same SHA. It is a different deployment. The workflow alias was then assigned to `dpl_DXpwuYynyDVRDR6Btoza98QAy1WY`. After that assignment, both hosts resolve to the git deployment. Neither host remains on `dpl_CkhKCmWTfTNwhUn5bB8Pv6VXAxK9` (`edaac4833564cfcf600381e1d1ad1f824b8e7a86`, signup prefix `b6f633f99577`).

`npx tsc --noEmit` completed with no errors. `scripts/verify-application-email-01.ts` passed. Generated hosts on that check:

| Link | Host and path |
| --- | --- |
| Invite | `quotr-2-0-git-ui-core-workflow-overhaul-quotr1.vercel.app` `/invite/{token}` |
| Quote | same host `/q/{token}` |
| Variation | same host `/v/{token}` and `/v/{token}/response` |
| RFQ | same host `/r/{token}` |

A signup started on `https://app.get-quotr.com` keeps `https://app.get-quotr.com/auth/callback?next=/app/setup?mode=basics`. The invalid-token signup verify returned HTTP 303 to `app.get-quotr.com` `/auth/callback`. No account was created. No customer email was sent and no commercial document was issued.

Production was not migrated, deployed, or changed. Production Auth was not changed. The hardening alias was not moved. Production remains **NO-GO**.

## 15. Production backup, configuration, and staged migrations — 19 October 2026

Candidate `f42553a490c83089ff3d01eeabb1774725fffe60`. No migration was applied. PITR was not enabled. Billing was not changed. Production Auth was not changed. No Production deployment was created. `app.get-quotr.com` stays on Preview `dpl_DXpwuYynyDVRDR6Btoza98QAy1WY` until the controlled domain cutover. The hardening alias stays on `dpl_7HV1zMhfbcpNcSp3KeQphXraFTN2`.

### 15.1 Plan and backups

Organisation `quotr` (`rkstzmnnkcorevoazhny`) now reports plan `pro`. Project `lxvnylhsbvudzzupxeqr` still has `pitr_enabled` false and `physical_backup_data` empty. There is no PITR restore window.

`GET /v1/projects/lxvnylhsbvudzzupxeqr/database/backups` returned HTTP 200 and seven backups. Each object has `id`, `inserted_at`, `is_physical_backup: true`, and `status: COMPLETED`. That list is the daily restore set the dashboard uses. A restore was not run. Schema head is still `045` / `commercial_close`.

| Order | `inserted_at` (UTC) |
| --- | --- |
| First | `2026-10-12T17:45:37.819Z` |
| | `2026-10-12T23:12:28.442Z` |
| | `2026-10-14T19:43:14.752Z` |
| | `2026-10-15T17:45:21.182Z` |
| | `2026-10-16T17:44:49.848Z` |
| | `2026-10-17T17:46:02.071Z` |
| Latest | `2026-10-18T17:45:14.209Z` |

The latest completed backup is the current restore point: `2026-10-18T17:45:14.209Z` (19 October 2026, 06:45 +1300). The plan change alone is not a migration go-ahead. Live configuration in this section is still unset.

### 15.2 Storage objects the database backup does not restore

Read-only counts. No object was downloaded.

| Bucket | Public | Objects | Bytes |
| --- | --- | ---: | ---: |
| `organisation-branding` | yes | 1 | 100407 |

That one branding object needs its own copy before the migration window. A database restore restores the Storage metadata row and does not restore the uploaded bytes. Migrations `071`, `078`, `088`, and `090` create `variation-attachments`, `project-documents`, `subcontractor-documents`, and `rfq-response-files`. Those buckets are absent at head 045, so they have no files to copy.

### 15.3 Where each value is entered

The approved Production origin is still unset. It must be an `https` origin with no path. It must not be `app.get-quotr.com` while that host serves Preview. It must not be the hardening alias. On a Production deployment, `resolveConfiguredSiteOrigin` returns null for localhost and for a unique `*.vercel.app` host.

Enter Vercel values on project `quotr-2-0`, environment **Production** only. Do not copy Preview secrets. Do not print the values back into this document.

#### Build

`assertRequiredEnv()` fails a production build only when these two are missing. Both are already set on Production, and the URL’s project ref is `lxvnylhsbvudzzupxeqr`:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

`SUPABASE_SERVICE_ROLE_KEY` is already set. It is not required for the build. Signup provisioning uses an authenticated RPC.

#### Signup, invites, and recovery

| Name | Purpose | Where the owner enters it |
| --- | --- | --- |
| `NEXT_PUBLIC_SITE_URL` | Production link origin for invite, Quote, and variation mail, and the fallback Auth origin. Unset, localhost, or a unique `*.vercel.app` host makes `resolveConfiguredSiteOrigin` return null. | Vercel Production |
| Auth Site URL | GoTrue substitutes this host when `redirect_to` is not allowed. Set it to the approved origin. | Supabase Dashboard → Authentication → URL configuration, project `lxvnylhsbvudzzupxeqr` |
| Redirect allow-list | Must include `https://<approved-origin>/auth/callback*` so signup (`next=/app/setup?mode=basics`), recovery (`next=/reset-password`), and invite (`next=/invite/{token}`) stay on that host. | Same Auth URL configuration |

Current Production Auth was read and left unchanged: Site URL `https://quotr-2-0-git-hardening-stage-2a-security-quotr1.vercel.app`; allow-list `https://quotr-2-0-5f7fdzeub-quotr1.vercel.app/`, `http://localhost:3000/auth/callback`, and the hardening `/auth/callback`. Replace those entries with the approved origin when that origin is chosen. Do not point them at `app.get-quotr.com`.

#### Payment

| Name | Purpose | Where the owner enters it |
| --- | --- | --- |
| `BILLING_ENVIRONMENT=live` | Hosted production throws unless this is exactly `live`. | Vercel Production |
| `billing_runtime_config` singleton | Database authority. One row, `id true`, `billing_environment 'live'`. Insert it only after 048 commits and before 049. Do not call `bootstrap_missing_preview_internal_trials()`. | SQL editor for `lxvnylhsbvudzzupxeqr`, section 15.5 |
| `STRIPE_SECRET_KEY` | Live-mode secret. `getStripe()` throws when a client is constructed without it. | Vercel Production. Create it in Stripe live mode. |
| `STRIPE_PRICE_BUILDER_MONTHLY`, `STRIPE_PRICE_BUSINESS_BASE_MONTHLY`, `STRIPE_PRICE_BUSINESS_SEAT_MONTHLY` | Checkout prices. All three together, or none. A partial set throws. | Vercel Production. Live-mode price ids. |
| `STRIPE_TAX_RATE_NZ_GST` | NZ GST tax rate on checkout. | Vercel Production. Live-mode tax rate id. |
| `STRIPE_PORTAL_CONFIGURATION_ID` | Billing portal configuration. | Vercel Production. Live-mode portal configuration. |
| `STRIPE_WEBHOOK_SECRET` | Verifies `POST /api/webhooks/stripe`. | Vercel Production. The Stripe live webhook endpoint is `https://<approved-origin>/api/webhooks/stripe`. |

Checkout return URLs use `NEXT_PUBLIC_SITE_URL` under `/app/settings/billing`.

#### Email

| Name | Purpose | Where the owner enters it |
| --- | --- | --- |
| `RESEND_API_KEY` | Sends Quote, team, and price-request mail. | Vercel Production |
| `RESEND_TEAM_FROM_EMAIL` | Team invite From. Must not be the Quote mailbox `quotes@get-quotr.com`. | Vercel Production. The address must be verified in Resend. |
| `RESEND_QUOTE_FROM_EMAIL` | Quote From. The Quote channel mailbox is `quotes@get-quotr.com`. | Vercel Production. Verified in Resend. |
| `RESEND_FROM_EMAIL` | Fallback when a channel address is unset. | Vercel Production |
| `RESEND_WEBHOOK_SECRET` | Verifies the Svix signature on `POST /api/webhooks/resend`. | Vercel Production. The Resend webhook endpoint is `https://<approved-origin>/api/webhooks/resend`. |
| `QUOTE_DELIVERY_PROVIDER` | Optional. Unset selects Resend. `mock` selects the mock provider. | Leave unset for live sending. |

`BILLING_ENFORCEMENT_MODE`, `LOOPS_API_KEY`, and `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` stay optional, as in section 11.4.

### 15.4 Why `db push` cannot stop at 048

`npm run db:production:push` runs `supabase db push --project-ref lxvnylhsbvudzzupxeqr --skip-vault --yes` against the full `supabase/migrations` directory. That command has no stop version. It would apply 046 through 111, including the open 060–062 window, and it would pass 048 with `billing_runtime_config` still empty. Do not run it for these stages.

`supabase db query --project-ref` without `--linked` is rejected. Do not link the CLI to Production.

### 15.5 Stages

Run these only after the owner configuration in 15.3 is ready to verify, and after a fresh backup read still shows a `COMPLETED` backup. Re-read the latest `inserted_at` immediately before stage A and treat that timestamp as the restore point. None of these commands were run.

Each stage uses a separate checkout of `f42553a490c83089ff3d01eeabb1774725fffe60`. Delete every migration file whose numeric prefix is above the stage end. Keep every file already applied through `045`, so remote history still matches the directory. `037` and `055` are already absent.

Stage A, stop at 048. In that checkout:

```powershell
Get-ChildItem supabase\migrations -File |
  Where-Object { [int]$_.Name.Substring(0,3) -gt 48 } |
  Remove-Item
npx supabase db push --project-ref lxvnylhsbvudzzupxeqr --skip-vault --dry-run
```

The dry-run must list only `046_billing_foundation.sql`, `047_past_due_authority.sql`, and `048_billing_checkout_trial.sql`. If any other version appears, stop and do not push. When it matches:

```powershell
npx supabase db push --project-ref lxvnylhsbvudzzupxeqr --skip-vault --yes
```

Then, in the Supabase SQL editor for `lxvnylhsbvudzzupxeqr`, confirm the head and the empty singleton:

```sql
select version, name
from supabase_migrations.schema_migrations
order by version desc
limit 1;

select count(*) as rows
from public.billing_runtime_config;
```

Stop unless the version is `048` and the count is 0.

Insert and verify the live row. Do not call `bootstrap_missing_preview_internal_trials()`.

```sql
insert into public.billing_runtime_config (id, billing_environment)
values (true, 'live');

select count(*) as rows,
       count(*) filter (where billing_environment = 'live') as live_rows,
       count(*) filter (where billing_environment = 'test') as test_rows
from public.billing_runtime_config;
```

Stop unless the result is 1 row, 1 live, 0 test.

Stage B, 049–059. Use a new checkout and remove files above `059`. Dry-run must list only `049`, `050`, `051`, `052`, `053`, `054`, `056`, `057`, `058`, and `059`. `055` stays absent. Then run the same `db push` with `--yes`.

Stage C, 060–062. Use a new checkout and remove files above `062`. Dry-run must list only `060_preview_lifecycle_fixture_cleanup.sql`, `061_preview_lifecycle_fixture_cleanup_order.sql`, and `062_remove_preview_lifecycle_cleanup.sql`. Run that one push without a pause. Immediately afterwards:

```sql
select to_regprocedure('public.preview_lifecycle_fixture_cleanup(uuid)') is null
   and to_regprocedure('public.preview_fixture_org(uuid)') is null as bypass_closed;

select pg_get_functiondef('public.enforce_quote_events_append_only()'::regprocedure)
         like '%quote_events are append-only%'
   and pg_get_functiondef('public.enforce_quote_events_append_only()'::regprocedure)
         not like '%preview_fixture_org%' as append_only;
```

Stop unless both results are true. Do not start 063 while either cleanup function exists.

Stage D, 063–111. From the full checkout, dry-run must start at `063` and end at `111_deck_concrete_calibration_benchmark.sql`, with `055` absent. If `046` or `060` appears, stop. Then `db push` with `--yes`.

Final checks, still in the SQL editor:

```sql
select version, name
from supabase_migrations.schema_migrations
order by version desc
limit 1;

select
  (select count(*) from public.organisations) as organisations,
  (select count(*) from public.organisation_memberships where status = 'active' and role = 'owner') as active_owners,
  (select count(*) from (
     select org_id
     from public.organisation_memberships
     where status = 'active' and role = 'owner'
     group by org_id
     having count(*) > 1
  ) extra) as multi_owner;

select id, public
from storage.buckets
order by id;

select c.relrowsecurity as billing_rls
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relname = 'billing_runtime_config';

select count(*) as billing_policies
from pg_policies
where schemaname = 'public' and tablename = 'billing_runtime_config';
```

Pass only when the head is `111`, `active_owners` equals `organisations`, `multi_owner` is 0, `billing_rls` is true, and `billing_policies` is 0. The bucket list must include `organisation-branding`, `variation-attachments`, `project-documents`, `subcontractor-documents`, and `rfq-response-files`. `pricing_documents.provisional_ceiling_confirmation` must exist. Repeat the stage C bypass check. Confirm the Vercel Production names in 15.3 are present without printing their values.

### 15.6 Stop conditions

Stop before stage A when the backup list has no `COMPLETED` timestamp, or when the approved origin and the Vercel, Auth, Stripe, and Resend values in 15.3 are still unset. Stop when a dry-run lists a version outside its stage. Stop after 048 when the singleton is not one live row. Stop inside 060–062 when 062 has not been applied. Stop before 063 when the bypass check fails. Stop before a Production deployment when the head is not 111 or `NEXT_PUBLIC_SITE_URL` is unset.

There is no down migration. Database rollback is a restore of the latest `COMPLETED` backup from 15.1, followed by the separate branding-object copy. Do not run that restore in this preparation. Production remains **NO-GO**.
