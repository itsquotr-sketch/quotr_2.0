# DECK-1A — Current State & Input Audit

**Status:** COMPLETE / OWNER MODEL VALIDATED (R1 2026-08-18)  
**Date:** 2026-08-18  
**Branch:** `hardening/stage-2a-security`  
**HEAD:** `cdf8134b2a131da8283782e83d1ceca31879f287`

Planning audit only. No estimate money changes. No new MaterialRequirements. No migrations.

---

## 1. Executive summary

Deck **surface** estimating is physically explainable (lm takeoff, requirement-authoritative). Deck **structure** is still a single **m² package** (`deck.substructure.m2` @ benchmark $120/$180 per m² deck area) plus generic fixings m² and flat allowances for pile/post replacement.

DECK-1 must replace the coarse substructure package with member-level physical quantities. DECK-1A establishes the contract before any formulas are coded.

**Critical gap:** Scope Details capture geometry and high-level substructure flags but **no joist/bearer/post sizing, spacing, or orientation facts** exist today.

---

## 2. Current Deck facts (live template)

**Source of truth:** `lib/scopes/templates/deck.ts`

### 2.1 Geometry

| Key | Type / unit | Question | Availability | Notes |
| --- | --- | --- | --- | --- |
| `deck.length_m` | number, m | ✓ required | **A — fact exists** | Used for area derivation |
| `deck.width_m` | number, m | ✓ required | **A** | Used for area derivation |
| `deck.area_m2` | number, m² | ✓ (hidden when L×W known) | **A + C derived** | `length × width` via `derived-facts.ts`; calculator default **20 m²** if missing |
| `deck.height_m` | number, m | ✓ required | **A** | Elevated labour, balustrade gate, consent assumptions |
| `deck.level` | select | ✓ (hidden when height set) | **A + C inferred** | Inferred from height > 0.3 m when absent |
| `deck.board_width_mm` | select mm | ✓ optional | **A + D default 140** | Required for surface lm takeoff |

### 2.2 Construction / surface

| Key | Type | Question | Availability |
| --- | --- | --- | --- |
| `deck.board_material` | select | ✓ required | **A** |
| `deck.existing_deck_removal` | boolean | ✓ | **A** |
| `deck.access_type` | select | ✓ | **A** |
| `deck.vertical_face_boards_required` | boolean | ✓ | **A** |
| `deck.vertical_face_board_length_lm` | number, lm | ✓ conditional | **A + C inferred** perimeter fallback |
| `deck.balustrade_required` | boolean | ✓ | **A** |
| `deck.handrail_required` | boolean | ✓ | **A** |

### 2.3 Structure (high-level only)

| Key | Type | Question | Availability | Calculator use |
| --- | --- | --- | --- | --- |
| `deck.substructure_included` | boolean | ✓ | **A + D default true** | Gates m² framing package |
| `deck.pile_or_post_replacement_required` | boolean | ✓ conditional | **A** | Allowance lumps |
| `deck.pile_or_post_count` | number | ✓ conditional | **A** | Per-post allowance when known |
| `deck.substructure_condition` | select | ✓ conditional | **A** | Partial/full replacement allowances |

### 2.4 Risk / consent (WA-scoped)

| Key | Type | Question | Availability |
| --- | --- | --- | --- |
| `deck.engineering_or_consent_status` | select | ✓ | **A** — estimate exclusion/assumption text only |

### 2.5 Project Conditions (not `deck.*`)

| Key | Applicability | Availability |
| --- | --- | --- |
| `consent_engineering` | Project constraint when deck WA confirmed | **A** — does not drive member sizing today |
| `site_access` | Project | **A** |
| `material_carry_distance` | Project | **A** |

---

## 3. Referenced but missing / stub keys

| Key | Where referenced | Status |
| --- | --- | --- |
| `deck.joist_centres_mm` | `scope-impact.ts` DETAIL_ONLY list | **E — missing** (no question, no calculator) |
| `deck.waste_removal_required` | scope-discovery relationships | **E — missing** |
| `deck.coating_required` | scope-discovery relationships | **E — missing** |
| `deck.finish_level` | scope-impact DETAIL_ONLY | **E — missing** |
| `deck.fascia_included` | clarification routing | **B — mismatch** (canonical = `deck.vertical_face_boards_required`) |
| `deck.stairs_required` | conditional-rules (always hidden) | Stub only |
| `deck.face_board_*` | architecture docs | **E — documented future, not implemented** |

Legacy aliases (`deck.material`, `deck.demolition_required`, etc.) remain readable via `fact-keys.ts`.

---

## 4. Current Deck calculator — all lines

**Source:** `lib/estimate/calculators/deck.ts`

| # | Label | componentKey | Qty basis | Unit | Rate key | Line type | Structural? |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | Deck labour | `deck.labour` | area × productivity | m² | `labour.carpenter.hour` | physical labour | No |
| 2 | Decking materials | `decking.surface` | lm takeoff or area package | lm / m² | `deck.material.{variant}.lm/m2` | physical / package | Surface |
| 3 | **Framing/substructure** | — | `effectiveArea` | m² | **`deck.substructure.m2`** | **package** | **YES — bundled** |
| 4 | Fixings and consumables | — | `effectiveArea` | m² | `deck.fixings.m2` | package | Partial |
| 5 | Existing deck removal | — | area × 0.35 hrs | m² | labour | physical labour | No |
| 6–8 | Stair/step allowances | — | 1 | allow | benchmarks | allowance | No |
| 9–10 | Balustrade/handrail | — | 1 | allow | benchmarks | allowance | No |
| 11–12 | Pile/post / substructure replacement | — | count or 1 | allow/ea | `deck.post_replacement.each` / benchmarks | allowance | Partial |
| 13–14 | Face boards + labour | — | lm or inferred | lm / allow | hardcoded $22/$35 lm | hardcoded | Fascia (DECK-2) |

**Registered authority today:**

| componentKey | Authority |
| --- | --- |
| `decking.surface` | REQUIREMENT_AUTHORITATIVE |
| `deck.labour` | SHADOW |
| All others | LEGACY_AUTHORITATIVE (unregistered) |

---

## 5. Current structural money map

| Current money line | Physical basis today | Cost basis | Future DECK-1 owner |
| --- | --- | --- | --- |
| Framing/substructure | **None** — flat deck area | `deck.substructure.m2` @ $120/$180 m² benchmark | **Decomposed** into joists, rim, bearers, supports, blocking, concrete |
| Fixings and consumables | **None** — flat deck area | `deck.fixings.m2` @ $25/$40 m² | Split: `deck.fixings.structural` + surface fixings (optional) |
| Pile/post replacement | Count if known; else lump | `deck.post_replacement.each` or benchmark allowance | `deck.supports` (EA) + optional height-derived LM later |
| Substructure replacement allowance | Condition flag | Flat benchmark | Remains allowance until replacement scope modelled (DECK-1+ or separate) |

**Explicit finding:** Joists, bearers, rim joists, blocking, and concrete are **not separately represented**. They are bundled inside `deck.substructure.m2`.

---

## 6. Current rate keys & catalogue coverage

### Live keys

| Key | Catalogue | Benchmark | Member-level? |
| --- | --- | --- | --- |
| `deck.material.*.lm/m2` | ✓ | ✓ | Surface only |
| `deck.substructure.m2` | ✓ | $120/$180 | **GENERIC package** |
| `deck.fixings.m2` | ✓ | $25/$40 | **GENERIC package** |
| `deck.post_replacement.each` | **Missing from catalogue** | $180/$280 | Allowance only |

### Missing (architecture-only today)

| Material | Status |
| --- | --- |
| `timber.sg8.90x45.h*.lm` | MISSING (docs/tests) |
| `timber.sg8.140x45.h3.2.lm` | PARTIAL (test fixture only) |
| `timber.sg8.190x45.h*.lm` | MISSING (docs) |
| `timber.sg8.90x90.h5.lm` (posts) | MISSING (docs) |
| `200x50` | MISSING everywhere |
| Concrete m³ (deck footings) | MISSING |
| Structural fixings EA | MISSING |

Org setting `timber_framing_wastage_percent` exists (`021_company_material_wastage.sql`) but is **not applied** to deck framing today.

---

## 7. Scope discovery vs estimating gap

Scope-discovery graph (`lib/scope-discovery/catalogue/relationships/deck.ts`) already names `deck.joists`, `deck.bearers`, `deck.piles_posts` as **candidate scope items**. These are **not connected** to calculator takeoff or MaterialRequirements.

---

## 8. Golden fixtures (unchanged by DECK-1A)

| Fixture | Key inputs | Sell golden |
| --- | --- | --- |
| Deck 1 | 70 m² hardwood, 140 mm, 0.8 m height, removal, stairs, balustrade | **$48,340** |
| Surface reference | 16.12 m², 140 mm, 10% waste, hardwood | 126.65 lm purchase; $2,786.30 benchmark cost |

DECK-1A must not restamp these. Structural decomposition will be validated in DECK-1B+ with new fixtures.

---

## 9. Audit conclusions

1. **Inputs exist for geometry and surface**; **structure lacks member specification facts**.
2. **One legacy package** (`deck.substructure.m2`) owns all framing money today.
3. **No sized timber rate keys** in live catalogue — CAT-V2-1 / benchmark seeding is a DECK-1B dependency.
4. **Orientation and spacing are completely missing** — must be proposed, not invented silently.
5. **Area-only decks** must retain legacy fallback — no fake joist grid from area alone.

See `docs/architecture/DECK_STRUCTURAL_MATERIAL_MODEL.md` for the proposed physical model contract.
