# RECOVERY-2 — Assistant Domain Audit

**Status:** COMPLETE / OWNER ASSISTANT ARCHITECTURE VALIDATED  
**Date:** 2026-08-19  
**HEAD:** `2b4055c316c404dcf3cc183dad47c9408c3634e4`  
**Branch:** `hardening/stage-2a-security`  
**Mode:** Audit only. Production code unchanged.

**Contracts produced:**
- `docs/architecture/QUOTR_ASSISTANT_OPERATING_MODEL.md`
- `docs/architecture/QUOTR_WORK_AREA_ASSISTANT_CONTRACT.md`
- `docs/architecture/QUOTR_ESTIMATE_PRESENTATION_CONTRACT.md`
- `docs/plans/QUOTR_WORK_AREA_MIGRATION_PLAN.md`

---

## 1. Current user-facing domain map

`AssistantShell` (`components/assistant/AssistantShell.tsx`, ~2053 lines) remounts on `projects.stage` via `key={stage}`. Authoritative DB stages (`lib/assistant/stage.ts`):

`brief → confirm_work_areas → quality → work_area_questions → constraints → ready_to_estimate → estimate_ready`

There is **no** `editing` stage. Post-estimate edits stay on `estimate_ready` + `markEstimateStale`.

Overlay disclosure (`lib/assistant/progressive-disclosure.ts`): capture | workAreas | scopeReview | quality | questions | estimateReview | constraints | null.

Client mode: `setup` vs `estimate-ready` (`compressCompletedSetup`).

**Scope Review is not in `projects.stage` or the stepper** — ISD / disclosure only.

Naming collisions: Scope Review (discovery) vs Estimate Review (`ScopeSummaryBlock`) vs “Review estimate” (breakdown modal).

| Current surface | UI | State owner | SoT | Business purpose | Still valuable? | Separate user stage? |
| --- | --- | --- | --- | --- | --- | --- |
| Brief | Project Capture | `projects.stage=brief` | `projects.brief_text`, notes | Capture known intent | Yes | **Yes — Brief** |
| Analyse Job | Capture action | server extraction | Facts / suggested WAs / constraints | Carry complexity | Yes | **No** — service inside Brief |
| Work Areas | confirm_work_areas | project stage | `work_areas` | Confirm packages | Yes | **Merge into Job Plan** |
| Scope Review | overlay / ISD | disclosure, not DB stage | suggestions + decisions + manual items | Include/exclude items | Yes | **Merge into Job Plan** |
| Specification | `QualityBlock` | `quality` stage | `projects.quality_level` | Budget/standard/premium range | Yes as a **factor**, not the spec | **No** — not a full-page stage |
| Scope Details | `QuestionBlock` | `work_area_questions` | `project_facts` (questions are mirrors) | Collect WA facts | Yes internally | **No** — Clarify leftovers + EDIT_JOB |
| Project Conditions | constraints step | `constraints` stage | `constraints` | Access, carry, occupancy, waste, hours | Yes | **No** — Clarify |
| Estimate | generate + panel | `ready_to_estimate` / generate | estimates + lines + snapshot | Produce money | Yes | **Yes — Estimate** |
| Estimate Ready | `EstimateReadyCard` | `estimate_ready` | same money SoT | Show result, edit, price | Yes | **Yes — Estimate** until Builder Review exists |
| Pricing | downstream | pricing docs | pricing (RECOVERY-1) | Commercial edit | Yes | **Yes** |
| Quote | downstream | quotes | quote snapshot | Customer document | Yes | **Yes** |

Generate is gated to `ready_to_estimate`. Project Conditions can auto `saveConstraints([])` to unlock.

Estimate Ready headline uses **first Work Area only** — a multi-WA defect to fix in RECOVERY-4.

---

## 2. Overlapping question priority systems

Live, contradictory planners:

1. Deck `estimatePriorityClass` P0–P3 — `lib/scopes/estimate-priority.ts` + `lib/scopes/templates/deck.ts`
2. Template numeric `priority` (sort) — all WAs
3. `level1BlockingClass` HARD_MINIMUM | ASSUMABLE | REFINEMENT — `lib/scopes/level1-blocking.ts` (**P0 ≠ blocking**; demolition P0 is ASSUMABLE)
4. Hardcoded SCORE maps — `lib/assistant/level1-question-plan.ts` (Deck keys + PC)
5. Builder Interview registry P0–P3 + DOMAIN_ORDER — `lib/builder-interview/` (not the live Assistant path)
6. PC applicability required/assumable/optional — `lib/project-conditions/applicability.ts`
7. Legacy constraint-template numeric priority — `lib/assistant/constraint-templates.ts`

Docs vs code: DECK-2A said board width P0; live template is **P1**. Access/carry live in **PC**, not Scope Details.

Global budget ~3 Level 1 asks across Deck P0 + PC. Unclassified WAs (bathroom etc.) still dump all `required` questions and can exceed 3.

**Design (not implemented):** one planner overlay — see operating model `askClass` + `valueScore` + `blocksEstimate` + `assumable` + `scope`.

---

## 3. Deck Scope Details classification

| Fact | Class |
| --- | --- |
| `deck.area_m2` | **DERIVED** (P3) |
| `deck.length_m`, `deck.width_m` | **QUICK-ESTIMATE INPUT** / HARD_MINIMUM |
| `deck.height_m` | QUICK-ESTIMATE INPUT / ASSUMABLE |
| `deck.board_material` | QUICK-ESTIMATE INPUT / ASSUMABLE |
| `deck.existing_deck_removal` | QUICK-ESTIMATE INPUT / ASSUMABLE (scope toggle) |
| `deck.board_width_mm` | HIGH-VALUE if unknown; often brief-derived (P1) |
| `deck.level` | DERIVED from height when possible |
| `deck.substructure_included` | QUICK-ESTIMATE INPUT (Job Plan toggle) |
| `deck.access_type` | **Steps / stair-set from the deck** (HIGH-VALUE user-facing **Steps**, not site logistics) |
| pile replacement, substructure condition | REFINEMENT |
| joist/bearer/support/footing/consent | **ADVANCED** (P2) |

PC (`site_access`, carry, occupancy, waste, working hours): **HIGH-VALUE** project-wide; capture from brief; Clarify leftovers only. **Never Job Plan scope.**

`deck.access_type` is stairs/step-down **from the deck**. It does not duplicate `site_access`. Do not retire the Fact in RECOVERY-3. Do not show it as site access on Job Plan. Project as **Steps** when relevant.

Fascia / balustrade / handrail / pergola: user-facing scope. Surface only when included, explicitly excluded, or commercially meaningful and unresolved. Low-level decks must not invent a balustrade check.

---

## 4. Attention / assumptions today

Presentation-only `QuickEstimateAttentionKind` (QUESTION/SCOPE/PRICING_REQUIRED/ASSUMPTION/NON_ACTIONABLE) + `AttentionProductSeverity` (assumption/check/attention).

Blockers: stale estimate; critical assumed dimensions; `canGenerateQuickEstimate` false.

Fascia remapped to check → estimateReview (DECK-2B-R2). No general contradiction engine. BI assumptions engine exists but is **not persisted** in the live Assistant.

---

## 5. Estimating maturity (code)

14 calculators: deck, bathroom, retaining_wall, fence, pergola, kitchen, external_stairs, demolition, internal_walls, ceilings, doors, flooring, painting, plastering.

Bands: deck+bathroom `trial_supported`; retaining/fence/pergola/kitchen `developing`; rest `component`.

`LineItemCategory` has no plant/waste. Presentation groups by WA name + those categories.

---

## 6. SoT confirmation

| Domain | Table / module |
| --- | --- |
| Work Areas | `work_areas` |
| Facts | `project_facts` |
| Constraints | `constraints` |
| Scope catalogue | suggestions + decisions |
| User scope items | `work_area_scope_items` |
| Money | `estimates` + lines + snapshots |
| Sell authority | RECOVERY-1 `__quotr_meta__` / snapshot |

Job Plan / Clarify / EDIT_JOB must write these only.

---

## 7. Production / migration / deploy

None in this batch. Structural authority unchanged. DECK-3 not started. DECK-2C deferred to RECOVERY-5.
