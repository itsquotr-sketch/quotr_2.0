# FOUNDATION-R2 — Calculator input gap matrix

**Classification:** SUPPORTING evidence. Canonical engine: `docs/architecture/QUOTR_ESTIMATING_ENGINE_ARCHITECTURE.md`.  
**Status:** Companion to `docs/audits/FOUNDATION_R2_SCOPE_DETAILS_QUESTION_AUDIT.md`  
**Date:** 2026-08-16  
**Rule:** A question existing does **not** improve calculator accuracy until consumed. R2 did not expand calculator logic.

Mapping codes: **A** current calculator · **B** future material requirement · **C** future labour requirement · **D** scope/quote · **E** unconsumed, needed later.

---

## Deck — READY FOR REQUIREMENT PILOT (inputs)

| Input | Status | Notes |
| --- | --- | --- |
| L / W / area | A (area derived when L×W known) | Irregular override **E** / DECK-1 |
| Height / level | A | Level hidden when height known |
| Board material / width | A | Thickness, gap, orientation **E**. **R2-R1:** width + material now drive **priced** lm × `$/lm` (not display-only). |
| Existing removal / substructure / piles | A | Joist/bearer sizes **E** |
| Stairs (`access_type`) | A allowance | Geometry for local stair takeoff **E** |
| Balustrade / handrail | A | Explicit No preserved |
| Fascia required + lm | A | F/R/L/R edges reserved OD-FACE-01 |
| Consent | D | Optional WA; project consent is PC |
| Pergola on deck | Hidden | Separate WA |
| Requirement emission | Absent | REQ-1 |

**Still:** MATERIAL TAXONOMY GAP + LABOUR MODEL GAP for the transparent estimator. Do not start emission in R2.

## Bathroom — NOT READY — CALCULATOR GAP

Consumed: area, reno type, demo, finish, waterproofing yes/no, tiling, tile areas/extent, fixtures, shower type, lining, floor prep, UFH, plumbing/electrical level, ventilation.

Unconsumed (**E**): `waterproofing_extent`. No wall-area geometry derivation. Allowance-first packages remain. Taxonomy/labour model gaps remain.

## Retaining wall — NOT READY — CALCULATOR GAP

Consumed: length, heights/raking, material, fixing, drainage, drain connection, backfill dims, excavation, disposal, consent.

Unconsumed (**E**): `post_spacing_m`. No geotextile, capping, corners, post size, sleeper lm takeoff. Carting metres remain historical-only (not asked).

## Fence — NOT READY — CALCULATOR GAP

Consumed: length, height, material, gate yes + count, slope, services, demo/disposal, finish.

Unconsumed (**E**): `post_spacing_m`, `paling_or_panel_type`, `gate_width_m`. Rail count / post size deferred (assumable later). No post-count takeoff yet.

## Pergola — NOT READY — CALCULATOR GAP

Consumed: area (or L×W), material, attached, roofing, footings, gutters, tie-in, finish, consent.

Unconsumed (**E**): `height_m`. No post/beam/rafter size takeoff.

## Kitchen — NOT READY — CALCULATOR GAP

Consumed: area, reno, finish, demo, flooring, cabinetry yes/type/client, benchtop yes, splashback, rangehood, appliances, plumbing/electrical.

Unconsumed (**E**): `island_included`, `island_length_m`, `cabinetry_lm`, `benchtop_material`. Calculator remains package/allowance-heavy and cannot yet use richer answers.

## Demolition — NOT READY — LABOUR MODEL GAP

Consumed: scope items, area, wall/floor/ceiling quantities, disposal, skip inclusion, salvage. DC-01 preserved.

Not asked (correct): access, carting, floor level, services isolation, general hazmat — Project Conditions.

## External stairs — NOT READY — CALCULATOR GAP

Consumed: risers/rise, width, material, stringer, landing, handrail, balustrade, ground, finish, consent, existing removal. DC-02 preserved.

## Commercial components — NOT READY — CALCULATOR GAP (+ taxonomy)

Internal walls consume length/height/framing/lining/sides/skirting/insulation/stopping/painting flags. **E:** `fire_or_acoustic` (no fire-system child graph in R2).

Ceilings consume area/system/type/edges/working height. Doors consume count/type/supply/prehung/frames/hardware. Flooring consume area/type/removal/prep/underlay. Painting consume location/areas/coats/prep. Plastering consume area/level/surface/complexity/sanding.

Fitout calculators remain component-allowance grade. `commercial_fitout` has no calculator.

---

## Requirement-emission readiness

| Work Area | Classification |
| --- | --- |
| Deck | **READY FOR REQUIREMENT PILOT** (question contract). Still taxonomy + labour-model gaps for transparent estimator. |
| Bathroom | NOT READY — CALCULATOR GAP (+ taxonomy / labour model) |
| Retaining / Fence / Pergola | NOT READY — CALCULATOR GAP (some **E** inputs reserved) |
| Kitchen | NOT READY — CALCULATOR GAP (richer answers unused) |
| Demolition | NOT READY — LABOUR MODEL GAP (DC-01 labour is combined, not task-split) |
| External stairs | NOT READY — CALCULATOR GAP |
| Commercial components | NOT READY — CALCULATOR GAP + MATERIAL TAXONOMY GAP |

Do **not** emit `CalculatorResult.requirements` in R2. First pilot remains Deck after Owner R2 Preview + REQ-1 authorisation.

---

## E-class question safety (Owner approved collection)

Hard rule: if **CURRENT CALCULATOR CONSUMER = No**, the current price did not use that value. Confidence `missingInfo` lists do not include these keys. Quote descriptions do not claim they were priced.

| QUESTION KEY | WHY COLLECT | CURRENT CALC? | FUTURE | Δ ESTIMATE NOW? | Δ CONFIDENCE? | IN CURRENT QUOTE/SCOPE? |
| --- | --- | --- | --- | --- | --- | --- |
| kitchen.island_included | Island is a major kitchen driver | No | Kitchen maturation / REQ | No | No | No (not in quote-description) |
| kitchen.island_length_m | Island quantity | No | Material/labour REQ | No | No | No |
| kitchen.cabinetry_lm | Linear cabinetry | No | Material/labour REQ | No | No | No |
| kitchen.benchtop_material | Spec/rate | No | Material REQ / rates | No | No | No |
| retaining_wall.post_spacing_m | Post count | No | Material/labour REQ | No | No | No |
| pergola.height_m | Structure/labour | No | Material/labour REQ | No | No | No |
| internal_walls.fire_or_acoustic | Fire/acoustic system | No | Component maturation | No | No | No |
| fence.post_spacing_m | Post count | No | Material REQ | No | No | No |
| fence.paling_or_panel_type | Face material | No | Material REQ | No | No | No |
| fence.gate_width_m | Gate materials | No | Material REQ | No | No | No |
| bathroom.waterproofing_extent | Wet-area extent | No | Bathroom calculator | No | No | No |

`bathroom.waterproofing_included` is **not** E-class: required, consumed as Yes → allowance; explicit No → omit line.

**Density:** E children are gated (island length, cabinetry lm, benchtop material, gate width, waterproofing extent). Always-visible extras are optional parents (island, fence post spacing, paling type, retaining post spacing, pergola height, fire/acoustic). Owner approved keeping them. Not deferred.

---

## Deck remaining gaps before transparent emission

Current inputs **are** sufficient to start REQ-1 envelope mapping of **existing priced lines**.

Not yet enough to emit honest takeoff quantities for:

| Output | Gap |
| --- | --- |
| Decking quantity | Board gap/orientation/thickness; irregular geometry (DECK-1) |
| Joist quantity | Joist size/centres not asked (DEFER) |
| Bearer quantity | Bearer size/system not asked (DEFER) |
| Posts/piles | Count only when replacement = Yes; new-build spacing not asked |
| Concrete | Footing/pile concrete not asked |
| Fascia | Length asked; F/R/L/R edges = OD-FACE-01 / DECK-2 |
| Fixings | No taxonomy (REQ-2 / Catalogue V2) |
| Labour task hours | Lumped labour today (DECK-3 / REQ-3) |

