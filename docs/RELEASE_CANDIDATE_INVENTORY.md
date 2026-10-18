# Release-candidate inventory

**Updated:** 19 October 2026, after a signed-in workflow Preview acceptance pass. The 9 October observations below remain the earlier inventory. Where they disagree with this update, this update is the current record.  
**Application candidate:** `e85029eac87bb16d6343213975e13660578a344c` on `ui/core-workflow-overhaul`.  
**This document is not the application candidate.** It lives on `docs/release-candidate-notes` and is not part of the Preview deployment.  
**Not frozen.** Production was not migrated or deployed. The hardening alias was not moved.

**Go / no-go for the proper domain: NO-GO.**

## Current candidate — 19 October 2026

| Fact | Value |
| --- | --- |
| Application branch | `ui/core-workflow-overhaul` |
| Application SHA | `e85029eac87bb16d6343213975e13660578a344c` |
| Commit | 2026-10-18 19:49:19 +1300 — Speed up Create Quote by sharing the signed-in organisation and overlapping independent reads. |
| Working tree | clean at that SHA. No further Pricing redirect or project-loading change. |
| Workflow Preview deployment | `dpl_5Td3Gm35VfzjsD2L9zLeaaMLczts` |
| Deployment URL | `https://quotr-2-0-1qhjayb7m-quotr1.vercel.app` |
| Created | 2026-10-18 19:49:40 +1300, Ready, target preview |
| `app.get-quotr.com` | that same deployment |
| Workflow alias | `https://quotr-2-0-git-ui-core-workflow-overhaul-quotr1.vercel.app` → that same deployment |
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

The pass is closed at `e85029eac87bb16d6343213975e13660578a344c`. No change was kept. Do not make another Pricing redirect or project-loading optimisation without a new, reproducible blocking cause.

The action response is a 303 whose body is the Pricing page. The browser does not make a second GET of that page. The usable summary is the commercial summary with a dollar amount. On the signed-off Preview, four journeys gave headers-to-usable about 2.39s, 2.53s, 2.50s, and 2.92s (median about 2.52s) and click-to-usable about 9.14s, 10.13s, 9.18s, and 9.15s (median about 9.17s). An instrumented page render was 2210ms: auth 719ms, then the slowest parallel loader (tabs 1491ms). A loader experiment on a throwaway deployment cut that render to about 1802ms, but four later journeys stayed at response-to-money 2426, 2359, 2871, and 2568 (median about 2.50s) and click-to-usable 9125, 9150, 9674, and 9139 (median about 9.14s). The experiment was reverted. Preview remains `dpl_5Td3Gm35VfzjsD2L9zLeaaMLczts`.

### Owner decisions still open

- Whether the bathroom details path must ask for GIB versus fibre cement before an estimate, and whether an analysed floor rebuild should become a second Flooring area that prices the same sheet and a second removal.
- Whether an unspecified ceiling stored as a nested portion should stay on the flat provisional package instead of requiring a named lining.
- Production remains NO-GO: schema 045, no Ready Production deployment of this SHA, and the environment gaps recorded in section 6. Do not deploy Production from this update.

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

The pair recorded on 9 October is below. The pair tested on 19 October is in the current-candidate section: `e85029eac87bb16d6343213975e13660578a344c`, deployment `dpl_5Td3Gm35VfzjsD2L9zLeaaMLczts`, Preview schema **111**.

The 9 October pair was:

- code `1cfa7d24a437f8955143d100083d6e93eaab115e`
- Preview deployment `dpl_9fjHt4pATsN6ec3se272NynYChxL`
- Preview database `quotr_preview` / `shhpjsoldmqtkdbgrbtm`, schema history through **107**

That commit contains `supabase/migrations/107_rfq_price_notification.sql`, and Preview’s migration history includes 107. This inventory does not treat any other mixture as the candidate.

These mixtures were **not** jointly tested as the candidate:

- hardening code `58d7681` with Preview schema 107 (same database, older application)
- candidate code with Production schema 045
- a local Docker database (Docker was not running)

`NEXT_PUBLIC_SITE_URL` on Preview is the hardening alias. Quote and invite links use that origin (`resolveConfiguredSiteOrigin`). Any *.vercel.app origin other than the hardening alias is treated as ephemeral, including the workflow alias. RFQ public links use `VERCEL_BRANCH_URL` instead, so they stay on the branch that sent them. Signup and recovery mail use the request host, then the branch host, then the deployment host, and do not substitute the hardening alias. A quote or invitation opened from the workflow app can still land on `58d7681` while reading the schema-107 database. That is a different pair from the candidate.

## 2. Schema heads

| Place | History | Head |
| --- | --- | --- |
| Repository files on the 19 October application SHA | 001–036, 038–054, 056–111 | file head **111** |
| Local applied database | **unavailable** | Docker daemon is not running (`npipe:////./pipe/dockerDesktopLinuxEngine` missing). `supabase status` could not inspect a local database. |
| Local `.env.local` target | hosted Preview | project ref `shhpjsoldmqtkdbgrbtm` (not Production) |
| Preview `shhpjsoldmqtkdbgrbtm` | same version list as the application files, each local version present remotely, read 19 October 2026 | **111** |
| Production `lxvnylhsbvudzzupxeqr` | 001–036, 038–045 present; 046–111 absent, read 19 October 2026 | **045** |

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

Do not delete these tests. Retarget the head or selector, then re-run. Lexicographic last file on this tree is `107_rfq_price_notification.sql`.

| Test | Assertion | Current result | Proposed resolution |
| --- | --- | --- | --- |
| `verify-quote-transaction-01.ts` | `041 quote transaction exists; later migrations follow additively` requires last file `080_project_document_delete.sql` | FAIL | Keep the “041–054 remain” checks. Point the head at 107. |
| `verify-quote-delivery-01.ts` | `042 delivery architecture remains; later billing/membership migrations are additive` also requires last file 080 | FAIL | Same retarget. |
| `verify-quote-acceptance-01.ts` | `044 acceptance remains; later billing/membership migrations follow additively` also requires last file 080 | FAIL | Same retarget. |
| `verify-billing-2.ts` | `047 past_due authority exists locally; 053 role RLS remains; 063 remains and 071 is latest` | FAIL | Keep 047 and 063 present. Point the head at 107. |
| `verify-billing-3.ts` | `053 role RLS is latest numbered local migration; 048 trial remains` | FAIL | Keep 048 present. Point the head at 107. |
| `verify-billing-4.ts` | `049 memberships remain and 053 role RLS is latest numbered local migration` | FAIL | Keep 049–053 present. Point the head at 107. |
| `verify-beta-launch.ts` | `latest migration is 057 repeated work area acceptance` | FAIL | Keep “no 037” and “046–053 present”, which passed. Point the head at 107. |
| `verify-security-053.ts` | `latest migration is 056 Bathroom DNA catalogue seed` | FAIL | Keep “053 remains”. Point the head at 107. |
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
| `NEXT_PUBLIC_SITE_URL` | hardening alias | inherited hardening alias | inherited hardening alias | **unset** |
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
| Vercel domains on this project | `get-quotr.com` verified, no git branch, no redirect. `app.get-quotr.com` verified and redirecting to `get-quotr.com`. `quotr-2-0.vercel.app` verified. | Which Cloudflare origin actually serves `get-quotr.com`. The HTML is not this app. |
| Public DNS | `get-quotr.com` and `www.get-quotr.com` are Cloudflare A/AAAA. MX is Google. SPF and DMARC exist as recorded above. | `app.get-quotr.com` and `beta.get-quotr.com` do not resolve. Nested SPF TXT did not resolve here. Resend DKIM was not checked. |
| Production app | `quotr-2-0.vercel.app` is 404. The only Production deployment is Error. | — |
| Supabase Auth Site URL and redirect allow-list, on both `shhpjsoldmqtkdbgrbtm` and `lxvnylhsbvudzzupxeqr` | CLI could list migrations, so the account can reach the databases. | **Unverified.** Auth URL configuration was not read. Do not copy the hardening Site URL onto Production, and do not assume the workflow callback is allow-listed. |
| Mail URLs | Code: auth callbacks use `/auth/callback`; quotes use `/q/[token]`; variations use `/v/[token]`; RFQs use `/r/[token]`. | Resend and Supabase SMTP dashboard endpoints were not opened. |
| Webhook routes in this app | `/api/webhooks/stripe` and `/api/webhooks/resend` exist. | Whether Stripe or Resend is pointed at the workflow host, the hardening host, or Production. Production has no webhook secrets. |
| Signup links | Marketing page links are `/` and `/#sign-in` only. | No `get-quotr.com` link to this app’s `/signup` was found. |

### Production Error deployment

Build log for `dpl_EVCFu6wXBDvAvSB1oNcmsEzZe5Ji` on 2026-08-05:

`Missing required environment variables: NEXT_PUBLIC_SUPABASE_URL, …`  
`Failed to collect page data for /`  
`npm run build` exited 1.

`assertRequiredEnv()` throws in production builds when `NEXT_PUBLIC_SUPABASE_URL` or `NEXT_PUBLIC_SUPABASE_ANON_KEY` is missing. Both names are **present now**, and the URL ref is the Production project. The Error deployment was never replaced. Current settings would get past that particular build check. They would not make a safe release: site URL, billing, Stripe, Resend, and Google are still unset, and the database is still at 045. Nothing was deployed to confirm a newer build.

## 7. Ordered blockers

| # | Blocker | Owner | Evidence that closes it |
| --- | --- | --- | --- |
| 1 | No Ready Production deployment. The only one is Error on `383133d`, an old `main` SHA, not the candidate. `quotr-2-0.vercel.app` is 404. | Owner | A later Ready Production deployment of the approved SHA, after the rows below are closed. Do not deploy from this inventory. |
| 2 | Production schema is 045. The candidate database is 111. Delta is 046–111 except absent 037 and 055. | Owner | Backup or PITR confirmation, then a rehearsed apply in the order in section 2. 048 live singleton inserted in the same window. 060–062 not left half-applied. Preview bootstrap function not called. |
| 3 | Production env has no site URL, Stripe, billing mode, Resend, or Google key. | Owner | Names present on Production only, live Stripe mode confirmed in the dashboard, site URL equal to the approved domain. Preview values must not be copied. |
| 4 | `get-quotr.com` does not serve this app and does not link to `/signup`. `app.get-quotr.com` does not resolve even though Vercel lists a redirect. | Owner | Public DNS and a page load of the approved origin showing this app’s signup, plus a marketing link to that URL. |
| 5 | Supabase Auth Site URL and redirect allow-list are unverified on both projects. | Owner | Dashboard read of both projects: Site URL and redirects for the approved origin, with the workflow callback kept only for Preview. |
| 6 | Quote and invite links on Preview still resolve to the hardening alias (`58d7681`) while the candidate is `1cfa7d2` on schema 107. | Owner | A decision, then one workflow-alias send whose public link stays on that deployment. Do not move the hardening alias as part of this inventory. |
| 7 | Preview Stripe secret mode was not readable. | Owner | Stripe dashboard shows the Preview secret is test mode. |
| 8 | Resend alignment with Google MX / SPF is unverified. | Owner | Resend domain status for `get-quotr.com`, plus one delivered invite and one delivered quote. |
| 9 | Google key restrictions are unverified, and Production has no key. | Owner | Referrer list includes the approved origin before a Production key is used. |
| 10 | Rates, productivity values, and Work Area commercial maturity await owner review. | Owner | Written accept or deferral. Not a code change in this task. |
| 11 | Release scripts are red on stale heads and one UI selector. | Engineering, after this inventory | Retarget as in section 4 and re-run. Do not delete the tests. |
| 12 | Local tenant-isolation suite did not run. | Engineering | Docker up, then `verify-batch-2a5-tenant-isolation.ts`. Optional later: security-053 and security-082 `--live` on Preview only. |

## 8. Rehearsal and rollback

Do not run this section now.

1. Confirm a Production backup or PITR point. That confirmation is not in this repo.
2. Read Production and Preview Auth URLs. Set the approved Production origin only when it exists.
3. Set Production environment names from section 6. `BILLING_ENVIRONMENT=live`. Stripe live keys and live prices only. Resend production sender only. Google key restricted to the approved origin.
4. Read-only `npm run db:production:status`. Expect head 045. If it is not 045, stop.
5. Count owner-role profiles per organisation. More than one owner blocks 049.
6. Apply 046 through 107 in the order in section 2, one window. Immediately after 048, insert the live billing singleton. Do not call `bootstrap_missing_preview_internal_trials()`. Apply 060, 061, and 062 without leaving the database on 060 or 061.
7. Deploy Production only from `e85029eac87bb16d6343213975e13660578a344c` (or a later SHA that has been paired again with schema 111). Do not deploy `58d7681` onto schema 111. Do not deploy the candidate onto schema 045. Do not deploy Production as part of the 19 October acceptance update.
8. Smoke the approved origin: signup, phone duplicate, Viewer denial, one quote link host, one variation link host.
9. Rollback for the database is restore of the backup taken before 046. There is no down-migration. 049 memberships, 052 rate provenance, phone claims, storage objects, and issued quote or variation rows are not safely reversible. There is no previous Ready Production deployment to alias back to. `quotr-2-0.vercel.app` is already 404. Do not alias Production at the Error deployment and call that a rollback. Leave the hardening alias on `58d7681`.

## 9. Go / no-go for the proper domain

| Gate | Result |
| --- | --- |
| Candidate SHA is the Ready workflow deployment | yes — `e85029eac87bb16d6343213975e13660578a344c` on `dpl_5Td3Gm35VfzjsD2L9zLeaaMLczts` |
| That SHA is paired with Preview schema 111 | yes |
| Working tree was clean and matched origin at inventory start | yes |
| Candidate labelled frozen | **no** |
| Production deployment Ready on that SHA | **no** |
| Production schema 111 | **no** — still 045 |
| Production site URL, Stripe live, billing live, Resend, Google | **no** |
| Auth redirects read and matching the approved origin | **no** |
| Marketing signup link to the app | **no** |
| Quote links proven on the candidate host rather than the hardening alias | **no** |
| Owner review of rates and Work Area maturity | **no** |
| **Decision** | **NO-GO** |

## 10. Smallest next action

Leave Production and the hardening alias untouched. The next action is an owner read of blockers 1–6, starting with the fact that the recorded Production failure is a missing-Supabase-env build from 5 August 2026 and that those two variables exist now, while schema 045, the empty Production site URL, and the absent Ready deployment still block a release.
