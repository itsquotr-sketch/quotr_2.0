# Stage 3.1B.7F-R6 — Multi-Work-Area Question Coverage Audit

**Status:** Complete — Local (Owner Fitout retest Pending)  
**Date:** 2026-08-10  
**Branch:** `hardening/stage-2a-security`  
**Verify:** `scripts/verify-stage-3-1b7fr6-multi-work-area-data-collection.ts`  
**Completion:** `docs/implementation/STAGE_3_1B7FR6_MULTI_WORK_AREA_DATA_COLLECTION_COMPLETION.md`

This audit is **common multi-WA architecture**, not a Commercial Fitout-only workflow.

---

## CORE BASELINE SCOPE ITEMS (principle)

| Layer | Meaning |
| --- | --- |
| **CORE** | Concise deterministic components that normally define a confirmed Work Area (framing, lining, door leaf/hardware, floor finish, paint prep/coats, plaster stopping). |
| **DEPENDENCIES** | Cross-trade / interface items (services coordination, seismic, fire stopping, make-good). |
| **PROJECT-WIDE** | Shared logistics / waste / access — one answer feeds all consumers. |
| **Not** | Clarification-only fluff, optional adjacent scope, or a new Work Area per component. |

CORE items emit as restrained catalogue relationships (`MUST_CONSIDER` / `LIKELY`). Explicit Facts / exclusions suppress. User decision remains authoritative. `UNKNOWN != false`.

---

## Per-Work-Area catalogue coverage (Fitout set)

### Demolition / strip-out

| Aspect | Finding |
| --- | --- |
| Existing relationships | Waste (project-wide), make-good, fire stopping, strip-out handling |
| CORE added (R6) | `fitout.demolition.handling` — strip-out / loading handling |
| Dependencies | Waste remains project-wide (not duplicated under every WA) |
| Hazmat | **Condition** via `demolition.hazardous_materials_risk` (not a scope item) |
| Questions | Area / wall / floor / ceiling removal; disposal; access; carting; noise; salvage; hazmat |
| Dedupe | Access / carting / noise suppressed when project Site Constraints answer them; disposal suppressed when waste_removal WA or known waste Fact |
| Calculators | Demolition calculator consumes area + access/labour factors |

### Internal walls (partitions)

| Aspect | Finding |
| --- | --- |
| Existing | Services coordination; doors adjacency; project linings (suppressed when partitions accepted) |
| CORE added | `fitout.partitions.framing`, `fitout.partitions.wall_linings` |
| Questions (required) | length, height, framing type, wall lining, plasterboard type, lining sides (+ optionals) |
| Attention keys | Plasterboard type, Lining sides — **mapped questions exist** |
| Calculators | Internal walls / lining area derivation (`lm × height`) |

### Ceilings

| Aspect | Finding |
| --- | --- |
| Existing | Services; seismic |
| CORE added | `fitout.ceilings.system`, `fitout.ceilings.trims` |
| Questions | area_m2, structure, ceiling type, plasterboard type, … |
| Attention | Ceiling area — **mapped** |

### Doors

| Aspect | Finding |
| --- | --- |
| CORE added | `fitout.doors.hardware`, `fitout.doors.frames` |
| Questions | count, prehung, supply_scope, type, … |
| Attention | Number of doors, Pre-hung, Supply scope — **mapped** |

### Flooring

| Aspect | Finding |
| --- | --- |
| CORE added | `fitout.flooring.prep`, `fitout.flooring.finish` |
| Questions | area_m2, type, removal, supply_scope, … |
| Attention | Flooring area — **mapped** |

### Painting

| Aspect | Finding |
| --- | --- |
| CORE added | `fitout.painting.prep`, `fitout.painting.finish_coats` |
| Questions | location, areas, coats, surfaces, … |
| Attention | Painting location, Number of coats — **mapped** (coats may be important/assumable) |

### Plastering (canonical catalogue id: `linings`)

| Aspect | Finding |
| --- | --- |
| CORE added | `fitout.plastering.stopping`, `fitout.plastering.sanding` |
| Questions | area_m2, level, surface type, … |
| Attention | Plastering area, Plastering level — **mapped** |

---

## Attention key → question map (Owner Preview list)

| Attention label | Fact key | Question? | WA / group | Classification |
| --- | --- | --- | --- | --- |
| Plasterboard type | `internal_walls.plasterboard_type` | Yes | Internal walls / Construction | REQUIRED TO ESTIMATE |
| Lining sides | `internal_walls.lining_sides` | Yes | Internal walls / Construction | IMPORTANT BUT ASSUMABLE (both sides common) — still asked when lining included |
| Ceiling area | `ceilings.area_m2` | Yes | Ceilings / Measurements | REQUIRED TO ESTIMATE |
| Number of doors | `doors.count` | Yes | Doors / Measurements | REQUIRED TO ESTIMATE |
| Pre-hung doors | `doors.prehung` | Yes | Doors / Construction | REQUIRED TO ESTIMATE |
| Supply scope | `doors.supply_scope` | Yes | Doors / Construction | REQUIRED TO ESTIMATE |
| Flooring area | `flooring.area_m2` | Yes | Flooring / Measurements | REQUIRED TO ESTIMATE |
| Painting location | `painting.location` | Yes | Painting / Scope | REQUIRED TO ESTIMATE |
| Number of coats | `painting.coats` (or equivalent) | Yes if template present | Painting / Scope | IMPORTANT BUT ASSUMABLE |
| Plastering area | `plastering.area_m2` | Yes | Plastering / Measurements | REQUIRED TO ESTIMATE |
| Plastering level | `plastering.level` | Yes | Plastering / Scope | IMPORTANT BUT ASSUMABLE (Level 4 common) |

If an attention row has **no** mapped question and **no** active editors: UI shows **More information required** without a Review button (no fake action).

---

## Question progression (R6 model)

- All currently-applicable **required** unanswered questions appear together (hard `MAX_QUESTIONS = 12` removed).
- Soft cap only on excess **optional** questions (`MAX_OPTIONAL_QUESTIONS_SOFT = 40`).
- Conditional children still gated by existing `shouldHideConditionalQuestion` / scope-item exclusion.
- Multi-WA Scope Summary: incomplete WAs expand by default; completed may collapse.

---

## Fact-first / project-wide dedupe

| Project knowledge | Suppresses |
| --- | --- |
| `site_access` (non-easy / known) | `*.access` WA questions |
| `material_carry_distance` (meaningful) | demolition carting / skip-bin questions |
| `working_hours` (restricted) | demolition noise/hours question |
| Confirmed `waste_removal` WA or known waste Fact | `demolition.disposal_included` |
| `site_occupied` | WA occupied duplicates |

---

## Estimate readiness classes

| Class | Behaviour |
| --- | --- |
| REQUIRED TO ESTIMATE | Named attention; Review when mapped; estimate may still run with assumptions but readiness is honest |
| IMPORTANT BUT ASSUMABLE | Attention allowed; visible assumption if defaulted later |
| PRICING-ONLY | Quick Estimate may proceed; Final Pricing needs resolution |
| OPTIONAL DETAIL | Must not alarm as High attention |

R6 does **not** invent commercial defaults solely to shrink the form. Visible assumptions remain labelled when used.

---

## Hazmat semantics

| Option | Meaning |
| --- | --- |
| No known hazardous material risk | Explicit No |
| Possible asbestos / lead / mould | Possible risk |
| Not sure | Unknown (distinct from No) |

Removed ambiguous **None known**.
