# Quotr Internal Walls Estimating Architecture

**Status:** CANONICAL — **WA-INTERNAL-WALLS-02** wall type collection + job scope + geometry foundation  
**Date:** 2026-09-09  
**Branch:** `hardening/stage-2a-security`  
**Preview:** Supabase `shhpjsoldmqtkdbgrbtm`, migrations through **056**  
**Production:** DO NOT TOUCH  
**055:** RESERVED / DEFERRED for QDISP-SQL-055. Do not create.  
**Factory:** [QUOTR_WORK_AREA_FACTORY.md](./QUOTR_WORK_AREA_FACTORY.md)  
**Triage:** [WORK_AREA_EXPANSION_TRIAGE.md](../WORK_AREA_EXPANSION_TRIAGE.md)  
**Verifier (01 audit):** `scripts/verify-work-area-internal-walls-01.ts`  
**Verifier (02 foundation):** `scripts/verify-work-area-internal-walls-02.ts`

Canonical Work Area type: **`internal_walls`**. ISD alias: **`partitions`**.

Owner domain input after 01 **overrides** the 01 recommendation of one summed-length construction per Work Area. Canonical mature model: **one Internal Walls Work Area may contain one or more Wall Types**.

---

## 0. Verdict

| Gate | Result |
| --- | --- |
| WA-INTERNAL-WALLS-01 architecture / gap audit | **GO** (historical) |
| WA-INTERNAL-WALLS-02 wall types + job scope + geometry | **GO** |
| Current product maturity | **PARTIAL** — foundation exists; no timber/lining takeoff money |
| Customer UI band | **Component** — do not call Supported or Mature |
| Framing / lining money in 02 | **NO-GO** |
| Start WA-INTERNAL-WALLS-03 / Ceilings / Doors / Variations / RFQ | **NO-GO** |
| Production / migration 055 | **NO-GO** |

**Current factory score (honest):**

| Stage | Score |
| --- | --- |
| WA-0 Discovery | **Written** — owner override: multiple Wall Types in one WA |
| WA-1 Facts | **PARTIAL** — `job_scope`, `wall_types` JSON, structural gate. No openings takeoff |
| WA-2 Clarify | **PARTIAL** — progressive job scope → Wall Type fields; Refine adapter + cards |
| WA-3 Physical | **FAIL for money** — geometry derived; no stud/sheet quantities |
| WA-4 Requirements | **FAIL** — no envelope |
| WA-5 Commercial | **FAIL on mature path** — package $95/$145 not used when `job_scope` or `wall_types` present |
| WA-6 Conditions | **PARTIAL apply / FAIL consume** — Project Conditions reused, not consumed |
| WA-7 Review | **PARTIAL** — Job Plan wall-type count + summaries; no commercial Refine |
| WA-8 DNA | **N/A** |
| WA-9 Hosted close | **FAIL** — local verifier only in 02 |

Do not infer maturity from file or question count.

---

## 0A. WA-INTERNAL-WALLS-02 — owner decisions recorded

| Decision | Owner / 02 |
| --- | --- |
| Multiple Wall Types in one WA | **Canonical.** Not one summed length. |
| Storage | **`internal_walls.wall_types` JSON array** on existing `project_facts.value` (jsonb). No SQL migration. Logical `internal_walls.wall_type.*` keys patch the collection and are not persisted as sibling rows. |
| Stable ID | UUID per Wall Type (`crypto.randomUUID`). Duplicate/delete/reorder must not use array index as identity. |
| `job_scope` | `new_partition` / `extend_partition` / `reline_existing` / `infill_opening` / `form_opening` / `remove_partition` / `mixed` / `custom` |
| Height 2.4 m | **ASSUMED_DISCLOSED** when Not sure on ordinary residential partition. Copy: "Wall height assumed at 2.4 m." |
| Length | **HARD REQUIRED** for build/reline Wall Types. Missing → INFO_REQUIRED. Do not invent. |
| Stud centres | height ≤ 2.4 → recommended **600 mm**; height > 2.4 → recommended **400 mm**. Visible/editable. Builder may override 400 / 600 / custom. |
| Nogging (recorded only) | ≤2.4 → **2 rows**; >2.4 and ≤3.2 → **3 rows**; >3.2 → **4 rows**. No timber calc in 02. |
| Frame systems | `timber` / `steel` / `existing_frame` / `other`. Steel stores track-and-stud foundation. No takeoff. |
| Timber sizes | `90x45` / `140x45` / `other`. User copy: "90 mm timber framing — 90×45". |
| Lining | Side A and Side B independently. **02C:** "Same lining both sides?" is Yes/No. While Yes, Side B follows Side A. Switching to No keeps the copy, then independent. |
| Layers | 1 or 2 per face. |
| Products (foundation ids only) | Standard GIB, Aqualine, Fyreline, Braceline, Noiseline, Weatherline, Barrierline, Plywood, Fibre cement, Other. No invented rates. |
| Thickness / sheet length | **02C:** generic selectable 2400/2700/3000/3600/4800/6000 mm. Recommended = smallest generic length ≥ wall height. Never silent 2400 on a 3.0 m wall. Product availability not commercially validated until IW-05. Thickness edit persists; 13 mm remains plasterboard foundation default. |
| Silent 20 m² | **Killed on mature path** (`job_scope` or canonical `wall_types`). Legacy projects without those facts retain fallback. |
| Structural gate | Ask for form opening / remove / infill / mixed. Yes / Not sure → INFO_REQUIRED specialist. Do not ask for ordinary new partition. |
| Openings / skirting / electrical / DNA | Not implemented. Storage permits future `openings[]` on each Wall Type. |
| Project Conditions | Reuse canonical keys. No per-Wall-Type condition fields. |

### Chosen storage model

```
project_facts
  key = internal_walls.wall_types
  value = {
    v: 1,
    types: [
      {
        id, label,
        length_lm, height_m, height_source,
        frame_system, frame_size, steel,
        stud_centres_mm, stud_centres_source,
        same_lining_both_sides,
        side_a: { lined, material_family, product, thickness_mm, sheet_length_mm, layers },
        side_b: { ... },
        openings: []
      }
    ]
  }
```

Readers unwrap `{ v, types }` or a legacy bare array via `parseInternalWallsWallTypes`. `v` is persist revision only (CAS), not pricing authority.

Plus WA-level scalars: `internal_walls.job_scope`, `internal_walls.structural_involvement`, `internal_walls.active_wall_type_id` (UI selection).

**02C write rule:** one canonical mutator (`updateWallType` / `applyInternalWallsFactWrite`) patches by stable ID against the latest `wall_types` row. Persistence wraps `{ v, types }` and compare-and-swaps `value->>v` (legacy rows still CAS `updated_at` once while wrapping). Overlay stores logical field writes, applied onto latest base facts. Add/Duplicate send a client UUID so overlay and persist share the same id. A later product write must not reset layers or an explicit sheet-length override on that type.

Do **not** flatten `wall_1` / `wall_2` keys.

### Legacy boundary

- No historical fact mutation.
- Projects **without** `job_scope` and **without** canonical `wall_types` keep the legacy calculator, including silent 20 m².
- Dual-read: flat `length_lm` / `height_m` / `framing_type` / lining sides may appear as one synthetic legacy Wall Type for display. Synthetic id is `legacy:{workAreaId}` and is not persisted as a migrated type.
- Mature path never emits $95/$145 package money.

### UX

Progressive: What wall work? → framing → dimensions → Side A → same both sides? → clone. Do not ask "How many wall types?" Add / Duplicate / Delete on Refine cards. Optional builder label.

---

This document retains the **01 architecture / gap audit** below as historical current-state of the package calculator. 02 implements the foundation described in 0A. Do not start WA-INTERNAL-WALLS-03 from this phase.

Canonical Work Area type: **`internal_walls`**. ISD alias: **`partitions`**.

---

## 0B. 01 audit verdict (historical)

| Gate | Result |
| --- | --- |
| WA-INTERNAL-WALLS-01 architecture / gap audit | **GO** |
| Current product maturity | **PARTIAL / FALLBACK** (factory WA-0 written here; WA-3…WA-9 **not** closed) |
| Customer UI band | **Component** — do not call Supported or Mature |
| Implement mature calculator in 01 | **NO-GO** |
| Start Ceilings / Doors / Variations / RFQ | **NO-GO** |
| Production / migration 055 | **NO-GO** |
| Next | **WA-INTERNAL-WALLS-02** only after owner decisions in §67 |

**Current factory score (honest):**

| Stage | Score |
| --- | --- |
| WA-0 Discovery | **This document closes written discovery** |
| WA-1 Facts | **PARTIAL** — 13 asked keys + derived `area_m2`. Missing job scope, openings, load-bearing, layers, segments |
| WA-2 Clarify | **PARTIAL** — templates exist; no P0 class; no Refine adapter; no dedicated Clarify compose |
| WA-3 Physical | **FAIL** — package $/m², not takeoff |
| WA-4 Requirements | **FAIL** — no envelope |
| WA-5 Commercial | **PARTIAL pipeline / FAIL authority** — hardcoded `FITOUT_BENCHMARKS` |
| WA-6 Conditions | **PARTIAL apply / FAIL consume** |
| WA-7 Review | **FAIL** — generic Job Plan |
| WA-8 DNA | **N/A** — no consumed independent productivity |
| WA-9 Hosted close | **FAIL** |

Do not infer maturity from file or question count.

---

## 1. Proposed V1 domain boundary

### Belongs on Internal Walls (V1)

- New internal **non-load-bearing** partition walls
- Alter / extend / infill / form-opening / reline / remove of existing internal partitions when selected
- Timber framing takeoff (studs, plates, nogging, opening trimmers)
- Wall linings (one or both faces; single layer V1)
- Insulation in the partition cavity when selected
- Opening in wall geometry (count / width / height / type)
- Framing around openings (non-structural header/trimmers)
- Nested stopping and nested painting **only when selected and no sibling WA owns them**
- Nested demolition of the partition when selected and no standalone Demolition WA owns the same wall

### Does not belong (V1)

- Door leaf, jamb/frame supply, hardware, door installation → future **Doors**
- Standalone ceiling systems → **Ceilings**
- Bathroom wet-area nested walls / Aqualine wet walls / bathroom local nogging → **Bathroom**
- Load-bearing / structural wall engineering, beams, engineered lintels
- Specialist proprietary fire or acoustic **systems** (GIB system specs, sealant schedules, deflection tracks) as fake precision
- Light-gauge steel as a physical takeoff until catalogue identities exist (**DEFER** — allowance or Pricing Required only)
- Multi-layer / different-lining-each-side as a full system (V1: **custom / Pricing Required**)
- Skirtings as a mature identity (current allowance may remain nested P2)

### V1 in/out jobs

| In | Out |
| --- | --- |
| “Build a 3 m timber partition, GIB both sides” | “Supply and hang an internal door” |
| “Close in an old doorway” | “Bathroom wet-wall Aqualine” |
| “Form a new opening in a non-load-bearing wall” | “Fire-rated GIB system to spec, engineer signed” |
| “Line one side of an existing frame” | “Load-bearing wall removal” |
| “Remove a 3 m non-load-bearing partition” | “Ceiling batten and GIB ceiling” |

---

## 2. Current files

| Concern | Path |
| --- | --- |
| Catalogue | `lib/scopes/catalogue.ts` |
| Questions | `lib/scopes/templates/internal-walls.ts` |
| Registry / ISD alias | `lib/scopes/registry.ts` (`partitions` → `internal_walls`) |
| Fact aliases | `lib/scopes/fact-keys.ts`, `lib/scopes/fact-labels.ts` |
| Derived area | `lib/scopes/derived-facts.ts`, `lib/scopes/dimension-derivation.ts` |
| Conditionals | `lib/scopes/conditional-rules.ts`, `lib/scopes/questions.ts` |
| Calculator | `lib/estimate/calculators/fitout.ts` → `calculateInternalWalls` |
| Dispatch | `lib/estimate/calculate-estimate.ts` |
| Benchmarks | `lib/estimate/benchmark-rates.ts` `FITOUT_BENCHMARKS` |
| Sheet shadow | `lib/estimate/material-buildups.ts` `calculateSheetCount` |
| Sheet label | `lib/estimate/material-rate-keys.ts` |
| Rate aliases (unused by calc) | `lib/estimate/rates.ts` |
| Consumed-fact contracts | `lib/estimate/consumed-facts.ts` — **no `internal_walls`** |
| Support band | `lib/work-areas/support-contract.ts` — **component** |
| First-run | `lib/setup/first-run-work-areas.ts` — shown |
| Starter / legacy scope $ | `lib/setup/starter-rates.ts` `scope.internal_walls.m2` |
| Quote draft | `lib/work-areas/quote-description.ts` `buildInternalWallsDraft` |
| Analyse heuristic | `lib/ai/enrich-extraction.ts` `inferInternalWalls` |
| LLM prompt | `lib/ai/brief-extraction-prompt.ts` |
| Crossover | `lib/scopes/scope-crossover.ts` |
| Interview | `lib/builder-interview/registry.ts`, `fixtures/fitout.ts`, `domain-rules/triggers.ts` |
| Project Conditions | `lib/project-conditions/applicability.ts`, `canonical.ts` (`internal_walls.access` → `site_access`) |
| Constraint templates | `lib/assistant/constraint-templates.ts` |
| Site fallback | `lib/assistant/site-constraint-fallback.ts` |
| ISD relationships | `lib/scope-discovery/catalogue/relationships/commercial-fitout.ts` |
| ISD normalisation | `lib/scope-discovery/catalogue/normalisation.ts` |
| Scope impact | `lib/scope-discovery/scope-impact.ts` |
| Shared materials | `lib/rates/specific-material-catalogue.ts` |
| Bathroom XOR note | `lib/estimate/bathroom-framing.ts` |
| Job Plan | generic only (`lib/assistant/job-plan/adapters/registry.ts`) |
| Refine | **none** (`getRefineAdapter("internal_walls")` → `null`) |
| Clarify compose | **no dedicated Internal Walls candidates** |
| Company DNA | **none** |
| Tests (current-state, not maturity) | `scripts/verify-req-1-estimate-requirement-envelope.ts`, `verify-req-3-1-deck-labour-requirement.ts`, `verify-internal-ai-extraction.ts`, `verify-fact-coverage.ts`, `verify-buildup-dedupe.ts`, `verify-foundation-r2-scope-details-completeness.ts` |

---

## 3. Current fact inventory

| Key | Type | Source | Calculator | Requirement | Persistable | Class | Canonical V1? |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `internal_walls.length_lm` | number lm | question + Analyse | **YES** | no envelope | yes | **CONSUMED** | **YES** (total length) |
| `internal_walls.height_m` | number m | question + Analyse | **YES** | no | yes | **CONSUMED** | **YES** |
| `internal_walls.area_m2` | derived m² | derived / optional fact | **YES** (or silent 20) | no | derived | **CONSUMED / DERIVED** | lining face area, not framing authority |
| `internal_walls.framing_type` | enum | question + Analyse | **NO** | no | yes | **QUESTION ONLY** | map → `frame_system` |
| `internal_walls.wall_lining_type` | enum | question + Analyse | **YES** sheet *label* only | no | yes | **CONSUMED (label)** | **YES** lining family XOR |
| `internal_walls.plasterboard_type` | enum | question + LLM | **YES** sheet *label* only | no | yes | **CONSUMED (label)** | **YES** when plasterboard |
| `internal_walls.lining_sides` | enum | question + Analyse | **YES** sideFactor | no | yes | **CONSUMED** | **YES** |
| `internal_walls.fire_or_acoustic` | enum | question | **NO** | no | yes | **QUESTION ONLY** | keep; do not fake $ |
| `internal_walls.skirtings_included` | bool | question + Analyse | **YES** | no | yes | **CONSUMED** | P2 nested |
| `internal_walls.skirting_length_lm` | number lm | question | **YES** | no | yes | **CONSUMED** | P2 |
| `internal_walls.demolition_included` | bool | question | **YES** lump | no | yes | **CONSUMED** | replace with job_scope + demo labour |
| `internal_walls.stopping_included` | bool | question | **YES** allowance | no | yes | **CONSUMED** | nested XOR vs Plastering |
| `internal_walls.painting_included` | bool | question; forced false if Painting WA | **YES** allowance | no | yes | **CONSUMED** | nested XOR vs Painting |
| `internal_walls.insulation_included` | bool | question + Analyse | **YES** $/m² | no | yes | **CONSUMED** | **YES** as include flag |
| `internal_walls.access` | legacy PC | canonical map only | not IW calc | — | — | **LEGACY** | use `site_access` |
| `internal_walls.lining_type` | stale key | crossover only | no | — | — | **AMBIGUOUS / STALE** | alias of `wall_lining_type` |
| `scope.internal_walls.m2` | starter rate | onboarding | **NOT resolveRate’d** | — | rates | **LEGACY PACKAGE** | supersede |

No `job_scope`, openings, load-bearing, stud centres, layers, or wall-segment facts exist today.

---

## 4. Current question inventory

13 templates in `lib/scopes/templates/internal-walls.ts`. None have `estimatePriorityClass` or `level1BlockingClass`. Quick Estimate therefore treats **all** as askable; required keys block Level 1 via `required: true`.

| Copy | Fact | Pri | Shown | Calc uses? | QE / Refine | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| What is the total wall length? | `length_lm` | 10 | always | yes | QE required | Total lm, not segments |
| Is demolition/removal of existing wall included? | `demolition_included` | 15 | always | yes | QE optional | Between length and height |
| What is the wall height? | `height_m` | 20 | always | yes | QE required | No 2.4 disclosed default |
| What framing type is required? | `framing_type` | 30 | always | **no** | QE required **bloat** | Interview also DEFERs it |
| What wall lining is required? | `wall_lining_type` | 40 | always | label | QE required | |
| What plasterboard type is required? | `plasterboard_type` | 45 | if plasterboard | label | QE required | Hidden but `required: true` |
| One side or both sides? | `lining_sides` | 50 | always | yes | QE required | “Not sure” → one-side in calc |
| Is fire or acoustic rating required? | `fire_or_acoustic` | 52 | always | **no** | QE optional **bloat** | |
| Are skirtings included? | `skirtings_included` | 55 | always | yes | Refine | |
| Approximate skirting length? | `skirting_length_lm` | 56 | if skirtings yes | yes | Refine | |
| Is stopping/plastering included? | `stopping_included` | 57 | always | yes | Refine | Double-count vs Plastering WA |
| Is painting included? | `painting_included` | 58 | hide if Painting WA | yes | Refine | Crossover forces false |
| Is wall insulation included? | `insulation_included` | 60 | always | yes | Refine / P1 | |

**Bloat:** framing type and fire/acoustic are asked as if they change money. They do not. No job-scope, openings, or load-bearing questions. Refine adapter: **none** — answered facts cannot be edited on a dedicated surface.

---

## 5. Current calculator formulas

`calculateInternalWalls` in `lib/estimate/calculators/fitout.ts`.

```
sideFactor = lining_sides contains "both" ? 2 : 1
derivedArea = length_lm × height_m × sideFactor     // if both known
effectiveArea = area_m2 fact ?? derivedArea ?? 20    // SILENT 20 m²
```

| Line | Trigger | Quantity | Money |
| --- | --- | --- | --- |
| Existing wall removal | `demolition_included` | `length ?? 10` lm | `(removalPerM2 × 2)` cost 44 / sell 70 — labelled labour, **not** hours |
| Wall framing labour | **always** | `length ?? effectiveArea / (height ?? 2.4)` lm | generic carpenter × **0.8 h/lm hardcoded** |
| Internal wall lining labour | **always** | `effectiveArea` m² | generic carpenter × `internal_walls.labour_hours_per_m2` **fallback 1.4** (key not in `BENCHMARK_PRODUCTIVITY`) |
| Internal wall materials allowance | **always** | `effectiveArea` m² | **$95 / $145** `internalWallsPerM2` × quality |
| Sheet count | length+height+lining type | `ceil((area / 2.88) × (1+waste%))` | **metadata only** — does not own $ |
| Skirting | flag | `skirting_length_lm ?? length` + timber waste | $28 / $42 /lm |
| Wall insulation | flag | `effectiveArea` m² | $12 / $18 /m² |
| Stopping/plastering allowance | flag | `effectiveArea × $28 / $42` | subcontract allowance |
| Painting allowance | flag | `effectiveArea × $18 / $28` | allowance |

**Never priced:** openings, doors, studs, plates, nogging, steel vs timber XOR, fire/acoustic, lining layers, waste disposal requirement.

`resolveRate` is **not** called. Company `scope.internal_walls.m2` is unused.

---

## 6. Current requirement envelope

**None.** Return is `lineItems` + assumptions + missingInfo only.

`scripts/verify-req-3-1-deck-labour-requirement.ts` asserts `calculateInternalWalls(...).requirements == null`.

Mature path **must** emit Material / Labour / Subcontract / Waste requirements. Plant is N/A (document).

---

## 7. Current rate inventory

| Key / source | Class | Used by IW calc? |
| --- | --- | --- |
| `FITOUT_BENCHMARKS.internalWallsPerM2` 95/145 | **LEGACY PACKAGE** | **YES** |
| `FITOUT_BENCHMARKS.skirtingLm` 28/42 | PC / ALLOWANCE | yes if flag |
| `FITOUT_BENCHMARKS.insulationPerM2` 12/18 | PC / ALLOWANCE | yes if flag |
| `FITOUT_BENCHMARKS.stoppingPerM2` 28/42 | SUBCONTRACT allowance | yes if flag |
| `FITOUT_BENCHMARKS.paintingPerM2` 18/28 | SUBCONTRACT/ALLOWANCE | yes if flag |
| `FITOUT_BENCHMARKS.removalPerM2` × 2 | LEGACY PACKAGE (mis-labelled labour) | yes if demo |
| `FITOUT_BENCHMARKS.plasterboardSheet` 18/28 | SHARED PHYSICAL (catalogue planned) | **no $** — shadow label only |
| fyreline / aqualine / braceline / plywood sheet benchmarks | SHARED PHYSICAL | **no $** |
| `internal_walls.framing.lm` | declared alias, **UNUSED** | no |
| `sheet.plasterboard.standard.each` | SHARED PHYSICAL, planned | no money |
| `sheet.plasterboard.aqualine.each` | SHARED PHYSICAL, Bathroom used_now | no IW money |
| `timber.framing.90x45.h1.2.lm` | SHARED PHYSICAL, Bathroom used_now | **no IW money** |
| `scope.internal_walls.m2` | LEGACY PACKAGE starter | no |
| `internal_walls.labour_hours_per_m2` | PRODUCTIVITY string, **no benchmark row** | fallback 1.4 |
| Hardcoded 0.8 h/lm framing | PRODUCTIVITY (inline) | yes |
| `resolveLabourRate` (generic carpenter) | BUILDER LABOUR | yes |
| `demolition.wall.lm` | sibling Demolition WA | not IW calc |
| `bathroom.stopping.m2` | Bathroom-specific | **do not reuse as IW identity** |

---

## 8. Silent assumptions (must not remain mature authority)

| Behaviour | Rank |
| --- | --- |
| Silent **20 m²** if length/height missing | **P0** |
| Framing labour **always** emitted (including reline / existing frame / steel) | **P0** |
| Lining labour **always** emitted | **P0** |
| Package **$95/m²** independent of timber vs GIB vs steel | **P0** |
| `framing_type` asked, ignored | **P0** |
| “Not sure” lining sides → **one side** without disclosure | **P0** |
| Height fallback **2.4** only inside framing qty `area/height`, not disclosed as wall height | **P0** |
| Demo length fallback **10 lm** | **P1** |
| Sheet 2.4×1.2 shadow while money is $/m² | **P1** |
| Quality factor × package/allowances | **P1** |
| Fire/acoustic asked, $0 change | **P1** |
| Nested stopping + Plastering WA can both price | **P1** |
| Nested painting XOR only if Painting WA confirmed | **P1** |
| No opening deduction | **P1** |
| Doors WA silent **3 doors** if that sibling exists | **P1** (Doors, not IW) |
| `dimension-derivation` omits sideFactor vs calculator | **P2** |
| Crossover reads `lining_type` not `wall_lining_type` | **P2** |
| Interview DEFERs framing_type while template still requires it | **P2** |

---

## 9. Risk ranking (mature path)

**P0** — silent 20 m²; generic wall package; framing+lining always on; timber/steel/existing ignored; lining sides “Not sure” silently one-face; no load-bearing gate.

**P1** — openings absent (double-count vs Doors; lining not deducted); nested stop/paint vs siblings; fire/acoustic fake question; demo vs Demolition WA; sheet count not owning money; 2.4 height used as divisor without disclosure.

**P2** — skirting model; stale `lining_type`; interview defer mismatch; first-run UI showing Internal Walls next to Deck.

---

## 10. Canonical job scope

**No runtime enum exists today.** Do not create it in 01.

Recommended V1 enum `internal_walls.job_scope`:

| Value | Meaning |
| --- | --- |
| `new_partition` | New non-load-bearing wall |
| `extend_partition` | Lengthen existing |
| `reline_existing` | Existing frame; lining only |
| `infill_opening` | Close a doorway / opening |
| `form_opening` | New opening in existing non-LB partition |
| `remove_partition` | Strip existing partition |
| `mixed` | More than one of the above on the same WA |
| `custom` | Builder describes; Pricing Required / allowances |

Not recommended as V1 primary: `alter_existing` (too vague — split to reline / infill / form / mixed).

### Legacy mapping (when 02 implements)

| Current | Maps to |
| --- | --- |
| (none stored) | unknown → ask, or infer `new_partition` only if timber+both sides+no demo |
| `demolition_included=true` alone | at least `remove_partition` **or** mixed with new work — do not guess mixed |
| `framing_type=Existing frame` | `reline_existing` candidate |
| `framing_type=Steel stud` | still a **frame_system**, not a job_scope |

---

## 11. Geometry model

Primary facts:

- `internal_walls.length_lm` — total partition length (sum of segments in V1)
- `internal_walls.height_m` — wall height

Derived (calculator-owned, not asked):

```
gross_wall_face_area_m2 = length_lm × height_m
lining_face_area_m2 = gross_wall_face_area_m2 × lined_faces   // 1 or 2
```

Framing uses length, height, centres, openings — **not** lining m².

`internal_walls.area_m2` today **is lining-face area** (includes sideFactor). Keep that meaning or rename in 02; do not use it as framing quantity.

Floor area is **not** a wall-area proxy. Current calc does not use floor m² (good). Silent 20 m² is the defect.

---

## 12. Multiple wall segments (V1)

**01 recommended: one Internal Walls Work Area; `length_lm` = sum of segments.**

**OWNER OVERRIDE (02):** one Work Area may contain **one or more Wall Types** with independent framing, height, length, and lining. Same-construction lengths may still be summed *inside* one Wall Type. Different constructions are additional Wall Types, not additional Work Areas.

Example A 3.2 + B 1.8 + C 4.5 → `length_lm = 9.5` with optional note.

Do **not** ship a CAD wall graph in V1.

Do **not** ship a CAD wall graph in V1.

| Option | Speed | Accuracy | Questions | Edit |
| --- | --- | --- | --- | --- |
| One WA, total length | Fast | Good if same construction | Low | Edit the total |
| One WA per wall | Slow | Best if construction differs | High | Natural |
| Segments array | Medium | Good | High | Future |

If two constructions (e.g. one fire-rated wall + ordinary partitions), **two Work Areas** — not a segment array.

---

## 13. Wall height authority

Current: required question; if missing, area falls back to 20 m² rather than disclosed 2.4 m.

**Recommendation (not implementation):**

- KNOWN height preferred
- **ASSUMED_DISCLOSED 2.4 m** is acceptable Quotr V1 for standard residential internal partitions when the builder says Not sure **and** the job is ordinary housing
- Unusual (raked, 2.7/3.0 commercial, bulkhead) → **INFO_REQUIRED**
- Never silently invent height **and** still emit a confident package

Bathroom already uses disclosed 2.4 m wall height. Reuse the *policy*, not Bathroom keys.

---

## 14. Frame system

Current `internal_walls.framing_type`: Timber / Steel stud / Existing frame / Other / Not sure.

**Canonical V1:** keep values; prefer key `internal_walls.frame_system` as alias of `framing_type` (do not fork two live keys).

| Value | V1 money |
| --- | --- |
| Timber | Physical timber takeoff |
| Existing frame | No new framing labour/material; lining only |
| Steel stud | **DEFER physical** — Pricing Required or labelled allowance until identities exist |
| Other / Not sure | INFO_REQUIRED or Pricing Required |

Do not assume all Internal Walls are timber.

---

## 15. Timber framing model (architecture only)

Typical residential partition: **90×45 H1.2**.

Reuse `timber.framing.90x45.h1.2.lm` (Bathroom already consumes). **Do not** create `internal_walls.90x45.h1.2`.

Recommended formula architecture (02+; do not implement here):

```
stud_spacing_m = owner-approved centres (see §16)
stud_count = ceil(length_lm / stud_spacing_m) + 1     // include both ends
             + extra_end_studs_for_returns            // V1: 0 unless fact
             + opening_trimmer_studs                  // see openings

stud_lm = stud_count × height_m

bottom_plate_lm = length_lm
top_plate_lm    = length_lm          // V1 single top plate
plate_lm        = bottom_plate_lm + top_plate_lm

nogging_lm      = nogging_rows × length_lm     // or × stud bays; pick one in 03
opening_header_lm = sum(opening_width)         // non-structural packer/header

framing_purchase_lm = (stud_lm + plate_lm + nogging_lm + header_lm)
                      × (1 + timber_framing waste)
```

Do **not** use Bathroom `lm/m²` intensity as Internal Walls framing authority when wall length is known.

Double top plate: **not V1** unless load-bearing (which V1 does not price).

---

## 16. Stud centres — owner decision recorded in 02

**02 owner rule (implemented as recommended/default, visible and editable):**

- wall height ≤ 2.4 m → 600 mm
- wall height > 2.4 m → 400 mm
- builder may override 400 / 600 / custom

No stud quantity in 02.

Owner must choose before 03:

1. ASSUMED_DISCLOSED 600 mm for ordinary residential partitions, or
2. Ask every time (P0), or
3. 450 mm as standard.

Until then, 02 may capture `internal_walls.stud_centres_mm` without using it in money.

---

## 17. Plates

V1: **bottom + single top plate** = `2 × length_lm`.

Double top plate: out of V1 except documented custom.

---

## 18. Nogging

Different from Bathroom local fixture nogging.

Simplest defensible V1:

- If `height_m ≤ 2.4`: **one row** mid-height → `nogging_lm = length_lm` (or `stud_bays × spacing` equivalent)
- If `height_m > 2.4`: **two rows** or INFO_REQUIRED

Do not import Bathroom `0.2 h/lm` as partition nogging productivity.

---

## 19. Openings vs Doors

| Internal Walls owns | Doors owns (future) |
| --- | --- |
| Opening count, width, height, type (door / passage / other) | Door leaf |
| Lining deduction (V1 recommend **yes** if geometry known) | Jamb/frame supply if defined there |
| Extra trimmers + non-structural header | Hardware |
| Form opening / infill opening labour | Door installation |
| | Existing door removal lump (current Doors calc) |

Current IW: **no opening facts**. Current Doors: count default **3**, supply/install lump, optional removal, architraves `count × 5 lm`. Doors does **not** form the wall opening.

**Double-count risk:** IW package + Doors 3-door lump on the same job; IW framing labour with no opening extra while Doors charges install.

---

## 20. Door-opening lining deduction

**Recommend V1: deduct known opening face area from lining material** when width × height known.

```
lining_net_m2 = lining_face_area_m2 − Σ(opening_width × opening_height × faces_cut)
```

Unlike Bathroom (openings not deducted — disclosed), Internal Walls often has explicit doorway geometry. If opening size unknown: do **not** invent 810×1980; INFO_REQUIRED or no deduction with disclosure.

Stopping may still follow installed board area (joints around opening remain).

---

## 21. Opening framing (non-load-bearing only)

V1:

- Two extra studs (trimmers) per opening
- One header / lintel **packer** of opening width (not engineered lintel)
- Cripple/sill studs: optional P2; may omit in V1 if owner prefers simplicity

**Not V1:** structural lintel design, point loads, steel flitch.

---

## 22. Load-bearing / structural

Proposed fact: `internal_walls.structural_involvement` = no / yes / not sure.

| Answer | V1 |
| --- | --- |
| No | Ordinary partition path |
| Yes or not sure, and work is form/remove/infill | **INFO_REQUIRED** or specialist/engineer allowance labelled as such — **no invented structural $** |

Do not silently price structural alterations as 90×45 partitions.

---

## 23. Lining sides and layers

**Sides:** `one` | `both` | (custom later). **Do not assume both.** Not sure → INFO_REQUIRED or ASSUMED_DISCLOSED only with owner approval (this audit: prefer INFO_REQUIRED).

**Layers V1:** single layer ASSUMED_DISCLOSED when plasterboard. Double layer / different each side → `custom` / Pricing Required. Do not overcomplicate V1.

---

## 24. Plasterboard / shared identities

| Identity | Catalogue | Unit | Rate | Sheet size in description | Shared? | IW calc money? |
| --- | --- | --- | --- | --- | --- | --- |
| `sheet.plasterboard.standard.each` | yes, `work_area_type: internal_walls`, **planned** | each | default 18/28 | **2.4 × 1.2 m** (2.88 m²) | tagged IW | no |
| `sheet.plasterboard.aqualine.each` | yes, **used_now** Bathroom | each | 26/38 | same default sheet helper | **READY FOR REUSE** | no |
| `sheet.plasterboard.fyreline.each` | planned | each | 24/36 | not dimensioned beyond default helper | READY if fire is allowance | no |
| `sheet.plasterboard.braceline.each` | planned | each | 22/32 | ditto | READY if bracing is allowance | no |
| Noise control | **no identity** | — | — | — | **MISSING** | — |
| `sheet.plywood.each` | planned generic | each | 45/68 | unspecified | weak | no |
| `sheet.plywood.19mm.h3.2.each` | Bathroom floor | each | 145 | 2400×1200 | **NOT RELEVANT** to ordinary GIB walls | — |
| `sheet.fibre_cement.*` flooring/underlay | Bathroom floor | — | — | — | **NOT RELEVANT** as wall lining | — |

**3.0 m standard GIB sheets are not stored.** Helper `calculateSheetCount` defaults **2.4 × 1.2**. Owner must decide if V1 uses 2400×1200 or needs a **3.0 m** identity. Do not assume 3.0 m exists.

Aqualine on Internal Walls: only if wet-adjacent / specified. Bathroom wet walls stay Bathroom.

---

## 25. Sheet count model

Current shadow:

```
sheetArea = 2.4 × 1.2 = 2.88 m²
totalSheets = ceil(lining_area / 2.88 × (1 + sheet_material waste %))
```

Waste category `sheet_material` falls back to org default **10%** (`lib/settings/material-wastage.ts` `FALLBACK_DEFAULT_PERCENT = 10`). Bathroom lining uses the same 10% sheet waste convention.

**V1 recommend:** keep area / sheet-area / waste / ceil — simplest accurate model. Orientation/height-based sheet count is P2.

**10% plasterboard waste:** already canonical for `sheet_material` when unset. **Reuse** for Internal Walls; no new IW-specific waste percent. Company override still wins.

---

## 26. Steel framing

**DEFER physical calculator.** No steel stud / track identities in the specific-material catalogue.

V1: if `frame_system = Steel stud` → labelled **Pricing Required** or a single transparent allowance — not a half-baked stud-count.

---

## 27. Insulation

Current: boolean → `$12/18 per lining m²` (uses sideFactor area, so two-face walls double insulation — **wrong** for cavity).

Correct physical quantity: **cavity face ≈ gross wall face − openings**, not × lined faces.

No shared insulation identity. New identity required later; owner $ not invented here.

Propose `internal_walls.insulation` = none / acoustic / thermal. V1: include boolean + one allowance/identity later.

---

## 28. Fire / acoustic

Do **not** treat as finish multipliers.

V1: if Fire-rated / Acoustic / both → **Pricing Required / custom** unless a later owner-approved preset exists. Asking the question today without changing $ is deceptive — keep the fact, stop implying a priced system.

---

## 29. Stopping

Nested stopping quantity: **installed plasterboard lining area** (after opening deduction if V1 deducts).

`bathroom.stopping.m2` is Bathroom-specific. **No domain-neutral stopping key exists.** Internal Walls should get `internal_walls.stopping.m2` (or shared `stopping.plasterboard.m2` later) — **do not create in 01**. Bathroom XOR: if Plastering WA present, nested stopping off (Bathroom already does this pattern).

---

## 30. Painting

Optional nested. Quantity: **paintable lined face area**.

Do not paint unlined faces, wet-area tile (Bathroom), or when sibling **Painting** WA is confirmed (crossover already forces `painting_included=false`).

---

## 31. Demolition

Current: `length ?? 10` lm × $44/70, labelled labour, not hours.

V1: demolition labour **separate** from construction labour. Quantity: wall length and/or lined face area. Waste/disposal separate allowance.

**Do not copy Bathroom demolition component hours** (`bathroom.demolition.*`) as Internal Walls partition removal.

Standalone `demolition` WA also prices `demolition.wall.lm` (fallback 10 lm). **Document XOR:** partition-specific removal on IW; whole-house strip-out on Demolition WA; never both for the same wall.

---

## 32. Waste

| Stream | V1 |
| --- | --- |
| Plasterboard | 10% sheet_material (canonical fallback) |
| Timber | `timber_framing` wastage category (same helper) |
| Steel | N/A until steel exists |
| Demolition spoil | transparent disposal **allowance**, no fake density |

No WasteRequirement today.

---

## 33. Project Conditions

Reuse canonical keys only. IW is in `INTERIOR_TYPES` + `RENO_TYPES`.

Constraint templates today: `services_isolated`, `protection_dust_control`, `occupied_site`.

`SHARED_CONSUMED_CONSTRAINT_KEYS` (access, carry, occupied, hours) are **not read** by `calculateInternalWalls`. Mature labour should consume them the way Deck/Bathroom do. Do not create `internal_walls.access` (legacy map already points at `site_access`).

---

## 34. Recommended productivity tasks (no values)

Do not set hours in 01.

| Task | Proposed key | DNA |
| --- | --- | --- |
| Timber partition framing | `internal_walls.framing.timber.install.hours_per_lm` (or per stud) | **TIER 1** |
| Single-layer wall lining | `internal_walls.lining.install.hours_per_m2` | **TIER 1** |
| Insulation install | `internal_walls.insulation.install.hours_per_m2` | SECONDARY |
| Form / infill opening | `internal_walls.opening.form.hours_each` | SECONDARY |
| Partition demolition | `internal_walls.demolition.hours_per_lm` or per m² | SECONDARY |
| Steel framing | — | **DO NOT CALIBRATE** until physical |
| Double-layer lining | — | DO NOT CALIBRATE V1 |
| Stopping | subcontract, not DNA | **DO NOT CALIBRATE** |
| Current `internal_walls.labour_hours_per_m2` 1.4 | lump lining | **SUPERSEDE** |
| Current 0.8 h/lm framing | hardcoded | **SUPERSEDE** — do not treat as owner-approved |

Do not reuse Bathroom 0.3 h/m² wall lining or 0.2 h/lm local framing as Internal Walls defaults without owner approval.

---

## 35. Shared material reuse

| Material | Verdict |
| --- | --- |
| `timber.framing.90x45.h1.2.lm` | **READY FOR REUSE** |
| `sheet.plasterboard.aqualine.each` | **READY FOR REUSE** (wet-adjacent only) |
| `sheet.plasterboard.standard.each` | **READY** identity; money planned; confirm 2.4 vs 3.0 m with owner |
| `sheet.plasterboard.fyreline.each` / `braceline.each` | **READY** as identities; V1 fire/brace still Pricing Required |
| `sheet.plywood.19mm.h3.2.each` | **NOT RELEVANT** (floor) |
| `sheet.fibre_cement.*` flooring/underlay | **NOT RELEVANT** as partition lining |
| Steel studs / track | **MISSING CANONICAL IDENTITY** |
| Wall insulation | **MISSING CANONICAL IDENTITY** |
| Noise-control board | **MISSING CANONICAL IDENTITY** |
| Fixings | typically labour-bundled; **no new identity in 01** |

### Materials page contract

**Forbidden:** `internal_walls.90x45.h1.2`, `internal_walls.standard_gib`, `internal_walls.aqualine` as physical rate rows.

Requirement keys may be `internal_walls.framing`, `internal_walls.lining`, etc. Physical `item_key`s stay shared `timber.*` / `sheet.*`.

---

## 36. Commercial model (target)

```
material: physical qty × resolved shared material rate
labour:   physical qty × task productivity × carpenter rate
subcontract: qty × stopping/painting rate or explicit allowance
waste:    sheet/timber waste once; demo disposal allowance
sell:     existing commercial engine
```

No Internal-Walls-specific sell math. Missing rate → Pricing Required, **not** revert to $95/m² package.

---

## 37. Fallback / package inventory (supersede on mature path)

| Location | What | Mature fate |
| --- | --- | --- |
| `FITOUT_BENCHMARKS.internalWallsPerM2` | $95/145 /m² | **SUPERSEDE** |
| `recordDefaultedNumber` 20 m² | silent quantity | **SUPERSEDE** |
| `scope.internal_walls.m2` starter | legacy overall $/m² | **SUPERSEDE** as money authority |
| Hardcoded 0.8 h/lm + 1.4 h/m² | lump labour | **SUPERSEDE** with task keys |
| Demo `removalPerM2 * 2` on lm | unit mismatch | **SUPERSEDE** |
| Quality × package | inflates physical-looking $ | **SUPERSEDE** on construction lines |
| Sheet build-up on package line | fake precision | Keep takeoff; drop package |

---

## 38. Partial-scope fixtures (do not implement)

| ID | Job | V1 intent |
| --- | --- | --- |
| A | NEW WALL 3.0×2.4, 90×45, two-sided standard GIB | Full framing + lining |
| B | ONE-SIDE RELINE existing frame 3.0×2.4 | No framing material; lining × 1 |
| C | INFILL OPENING | Local framing + lining; not a full new wall |
| D | FORM OPENING non-LB | Opening framing; lining deduction; no door leaf |
| E | REMOVE WALL 3.0×2.4 non-LB | Demo labour + waste; no new GIB |
| F | NEW WALL + DOOR OPENING | Partition + framed opening; Doors sibling owns leaf |

---

## 39. Proposed requirement groups (Review)

Framing · Linings · Insulation · Openings · Builder labour · Stopping · Painting · Demolition · Waste.

Builder-readable labels only. No `PACKAGE_FALLBACK` / component keys in UI.

---

## 40. Question strategy (progressive)

1. Job scope  
2. Structural involvement (gate)  
3. Geometry (length, height)  
4. Frame system (if building/framing)  
5. Openings (if not remove-only)  
6. Lining sides / type / plasterboard grade  
7. Insulation  
8. Nested stopping / painting if no sibling  
9. Demolition if alteration/remove  
10. Project Conditions (shared)

Do not front-load fire-system, steel gauges, or skirting.

---

## 41. Proposed P0 / P1 / P2 fact matrix

| Fact | Class |
| --- | --- |
| `job_scope` | **P0 HARD** |
| `structural_involvement` | **P0 HARD** when form/remove/infill; else P1 |
| `length_lm` | **P0 HARD** |
| `height_m` | **P0 ASSUMABLE** (disclosed 2.4 residential) |
| `frame_system` | **P0 HARD** if scope includes framing; skip if reline/remove |
| `lining_sides` | **P0 HARD** if lining in scope |
| `wall_lining_type` | **P0 ASSUMABLE** plasterboard on new/reline |
| Opening count/size | **P0 ASSUMABLE** none if new wall without doors; **P0 HARD** if form/infill |
| `stud_centres_mm` | **P0 ASSUMABLE** only after owner default; else P1 ask |
| `plasterboard_type` | **P1** (standard assumed disclosed) |
| `insulation_included` | **P1** |
| `stopping_included` / `painting_included` | **P1** nested |
| `demolition_included` | derived from job_scope or **P1** |
| `fire_or_acoustic` | **P1** → Pricing Required, not money formula |
| Skirtings | **P2** |
| `area_m2` | **LEGACY / DERIVED** |
| `scope.internal_walls.m2` | **LEGACY** |

Ready depends on P0 HARD (+ structural gate). Do not block Ready on skirting or fire-system SKU.

---

## 42. Assumption policy

| Fact | Policy |
| --- | --- |
| Height 2.4 m | ASSUMED_DISCLOSED if Not sure + residential |
| Stud centres | **Owner decision** before assuming |
| Sheet 2.4×1.2 | ASSUMED_DISCLOSED until 3.0 m identity exists |
| Lining both sides | **Do not assume** |
| Frame timber | **Do not assume** if unanswered |
| Single layer | ASSUMED_DISCLOSED for plasterboard V1 |
| No openings | ASSUMED_DISCLOSED on new_partition unless brief mentions a door |
| Fire none | ASSUMED_DISCLOSED if unanswered |

Conservative: missing length → **INFO_REQUIRED**, never 20 m².

---

## 43. Builder Review target

```
INTERNAL WALL
Wall: 3.0 m × 2.4 m
Scope: New partition
Framing: 90×45 H1.2 timber · {centres} · {n} studs · plates · nogging
Lining: Both sides · 13 mm standard GIB · net m² · {n} sheets
Labour: Framing {h} · Lining {h}
Opening: 1 × {w} door opening (no door leaf)
Finishing: Stopping / painting if selected
Assumptions: listed
Source: company vs Quotr benchmark
```

No internal keys.

---

## 44. Overlap contracts (document only — no XOR implementation in 01)

### Bathroom

Bathroom owns nested wet-area walls, Aqualine, local nogging. **Complete partitions → Internal Walls.**  
Fact `bathroom.partition_by_internal_walls` is documented in Bathroom architecture as later. **No runtime XOR today.**  
01 contract: if both confirmed, Bathroom must not emit full partition; IW must not emit bathroom wet walls. Implement XOR in a later phase, not 01.

### Ceilings

IW = vertical partitions. Ceilings = horizontal systems. Bulkheads / deflection tracks **out of V1**. Wall head is a plate, not a ceiling.

### Doors

See §19–21. Doors current calc does not form openings. Risk is parallel lumps, not shared opening takeoff.

### Painting / Plastering

Nested flags are allowances. Painting WA already suppresses IW painting question. Plastering may still double-count stopping — **document; do not mature those siblings here**.

### Demolition

IW owns partition-specific removal. Standalone Demolition owns `demolition.wall.lm` / scope_items. Same wall must not be priced twice. Implement later.

---

## 45. Gap tables

### Materials

| Physical | Existing key | Rate? | Unit | Shared? | New identity? | Owner decision? |
| --- | --- | --- | --- | --- | --- | --- |
| 90×45 H1.2 | `timber.framing.90x45.h1.2.lm` | $6.20/lm benchmark | lm | yes | no | no |
| Standard GIB 13 mm | `sheet.plasterboard.standard.each` | planned 18/28 | each | tagged IW | maybe **3.0 m** variant | **YES — sheet length** |
| Aqualine | `sheet.plasterboard.aqualine.each` | 26/38 used_now | each | yes | no | wet-use only |
| Fyreline | `sheet.plasterboard.fyreline.each` | planned 24/36 | each | yes | no | fire = PR |
| Steel studs/track | none | — | — | — | **YES if steel V1** | **DEFER steel** |
| Insulation | none | hardcoded 12/18 | m² | — | **YES later** | $ later |
| Fixings | none | bundled | — | — | no in 01 | no |

### Productivity

| Task | Current key | Benchmark | Consumed? | Suitable? | New key? | Owner benchmark? | DNA? |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Lining lump | `internal_walls.labour_hours_per_m2` | **1.4 fallback only** | yes | no | yes | **YES** | Tier 1 later |
| Framing lump | inline 0.8 h/lm | **not in table** | yes | no | yes | **YES** | Tier 1 later |
| Bathroom wall lining | `bathroom.lining.wall.install.hours_per_m2` | 0.3 | Bathroom | **do not copy** | IW-specific | **YES** | — |
| Bathroom local framing | `bathroom.framing.install.hours_per_lm` | 0.2 | Bathroom | **do not copy** | IW-specific | **YES** | — |

**No invented Internal Walls productivity numbers in this audit.**

### Commercial rates

| Item | Current | Gap |
| --- | --- | --- |
| Stopping | hardcoded 28/42 /m² | need IW or shared stopping key; **no new $ in 01** |
| Painting nested | hardcoded 18/28 | XOR vs Painting WA `painting.m2` |
| Demo/waste | removalPerM2×2 on lm | replace; disposal allowance TBD |
| Steel | none | Pricing Required |
| Insulation | 12/18 /m² | identity + owner $ later |
| Fire system | none | Pricing Required |

---

## 46. Migrations

**None for 01.** Preview stays **056**. Do not create **055**.

Future implementation may need a **data-only** catalogue seed (DNA and/or material rows) **after** identities are approved — same pattern as Bathroom 056. Do not invent it now. Production untouched.

---

## 47. Implementation phases (after owner decisions)

| Phase | Name | Does |
| --- | --- | --- |
| **01** | Architecture + gap audit | This document + verifier |
| **02** | Job scope + Wall Types + geometry | **Closed (data/UX foundation).** Nested CRUD hosted close is **02C**. |
| **02C** | Nested Wall Type persist + sheet length UX | Canonical `updateWallType` by stable ID; `{ v, types }` CAS; logical overlay rows keyed by Wall Type id; Yes/No same-both-sides; selectable sheet length with height recommendation |
| **03** | Timber framing + lining sheets + envelope | Shared timber + GIB identities; requirements; XOR timber vs existing frame |
| **04** | Openings + structural gate | Deduct lining; trimmers; INFO_REQUIRED if load-bearing |
| **05** | Insulation + nested finishing XOR | Cavity area; stop/paint vs siblings |
| **06** | Demolition + waste + Review | Separate demo labour; disposal allowance; builder copy |
| **07** | Commercial close | Remove $95/m² package from mature path |
| **08** | DNA | Only if 03 productivity keys are consumed |
| **09** | Hosted close | Deterministic + Preview proof |

Do not start 03 in this phase.

---

## 48. Owner decisions required BEFORE WA-INTERNAL-WALLS-02

Historical 01 list. **02 recorded** items 1, 2, 7, 8, 9 in §0A. Remaining items are for **WA-INTERNAL-WALLS-03** (takeoff), not a second 02.

1. Stud centres: 600 ASSUMED_DISCLOSED vs always ask vs 450. **02: recommended 600 ≤2.4 m / 400 >2.4 m, visible/editable.**  
2. Confirm 2.4 m height as residential ASSUMED_DISCLOSED. **02: yes.**  
3. Standard GIB sheet: keep **2400×1200** vs add **3000** identity.  
4. Confirm 10% `sheet_material` waste for IW GIB.  
5. Steel V1: Pricing Required vs out of scope.  
6. Opening lining deduction: yes (recommended) vs Bathroom-style no-deduct disclose.  
7. One WA total length vs per-wall WAs. **02 owner override: multiple Wall Types in one WA.**  
8. Job-scope enum as in §10. **02: implemented.**  
9. Load-bearing yes/unknown → INFO_REQUIRED (recommended). **02: structural gate foundation.**  
10. Lining “Not sure” → INFO_REQUIRED vs disclosed one/both.  
11. Nested stopping/painting remain allowances until siblings mature (recommended).  
12. Do **not** copy Bathroom lining 0.3 h/m² or framing 0.2 h/lm without a new owner benchmark.

---

## 49. What is trustworthy vs fallback vs supersede

| Trustworthy | Fallback / placeholder | Must supersede |
| --- | --- | --- |
| Catalogue type `internal_walls` | $95/m² package | Silent 20 m² |
| Length × height geometry when both known | 1.4 h/m² lining | Always-on framing+lining labour |
| Lining sideFactor when “both” | 0.8 h/lm framing | Ignoring `framing_type` |
| Shared timber + GIB identities (Bathroom-proven timber) | Sheet count shadow | Quality × construction package |
| Painting WA XOR on nested paint | Nested stop/paint $ | Fire question as priced system |
| Project Conditions applicability | Demo 10 lm | Floor-area-as-wall (not current — keep forbidden) |

---

## 50. WA-INTERNAL-WALLS-01 GO criteria

- Current-state inventory complete  
- V1 boundary written  
- Risks ranked  
- Owner decisions listed  
- Verifier asserts current-state claims  
- No product money/question/DNA change  
- No migration 055 / Production  

**GO.** Next action is owner decisions, then WA-INTERNAL-WALLS-02 — not started here.
