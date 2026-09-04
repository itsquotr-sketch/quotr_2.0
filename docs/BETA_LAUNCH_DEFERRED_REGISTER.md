# Beta launch — master deferred-item register

**Programme:** BETA LAUNCH CLOSE  
**Classification date:** 2026-09-04  
**Head at classification:** `a4ca7f644fdf479d8963c17842e0c1ed7eff42ea`  
**Preview:** `shhpjsoldmqtkdbgrbtm` (migration 052)  
**Production:** `lxvnylhsbvudzzupxeqr` (migration 045) — do not deploy or migrate until owner-approved release.

Classes: **BLOCKER** · **FIX BEFORE BETA** · **SAFE BETA DEFER** · **COSMETIC** · **FUTURE**.

Nothing in this register is a schema change. Migration 053 is a **proposal only**.

---

| ID | Item | Class | Notes |
| --- | --- | --- | --- |
| A | `organisation_settings` RLS allows org-member / Estimator UPDATE | **FIX BEFORE BETA** (Business Estimator seats). **BLOCKER for Production.** | Confirmed PostgREST bypass: Estimator JWT + anon key can UPDATE company settings (margin, GST, timezone, logo URL). Viewer blocked by 049 `auth_can_mutate_work()`. Same class: `rates` DML. Viewer can still write `work_areas` / `project_facts` / `organisation_work_areas` (not in 049 restrictive list). App layer is stricter. See `docs/runbooks/MIGRATION_053_ROLE_RLS_PROPOSAL.md`. Do **not** create/apply 053 until owner approval. Owner-only Builder beta does not hit this path. |
| B | DNA catalogue policy-name cosmetic discrepancy | **COSMETIC** | `052` catalogue SELECT is `"Authenticated users can select productivity calibration catalogue"` vs house style `"Users can select … in their organisation"`. Not a security defect (`USING (true)` is correct for a global catalogue). |
| C | Estimator project-level margin intentionally allowed | **SAFE BETA DEFER** | Not a defect. Estimator may set `estimates.target_margin_percent` / project Pricing. Must **not** edit org default margin or company `$/h` rates (app-enforced; DB still Estimator-writable until 053). |
| D | Pricing “confirm default margin” banner | **FIX BEFORE BETA** | Closed in this programme: after first-run, Pricing no longer nags 20% as if unconfirmed. Setup recommendation remains. |
| E | Quote expiry calendar still Auckland-based | **SAFE BETA DEFER** | `valid_until` is an inclusive calendar date in `Pacific/Auckland` (SQL + `isQuoteExpired`). Wiring org timezone would **change quote validity**. NZ-controlled beta is consistent. Display timestamps already use org TZ where set. |
| F | No realtime draft-quote lock | **SAFE BETA DEFER** | `createQuoteFromPricing` is check-then-act; `insert_draft_quote_v1` has no unique open-draft constraint. Duplicate **drafts** possible if two Estimators click at once. Client-facing state is send/revision locked. Unique partial index would be a migration — not in this programme. Owner-only beta risk is negligible. |
| G | Own-price cent allocation vs typed amount | **SAFE BETA DEFER** | Last line absorbs remainder; successful allocate sum **equals** typed target (max observed residual **$0.00**). Document totals are SUM of lines. Pathological micro-lines can fail closed (negative last line) rather than quote a wrong total. Do not change economics. |
| H | Public / company branding polish | **COSMETIC** | Logo upload works; quote snapshot still reads live logo (`BRANDING-SNAPSHOT-01` deferred). No demo company name should go to external testers — fixture standard in launch checklist. |
| I | Production migration gap 045 → 052 | **FUTURE** | Sequence prepared in `docs/BETA_RELEASE_RUNBOOK.md`. Do not apply. |
| J | Production billing not configured/deployed | **FUTURE** | Stripe LIVE + `BILLING_ENVIRONMENT=live` + webhook + `billing_runtime_config` required at release. Not now. |
| K | Auth custom SMTP currently Preview-specific | **FUTURE** | Production Auth SMTP must be configured on `lxvnylhsbvudzzupxeqr` before Production emails. Do not copy Preview scripts blindly. |
| L | Hosted invite email proof | **SAFE BETA DEFER** | Code path exists (`lib/team/invite-email.ts` → Resend). Inbox delivery not fully proven in prior programmes (Preview secrets). Owner-only Builder beta does not need Team invite. Prove before inviting Business testers. |
| M | Repo-wide lint legacy warnings/failures | **SAFE BETA DEFER** | Targeted lint on touched files is the beta bar. Do not boil the ocean. |
| N | Older recovery verifier failures | **SAFE BETA DEFER** | Canonical beta suites are the launch bar, not every historical recovery script. |
| O | Stale Preview fixture / test data | **SAFE BETA DEFER** | Preview holds internal BETA projects. External testers must use **fresh orgs**. Do not mass-delete shared Preview data. |

### Additional items found this pass

| ID | Item | Class | Notes |
| --- | --- | --- | --- |
| P | Viewer PostgREST writes on non-049 tables | **FIX BEFORE BETA** (with A / 053) | `work_areas`, `project_facts`, `organisation_work_areas`, notes/questions not in 049 restrictive set. UI blocks Viewer; API does not. Include in 053. |
| Q | `CANCELLED_READ_EXPORT_DAYS = 90` unused | **SAFE BETA DEFER** | Cancelled orgs stay `read_export` indefinitely. Product-acceptable for beta; timed lockout is post-beta. |
| R | Billing primary-nav prominence | **FUTURE** | Billing is already `/app/settings/billing` but listed in primary sidebar. Trial banner carries upgrade. No IA redesign in this programme. |
| S | Quote contractor mobile bar missing safe-area padding | **FIX BEFORE BETA** | Closed in this programme (`QuoteMobileActionBar`). |
| T | Raw `error.message` on Rates / Setup actions | **FIX BEFORE BETA** | Closed in this programme (`toUserError`). |
