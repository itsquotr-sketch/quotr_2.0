# Quotr Work Area Assistant Contract

**Classification:** CANONICAL — Work Area ports for the generic Assistant  
**Status:** COMPLETE / OWNER ASSISTANT ARCHITECTURE VALIDATED  
**Date:** 2026-08-19  
**HEAD:** `2b4055c316c404dcf3cc183dad47c9408c3634e4`  
**Mode:** Architecture locked. RECOVERY-3 implements Deck-first Job Plan adapters; no mega-interface.  
**Operating model:** `docs/architecture/QUOTR_ASSISTANT_OPERATING_MODEL.md`  
**Presentation:** `docs/architecture/QUOTR_ESTIMATE_PRESENTATION_CONTRACT.md`  
**Capability bands (keep):** `docs/architecture/QUOTR_SUPPORTED_WORK_AREA_CONTRACT.md`

---

## 1. Work Area remains the domain parent

Internally a Work Area continues to determine:

- calculator
- scope model
- questions
- materials
- labour
- allowances
- attention rules
- quote grouping

Do **not** flatten all project scope into one generic list.

`commercial_fitout` remains an ISD **parent label only**. It has no calculator and must never migrate as an estimatable Work Area.

---

## 2. Prefer composable ports, not one mega-interface

Current architecture already splits:

| Existing module | Role |
| --- | --- |
| `lib/scopes/templates/*` + `ScopeDefinition` | questions, labels, fact keys |
| `lib/scopes/catalogue.ts` | creatable types |
| `lib/work-areas/support-contract.ts` | capability band |
| `lib/calculators/*` | money / quantities |
| `lib/work-areas/scope-items/*` | user INCLUDE/EXCLUDE |
| `lib/scope-discovery/*` | catalogue suggestions + decisions |
| `lib/project-conditions/*` | project constraints |
| `lib/estimate/requirements*` | takeoff emission (Deck-first) |
| `lib/estimate/presentation-breakdown.ts` | display groups by WA name |
| `lib/assistant/current-work-area-scope-state.ts` | composed Job Plan **read model** |

**Recommendation:** add thin **projection adapters** per Work Area as they migrate. Do not invent `IWorkAreaAssistant` with every method required on day one.

Minimum shared **identity**:

| Port | Required now | Notes |
| --- | --- | --- |
| Identity | yes | `type`, `label`, `work_areas.id` |
| Display metadata | yes | name, sort_order, capability band |
| Scope items projection | yes for Job Plan | compose existing SoT |
| Quick specification projection | yes for Job Plan | Facts, not a spec table |
| Question candidates | yes for Clarify | template + blocking class |
| Calculator | yes if `estimatableAsWorkArea` | existing calculator registry |
| Estimate line projection | yes for Builder Review later | presentation contract |
| Assumptions | yes after generate | estimate metadata |
| Attention rules | optional | Deck has some; others may be empty |
| Condition dependencies | optional | PC applicability already exists |
| Material / labour / allowance / quote projection | as maturity allows | empty buckets are valid |

---

## 3. Scope item contract (project, do not duplicate)

There is **no Job Plan table**. Compose:

| Source | Meaning |
| --- | --- |
| `work_areas.status` | suggested / confirmed / excluded (whole WA) |
| `scope_discovery_suggestions` + decisions ACCEPT/REJECT/MODIFY | catalogue items |
| `work_area_scope_items` + INCLUDE/EXCLUDE (`origin=user`) | builder-added items |
| Facts (`project_facts`) | boolean/select scope signals (`deck.substructure_included`, `painting.surfaces`, …) |

Legacy compose (`CurrentScopeItem`) uses `INCLUDED` \| `NOT_REQUIRED`. **Job Plan must not treat absence as `NOT_REQUIRED`.** Use a dedicated projection with presentation states below.

### Target Job Plan states (presentation — Owner lock)

| Presentation | Persist how |
| --- | --- |
| **INCLUDED** | INCLUDE / true Fact / confirmed WA / deterministic rule (e.g. Decking while a Deck WA exists) |
| **NOT_INCLUDED** | EXCLUDE / false Fact / excluded WA — **only** after explicit user decision, authoritative Fact, or deterministic rule |
| **NOT_CONFIRMED** | missing Fact, `"Not sure"`, unresolved discovery. **Never persist as `NOT_REQUIRED`.** |
| **Attention if contradictory** | e.g. elevated + balustrade no — existing attention, not a new scope enum |
| **Source / provenance** | keep `origin` system/user + Fact `source` |

```
ABSENT FROM BRIEF  ≠  NOT_REQUIRED
```

Job Plan **projects** this truth. Explicit include/exclude writes canonical actions, then recomposes. Unresolved writes nothing.

### User-facing scope vs estimate components

Deck Job Plan may toggle: Decking, new substructure, existing removal, fascia, steps, balustrade (when evidence warrants).

Deck Job Plan must **not** toggle: joists, bearers, rim, concrete, fixings, surface lm line, pile counts as takeoff lines.

Piles mentioned in a brief support **new substructure included**, not a separate estimate-component checklist.

---

## 4. Specification contract

Per Work Area, classify Facts into:

- **Quick specification** — needed to understand the job immediately
- **Advanced specification** — refinement after first estimate

Deck examples (not global rules):

| Quick | Advanced |
| --- | --- |
| decking material | grade / treatment / KD-green (not even in template yet) |
| board/profile (width if known) | joist/bearer section, centres, direction |
| height / low vs elevated | footings, support type/count |
| new framing included | pile replacement counts |

Bathroom examples (current facts only):

| Quick | Advanced |
| --- | --- |
| area, renovation type | fixture SKU-level (unsupported) |
| demolition included | waterproofing detail beyond current allowance |
| finish level | — |

Painting: location + surfaces + area = quick. Coats/primer = quick if unknown. Substrate prep = advanced.

Doors: count + supply/install + type = quick. Hardware spec = advanced (not modelled).

---

## 5. Estimating maturity (code evidence, not roadmap labels)

Capability bands (`trial_supported` / `developing` / `component`) are **product claims**. Assistant maturity is **how the calculator actually prices**.

| Class | Work Areas | What first estimate looks like |
| --- | --- | --- |
| **Hybrid takeoff** | `deck` | surface lm REQUIREMENT_AUTHORITATIVE; labour SHADOW; structure still `deck.substructure.m2` LEGACY package; children SHADOW |
| **Package / subcontract** | `bathroom`, `kitchen` | labour + subcontract/allowance heavy; many bathroom facts exist; kitchen facts often unconsumed |
| **Productivity + package** | `retaining_wall`, `fence`, `pergola` | area/lm × productivity; packages for materials |
| **Area / productivity** | `painting`, `internal_walls`, `flooring`, `ceilings` | m² driven |
| **Count / EA** | `doors` | count lumps; no labour model |
| **Strip / allowance** | `demolition`, `plastering` | plastering may double-count with other WAs — honesty required |

The shared UX must **not** require identical calculation architecture. Job Plan and Clarify are the same shells; projection adapters differ.

**Hybrid principle (locked):** detailed physical takeoff where it improves accuracy, user value, and commercial visibility. Allowances/packages remain valid for minor, variable, low-value, or still-maturing scope. **Physical modelling is not a prerequisite** for Assistant UX migration.

---

## 6. LABOUR-CREW-01 (future, shared labour domain)

Distinguish:

| Concept | Meaning | Example |
| --- | --- | --- |
| **LABOUR EFFORT** | crew labour-hours | 12 h |
| **CREW SIZE** | concurrent workers | 2 |
| **ELAPSED DURATION** | task time | 6 h |

`2 workers × 6 hours elapsed = 12 labour-hours`.

**Belongs in:** labour-domain / `LabourRequirement` architecture (`docs/architecture/QUOTR_ESTIMATING_ENGINE_ARCHITECTURE.md`), **not** Job Plan, **not** DECK-3 as a secret new store.

Presentation later: Builder Review Labour section may show effort vs duration when the domain emits both. Until then, existing `labourHours` on lines remains effort-shaped.

No implementation in RECOVERY-2–5.

---

## 7. Condition dependencies

Work Areas may declare which **project** conditions they care about (access, carry, occupancy). The PC applicability layer already does this. Job Plan does not re-ask them. Clarify ranks leftover PC with WA questions.

Local site geometry stays Facts (`deck.access_type` = stairs/step-down from the deck, fence slope). **Not** `site_access` / carry / waste / occupancy — those stay `constraints` and must never appear as Job Plan scope.
