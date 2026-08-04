# Stage 2B — Authoritative Pricing Engine Implementation Plan

**Status:** Auditing (Batch 2B.1 complete; Batch **2B.2A** owner commercial decision register prepared — awaiting owner confirmation; implementation not started)  
**Plan date:** 2026-08-04  
**Governing architecture:** `docs/architecture/QUOTR_ARCHITECTURE_FOUNDATION.md`  
**Governing process:** `docs/MVP_HARDENING_GUIDE.md`  
**Audit:** `docs/audits/STAGE_2B_PRICING_ENGINE_AUDIT.md`  
**Specification:** `docs/specifications/AUTHORITATIVE_PRICING_ENGINE_SPEC.md`  
**Owner decisions (2B.2A):** `docs/decisions/STAGE_2B_OWNER_COMMERCIAL_DECISIONS.md`  

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
| **2B.2A** | Owner commercial decision register | Docs only — **in progress / register issued** |
| **2B.2B** | Golden pricing test cases (after owner confirmations) | Docs + fixtures only |
| **2B.3** | Pure authoritative line-item calculation module | Code; no persistence change |
| **2B.4** | Document aggregation engine | Code; no caller migration |
| **2B.5** | Shadow parity verification | Code/scripts; no user-visible change |
| **2B.6** | Pricing-action adoption | Code |
| **2B.7** | Estimate adoption | Code |
| **2B.8** | Quote adoption | Code; preserve snapshots |
| **2B.9** | Client/UI calculation removal | Code |
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

### Batch 2B.2B — Golden pricing test cases (after owner confirmations)

### Customer outcome

No behaviour change yet; decisions prevent later surprise price changes.

### Strategic outcome

Lock commercial meaning before consolidation (audit Part 2 + owner register OCD-01…OCD-56 / OCD-GST).

### Exact scope

* Owner answers each unresolved commercial decision in the 2B.2A register.  
* Author golden numeric cases covering: quantity_rate, productivity_labour, lump_sum, sell-from-margin, document aggregate, quote visible aggregate, GST, ranges, waste-adjusted qty (given), minimums (given).  
* **No refactor.**  

### Files expected

* `docs/decisions/STAGE_2B_OWNER_COMMERCIAL_DECISIONS.md` (2B.2A — issued)  
* `docs/specifications/PRICING_ENGINE_GOLDEN_CASES.md` and/or `scripts/fixtures/pricing-engine/*.json` (2B.2B)  

### Tests required

Fixture schema validation only (optional script); no production path change.

### Acceptance criteria

* Every **blocks Batch 2B.3** decision resolved or explicitly deferred with safe default.  
* Golden cases cover duplicate-formula scenarios from audit D.1.  
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

### Customer outcome

None visible (module unused by actions yet).

### Strategic outcome

One module implements Spec modes + profit metrics + sell-from-cost.

### Exact scope

* Add pure functions implementing Spec §§5–8, 12–13 for **lines**.  
* No DB writes; no action wiring.  
* Prefer extracting/wrapping existing `pricing-item-calculation` / `deriveSellFromCost` behaviour to match golden cases **without intentional numeric change**.  

### Files expected

* New module under a stable lib path (exact path chosen at implement time; e.g. `lib/pricing-engine/` or consolidation under `lib/pricing/engine/`)  
* Unit tests against golden fixtures  

### Tests required

Golden line-item vectors; margin bound failures; lump_sum; productivity.

### Acceptance criteria

* Parity with today’s C-25/C-01/C-08 metrics on fixtures.  
* No imports from React or Supabase.  
* Explanation hooks present (may be minimal).  

### Stop conditions

Wiring into `actions.ts`; changing calculator domain logic; schema migrations.

### Rollback

Remove module; tests unused.

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

## Batch 2B.4 — Document aggregation engine

### Customer outcome

None visible yet.

### Strategic outcome

One aggregate implementation for pricing (`all`) and quote (`visible_only`) + GST.

### Exact scope

* Implement Spec aggregate + GST + optional ranges.  
* No caller migration.  

### Files expected

* Aggregation module beside line engine  
* Golden aggregate fixtures (incl. S1-010 visibility case documenting current behaviour)  

### Tests required

All-items vs visible-only; GST; empty sets; rounding order.

### Acceptance criteria

* Matches today’s `calculateDocumentTotals` / `calculateQuoteTotals` on fixtures.  
* Inclusion rule explicit in API.  

### Stop conditions

Adopting in actions; changing visibility semantics without CD-21 decision.

### Rollback

Remove unused module.

### Future Learning Compatibility Check

(Same pattern as 2B.3 — structured, replayable, no DNA coupling, history untouched.)

---

## Batch 2B.5 — Shadow parity verification

### Customer outcome

None (user-visible results unchanged).

### Strategic outcome

Prove old vs new equivalence before cutover.

### Exact scope

* Behind flag or dev-only path, run engine beside existing helpers on pricing/estimate/quote calculations.  
* Record mismatches (safe logging).  
* Fix engine bugs until parity green on golden + sampled fixtures.  
* **Do not switch authority.**  

### Files expected

* Shadow helper / scripts `verify-batch-2b5-pricing-parity.ts`  
* Optional flag default **off**  

### Tests required

Parity script PASS; existing 2A scripts still PASS.

### Acceptance criteria

* Zero unexplained mismatches on golden set.  
* Any intentional difference tied to a 2B.2 decision and documented.  

### Stop conditions

Shipping user-visible changes; production log spam of PII.

### Rollback

Disable flag; remove shadow calls.

### Future Learning Compatibility Check

1. Today CX? Unchanged — preserves usefulness.  
2–8. Yes — comparison evidence strengthens replay confidence without coupling DNA.

---

## Batch 2B.6 — Pricing-action adoption

### Customer outcome

Final pricing edits/totals remain correct; fewer drift risks.

### Strategic outcome

Pricing mutations use authoritative engine (Architecture one commercial truth).

### Exact scope

* Wire `lib/pricing/actions.ts` + recalibration totals through engine.  
* Keep Stage 2A auth/Zod/ownership.  
* Preserve lump-sum behaviour.  
* **Fix confirmed GST bug:** `createPricingFromEstimate` must recalc document totals with the document’s / organisation GST rate, not hardcoded `DEFAULT_GST_RATE` when org GST was already applied on insert (audit C-28 / CD-09).  

### Files expected

* `lib/pricing/actions.ts`, recalibration modules, possibly thin wrappers deleting duplicate GP helpers once unused  

### Tests required

Extend/re-run 2A.3A style tests; golden pricing edit cases; recalibration smoke.

### Acceptance criteria

* Server persists engine outputs.  
* Document totals from engine.  
* No client-only authority for saved money.  

### Stop conditions

Estimate/quote adoption in same batch; UI redesign; DNA features.

### Rollback

Revert adopt commits; re-enable old helpers.

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

### Customer outcome

Quick estimates and margin edits stay correct; org margin behaviour coherent.

### Strategic outcome

Estimate finalize / margin-override / sell-from-cost use engine; reduce C-08/C-10/C-13/C-15/C-16 duplication.

### Exact scope

* Route profit metrics + sell-from-cost + estimate aggregates through engine.  
* Calculators still produce domain qty/rates; money metrics via engine.  
* Address **S1-012** only if 2B.2 directs (otherwise document residual → Stage 4).  

### Files expected

* `lib/estimate/summary.ts`, `margin-override.ts`, `line-items.ts`, `commercial-realism.ts` (profit paths), assistant generate/margin actions  

### Tests required

Golden estimate totals; margin update; regenerate with target margin.

### Acceptance criteria

* Single GP triad implementation on estimate path.  
* Persist fields unchanged in meaning.  

### Stop conditions

Rewriting all calculator domain heuristics; AI prompt changes; constraint wiring unless authorised.

### Rollback

Revert estimate adopt commits.

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

### Customer outcome

Quote totals remain trustworthy; revisions stay historically accurate.

### Strategic outcome

Quote aggregates/item totals via engine; **old revisions immutable**.

### Exact scope

* Adopt engine in quote build/actions.  
* Preserve snapshot semantics (CD-20).  
* Implement CD-21 warning/invariant only if decided in 2B.2; else leave S1-010 to Stage 6 with documented residual.  

### Files expected

* `lib/quotes/calculations.ts`, `build-from-pricing.ts`, `actions.ts`  

### Tests required

Create/revise quote totals; visibility fixture; print reads stored totals.

### Acceptance criteria

* New quotes use engine.  
* Superseded quotes untouched.  
* Stage 2A quote validation retained.  

### Stop conditions

Rewriting historical rows; PDF redesign; email sending.

### Rollback

Revert quote adopt commits.

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

### Customer outcome

UI shows the same numbers the server will save; less preview drift.

### Strategic outcome

Remove client financial **authority** (Architecture deterministic server money).

### Exact scope

* Replace inline GP preview duplicates with shared engine import **or** display server-returned fields only.  
* Ensure save path does not trust client totals without server recompute (already mostly true for pricing).  

### Files expected

* `components/pricing/PricingItemEditForm.tsx`  
* Possibly estimate breakdown display helpers  

### Tests required

Manual acceptance: edit → save → reopen parity; lint/tsc/build.

### Acceptance criteria

* No independent client GP formula.  
* Preview matches server within rounding policy.  

### Stop conditions

Visual redesign; new pricing UX features.

### Rollback

Restore previous component commits.

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
| Next batch | Owner confirmation of `docs/decisions/STAGE_2B_OWNER_COMMERCIAL_DECISIONS.md`, then **2B.2B** golden cases |
| Stage 2B implementation started? | **No** |
| Stage 2B tracker status | **Auditing** |
