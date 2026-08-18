# Quotr Work Area Migration Plan

**Classification:** CANONICAL — phased Assistant UX migration (not a second roadmap)  
**Status:** COMPLETE / OWNER ASSISTANT ARCHITECTURE VALIDATED  
**Date:** 2026-08-19  
**HEAD:** `2b4055c316c404dcf3cc183dad47c9408c3634e4`  
**Workstream:** D (Capture) for Job Plan / Clarify / Assistant state; E (Commercial workflow) for Builder Review  
**Does not replace:** `docs/plans/QUOTR_DEVELOPMENT_MASTER_PLAN.md`

No big-bang migration. Physical calculator improvement stays independent of UX migration.

---

## 1. Per Work Area migration recipe

For each type:

| Step | Proof |
| --- | --- |
| **A. Scope → Job Plan** | Compose existing WA + scope items + quick spec. Toggles write existing INCLUDE/EXCLUDE / Facts. Money unchanged. |
| **B. Questions → Clarify** | Rank leftover candidates into one list. No parallel question store. |
| **C. Lines → common projection** | Map live categories into presentation buckets. Empty plant/waste OK. |
| **D. Preserve money** | Same facts + rates + settings → same cost/sell/GM unless Owner explicitly intends a commercial change. |
| **E. Preview validate** | Owner Preview; mobile UX; persistence reload. |
| **F. Later physical model** | Takeoff/promotion remains DECK-1 / REQ-4 / WA maturity work. Not a Job Plan blocker. |

Never migrate `commercial_fitout` as a calculator Work Area.

---

## 2. Migration order (repository evidence)

Order by **live calculator maturity + trial band**, not historical Stage labels.

| Order | Type | Band | Why now / later |
| --- | --- | --- | --- |
| 1 | `deck` | trial_supported | Only hybrid takeoff; Job Plan example already specified; REAL-JOB / EXEMPLAR fixtures |
| 2 | `bathroom` | trial_supported | Second trial WA; package/subcontract proves UX is not Deck-shaped |
| 3 | `retaining_wall` | developing | Productivity + package; similar template shape |
| 4 | `fence` | developing | Same family as retaining |
| 5 | `pergola` | developing | Same family; also a Deck Fact (`deck.pergola_included`) — honesty: separate WA vs Deck toggle |
| 6 | `kitchen` | developing | Allowance/subcontract-first; many facts unconsumed — Clarify must not dump all `required` |
| 7 | `demolition` | component | Often a child scope of other WAs; waste bucket |
| 8 | `external_stairs` | component | Related to Deck access; avoid double-count with `deck.access_type` |
| 9 | `internal_walls` | component | Fitout m² |
| 10 | `painting` | component | Area/productivity; strong Job Plan surface list |
| 11 | `flooring` | component | Area |
| 12 | `ceilings` | component | Area; access Fact local |
| 13 | `plastering` | component | Double-count risk with walls/ceilings — migrate after those exist in Job Plan |
| 14 | `doors` | component | EA/count lumps; no labour model — last among fitout so UX does not pretend hours exist |

Unsupported catalogue types (cladding, roofing, …) stay ISD-only until they have calculators.

---

## 3. KEEP / MERGE / MOVE / SIMPLIFY / REBUILD / RETIRE LATER

Do not delete a purpose without a replacement.

| Piece | Action | Replacement / notes |
| --- | --- | --- |
| Work Area confirmation UI | **MERGE** | into Job Plan |
| Scope Review (ISD overlay) | **MERGE** then **RETIRE LATER** as mandatory stage | Job Plan toggles; ISD may remain as add-WA search |
| `QualityBlock` (budget/standard/premium) | **MOVE** | EDIT_JOB / advanced; not a full-page gate |
| Scope Details `QuestionBlock` | **SIMPLIFY** | leftover questions feed Clarify; full list in EDIT_JOB |
| Project Conditions questionnaire | **MERGE** | Clarify for unresolved; persist `constraints` |
| Analyse Job | **KEEP** | Brief extraction |
| Brief capture | **KEEP** | Stage 1 |
| Estimate generate gate | **KEEP** | Estimate now in PLANNING |
| `EstimateReadyCard` | **KEEP** / light **SIMPLIFY** | ESTIMATE_READY shell |
| Completed setup disclosure (“Job details”) | **REBUILD** as EDIT_JOB | same writes, clearer mode |
| Estimate breakdown modal | **MOVE** purpose | becomes Builder Review (RECOVERY-5); modal may remain as stopgap |
| Attention chips / navigation | **KEEP** then **MOVE** | dedicated attention navigator, not a 2000-line shell |
| Pricing / Quote | **KEEP** | RECOVERY-1 boundary |
| `AssistantShell` (~2053 lines) | **REBUILD by extraction** | not a second god-component |
| `projects.stage` enum | **KEEP** until RECOVERY-4 | overlay modes first |
| Facts / constraints / estimates | **KEEP** | SoT |
| Builder Interview engine (not live Assistant) | **KEEP** as candidate source | do not run a second interview |
| DECK-2C standalone | **RETIRE LATER** as programme | absorbed by RECOVERY-5 |
| Structural package / shadow | **KEEP** | no promotion in this plan |

---

## 4. AssistantShell decomposition (do not implement here)

`components/assistant/AssistantShell.tsx` remounts on `projects.stage` (`key={stage}`). Client modes: `setup` vs `estimate-ready`. Overlay disclosure in `progressive-disclosure.ts`.

Extract **later** (RECOVERY-4), not replace wholesale:

| Future unit | Responsibility |
| --- | --- |
| Planning orchestrator | Brief → Job Plan → Clarify → generate; `canGenerate` |
| `JobPlanPanel` | WA cards, scope toggles, quick spec, add WA |
| `ClarifyPanel` | one ranked list; writes Facts/constraints |
| Estimate-ready shell | totals, CTAs, stale banner |
| `EditJobMode` | Job Plan + advanced + conditions |
| Attention navigator | assumption/check/attention/blocker routing |

Shared data: load Facts/WAs/constraints/estimate once; children are views.

---

## 5. Target flows (architecture evidence — no UX change now)

### 5.1 Multi-Work-Area — bathroom + new deck + painting

1. **Brief** extracts three WAs + facts (areas, Vitex/deck size, paint surfaces if stated).
2. **Job Plan** three parents:
   - Bathroom: renovation type, demolition, fixtures included/excluded
   - Deck: decking + new framing included; fascia/steps/balustrade optional
   - Painting: surfaces toggles; area if known
3. **Clarify** one list: e.g. bathroom finish if unknown, site access if not in brief, paint coats if unknown. Do not re-ask extracted dimensions.
4. **Estimate** three calculators; one persist; money per WA.
5. **Builder Review** grouped by WA then bucket (bathroom subcontract vs deck materials vs painting labour).
6. **Pricing** RECOVERY-1 — entering does not change sell.
7. **Quote** customer wording from Job Plan inclusions.

Data relationships: one `projects` row; N `work_areas`; Facts keyed by `work_area_id`; one `constraints` set; one current `estimates` row with lines carrying `work_area_id`.

### 5.2 REAL-JOB-01 (do not change money)

Brief: `3m x 9m Vitex, 140mm, 0.14m high, attaching onto existing deck, new substructure`.

| Stage | Desired |
| --- | --- |
| Brief | Extract length/width/height/board/width/substructure. Vitex → current Hardwood-class taxonomy (existing limitation). |
| Job Plan | Deck confirmed. Included: decking, new framing. **Not confirmed (not excluded):** existing removal, fascia; steps if architecture considers them relevant. Do **not** persist unstated items as `NOT_REQUIRED`. Spec: Hardwood-class · 140mm · low-level. Attached to existing does not imply demolition. Balustrade is not a prominent check at 0.14 m. |
| Clarify | Near-zero if geometry present. Height ASSUMABLE only if missing. Access/carry not asked unless unknown. |
| Estimate | Current engine path (controlled commercial shape from RECOVERY-0/1). `$13,000` is **REAL_JOB_PARTIAL_COMMERCIAL_EVIDENCE** only. |
| Edit | Toggle fascia → CHECK/allowance path; regenerate; no silent structural promotion. |

### 5.3 EXEMPLAR-AI-01

Brief: elevated replacement, 5.2×3.1, 1.2m, remove existing, Kwila 140mm, piles, 90×45 @400, fascia, two steps, **no balustrade**, restricted access + 25–30m carry.

| Stage | Desired |
| --- | --- |
| Job Plan | Near-complete from brief: removal included, fascia included, steps included, **balustrade explicitly not included**, new substructure included. Spec: Kwila · 140mm · elevated. Access/carry remain Project Conditions, not scope. |
| Clarify | Near-zero (access/carry already in constraints). |
| Attention | Elevated + no balustrade → ATTENTION/CHECK. Do not auto-price balustrade. |
| Estimate | Current calculator; exemplar is architecture evidence, not rate authority. |

### 5.4 Bathroom (current calculator only)

Job Plan: area, renovation type, demolition, fixture supply vs client-supplied. Quick spec: finish level. Do **not** invent tiling takeoff. Estimate: labour + subcontract allowances as today. Clarify: only missing required commercial inputs (area, type), not the full template dump.

### 5.5 Painting (current calculator only)

Job Plan: location, surfaces (walls/ceilings/doors/trims/cladding) as scope toggles. Quick spec: coats if stated. Estimate: m² × productivity. No invented spray vs brush engine.

### 5.6 Doors (current calculator only)

Job Plan: count, type, supply vs install, removal, architraves. Estimate: EA lumps. Labour bucket may be empty — honest. Do not invent hanging-hours.

---

## 6. RECOVERY-3 — Job Plan (Deck Preview — implementation batch)

**Objective:** first user-facing merge of Work Area + scope confirmation + lightweight spec. Generic enough for other WAs. **Start with Deck Preview only.**

**Owner locks:** Job Plan is a projection. `ABSENT FROM BRIEF ≠ NOT_REQUIRED`. User-facing scope ≠ estimate components. No new table. Clarify not in this batch. Hybrid money unchanged.

**In:**

- Generic `JobPlanPanel` + Work Area projection adapters (Deck first)
- Presentation: INCLUDED / NOT_INCLUDED / NOT_CONFIRMED (no new persist enum)
- Deck card: user-facing Decking, substructure, removal, fascia, steps, balustrade (when evidence warrants)
- Toggle writes existing Fact / scope actions; unconfirmed writes nothing
- Approve / exclude whole Work Area via existing actions
- Compact spec; optional edit spec (not a full-page stage)
- Add WA via existing supported catalogue (`commercial_fitout` never a calculator card)
- Multi-WA fixture (Bathroom + Deck + Painting) — architecture only, do not migrate live bathroom/painting UX
- Verifiers: REAL-JOB / EXEMPLAR compose; money invariance
- Mobile stacked cards
- Hide old Work Areas + Scope Review as simultaneous primary (keep components as fallback until RECOVERY-4)

**Out:** Clarify planner, AssistantShell state-machine rebuild, Builder Review, new tables, rate/money/structural change, DECK-3.

**Quality:** CALCULATION/COMMERCIAL unchanged; PERSISTENCE of toggles; USER Deck Preview.

**Exit:** COMPLETE LOCAL / OWNER JOB PLAN REVIEW PENDING.

---

## 7. RECOVERY-4 — Assistant state rebuild (exact scope — later)

**Objective:** PLANNING / ESTIMATE_READY / EDIT_JOB as the user mode machine.

**In:**

- Extract orchestrator + estimate-ready shell + edit-job from `AssistantShell` (incremental PRs)
- Map `projects.stage` to modes without a mandatory DB migration in the first PR
- Wire Job Plan + Clarify (if RECOVERY-3 Clarify slice slipped) into PLANNING
- Stale estimate + generate gate behaviour preserved
- Attention navigator extraction if it reduces shell size
- Multi-WA headline (not first-WA-only)

**Out:** Builder Review UI; commercial changes; dropping `projects.stage` in the first slice unless a follow-up PR is explicitly scoped.

**Exit:** COMPLETE LOCAL / OWNER ASSISTANT STATE REVIEW PENDING.

---

## 8. RECOVERY-5 — Builder Review (exact scope — later)

**Objective:** Level 2 review from the assisted-estimate contract, genericized.

**In:**

- Sections: Overview, Materials, Labour, Allowances/Other, Assumptions/Checks, Pricing Required
- Group by Work Area then presentation bucket
- Absorb DECK-2C face/fascia review-editing intent
- Fact edits → stale → regenerate
- Continue to Pricing must not change sell (RECOVERY-1)

**Out:** Pricing redesign; Quote leak of internals; structural promotion; LABOUR-CREW-01 implementation.

**Exit:** COMPLETE LOCAL / OWNER BUILDER REVIEW PENDING.

---

## 9. Quality gates for every migrated WA

1. Money invariance fixture (same inputs → same totals)
2. Question ranking / skip / assume behaviour
3. Persistence round-trip
4. Mobile UX
5. Gates A–D recorded in the batch completion note
