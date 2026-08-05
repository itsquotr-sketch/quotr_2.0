# Stage 3.1D — Domain Model Refinement Completion

**Status:** Complete  
**Date:** 2026-08-05  
**Preview sign-off:** 2026-08-05 — `docs/implementation/STAGE_3_1A_3_1D_PREVIEW_SIGNOFF.md`  
**Deferred schema proposals:** **Not Approved**  
**Constraint compliance:** No migrations; no commercial formula changes; no UI redesign; no AI prompt redesign; no ISD; no Company DNA  

---

## 1. Objectives completed

| Objective | Outcome |
| --- | --- |
| Exactly one authoritative owner per business entity | Documented in `DOMAIN_ENTITY_CONTRACTS` + refined architecture doc |
| Remove duplicated ownership (Questions / Facts / Derived / Constraints) | Fact = estimating SoT; Question = capture journal; Derived never overwrites user; Constraints exclusive namespace |
| Deterministic Question → Fact → Estimate pipeline | Fact-first commit helpers; estimate context facts-only; heal drift before readiness |
| Eliminate duplicated domain meaning | Namespace guards; readiness no longer treats question-only answers as satisfied |
| Document every entity lifecycle | Refined domain model doc + code contracts |
| Owner / SoT / lifecycle / freeze / consumers | Present on every contract |
| Refactor only where value > risk | Shared persistence helpers; write-path consolidation; no schema rewrite |
| Backwards compatibility | Dual storage retained; UI paths unchanged; behaviour tightened |
| Regression tests | `scripts/verify-stage-3-1d-domain-model-refinement.ts` (45/45) |
| Architecture docs updated | Refined model, deferred schema proposals, foundation + roadmap pointers |

---

## 2. Architectural improvements completed

1. **Fact source-of-truth contract** — `project_facts` sole authority for estimating and missing-fact readiness.  
2. **Question demoted to capture journal** — still dual-written for UI, never estimate input.  
3. **Deterministic commit order** — Fact upsert → Question mirror → Derived recompute → Heal → Missing ensure → Stale.  
4. **Shared write orchestrators** — `commitUserAnswerToScope`, `commitUserFactEdit`, `upsertScopedFact`, `upsertProjectConstraintRecord`, `healQuestionAnswersIntoFacts`.  
5. **Constraint ↔ Fact namespace separation** — reserved flat keys cannot write to facts; dotted scoped keys cannot write to constraints.  
6. **Derived overwrite guard** — centralised `shouldWriteDerivedFact` (user always wins).  
7. **Drift heal** — question answers without matching facts are materialised before missing-details evaluation.  
8. **Readiness fix** — removed “answered question hides missing fact” gate that caused estimate/UI divergence.  
9. **Entity lifecycle catalogue** — owner, SoT, lifecycle, freeze point, consumers for all major objects.  
10. **Deferred schema proposals** — documented without implementing migrations.

---

## 3. Files created / modified

### Created
- `lib/scopes/domain-ownership.ts`
- `lib/scopes/scope-value-resolution.ts`
- `lib/assistant/scope-persistence.ts`
- `scripts/verify-stage-3-1d-domain-model-refinement.ts`
- `docs/architecture/STAGE_3_1D_DOMAIN_MODEL_REFINED.md`
- `docs/architecture/STAGE_3_1D_DEFERRED_SCHEMA_PROPOSALS.md`
- `docs/implementation/STAGE_3_1D_DOMAIN_MODEL_REFINEMENT_COMPLETION.md`

### Modified
- `lib/assistant/actions.ts` — fact-first answer commit; constraint upsert helper  
- `lib/assistant/fact-actions.ts` — `commitUserFactEdit`  
- `lib/assistant/constraint-actions.ts` — namespace-safe constraint upsert  
- `lib/assistant/missing-questions.ts` — heal before readiness  
- `lib/assistant/persist-derived-facts.ts` — shared derived guard  
- `lib/project-notes/proposals/actions.ts` — shared fact/constraint writers  
- `lib/scopes/questions.ts` — readiness no longer satisfied by question-only answers  
- `lib/scopes/scope-review.ts` — ownership comments  
- `lib/estimate/context.ts` — facts-only comment  
- `docs/architecture/QUOTR_ARCHITECTURE_FOUNDATION.md`  
- `docs/plans/STAGE_3_PRODUCT_ROADMAP.md`  
- `docs/MVP_HARDENING_GUIDE.md`  

---

## 4. Regression results

| Suite | Result |
| --- | --- |
| `npx tsx scripts/verify-stage-3-1d-domain-model-refinement.ts` | **45/45 Pass** |
| `npx tsx scripts/verify-stage-3-1a-product-stabilisation.ts` | **37/37 Pass** |
| `npx tsc --noEmit` | **Pass** |

---

## 5. Remaining risks

1. **Dual storage retained** — question + fact rows can still diverge if a future write path bypasses `scope-persistence` helpers. Mitigate by routing all scope writes through helpers (static scan covers current paths).  
2. **Heal is best-effort on ensure-missing** — historical drift is repaired when missing-details runs; projects never revisiting that path keep latent drift until next scope write.  
3. **Estimate history still overwrite-on-regen** — ownership fixed; learning history still needs D-S5 (deferred).  
4. **Photos / file documents / evidence store still missing** — documented; not in 3.1D scope.  
5. **Constraint consumption still partial** — taxonomy unused keys remain (FEAT-003 / 3.2); ownership separation does not add estimate consumers.  
6. **Assemblies still absent** — Stage 3.3 still NOT READY.  
7. **3.1A / 3.1D Preview smoke** — **Passed** 2026-08-05 (`docs/implementation/STAGE_3_1A_3_1D_PREVIEW_SIGNOFF.md`).

---

## 6. Recommended next stage

1. Stage 3.1A and Stage 3.1D are **Complete** (Preview signed off 2026-08-05).  
2. **Stage 3.1B — Intelligent Scope Discovery** is **Ready to Plan** — authorise explicitly before implementation; cite Fact SoT and proposal accept/reject patterns from this refinement.  
3. Do **not** implement deferred schema proposals until separately approved (**Not Approved**).  
4. Keep Company DNA / Evidence Engine blocked until 3.4–3.5 substrate exists.  
5. FEAT-001–003 remain **Deferred**.

---

## Document control

| Field | Value |
| --- | --- |
| Path | `docs/implementation/STAGE_3_1D_DOMAIN_MODEL_REFINEMENT_COMPLETION.md` |
| Migrations | None |
| Commercial formulas | Unchanged |
| UI redesign | None |
| AI prompts | Unchanged |
