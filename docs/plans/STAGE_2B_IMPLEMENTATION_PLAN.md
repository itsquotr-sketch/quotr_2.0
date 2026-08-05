# Stage 2B — Authoritative Pricing Engine Implementation Plan

**Status:** Complete — Local (Batches **2B.3A–2B.10**; deployment/smoke owner-gated; Stage 2C not started)  
**Plan date:** 2026-08-04  
**Governing architecture:** `docs/architecture/QUOTR_ARCHITECTURE_FOUNDATION.md`  
**Governing process:** `docs/MVP_HARDENING_GUIDE.md`  
**Audit:** `docs/audits/STAGE_2B_PRICING_ENGINE_AUDIT.md`  
**Specification:** `docs/specifications/AUTHORITATIVE_PRICING_ENGINE_SPEC.md`  
**Owner decisions (2B.2A):** `docs/decisions/STAGE_2B_OWNER_COMMERCIAL_DECISIONS.md` (blocking decisions **Confirmed** 2026-08-04)  
**Canonical scenarios (2B.2B):** `docs/specifications/CANONICAL_COMMERCIAL_SCENARIOS.md`  
**Golden results (2B.2B):** `docs/specifications/GOLDEN_PRICING_EXPECTED_RESULTS.md`  
**Regression standard (2B.2B):** `docs/specifications/CALCULATION_REGRESSION_STANDARD.md`  
**Coverage matrix (2B.2B):** `docs/specifications/SCENARIO_COVERAGE_MATRIX.md`  
**Execution map (2B.3B):** `docs/specifications/GOLDEN_SCENARIO_EXECUTION_MAP.md`  
**Engine contract (2B.3C):** `docs/specifications/COMMERCIAL_ENGINE_CONTRACT.md`  
**Compatibility matrix (2B.4):** `docs/specifications/LEGACY_COMMERCIAL_COMPATIBILITY_MATRIX.md`  
**Estimate commercial boundary (2B.7):** `docs/specifications/ESTIMATE_COMMERCIAL_BOUNDARY.md`  
**Financial presentation boundary (2B.9):** `docs/specifications/FINANCIAL_PRESENTATION_BOUNDARY.md`  
**Pricing adoption gate:** `docs/specifications/PRICING_ACTION_ADOPTION_GATE.md`  
**Commercial engine (2B.3A–C):** `lib/commercial-engine/`  
**Parity harness (2B.4):** `lib/commercial-engine/parity/` (comparison-only; not public API)  
**GST source helpers (2B.5):** `lib/pricing/gst-source.ts`  
**Item adoption (2B.6A):** `lib/pricing/commercial-engine-adapter.ts`, `lib/pricing/authoritative-document-totals.ts`  
**Pricing-domain completion (2B.6B):** `lib/pricing/estimate-to-pricing-adapter.ts`  
**Estimate adoption (2B.7):** `lib/estimate/estimate-commercial-engine-adapter.ts`  
**Quote adoption (2B.8):** `lib/quotes/quote-commercial-engine-adapter.ts`  
**UI presentation (2B.9):** `lib/pricing/presentation-item-preview.ts`, `lib/financial-presentation/format.ts`  
**2B.3B completion:** `docs/implementation/STAGE_2B_BATCH_2B3B_COMPLETION.md`  
**2B.3C completion:** `docs/implementation/STAGE_2B_BATCH_2B3C_COMPLETION.md`  
**2B.4 completion:** `docs/implementation/STAGE_2B_BATCH_2B4_COMPLETION.md`  
**2B.5 completion:** `docs/implementation/STAGE_2B_BATCH_2B5_COMPLETION.md`  
**2B.6A completion:** `docs/implementation/STAGE_2B_BATCH_2B6A_COMPLETION.md`  
**2B.6B completion:** `docs/implementation/STAGE_2B_BATCH_2B6B_COMPLETION.md`  
**2B.7 completion:** `docs/implementation/STAGE_2B_BATCH_2B7_COMPLETION.md`  
**2B.8 completion:** `docs/implementation/STAGE_2B_BATCH_2B8_COMPLETION.md`  
**2B.9 completion:** `docs/implementation/STAGE_2B_BATCH_2B9_COMPLETION.md`  

**Hard constraint:** No pricing-formula consolidation, caller migration, UI redesign, migration changes, or Company DNA implementation begins until the relevant batch is authorised and (for behaviour-changing batches) Batch **2B.2** commercial decisions and golden tests exist.

---

## Stage objective

Establish **one authoritative commercial arithmetic meaning** for cost, sell, gross profit, gross margin, markup metrics, GST and aggregates across estimate, pricing and quote paths — preserving the working MVP and Stage 2A security/validation, while remaining compatible with future Company DNA and learning.

**Architecture authorisation:** Foundation Roadmap item 2; Philosophy §4.5–4.6; Governance §13.3, §13.8.

---

## Batch overview

| Batch | Name | Implementation? |
| --- | --- | --- |
| **2B.1** | Audit and specification | Docs only — **this batch** |
| **2B.2** | Owner commercial decisions and golden test cases | Docs + test fixtures only |
| **2B.2A** | Owner commercial decision register | Docs only — **Confirmed** (blocking) / **Deferred** (intentional) as of 2B.3B |
| **2B.2B** | Canonical commercial scenarios + goldens + regression standard | Docs only — **issued 2026-08-04** |
| **2B.3** | Pure authoritative line-item calculation module | Code; no persistence change |
| **2B.3A** | Commercial calculation kernel (standalone) | Code — **complete; not wired to app** |
| **2B.3B** | Golden scenario regression suite + kernel hardening | Code — **complete; not wired to app** |
| **2B.3C** | Contract, replay, explainability, snapshot hardening | Code — **complete; not wired to app** |
| **2B.4** | Legacy mapping + shadow parity harness | Code/scripts — **complete; no live totals change** |
| **2B.5** | Pricing adoption gate + C-28 GST correction | Code/docs — **complete; engine still unwired** |
| **2B.6A** | Pricing item CRUD + aggregate adoption | Code — **complete** |
| **2B.6B** | createPricingFromEstimate + document update + recalibration | Code — **complete** |
| **2B.6** | Pricing-action adoption (umbrella) | **Complete for pricing-domain server paths** |
| **2B.7** | Estimate adoption | Code — **complete** |
| **2B.8** | Quote adoption | Code — **complete** |
| **2B.9** | Client/UI calculation removal | Code — **complete** |
| **2B.10** | Final regression, documentation and deployment | Docs + verification |

---

## Batch 2B.1 — Audit and specification

### Customer outcome

Builders keep today’s working product; programme gains a clear map of where money is calculated.

### Strategic outcome

Single governing audit + engine specification before any refactor (Architecture Governance §13.3).

### Exact scope

* Produce audit, specification, this plan.  
* Set Stage 2B tracker to **Auditing**.  
* Run non-destructive `tsc` / lint / build.  

### Files expected

* `docs/audits/STAGE_2B_PRICING_ENGINE_AUDIT.md`  
* `docs/specifications/AUTHORITATIVE_PRICING_ENGINE_SPEC.md`  
* `docs/plans/STAGE_2B_IMPLEMENTATION_PLAN.md`  
* Tracker row in `docs/MVP_HARDENING_GUIDE.md`  

### Tests required

Non-destructive compile/lint/build only.

### Acceptance criteria

* Inventory covers calculation sites, fields, flows, duplicates.  
* Spec contains required sections 1–16.  
* Plan batches 2B.1–2B.10 with learning checks.  
* No application/migration/UI/prompt/formula changes.  

### Stop conditions

Any code or formula change; starting Batch 2B.3+ early.

### Rollback

Delete/revert docs only.

### Future Learning Compatibility Check

1. Improves today? Indirectly (clarity) — yes for trust programme.  
2. Structured data? Spec defines structured I/O — yes.  
3. Explainable? Spec §11 hooks — yes.  
4. Replayable? Spec §10 — yes.  
5. Manual corrections as evidence? Override metadata specified — yes.  
6. Historical accuracy? No rewrites — yes.  
7. Avoid DNA-in-arithmetic? Explicit — yes.  
8. Backward compatible? Legacy-unversioned — yes.

---

## Batch 2B.2 — Owner commercial decisions and golden test cases

Split for reviewability:

### Batch 2B.2A — Owner commercial decision register

* **Status:** Register issued 2026-08-04 — awaiting owner confirmation on each item  
* **Delivered:** `docs/decisions/STAGE_2B_OWNER_COMMERCIAL_DECISIONS.md` (57 decision items including OCD-GST)  
* **Not done:** Owner Confirmed/Deferred marks; golden fixtures (2B.2B)  
* **Stop condition obeyed:** No application/formula/migration/UI/prompt changes  

### Batch 2B.2B — Canonical commercial scenarios and golden results

* **Status:** Issued 2026-08-04  
* **Delivered:**  
  * `docs/specifications/CANONICAL_COMMERCIAL_SCENARIOS.md` (52 scenarios)  
  * `docs/specifications/GOLDEN_PRICING_EXPECTED_RESULTS.md`  
  * `docs/specifications/CALCULATION_REGRESSION_STANDARD.md`  
  * `docs/specifications/SCENARIO_COVERAGE_MATRIX.md`  
* **Gate to 2B.3:** Blocking OCDs in 2B.2A must be Confirmed or explicitly Deferred with safe defaults aligned to goldens.  
* **Stop condition obeyed:** No application/formula/migration/UI/prompt changes; Batch 2B.3 not started  

### Batch 2B.2 (parent) — remaining acceptance

### Customer outcome

No behaviour change yet; decisions prevent later surprise price changes.

### Strategic outcome

Lock commercial meaning before consolidation (audit Part 2 + owner register OCD-01…OCD-56 / OCD-GST + canonical scenarios).

### Exact scope

* Owner answers each unresolved commercial decision in the 2B.2A register.  
* Canonical scenarios + golden expected results + regression standard authored (2B.2B).  
* Optional later: machine-readable fixtures under `scripts/fixtures/pricing-engine/` when 2B.5 needs them.  
* **No refactor.**  

### Files expected

* `docs/decisions/STAGE_2B_OWNER_COMMERCIAL_DECISIONS.md` (2B.2A — issued)  
* `docs/specifications/CANONICAL_COMMERCIAL_SCENARIOS.md` (2B.2B — issued)  
* `docs/specifications/GOLDEN_PRICING_EXPECTED_RESULTS.md` (2B.2B — issued)  
* `docs/specifications/CALCULATION_REGRESSION_STANDARD.md` (2B.2B — issued)  
* `docs/specifications/SCENARIO_COVERAGE_MATRIX.md` (2B.2B — issued)  

### Tests required

Non-destructive compile/lint/build for doc batches; fixture runners deferred to 2B.5.

### Acceptance criteria

* Every **blocks Batch 2B.3** decision resolved or explicitly deferred with safe default.  
* Golden cases cover duplicate-formula scenarios from audit D.1 and categories A–Z.  
* Spec updated only where decisions amend “recommended change” rows.  

### Stop conditions

Implementing engine module; changing live formulas.

### Rollback

Docs only.

### Future Learning Compatibility Check

1. Today CX? Neutral until later adopt.  
2. Structured? Decision register + fixtures — yes.  
3. Explainable? Cases document expected explanation ids — yes.  
4. Replay? Fixtures are replay seeds — yes.  
5. Corrections? Capture override cases — yes.  
6. History? No data rewrite — yes.  
7. DNA decoupling? Decisions separate levers from ML — yes.  
8. Backward compatible? Defaults preserve current behaviour where possible — yes.

---

## Batch 2B.3 — Pure authoritative line-item calculation module

Split for reviewability:

### Batch 2B.3A — Commercial calculation kernel (standalone)

* **Status:** Issued 2026-08-04  
* **Delivered:** `lib/commercial-engine/` — core, calculations, validation, explanation, versioning, fixtures  
* **Public API:** `calculateLineItem`, `calculateDocumentAggregate`, `deriveSellFromCost`, `deriveProfitMetrics`, `compareLineResultToGolden`, version constants  
* **Modes:** `quantity_rate`, `productivity_labour`, `lump_sum`  
* **Not done:** App wiring; scenario fixture migration; shadow parity (2B.5); adoption (2B.6+)  
* **Stop condition obeyed:** No pricing/estimate/quote action changes; no UI; no DB; no callers outside the new package  

### Batch 2B.3B — Golden scenario regression suite and kernel hardening

* **Status:** Complete 2026-08-04  
* **Delivered:** Executable golden fixtures; expanded comparator; `scripts/verify-batch-2b3b-golden-commercial-engine.ts`; execution map; sell-only null-margin hardening  
* **Results:** 60 fixtures pass; 47/52 CCS executable (90.4%); 5 deferred/doc-only  
* **Not done:** App wiring; shadow parity (2B.5); adoption (2B.6+)  
* **Evidence:** `docs/implementation/STAGE_2B_BATCH_2B3B_COMPLETION.md`  
* **Stop condition obeyed:** No pricing/estimate/quote/UI/DB/migration changes; engine still unused by app  

### Batch 2B.3C — Contract, replay, explainability, snapshot hardening

* **Status:** Complete 2026-08-04  
* **Delivered:** `CommercialCalculationRequest` / `CommercialCalculationRecord`; normalize/serialize; deep freeze; stable step/warning codes; `executeCommercialCalculation`; `verifyCalculationReplay`; contract docs + verify script  
* **Versions:** Engine `2B.3C.0`; Formula `2B.mvp.1` (unchanged arithmetic)  
* **Evidence:** `docs/implementation/STAGE_2B_BATCH_2B3C_COMPLETION.md`; `docs/specifications/COMMERCIAL_ENGINE_CONTRACT.md`  
* **Not done:** App wiring; shadow parity (2B.5); adoption (2B.6+)  
* **Stop condition obeyed:** No pricing/estimate/quote/UI/DB/migration changes; engine still unused by app  

### Customer outcome

None visible (module unused by actions yet).

### Exact scope

* Add pure functions implementing Spec §§5–8, 12–13 for **lines** (+ document aggregate helper).  
* No DB writes; no action wiring.  
* Align to Stage 2B recommended MVP commercial model / goldens.  
* 2B.3B: migrate canonical scenarios to executable fixtures and harden kernel only as required.  

### Files expected

* `lib/commercial-engine/**` (2B.3A–2B.3C)  
* `scripts/verify-batch-2b3b-golden-commercial-engine.ts`  
* `scripts/verify-batch-2b3c-engine-contract.ts`  
* `docs/specifications/GOLDEN_SCENARIO_EXECUTION_MAP.md`  
* `docs/specifications/COMMERCIAL_ENGINE_CONTRACT.md`  

### Tests required

`tsc` / lint / build; golden + contract verify scripts.

### Acceptance criteria

* No imports from React or Supabase.  
* Explanation hooks present.  
* Immutable calculation records (deep freeze).  
* Nothing in app imports the engine yet.  
* Same-version replay exact; version mismatches controlled.  
* All executable golden fixtures pass.  

### Stop conditions

Wiring into `actions.ts`; changing live calculator domain logic; schema migrations; beginning 2B.4+ without acceptance.

### Rollback

Remove `lib/commercial-engine/`.

### Future Learning Compatibility Check

1. Today CX? Not yet.  
2. Structured I/O? Yes.  
3. Explainable hooks? Yes.  
4. Replay? Pure functions yes.  
5. Override metadata supported? Yes.  
6. History? Untouched.  
7. No DNA in arithmetic? Yes.  
8. Backward compatible numeric policy? Required.

---

## Batch 2B.4 — Legacy calculation mapping and shadow parity harness

### Status

**Complete 2026-08-04** — comparison-only; no live totals changed.

### Customer outcome

None visible.

### Strategic outcome

Every legacy money path has a stable LEG-* ID; differences vs the commercial engine are classified against owner decisions and goldens before any adoption.

### Exact scope

* Legacy registry + known mismatch register  
* Pure adapters + comparison-only legacy calculators  
* Parity fixtures + `scripts/verify-batch-2b4-shadow-parity.ts`  
* Compatibility matrix + adoption gates  
* **Do not** fix C-28, change actions, or wire the engine  

### Files expected

* `lib/commercial-engine/parity/**`  
* `docs/specifications/LEGACY_COMMERCIAL_COMPATIBILITY_MATRIX.md`  
* `docs/implementation/STAGE_2B_BATCH_2B4_COMPLETION.md`  

### Tests required

Golden + contract suites remain 100%; shadow parity runner passes with registered blockers only.

### Acceptance criteria

* 25 LEG-* IDs; 19 fixtures; C-28 blocking mismatch documented  
* No production imports of parity  
* No migrations / UI / AI / live calc changes  

### Stop conditions

Pricing-action adoption; fixing C-28 in this batch; production telemetry.

### Rollback

Remove `lib/commercial-engine/parity/` and 2B.4 scripts/docs.

### Evidence

`docs/implementation/STAGE_2B_BATCH_2B4_COMPLETION.md`; generated parity reports.

### Note on prior plan label

Earlier plan text called 2B.4 “Document aggregation engine.” Aggregate APIs already shipped in **2B.3A** (`calculateDocumentAggregate`). Batch **2B.4** as executed is the **shadow parity harness**. Batch **2B.5** executed the C-28 GST fix + adoption gate (not a second shadow harness).

---

## Batch 2B.5 — Pricing adoption gate and C-28 GST correction

### Customer outcome

Pricing documents created from estimates keep the organisation GST rate (including 0% and non-15% rates); totals agree with stored `gst_rate`.

### Strategic outcome

Clear the last known GST adoption blocker; publish formal readiness gate before engine wiring.

### Exact scope

* Fix `createPricingFromEstimate` post-item recalc to use the same validated organisation GST as insert.
* Add `lib/pricing/gst-source.ts`; audit other pricing recalcs for nullish 0% handling.
* Update parity fixture / mismatch register so C-28 is no longer blocking.
* Publish `PRICING_ACTION_ADOPTION_GATE.md` and 2B.6 adoption order.
* **Do not** wire commercial engine; **do not** change estimate/quote/UI/migrations.

### Evidence

`docs/implementation/STAGE_2B_BATCH_2B5_COMPLETION.md`; `scripts/verify-batch-2b5-gst-source-and-adoption-gate.ts`.

### Stop conditions

Beginning 2B.6 adoption in the same change set; bulk-rewriting historic pricing GST amounts.

---

## Batch 2B.4-AGG — (superseded note)

Document aggregation for pricing `all` vs quote `visible_only` + GST is already available in the commercial engine kernel (2B.3A). Caller migration remains **2B.6 / 2B.8**.

### Future Learning Compatibility Check

(Same pattern as 2B.3 — structured, replayable, no DNA coupling, history untouched.)

---

## Batch 2B.6 — Pricing-action adoption

Split into **2B.6A** (item mutations + aggregate) and **2B.6B** (create / document / recalibration).

### Batch 2B.6B — complete (2026-08-04)

Adopted: `updatePricingDocument` (GST aggregate), `createPricingFromEstimate`, recalibration apply, read mapper `cost_known`.  
Evidence: `docs/implementation/STAGE_2B_BATCH_2B6B_COMPLETION.md`.  
UI/estimate/quote remain for later batches.

### Batch 2B.6A — complete (2026-08-04)

Adopted: `addPricingItem`, `updatePricingItem`, `duplicatePricingItem`, `deletePricingItem` aggregation.  
Evidence: `docs/implementation/STAGE_2B_BATCH_2B6A_COMPLETION.md`.  
Rollback: `lib/pricing/adoption-authority.ts` or git revert.

### Remaining after 2B.6 umbrella

| Step | Target | Notes |
| ---: | --- | --- |
| — | Estimate adoption | **2B.7** |
| — | Quote adoption | **2B.8** |
| — | UI calculation removal | **2B.9** |
| — | Optional `cost_known` column | Only if migration authorised |

### Customer outcome

Final pricing edits/totals remain correct; fewer drift risks.

### Strategic outcome

Pricing mutations use authoritative engine (Architecture one commercial truth).

### Exact scope (umbrella)

* Pricing-domain server paths through engine (2B.6A–2B.6B complete).
* Keep Stage 2A auth/Zod/ownership.
* Preserve lump-sum behaviour and GST source rule from 2B.5.

### Feature flag / rollback approach

Internal authority constant (not UI flag). Prefer small commits with immediate revert.

### Tests required

Golden, contract, parity, GST 2B.5, 2B.6A, 2B.6B focused scripts.

### Acceptance criteria

* Server persists engine outputs for adopted actions.
* Document totals from engine with stored document GST.
* No client-only authority for saved money on adopted paths.
* Historical quotes untouched; no bulk historic pricing rewrite.

### Stop conditions

Estimate/quote adoption in same batch; UI redesign; DNA features; removing legacy formulas still used by UI/quotes.

### Rollback

Revert adopt commits; set authority to legacy.

### Future Learning Compatibility Check

1. Yes — consistent pricing.  
2. Yes — structured results.  
3. Yes — explanation hooks available.  
4. Yes — if version stamped when authorised.  
5. Yes — edit overrides retained.  
6. Yes — no historic quote rewrite.  
7. Yes.  
8. Yes — parity-gated.

---

## Batch 2B.7 — Estimate adoption

**Status:** Complete — see `docs/implementation/STAGE_2B_BATCH_2B7_COMPLETION.md`

### Customer outcome

Quick estimates and margin edits stay correct; org margin behaviour coherent.

### Strategic outcome

Estimate finalize / margin-override / sell-from-cost use engine; reduce C-08/C-10/C-13/C-15/C-16 duplication.

### Exact scope

* Route profit metrics + sell-from-cost + estimate aggregates through engine.
* Calculators still produce domain qty/rates; money metrics via engine.
* Address **S1-012** only if 2B.2 directs (otherwise document residual → Stage 4).

### Files expected

* `lib/estimate/estimate-commercial-engine-adapter.ts`, `adoption-authority.ts`
* `lib/estimate/summary.ts`, `margin-override.ts`, `line-items.ts`, `commercial-realism.ts`
* assistant generate/margin actions
* `docs/specifications/ESTIMATE_COMMERCIAL_BOUNDARY.md`

### Tests required

`scripts/verify-batch-2b7-estimate-adoption.ts` plus Stage 2A/2B regression chain.

### Acceptance criteria

* Single GP triad implementation on estimate production path.
* Persist fields unchanged in meaning.
* Ranges/confidence outside money engine.

### Stop conditions

Rewriting all calculator domain heuristics; AI prompt changes; constraint wiring unless authorised.

### Rollback

`ESTIMATE_CALCULATION_AUTHORITY = "legacy"` or revert estimate adopt commits.

### Future Learning Compatibility Check

1. Yes.
2. Yes — rate provenance retained.
3. Yes.
4. Yes.
5. Yes — target_margin as correction.
6. Yes.
7. Yes.
8. Yes.

---

## Batch 2B.8 — Quote adoption

**Status:** Complete — see `docs/implementation/STAGE_2B_BATCH_2B8_COMPLETION.md`

### Customer outcome

Quote totals remain trustworthy; revisions stay historically accurate.

### Strategic outcome

Quote aggregates/item totals via engine; **old revisions immutable**.

### Exact scope

* Adopt engine in quote build/actions.
* Preserve snapshot semantics (CD-20 / OCD-45).
* CD-22 prefer-total retained as quote-domain policy.
* Implement CD-21 warning/invariant only if decided in 2B.2; else leave S1-010 to Stage 6 with documented residual.

### Files expected

* `lib/quotes/quote-commercial-engine-adapter.ts`, `adoption-authority.ts`
* `lib/quotes/calculations.ts`, `build-from-pricing.ts`, `actions.ts`
* `scripts/verify-batch-2b8-quote-adoption.ts`

### Tests required

`scripts/verify-batch-2b8-quote-adoption.ts` plus Stage 2A/2B regression chain.

### Acceptance criteria

* New quotes use engine.
* Superseded quotes untouched.
* Stage 2A quote validation retained.

### Stop conditions

Rewriting historical rows; PDF redesign; email sending.

### Rollback

`QUOTE_CALCULATION_AUTHORITY = "legacy"` or revert quote adopt commits.

### Future Learning Compatibility Check

1. Yes.
2. Yes — snapshots structured.
3. Yes.
4. Yes — revision ids stable.
5. Yes — revise-from-pricing as evidence trail.
6. **Critical yes** — immutability.
7. Yes.
8. Yes.

---

## Batch 2B.9 — Client/UI calculation removal

**Status:** Complete — see `docs/implementation/STAGE_2B_BATCH_2B9_COMPLETION.md`

### Customer outcome

UI shows the same numbers the server will save; less preview drift.

### Strategic outcome

Remove client financial **authority** (Architecture deterministic server money).

### Exact scope

* Replace inline GP preview duplicates with production engine preview adapter.  
* Section / work-area rollups via authoritative aggregates.  
* Unknown-cost honest labels.  
* Quote snapshot display only.  

### Files expected

* `docs/specifications/FINANCIAL_PRESENTATION_BOUNDARY.md`
* `lib/pricing/presentation-item-preview.ts`, `presentation-section-totals.ts`
* `lib/estimate/presentation-breakdown.ts`, financial view models
* `lib/financial-presentation/format.ts`
* Pricing/estimate/quote UI components
* `scripts/verify-batch-2b9-client-financial-authority.ts`

### Tests required

`scripts/verify-batch-2b9-client-financial-authority.ts` + full Stage 2A/2B chain.

### Acceptance criteria

* No independent client GP/GST/document-total formula.  
* Preview matches server within rounding policy.  

### Stop conditions

Visual redesign; new pricing UX features.

### Rollback

Restore previous component commits / git revert 2B.9.

### Future Learning Compatibility Check

1. Yes — trust.  
2–8. Yes — UI ceases to be a divergent truth source.

---

## Batch 2B.10 — Final regression, documentation and deployment

### Customer outcome

Stable, documented pricing behaviour.

### Strategic outcome

Stage 2B Complete evidence; tracker update; remote deploy only if schema changes authorised (prefer **no** schema in 2B; if version columns added, owner-gated).

### Exact scope

* Full verification suite (2A scripts + 2B parity + tsc/lint/build).  
* Completion report.  
* Update MVP hardening tracker to Complete with evidence.  
* Known limitations / residual (S1-010, S1-012, constraints) recorded.  

### Files expected

* `docs/implementation/STAGE_2B_COMPLETION_REPORT.md`  
* Tracker update  
* Spec marked Accepted if owner signs off  

### Tests required

Full non-destructive suite; manual frozen-journey money checks.

### Acceptance criteria

* Definition of done from hardening guide met for Stage 2B.  
* No unresolved Critical money drift.  
* Stage 2A evidence untouched.  

### Stop conditions

Pulling Stage 3–11 scope; DNA implementation.

### Rollback

Prior release; docs note.

### Future Learning Compatibility Check

1–8. Confirm all prior batch checks still hold at close; explicitly state DNA not implemented and not required for Stage 2B Complete.

---

## Cross-cutting stop conditions (all batches)

* Do not weaken Stage 2A auth/validation.  
* Do not merge intentionally different aggregates without CD-21.  
* Do not auto-convert markup ↔ margin.  
* Do not let AI own arithmetic.  
* Do not implement Company DNA / actuals ML.  
* Do not redesign UI or frozen workflow.  

---

## Suggested dependency graph

```text
2B.1 → 2B.2 → 2B.3 → 2B.4 → 2B.5 → 2B.6 → 2B.7 → 2B.8 → 2B.9 → 2B.10
                 └───────────── fixtures feed ─────┘
```

Estimate (2B.7) and Quote (2B.8) both depend on 2B.5 parity; they may be serialised as shown for reviewability.

---

## Residual items explicitly not owned by Stage 2B close

| Item | Owner stage |
| --- | --- |
| S1-010 UX warning/blocking (unless CD-21 pulls minimal check into 2B.8) | 6 |
| Broad calculator hardcoded rates (S1-012) if deferred | 4 / 2B.7 residual |
| Constraint→price wiring (S1-020) | 3 / later |
| Full test framework/CI | 8 |
| DNA / scenario ML / actuals | Future authorised programme |

---

## Document control

| Field | Value |
| --- | --- |
| Path | `docs/plans/STAGE_2B_IMPLEMENTATION_PLAN.md` |
| Created | 2026-08-04 |
| Batch 2B.1 / 2B.2A application changes | **None** |
| Next batch | None — Stage 2B closed locally; next is owner-gated deploy then authorised subsequent stage |
| Stage 2B implementation started? | **Yes** — complete through **2B.10** |
| Stage 2B tracker status | **Complete — Local** (`docs/implementation/STAGE_2B_COMPLETION_REPORT.md`) |
