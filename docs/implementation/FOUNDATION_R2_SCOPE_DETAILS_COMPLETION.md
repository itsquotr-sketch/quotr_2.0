# FOUNDATION-R2 — Scope Details completeness + question quality

**Classification:** HISTORICAL completion. Contract: `docs/architecture/QUOTR_SCOPE_DETAILS_QUESTION_CONTRACT.md`. Plan: `docs/plans/QUOTR_DEVELOPMENT_MASTER_PLAN.md`.  
**Status:** Complete Local / In Owner Preview / R2-R1 remediation ready  
**Date:** 2026-08-16  
**Branch:** `hardening/stage-2a-security`  
**Prerequisite:** FOUNDATION-R1-R1 **Complete — Owner Preview Validated** (Owner live Preview: Project Conditions order, sole PC surface, Generate blocked until required PC resolved).

**Verify:** `npx tsx scripts/verify-foundation-r2-scope-details-completeness.ts`  
**Contract:** `docs/architecture/QUOTR_SCOPE_DETAILS_QUESTION_CONTRACT.md`  
**Audit:** `docs/audits/FOUNDATION_R2_SCOPE_DETAILS_QUESTION_AUDIT.md`  
**Owner Preview:** `docs/runbooks/FOUNDATION_R2_OWNER_PREVIEW.md`

Do not mark Owner PASS from this document.

---

## Purpose

Input-quality / question-contract stage for all 14 product Work Areas. Calculators will have the correct **inputs** when REQ-1+ begins. This batch does **not** emit requirements.

---

## Delivered

1. **R1-R1 Owner PASS recorded** in canonical status docs. Evidence is the Owner’s live Preview confirmation only.
2. **Question contract** — authority split, required/optional, conditionals, order, wording, Fact suppression, calculator mapping codes.
3. **Templates** — contractor-native copy; estimator order; bathroom waterproofing required; new high-value keys marked unconsumed where needed.
4. **Conditionals** — parent/child gating + L×W area derivation + demolition quantity gating. Existing balustrade / fascia / gate / tiling gates preserved.
5. **Fact aliases** for brief language (`kitchen.has_island`, `bathroom.waterproofing_scope`, fence post/panel).
6. **Verifier** — `scripts/verify-foundation-r2-scope-details-completeness.ts` (PC duplicates, uniqueness, gating, DC-01/DC-02, no emission, no migration, honest maturity).
7. **No** calculator rewrite, no requirement emission, no schema/migration, no extra AI, no 3.2.3 UI, no WA promotion.
8. **Validation-pack hygiene** — Office Soft Strip / Retaining Wall P0s retargeted from WA `*.carting_distance_m` to project `material_carry_distance`, plus proof that obsolete WA Facts are not extracted and haulage lines are not double-priced.

---

## Bathroom waterproofing (Owner approved REQUIRED)

Question: **Is waterproofing required?** — Yes / No / Not sure.

| Answer | Scope Details | Calculator |
| --- | --- | --- |
| **Yes** | Extent question appears | Waterproofing allowance (existing formula; extent not consumed) |
| **No** | Extent hidden | No waterproofing line. Explicit negative is a stored `false` Fact (`isQuestionAnswered` true) |
| **Not sure** | Remains unresolved required | Treated like unanswered for pricing (no line). Not a silent Yes |
| **Unanswered** | Section stays incomplete | Same as Not sure for the line item (`getBooleanFact` → `null`, falsy skip) |

The calculator **does** distinguish `false` vs `null` at the Fact layer. It **does not** currently emit a different priced line for unanswered vs No (both omit waterproofing). That is a bathroom-calculator limitation, not an R2 formula change. Do not invent a waterproofing calculator here.

---

## Questions added (future calculator dependency unless noted)

| Key | Consumed now? |
| --- | --- |
| `bathroom.waterproofing_extent` | No (**E**) |
| `kitchen.island_included` / `island_length_m` / `cabinetry_lm` / `benchtop_material` | No (**E**) |
| `retaining_wall.post_spacing_m` | No (**E**) |
| `pergola.height_m` | No (**E**) |
| `internal_walls.fire_or_acoustic` | No (**E**) |
| `fence.post_spacing_m` / `paling_or_panel_type` / `gate_width_m` | No (**E**) |

Removed: none in R2 (PC clones were R1).

---

## Commercial / regression

| Item | Result |
| --- | --- |
| DC-01 demolition Difficult labour | 9.63 h once (unchanged) |
| DC-02 external stairs | 15.18 h, not × WA 1.1 (unchanged) |
| Bathroom combined access | 1.15 once (unchanged) |
| Deck/Fence/Pergola single-consume | Preserved |
| COMMERCIAL-P0 / cost-first / margin | Untouched |
| Estimate formulas | No R2 calculator edits |
| Requirement emission | Still absent |
| Migration | None |

`bathroom.waterproofing_included` is now required. The calculator already consumed that Fact when present; R2 does not change the waterproofing formula.

---

## Requirement-emission readiness (do not start)

| WA | Class |
| --- | --- |
| Deck | READY FOR REQUIREMENT PILOT (inputs). Still taxonomy + labour-model gaps for transparent estimator. |
| Bathroom | NOT READY — CALCULATOR GAP |
| Retaining / Fence / Pergola | NOT READY — CALCULATOR GAP |
| Kitchen | NOT READY — CALCULATOR GAP |
| Demolition | NOT READY — LABOUR MODEL GAP |
| External stairs + commercial components | NOT READY — CALCULATOR GAP (+ taxonomy) |

---

## Work Area maturity

Unchanged: Deck/Bathroom trial-supported; retaining/fence/pergola/kitchen developing; eight components remain component. `commercial_fitout` is not a calculator WA.

---

## Security / performance

No schema changes. Auth/org/RLS/Fact/Constraint authority unchanged. No new AI calls, no per-keystroke persist, no router.refresh loops. Question pruning via conditionals should reduce UI density.

---

## Verification (local)

| Suite | Result |
| --- | --- |
| `npx tsc --noEmit` | pass |
| `npm run lint` | pass |
| `npm run build` | pass |
| FOUNDATION-R2 | **65 passed, 0 failed** |
| FOUNDATION-R1-R1 | **45 passed, 0 failed** |
| FOUNDATION-R1 | **80 passed, 0 failed** |
| Stage 3.1D | **45 passed, 0 failed** |
| Stage 3.1A | **37 passed, 0 failed** |
| R6-R1 | **25 passed, 0 failed** |
| R6 multi-WA | **30 passed, 0 failed** |
| R6-R2 | **67 passed, 0 failed** |
| R6-R3 | **18 passed, 0 failed** |
| R6-R4 | **19 passed, 0 failed** |
| Stage 3.2.1 | **53 passed, 0 failed** |
| Stage 3.2.2 core | **50 passed, 0 failed** |
| 3.2.2-R1 | **27 passed, 0 failed** |
| 3.2.2-R2 | **23 passed, 0 failed** |
| 3.2.2-R3 | **23 passed, 0 failed** |
| 3.2.2-R4 | **22 passed, 0 failed** |
| 3.2.2-R5 | **24 passed, 0 failed** |
| Bathroom commercial | **19 passed, 0 failed** |
| Outdoor calibration | passed |
| Outdoor AI extraction | passed |
| Commercial realism | passed |
| Validation pack | **0 P0** after carting retarget (project `material_carry_distance`; WA carting Facts forbidden) |
| 2B.10 | PASSED (57/57) |
| COMMERCIAL-P0 | **34 passed, 0 failed** |
| Cost-first Rates | **40 passed, 0 failed** |
| Org isolation | static passed (remote URL refused; 2A.5 is live proof) |
| RLS coverage | passed (migrations + local Docker) |
| 2A.5 tenant isolation | PASSED |
| 2A.3A pricing | PASSED |
| 2B.8 quote | **32/32 passed** |
| Quote safety | passed |

No migrations. No requirement emission. No Stage 3.2.3 UI. Tests not weakened.

---

## Status

| Item | Status |
| --- | --- |
| FOUNDATION-R1 | Complete |
| FOUNDATION-R1-R1 | Complete — Owner Preview Validated |
| FOUNDATION-R2 | **Complete Local / In Owner Preview / R2-R1 remediation ready** |
| FOUNDATION-R2-R1 | Complete Local / Owner Preview Pending |
| FOUNDATION-R2-R1-R1 | Complete Local / included in R2-R1 Preview gate |
| REQ-1 | Not Started / technically ready after Owner PASS |
| MaterialRequirement emission | Not Started |
| LabourRequirement emission | Not Started |
| Deck transparent estimator | Not Started |
| Stage 3.2.3 | Not Started |
| Company DNA | Not Started |
| PERF-FUTURE-01 | Planned |
| Production Scope Discovery | Disabled |

**Exact next:** Owner FOUNDATION-R2-R1 Preview (`docs/runbooks/FOUNDATION_R2R1_OWNER_PREVIEW.md`) then remaining R2 question sampling. After Owner PASS: **REQ-1** per `docs/plans/QUOTR_DEVELOPMENT_MASTER_PLAN.md`. Do not emit requirements in R2. Do not start Deck Takeoff.
