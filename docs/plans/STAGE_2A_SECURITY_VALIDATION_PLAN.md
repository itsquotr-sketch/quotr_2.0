# Stage 2A — Security, Validation and Data Integrity Plan

**Status:** Batches 2A.1–2A.5 implemented locally — Stage 2A remains In Progress (remote 025/026 not applied)  
**Plan date:** 2026-08-03  
**Owner decisions incorporated:** 2026-08-03  
**Batch 2A.1 completed:** 2026-08-03  
**Batch 2A.2 completed:** 2026-08-03  
**Governing documents read:** `docs/MVP_HARDENING_GUIDE.md`, `docs/audits/STAGE_1_CURRENT_STATE_AUDIT.md`  
**Method:** Re-verification of Stage 1 findings against current source, migrations and scripts, then incorporation of official owner decisions. Batch completion reports live under `docs/implementation/`.

---

## A. Stage objective

Stage 2A establishes that Quotr’s existing MVP can be trusted for multi-tenant security and data integrity **without** consolidating the pricing engine.

After Stage 2A:

* Every protected server action verifies authentication.
* Every organisation-owned operation verifies organisation ownership independently of RLS.
* Database policies enforce tenant isolation independently of application code.
* Runtime inputs are validated before database mutation.
* Financial inputs cannot contain invalid, non-finite, negative or unauthorised values.
* Gross margin (not markup) is validated within the owner-approved bounds.
* Manual lump-sum items remain supported and are fully server-validated.
* Existing data is not destroyed by migrations or hardening work.
* Database changes are versioned and reviewable.
* Security failures produce controlled errors rather than partial writes.

**Explicit non-goals (reconfirmed by owner):** Stage 2A does **not** include pricing-engine consolidation, margin-formula refactoring, duplicated-calculation removal, UI redesign, performance optimisation, Quotr DNA, new estimating features, photo/document upload implementation, or package redesign. Those belong to later stages. Stage 2A may add validation and ownership guards around money-bearing actions while preserving current calculation behaviour.

---

## A.1 Official owner decisions (binding for Stage 2A)

### Production and environments

* There is currently **no real external customer data** in the production database.
* Production data must still be treated carefully and must not be modified unnecessarily.
* There is currently **no separate Supabase staging project**.
* During Stage 2A, **do not assume remote migrations can be safely tested**.
* All migration validation should be designed for a **local development environment** wherever possible.
* Any migration intended for the remote Supabase project requires **explicit owner approval** before execution.

### Organisation model (MVP)

* One user belongs to one company.
* One company may contain multiple users.
* No organisation-switching workflow is required.
* No multi-company user experience should be introduced during Stage 2A.
* All ownership validation assumes this model (org derived from the signed-in user’s `profiles.org_id`; no client-supplied org switching).
* **Same-company users are expected to share authorised company records.**
* **Cross-company access must fail closed** (generic not-found; no disclosure that a foreign record exists).
* **S1-013 documentation treatment (Batch 2A.1):** `profiles.role` remains largely unused in app code. Stage 2A does **not** add role-based write restrictions or an invitation system. Ownership remains organisation-scoped for all users in the company.

### Financial validation — gross margin

Quotr uses **gross margin**, not markup, as its primary commercial setting.

* Definition: **Gross Margin = Gross Profit ÷ Selling Price**
* Default company gross margin: **20%**
* Allowed range: **0%–95%**
* Reject: negative values, values above 95%, `NaN`, `Infinity`, `-Infinity`, and invalid numeric input
* Margin must not be confused with markup

### Financial validation — markup

* If markup exists in the codebase, treat it **separately** from margin.
* Allowed markup range: **0%–1000%**
* Do **not** automatically convert or merge markup and margin during Stage 2A (Stage 2B / later pricing-engine work).

### Negative values

* The MVP does **not** support credits.
* Reject negative quantities, labour rates, material rates, totals, margins and markups.
* Future credits must be a dedicated credit line-item type — **not** introduced in Stage 2A.

### Zero-value items

* Zero-value line items are permitted **only** where intentionally informational or included-at-no-charge.
* Normal commercial quantities, rates and totals must not silently become zero unless explicitly intended.

### Lump-sum items

* Manual lump-sum pricing is an **intended** feature.
* Requirements: finite, non-negative totals; runtime validation; authentication; organisation ownership validation.
* Lump-sum mode must **never** bypass server-side validation.
* Do **not** redesign lump-sum behaviour in Stage 2A — only secure it.

---

## B. In-scope audit findings

Re-verified against current code on 2026-08-03. Only findings that belong in Stage 2A are listed. Proposed corrections below reflect official owner decisions.

| Stage 1 issue ID | Severity | Launch-blocking | Audit description | Verified file / function / table / policy / migration | Why Stage 2A | Proposed correction | Test required | Migration required | Production verification required |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| **S1-002** | Critical | Yes | `calculation_mode: "lump_sum"` bypasses the only server-side total cross-check; no margin bound on pricing items | `lib/pricing/pricing-item-calculation.ts` `forwardTotalsMatchStored` (lines 613–618 returns `true` for lump_sum); `lib/pricing/actions.ts` `updatePricingItem` / `addPricingItem`; `lib/security/margin-validation.ts` never called from `lib/pricing/*` | Money-bearing write can persist arbitrary/negative-margin totals | Keep lump-sum as a supported mode; require finite non-negative totals; enforce gross-margin bounds **0–95%** and markup bounds **0–1000%** on persisted profit fields; reject negatives/non-finite; **do not** redesign lump-sum or change formula implementations | Crafted lump-sum and quantity_rate payloads; negative/NaN/Infinity/out-of-bounds cases | No (app-layer first) | Prefer local; remote only with owner approval |
| **S1-003** | Critical | Yes | `lib/pricing/actions.ts` and `lib/quotes/actions.ts` have zero Zod/runtime input validation | Confirmed: neither file imports `zod`; 11 pricing + 16 quote exported actions accept typed-but-unchecked inputs (`PricingItemInput`, `QuoteItemInput`, etc.) | Malformed input reaches money-bearing and quote mutations | Add server-side Zod schemas for all mutation inputs; reject unknown enums; validate IDs as UUIDs; encode owner financial rules | Malformed ID/enum/array/number payloads per mutation action | No | Prefer local smoke; remote optional with approval |
| **S1-005** | High | Yes | `lib/assistant/actions.ts` omits org-ownership check used by sibling assistant files | `loadProjectStage` selects `org_id` but never compares to caller `orgId` (lines 121–145); no `assertOrgOwnsProject` import; siblings call `assertOrgOwnsProject` | Central estimate/brief/question/constraint write path relies on RLS alone | Route `loadProjectStage` through shared ownership assert; fail closed with generic “not found” | Two-org cross-ID server-action attempts (local preferred) | No | Prefer local two-user proof |
| **S1-006** | High | Yes | ~~RLS live-isolation proof has never succeeded~~ **Verified locally in Batch 2A.5** | Prior live branch bailed; replaced by `scripts/verify-batch-2a5-tenant-isolation.ts` | Cannot claim tenancy proven end-to-end without local proof | Local two-org suite (RLS + ownership helpers); refuse non-local URLs | Executable two-org isolation suite against local env — **PASS 2026-08-03** | No (026 grants fix local only) | Remote proof / remote 026 apply only with explicit owner approval |
| **S1-007** | High | Yes | Seven parent/child tables lack parent-org-consistency triggers | Triggers exist only in `023_security_hardening.sql` for `pricing_items` / `quote_items` | DB backstop missing for child-row org mismatch | Additive migration modelled on 023; **validate on local DB first**; remote apply only after explicit owner approval | Insert mismatched `org_id` child rows as service role → reject (local) | Yes | Confirm whether 023 already applied remotely before any remote apply |
| **S1-013** | Medium | No | `profiles.role` exists; almost never enforced in app; no invite model | Role set `"owner"` at signup; only org UPDATE RLS checks owner/admin | Multi-user companies are in MVP model; role is vestigial for most writes | Do **not** add multi-company UX. Ownership remains org-scoped for all company users. Document that any future invite/role hardening is out of Stage 2A unless a verified cross-user write defect is found; no org-switcher | Optional: same-org second user can access org records; other-org cannot | Unknown | No |
| **S1-014** | Medium | No | Zero-org / missing-profile state renders empty shell | `app/(protected)/app/layout.tsx` continues with `organisationName: null` | Auth reliability | Detect missing profile/org and redirect to controlled recovery; do not silently operate | Signup-partial-failure simulation (local) | No | Optional if orphaned auth users exist remotely |
| **S1-015** | Medium | No | Org-resolution logic duplicated in four places | Canonical: `lib/assistant/state.ts`; copies in setup/settings/rates actions | Future security fix may miss copies | Collapse to one authoritative helper under one-user→one-company / multi-user→one-company model | Import-path / behaviour checks | No | No |
| **S1-016** | Medium | No | Author-tracking FKs to `profiles` default RESTRICT | Five author FKs with no `ON DELETE` clause | Safe deletion / referential integrity | **Accepted MVP limitation (2A.4):** account deletion not required; do not migrate FKs | N/A | No | Documented in 2A.4 completion |
| **S1-017** | Medium | No | Soft-deleted projects leave child rows live | `deleteProject` sets `deleted_at` only | Safe deletion / data integrity | **Addressed in 2A.4** via active ownership helper (hide from normal active queries; no hard-delete) | Soft-delete then active ownership fails | No | Children remain stored |

**Storage isolation:** Not applicable — confirmed zero upload/storage code. Revisit only if Stage 3 introduces uploads.

---

## C. Explicitly excluded findings

| Issue ID | Reason excluded from Stage 2A | Future stage |
| --- | --- | --- |
| **S1-001** | Duplicated margin/gross-profit formula consolidation | **2B** |
| **S1-004** | Photo/document upload feature absent | **3** |
| **S1-008** | AI numeric facts unclamped into estimate math | **5** |
| **S1-009** | `applyNoteProposal` swallows partial write errors | **5** |
| **S1-010** | Quote vs Final Pricing subtotal divergence | **6** |
| **S1-011** | Full test framework / CI (beyond focused Stage 2A proofs) | **8** |
| **S1-012** | Hardcoded rates bypassing org margin | **2B** |
| **S1-018** | `duplicateProject` omits notes/questions/proposals | **3** |
| **S1-019** | `MAX_QUESTIONS = 12` may drop required questions | **3** |
| **S1-020** | Constraints captured but unused by estimate engine | **3 / 2B** |
| **S1-021** | Pricing ownership badge missing on desktop | **6 / 10** |
| **S1-022** | Pricing line-item delete lacks UI confirmation | **6 / 10** |
| **S1-023** | No root error boundary | **8 / 10** |
| **S1-024** | No monitoring/analytics / correlation IDs | **8** |
| **S1-025** | AI failure logs may include user content | **5 / 8** |
| **S1-026** | No AI rate limiting | **5 / 9** |
| **S1-027** | Mobile-card flash on desktop | **10** |
| **S1-028** | Estimate range unexplained; AUD/NZD inconsistency | **10** |
| **S1-029** | `pricing_audit_log.organisation_id` naming inconsistency | **2B / 7** |
| **S1-030** | Sequential dashboard summary fetches | **9** |
| **S1-031** | Dead UI / unused AI test module | Cleanup anytime |
| **S1-032** | Browser print-to-PDF only | **6** |
| **S1-033** | AGENTS.md / vendor docs anomaly | **0** |

**Also excluded by owner stage-boundary reconfirmation:** pricing-engine consolidation; margin formula refactoring; duplicated calculation removal; UI redesign; performance optimisation; Quotr DNA; new estimating features; photo/document upload implementation; package redesign; converting or merging markup with margin.

---

## D. Authentication and organisation-resolution map

### Current authoritative flow (verified)

```
Browser request
  → middleware.ts → lib/supabase/middleware.ts updateSession()
       (cookie refresh; /app/* requires user; auth routes redirect if signed in)
  → app/(protected)/app/layout.tsx
       (second getUser(); loads profiles.org_id for display; no hard redirect if org missing)
  → Server Action / Server Component
       → createClient() (anon + session; RLS applies)
       → getAuthOrgContext() [intended canonical]
            supabase.auth.getUser()
            profiles.select(org_id) where id = user.id
            return { supabase, user, orgId } | null
       → assertOrgOwns*(ctx, id) [shared helpers in lib/security/org-ownership.ts]
       → .eq("org_id", orgId) on writes (defense in depth)
```

| Concern | Current implementation | Owner-aligned Stage 2A note |
| --- | --- | --- |
| User authentication | Supabase Auth email/password | Unchanged |
| Session retrieval | Cookie session via `@supabase/ssr` | Unchanged |
| Organisation membership | `profiles.org_id` scalar | **MVP model:** one user → one company; one company → many users. No org switcher. |
| Organisation creation | `signup()` via service-role admin client | Keep narrowly scoped; server-generated IDs only |
| Organisation lookup | Via `profiles.org_id` | Derive org **only** from session profile — never from client |
| Role lookup | `profiles.role` | Not a multi-company mechanism; do not build invite UX in 2A |
| Project / estimate / quote ownership | Org-scoped asserts + RLS | Same-org users share access; cross-org must fail closed |

### Shared helpers (exist today)

* `getAuthOrgContext` — `lib/assistant/state.ts` (exported)
* `assertOrgOwnsProject` / `PricingDocument` / `Quote` / `WorkArea` / `PricingItem` / `QuoteItem` — `lib/security/org-ownership.ts`
* `validateMarginPercent` / `assertMarginPercentForEstimating` — `lib/security/margin-validation.ts` (**current code uses 0–80; Stage 2A must align to owner 0–95 gross-margin bounds**)
* Local duplicates in project-notes, lifecycle, pricing, setup, settings, rates modules

### Missing ownership checks / fail-open risks

* **`lib/assistant/actions.ts` `loadProjectStage`** — RLS-only; no `assertOrgOwnsProject` (S1-005).
* **`getAssistantState`** — RLS-only project load.
* Mutations generally fail closed on missing auth; zero-org layout still renders hollow shell (S1-014).
* No audited mutation trusts client-supplied `org_id` as write org; client-supplied **resource IDs** remain the trust boundary.

### Proposed authoritative approach (do not implement yet)

1. **Single helper** `requireAuthOrgContext()` that requires authenticated user + `profiles.org_id` and returns typed context or controlled errors.
2. **Single ownership API** via `lib/security/org-ownership.ts` before mutating customer records.
3. **Error contract** — cross-tenant and missing resources both return generic `"… not found."`
4. **Layout** — missing profile/org → controlled recovery (S1-014); still needs owner UX copy decision.
5. **RLS remains mandatory** — app asserts are defense-in-depth.
6. **No org-switcher / multi-company UX** — ownership always uses the session user’s single company.

---

## E. Server-action security inventory

Inspected all `"use server"` modules that read/create/update/delete customer-owned records. Full inventory from the initial Stage 2A plan remains accurate; priority files unchanged:

* **Highest risk:** `lib/assistant/actions.ts` (ownership gap), `lib/pricing/actions.ts` and `lib/quotes/actions.ts` (no runtime validation; lump-sum / money writes).
* **Reference patterns:** `lib/assistant/margin-actions.ts`, `fact-actions.ts`, `constraint-actions.ts`, `work-area-actions.ts`.
* Sibling files are **not** assumed safe merely by pattern — inventory in the prior plan revision still applies.

**Owner-driven inventory updates:**

* Pricing/quote financial schemas must encode **gross margin 0–95%**, **markup 0–1000%**, **no negatives**, **lump-sum secure-in-place**.
* `updateEstimateMargin` / `saveRateSettings` currently enforce **0–80** via existing helpers — Stage 2A must update those bounds to **0–95** as validation alignment (not formula consolidation).
* Default company gross margin product rule is **20%** — if the codebase default constant differs, align the default constant narrowly during validation work; do not refactor estimate arithmetic.

---

## F. Runtime validation strategy

### Current libraries and conventions

* **Zod `^4.4.3`** is the project standard.
* Pattern: schema → `safeParse` → controlled `{ error }` responses.
* Gap: pricing and quotes use TypeScript types only.

### Proposed consistent server-side approach (owner-aligned)

| Input class | Stage 2A rule |
| --- | --- |
| IDs / UUIDs | `z.string().uuid()` |
| Names / descriptions | trimmed strings with max lengths |
| Quantities | finite; **`>= 0`**; reject negatives, NaN, ±Infinity |
| Labour / material rates | finite; **`>= 0`**; reject negatives |
| Totals / currency values | finite; **`>= 0`**; reject negatives |
| **Gross margin %** | finite; **0–95 inclusive**; primary commercial setting; **not markup** |
| **Markup %** | finite; **0–1000 inclusive**; validated separately; do not convert to/from margin |
| Tax / GST rates | finite; recommend `>= 0` and `<= 100` (NZ default 15) — GST bounds not owner-specified; keep conservative |
| Calculation modes | enum: `quantity_rate` \| `productivity_labour` \| `lump_sum` |
| Lump-sum totals | finite; non-negative; required when mode is lump_sum; **never skip validation** |
| Zero values | Allowed only for intentional informational / included-at-no-charge items; do not silently coerce commercial inputs to zero |
| Status / enums | explicit allow-lists |
| Arrays / nested items | element schemas; fail entire request before any write |
| Destructive inputs | UUID validated; ownership required |

### Non-negotiable requirements

* Client validation is not sufficient.
* `NaN`, `Infinity`, `-Infinity` must be rejected (`Number.isFinite`).
* Credits / negative commercial values are out of MVP — reject.
* Unknown enum values must be rejected.
* Org always from session profile — never trust client org ownership.
* Validation failures must not create partial database state.

### Schema reuse recommendation

* Reuse existing Zod schemas where they already cover the domain.
* Add narrowly scoped `lib/pricing/schemas.ts` and `lib/quotes/schemas.ts`.
* Extend/align `validateMarginPercent` to **0–95 gross margin** and add a separate markup validator **0–1000**.
* Do not invent a new validation framework.
* Do not merge margin and markup helpers into one “percentage” abstraction that blurs the product distinction.

---

## G. Financial-action validation

Stage 2A protects writes; it does **not** consolidate formulas (Stage 2B).

### Binding commercial rules

| Concept | Rule |
| --- | --- |
| Gross margin | GP ÷ sell; default **20%**; bounds **0–95%** |
| Markup | Separate; bounds **0–1000%**; no auto-conversion |
| Negatives | Reject quantities, rates, totals, margins, markups |
| Credits | Not supported; future dedicated type only |
| Zero | Only intentional informational / no-charge items |
| Lump sum | Intended feature; secure with auth + ownership + finite non-negative totals; do not redesign |

### Mutation protections

| Mutation | Current gap | Required Stage 2A protection |
| --- | --- | --- |
| `updatePricingItem` / `addPricingItem` | No Zod; lump_sum bypasses cross-check; no margin bounds | Auth + ownership (existing where present) + full schema; lump_sum totals finite & `>= 0`; derived/persisted gross margin in 0–95; markup in 0–1000 if persisted; reject negatives/non-finite; **keep existing calculation helpers** |
| `duplicatePricingItem` | UUID unchecked | Ownership + UUID; reject copy if source values non-finite/negative |
| `deletePricingItem` | UUID unchecked | UUID + existing ownership |
| `updatePricingDocument` | GST unchecked | Finite GST bounds (conservative) |
| `createPricingFromEstimate` | IDs unchecked | Authz + IDs; do not re-plumb engine |
| `updateEstimateMargin` | Bounds currently 0–80 | Align to **0–95** gross margin; keep existing apply path |
| Rate / company default margin saves | Bounds currently 0–80 | Align to **0–95**; default **20%** product rule |
| `updateQuoteItem` | Client `total` trusted; negatives possible | Finite non-negative qty/price/total; auth + ownership; preserve current total-resolution behaviour except reject invalid values |
| Quote create/revise | Snapshot copy | Authz + reviewed gate; no formula rewrite |

**Removed prior “pending decision” defaults:** negatives are forbidden; lump-sum is allowed and must be secured; gross-margin/markup bounds are now fixed by owner.

---

## H. RLS and tenant-isolation plan

Unchanged technical inventory from the prior plan revision (20 org-scoped tables; `auth_org_id()`; 023 triggers on pricing/quote items only; seven tables still need parent-org triggers — S1-007).

**Environment update:** runtime verification of live remote RLS is **not assumed**. Prefer:

1. Local migration apply + local policy/trigger checks.
2. Local two-user isolation script.
3. Remote checks only with explicit owner approval.

Multi-user same-company access is expected under MVP: User A1 and User A2 in Organisation A both pass `auth_org_id()` for Org A records. Isolation proof remains **cross-organisation**, not cross-user-within-org.

---

## I. Migration and production-state verification

### Chronology relevant to Stage 2A

| Migration | Relevance |
| --- | --- |
| `001_initial.sql` | `auth_org_id()`, base RLS |
| `002` / `003` / `008`–`012` | Org-scoped tables + RLS |
| **`023_security_hardening.sql`** | RLS re-enable; pricing/quote org-match triggers; note_proposals DELETE |
| **`024_sprint2_trust_hardening.sql`** | `pricing_audit_log` + RLS |

### Deployment reality (owner)

* **No separate staging Supabase project.**
* Migration validation must be designed for **local development** first.
* **No real external customer data** in production today — still treat production carefully; no unnecessary modification.
* Remote migration execution requires **explicit owner approval**.

### Drift and risk notes

* Remote applied state of 023/024 is still **unknown**.
* `verify_rls_coverage.sql` expected list predates `pricing_audit_log`.
* `verify_rls_status` RPC does not exist in migrations.
* New Stage 2A migrations must be idempotent (023 style).
* Do not write migrations that assume remote already has objects unless guarded with `IF NOT EXISTS` / `create or replace`.

### Verification commands (local first; do not execute in this planning task)

Prefer running against **local** Supabase/Postgres. Do not paste secrets.

1. Applied migrations ledger:
   ```sql
   select * from supabase_migrations.schema_migrations order by version;
   ```
2. RLS enabled on public tables (same query as prior plan).
3. Confirm 023 triggers/policies locally after migrate.
4. Confirm 024 `pricing_audit_log` exists locally after migrate.
5. Optional orphan count queries — read-only.

**Remote:** owner may later approve the same read-only checks against production. Do not apply new migrations remotely without that approval.

---

## J. Two-organisation isolation test

### Design

| Actor | Org | Seeded records |
| --- | --- | --- |
| User A | Organisation A | Project A, estimate A, pricing doc A, quote A |
| User B | Organisation B | Project B, estimate B, pricing doc B, quote B |

Optional same-org control (MVP multi-user): User A2 in Organisation A can access A records (not a Stage 2A defect).

### Must prove

1. User A can access Organisation A records.
2. User A cannot read/update/delete Organisation B records.
3. Symmetric for User B.
4. Client-supplied foreign IDs cannot bypass ownership.
5. Direct Supabase requests are blocked by RLS.
6. Server actions also reject cross-organisation IDs.
7. Failure responses do not disclose sensitive record existence.

### Environment

* **Primary:** local development Supabase/database with two disposable users/orgs.
* **Not required for Stage 2A completion:** a separate staging project.
* **Remote production proof:** only if owner explicitly approves; use disposable test orgs, not unnecessary data modification.

### Scripts

Repair `scripts/verify-org-isolation.ts` and `scripts/verify-rls-coverage.ts` for local execution; replace missing RPC with SQL introspection; document how to run locally. Full CI harness remains Stage 8.

---

## K. Safe deletion and referential integrity

Unchanged technical findings: soft-delete projects; hard-delete pricing/quote items with ownership; no org/account deletion app path; RESTRICT author FKs (S1-016); soft-delete orphans (S1-017).

**Stage 2A stance:**

* Enforce ownership on destructive server paths.
* Do not hard-delete production graphs.
* No unnecessary production modification (even without external customers).
* Account-deletion FK strategy and soft-delete child visibility remain **remaining owner decisions** (Section N).
* UI confirmation changes remain out of scope unless a server path is unsafe without them.

---

## L. Implementation batches

### Batch 2A.1 — Shared authentication and organisation guard

* **Status:** Complete (2026-08-03) — see `docs/implementation/STAGE_2A_BATCH_2A1_COMPLETION.md`
* **Issue IDs:** S1-005, S1-014, S1-015 (partial), S1-013 (documentation only)
* **Delivered:** Authoritative `requireAuthOrgContext` / `getAuthOrgContext` in `lib/security/`; assistant `loadProjectStage` + `getAssistantState` ownership checks; `/app/setup-required` recovery; rates/setup/settings duplicates redirected to shared helper
* **Left for later batches:** lifecycle/pricing/project-notes ownership loaders; full two-live-user isolation (2A.5)
* **Migrations:** None
* **Stop condition obeyed:** No multi-company UX, invites, or pricing-formula changes

### Batch 2A.2 — Runtime validation schemas

* **Status:** Complete (2026-08-03) — see `docs/implementation/STAGE_2A_BATCH_2A2_COMPLETION.md`
* **Issue IDs:** S1-002 / S1-003 **partially** addressed (schemas + helpers only; action wiring is 2A.3)
* **Delivered:** `lib/pricing/schemas.ts`, `lib/quotes/schemas.ts`, shared numeric primitives, gross-margin 0–95% + default 20%, separate markup 0–1000% validator, focused verification script
* **Not done here:** Applying schemas to `lib/pricing/actions.ts` / `lib/quotes/actions.ts` broadly (Batch 2A.3)
* **Migrations:** None
* **Stop condition obeyed:** No formula consolidation or lump-sum redesign

### Batch 2A.3 — Secure server actions

Split for reviewability:

#### Batch 2A.3A — Secure pricing server actions

* **Status:** Complete (2026-08-03) — see `docs/implementation/STAGE_2A_BATCH_2A3A_COMPLETION.md`
* **Issue IDs:** S1-002 (pricing-action portion), S1-003 (pricing-action portion), S1-015 (pricing ownership/auth resolution)
* **Delivered:** `requireAuthOrgContext` + shared ownership asserts on all pricing actions; Batch 2A.2 schemas wired; lump-sum validated before persistence; `assertOrgOwnsEstimate`; focused verification script
* **Not done here:** Quote-action enforcement (2A.3B); DB default margin migration (still 25%); formula consolidation
* **Migrations:** None
* **Atomicity note:** `createPricingFromEstimate` uses compensating document delete on item-insert failure; no broad transaction/RPC added
* **Stop condition obeyed:** No formula changes, no quote-action rollout, no lump-sum redesign

#### Batch 2A.3B — Secure quote server actions

* **Status:** Complete (2026-08-03) — see `docs/implementation/STAGE_2A_BATCH_2A3B_COMPLETION.md`
* **Issue IDs:** S1-003 (quote-action portion), S1-015 (quote auth/ownership resolution)
* **Delivered:** `requireAuthOrgContext` + shared ownership on all quote actions; Batch 2A.2 quote schemas wired; revise-from-pricing schema aligned to real payload; compensating org-scoped cleanup retained; focused verification script
* **Not done here:** Full status state machine; DB default margin migration (still 25%); formula consolidation; Batch 2A.4 migrations
* **Migrations:** None
* **Atomicity note:** Create/revise use compensating deletes of newly created quote rows only; no broad transaction/RPC
* **Stop condition obeyed:** No formula changes, no pricing-action reopen beyond shared ownership helper tweak, no UI/PDF redesign

### Batch 2A.3 (historical combined note)

* **Issue IDs:** S1-002, S1-003, S1-005 (completion), inventory gaps
* **Files expected:** `lib/pricing/actions.ts`, `lib/quotes/actions.ts`, `lib/assistant/actions.ts`, rate/settings margin call sites for bound alignment; **not** calculator formula modules except validation call sites
* **Migrations:** None
* **Tests:** Local malformed and cross-org payloads; lump_sum accepted when valid, rejected when invalid
* **Acceptance:** Audited mutations auth + ownership + schema validated; lump_sum cannot bypass validation; negatives rejected; current calculation functions still used unchanged
* **Dependencies:** 2A.1, 2A.2
* **Rollback:** Revert commit
* **Stop condition:** Redesigning lump-sum behaviour or touching seven margin formula implementations

### Batch 2A.4 — Database and RLS corrections

* **Status:** Complete locally (2026-08-03) — see `docs/implementation/STAGE_2A_BATCH_2A4_COMPLETION.md`
* **Issue IDs:** S1-007 fixed; S1-016 accepted MVP limitation (no account deletion); S1-017 active-query hide without hard-delete; DB margin default aligned to 20%
* **Migration:** `supabase/migrations/025_stage_2a4_database_integrity.sql`
* **Local reset:** `supabase db reset` succeeded through 025 (023/024 applied first)
* **Remote:** **Not applied** — runbook at `docs/runbooks/STAGE_2A4_REMOTE_MIGRATION_RUNBOOK.md`
* **Stop condition obeyed:** No formula changes; no remote apply; no account-deletion FK rewrite

### Batch 2A.4 (historical planning note)

* **Issue IDs:** S1-007; S1-016 only if account deletion approved; S1-017 only for non-destructive support if visibility policy confirmed
* **Files expected:** New local migration `025_*.sql` (name TBD), update `supabase/sql/verify_rls_coverage.sql`
* **Migrations:** Yes — parent-org-match triggers for seven tables
* **Tests:** **Local** service-role insert of mismatched `org_id` → reject
* **Acceptance:** Migration applies cleanly to a **clean local** database; idempotent; no data deletion; written runbook for remote apply **gated on owner approval**
* **Dependencies:** Confirm whether 023/024 already exist remotely before any remote apply; remaining deletion/soft-delete decisions if those issues are included
* **Rollback:** Drop new triggers/functions locally; never silent remote apply
* **Stop condition:** Applying migration to remote Supabase without explicit owner approval; bulk data rewrites

### Batch 2A.5 — Tenant-isolation verification — **COMPLETE (local, 2026-08-03)**

* **Issue IDs:** S1-006 verified; S1-005 / S1-007 / 2A.3A–2A.3B ownership re-verified
* **Implementation date:** 2026-08-03
* **Local environment:** Supabase Docker (`127.0.0.1`); `supabase db reset` through migrations **001–026**
* **Entry script:** `scripts/verify-batch-2a5-tenant-isolation.ts` (refuses non-local URLs)
* **Supporting:** `scripts/verify-org-isolation.ts` (static helpers + pointer to 2A.5); `scripts/verify-rls-coverage.ts` (Docker-only live checks)
* **Same-org control:** PASS (A1 + same-company A2)
* **Cross-org RLS reads/writes:** PASS (A↛B and representative B↛A)
* **Application ownership guards:** PASS (project/pricing/quote/work-area; soft-deleted active reject)
* **Parent-child triggers:** PASS (025 seven + 023 pricing/quote items)
* **Soft-delete:** PASS (active hide; children stored; foreign org empty; no hard delete)
* **Error disclosure:** PASS (missing ≡ foreign controlled not-found)
* **Defect fixed:** Migration `026_stage_2a5_restore_api_table_grants.sql` — postgres default privileges had omitted SELECT/INSERT/UPDATE for API roles (blocking PostgREST). **Remote not applied.**
* **Evidence:** `docs/implementation/STAGE_2A_BATCH_2A5_COMPLETION.md`
* **Stop condition obeyed:** No production/remote data; no Batch 2A.6; no formula/UI/AI changes

### Batch 2A.5 (historical planning note)

* **Issue IDs:** S1-006; verifies S1-005/007
* **Files expected:** Repaired isolation/RLS scripts; local run instructions
* **Migrations:** None planned originally; **026** added only as verified defect fix for API grants
* **Tests:** Two-user / two-org proof on **local** environment
* **Acceptance:** Local proof recorded for app + RLS isolation; remote proof optional and owner-gated
* **Dependencies:** Local Supabase (or equivalent) + two disposable users/orgs; batches 2A.1–2A.4 preferred first
* **Rollback:** N/A
* **Stop condition:** Destructive tests against production; assuming a staging project exists

### Batch 2A.6 — Final regression and completion report

* **Issue IDs:** Closure evidence for Stage 2A in-scope IDs
* **Files expected:** Docs / tracker only
* **Migrations:** None (unless deferred remote apply separately approved)
* **Tests:** `npx tsc --noEmit`, `npm run lint`, `npm run build`, focused Stage 2A tests/scripts, manual acceptance
* **Acceptance:** Section M criteria all true; tracker Complete with evidence
* **Dependencies:** 2A.1–2A.5
* **Rollback:** N/A
* **Stop condition:** Pulling Stage 2B pricing consolidation into the completion pass

**Recommended order:** 2A.1 → 2A.2 → 2A.3 → 2A.4 → 2A.5 → 2A.6.

---

## M. Stage-level acceptance criteria

Stage 2A is **not Complete** until:

1. Every protected server action requires a valid authenticated user.
2. Every organisation-owned action independently verifies ownership under the one-user→one-company / multi-user→one-company model.
3. No action trusts a client-provided organisation ID without verification; no org-switcher introduced.
4. Runtime schemas validate all audited mutation inputs.
5. All audited monetary inputs reject invalid, non-finite and negative values (no credits).
6. Gross margin bounds **0–95%** (default **20%**) and markup bounds **0–1000%** are documented and enforced separately.
7. Lump-sum calculation mode remains available and cannot bypass server-side validation.
8. RLS is enabled and verified for every organisation-owned table (including `pricing_audit_log`) on the **local** verification environment.
9. Two real users in two real organisations cannot access one another’s records (**local proof required**).
10. Direct database requests and server actions both enforce isolation in that proof.
11. Destructive operations cannot delete records belonging to another organisation.
12. Relevant migrations can be applied safely to a **clean local development database**; remote apply is documented and **owner-gated**.
13. Existing data is preserved; production is not modified unnecessarily (no external customer data today, still careful).
14. Type checking passes.
15. Linting passes.
16. Production build passes.
17. Focused automated tests pass.
18. No pricing-engine consolidation, margin-formula refactoring, UI redesign, performance work, Quotr DNA, uploads, package redesign, or unrelated feature work has been introduced.

---

## N. Owner decisions

### N.1 Decided (binding)

| # | Topic | Decision |
| --- | --- | --- |
| 1 | Production customer data | **No real external customer data** today; still treat carefully; no unnecessary modification |
| 2 | Staging | **No separate Supabase staging project**; validate migrations locally; remote apply needs explicit owner approval |
| 3 | Organisation model | One user → one company; one company → many users; no org-switching / multi-company UX in Stage 2A |
| 4 | Gross margin | Primary commercial setting; GP ÷ sell; default **20%**; bounds **0–95%**; reject invalid/non-finite/negative/>95 |
| 5 | Markup | Separate from margin; bounds **0–1000%**; no convert/merge in Stage 2A |
| 6 | Negatives / credits | **Reject** negatives; no credit line items in Stage 2A |
| 7 | Zero-value items | Allowed only for intentional informational / included-at-no-charge |
| 8 | Lump sum | Intended feature; secure with validation/auth/ownership; do not redesign |
| 9 | Stage boundaries | No pricing-engine consolidation, formula refactoring, UI redesign, performance, DNA, uploads, packages, new estimating features |

### N.2 Remaining decisions required before / during implementation

| # | Decision | Blocks | Notes |
| --- | --- | --- | --- |
| R1 | Are migrations **023** and **024** already applied on the remote Supabase project? | Remote verification and any remote apply of Batch 2A.4 | Does not block local 2A.1–2A.3 or local 2A.4 validation |
| R2 | Do database backups (or snapshot/export) exist for the remote project, and is restore understood? | Any owner-approved remote migration | Even without external customers |
| R3 | Local two-user / two-org test credentials (or approval to create disposable local users) | Batch 2A.5 | Preferred path for isolation proof |
| R4 | Soft-delete child visibility policy (S1-017): hide children of soft-deleted projects from all active queries? | Completeness of S1-017 in 2A | **Resolved in Batch 2A.4:** active paths use `assertOrgOwnsActiveProject`; children remain stored (no hard-delete) |
| R5 | Zero-org recovery UX copy/route (S1-014) | ~~Batch 2A.1~~ | **Resolved in Batch 2A.1:** `/app/setup-required` with sign-out-to-retry-setup CTA |
| R6 | Is account / user deletion required for MVP (S1-016)? | Whether to migrate RESTRICT FKs | **Resolved in Batch 2A.4:** account deletion not required for MVP; RESTRICT author FKs retained as accepted limitation |
| R7 | Explicit approval to apply any Stage 2A migration to **remote** Supabase | Production/remote schema change | Local apply does not imply remote apply |
| R8 | GST / tax rate explicit bounds (not specified in owner financial decisions) | Pricing document GST validation detail | Recommend finite `0–100` pending confirmation |

**Not blocking Batch 2A.1 start:** R1–R3, R7–R8 can proceed in parallel after auth/validation batches begin, provided remote work remains gated. **Preferred before 2A.1 recovery UX:** R5. **Preferred before closing S1-016/S1-017:** R4 and R6.

---

## O. Risk register

| Risk | Severity | Mitigation |
| --- | --- | --- |
| Cross-tenant access via assistant RLS-only path | High | Batch 2A.1 ownership asserts + local 2A.5 proof |
| Invalid financial writes via pricing/quotes | Critical | Batches 2A.2–2A.3 with owner bounds |
| Existing margin helpers still use 0–80 | High | Align to 0–95 in 2A.2; test estimate margin + rate settings |
| Accidental markup↔margin merge while aligning bounds | High | Separate validators; Stage 2B owns formula consolidation |
| No staging project → false sense of remote safety | High | Local-first validation; remote apply owner-gated |
| Remote DB missing 023/024 | High | R1 before remote work; idempotent migrations |
| Migration applied remotely without approval | Critical | Explicit gate in 2A.4/2A.6; do not auto-push |
| Over-securing lump-sum breaks intended manual pricing | Medium | Keep mode; validate totals only; no redesign |
| Silent zero coercion breaks commercial intent | Medium | Reject invalid input rather than coerce to zero; allow explicit zero only |
| Soft-delete orphans | Medium | Resolve R4; no hard-delete cleanup without approval |
| Multi-user same-org mistaken for isolation failure | Low | Isolation tests are cross-org; same-org sharing is expected |
| Accidental pricing-engine refactor | High | Batch stop conditions; excluded issue list |
| Partial signup orphan `auth.users` | Medium | S1-014 recovery (R5) |

---

## Document control

| Field | Value |
| --- | --- |
| Path | `docs/plans/STAGE_2A_SECURITY_VALIDATION_PLAN.md` |
| Created | 2026-08-03 |
| Owner decisions incorporated | 2026-08-03 |
| Governing audit | `docs/audits/STAGE_1_CURRENT_STATE_AUDIT.md` |
| Application code / schema / config / tests changed while planning | **None** |
| Tracker update | Stage 2A `In Progress`; Batches 2A.1–2A.5 complete locally; remote 025/026 not applied |
| Next step | Batch 2A.6 only (final regression and completion report) |
