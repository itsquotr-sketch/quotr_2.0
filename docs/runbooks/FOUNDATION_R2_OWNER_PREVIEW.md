# FOUNDATION-R2 — Owner Preview

**Status:** Owner Preview Pending — do not auto-mark PASS  
**Local completion:** `docs/implementation/FOUNDATION_R2_SCOPE_DETAILS_COMPLETION.md`  
**Prerequisite:** FOUNDATION-R1-R1 Complete — Owner Preview Validated

Stable Preview (same branch as R1-R1):  
`https://quotr-2-0-git-hardening-stage-2a-security-quotr1.vercel.app`

R2 is **question quality**. Project Conditions must still appear once. Generate Estimate must still respect R1-R1 required-PC blocking. Totals should not jump unless a newly answered commercial driver (e.g. waterproofing) was previously blank.

For each Work Area assess:

- questions are relevant
- no project-condition duplication (access, carry, floor level, occupancy, hours, parking, general waste, general services isolation, general hazmat)
- no obvious missing commercially important detail
- form is not unnecessarily long
- conditional questions behave
- answers save cleanly
- Estimate still generates
- no commercially absurd change

---

## A. Deck

Use a known rectangular deck brief (length × width, height, material, no balustrade if low, fascia yes/no).

| # | Check | Pass? |
| --- | --- | --- |
| A1 | Length/width asked; area **not** asked once both dimensions are known | |
| A2 | Height asked; “ground-level vs elevated” hidden once height is known | |
| A3 | No site access / carry / parking / waste-bin questions in Deck Scope Details | |
| A4 | Stairs language is step/stair from the deck (`access_type`), not site access | |
| A5 | Fascia length hidden until fascia = Yes | |
| A6 | Balustrade hidden when height ≤ 1 m or after explicit No | |
| A7 | Pergola is not asked on the Deck card | |
| A8 | Estimate still generates; no absurd $ swing vs R1-R1 | |

## B. Bathroom

| # | Check | Pass? |
| --- | --- | --- |
| B1 | Floor area, strip-out, **waterproofing required** (Yes/No/Not sure), tiling, fixtures, services | |
| B2 | Waterproofing extent appears only after waterproofing = Yes | |
| B3 | Tile areas / wall height hidden until tiling = Yes; wall height hidden for floor-only | |
| B4 | No bathroom site-access / carry / hours | |
| B5 | Finish level appears toward the end | |
| B6 | Estimate still generates | |

## C. Retaining wall

| # | Check | Pass? |
| --- | --- | --- |
| C1 | Length, raking, heights, material, fixing, drainage, backfill, excavation | |
| C2 | High/low heights only if raking = Yes | |
| C3 | Spoil disposal only if excavation = Yes | |
| C4 | Post spacing present (optional) | |
| C5 | No cart/access clone | |
| C6 | Estimate still generates | |

## D. Fence

| # | Check | Pass? |
| --- | --- | --- |
| D1 | Length, height, material, post spacing, palings/panels | |
| D2 | Gate count/width only if gate = Yes | |
| D3 | Slope and fence-line services remain (local, not general site slope/isolation) | |
| D4 | No general access/carry | |
| D5 | Estimate still generates | |

## E. Pergola

| # | Check | Pass? |
| --- | --- | --- |
| E1 | Area (or L×W), height, material, attached/freestanding, roof, footings | |
| E2 | Roof type only if roofing = Yes | |
| E3 | No project logistics | |
| E4 | Estimate still generates | |

## F. Kitchen

| # | Check | Pass? |
| --- | --- | --- |
| F1 | Area, strip-out, cabinetry, benchtop, island, services, finishes | |
| F2 | Island length only if island = Yes | |
| F3 | Benchtop material only if benchtop = Yes | |
| F4 | Cabinetry lm only if cabinetry = Yes | |
| F5 | No access / carry / floor level / occupancy / hours | |
| F6 | Estimate still generates (allowance-grade; do not expect island lm to change $ yet) | |

## G. Demolition

| # | Check | Pass? |
| --- | --- | --- |
| G1 | Physical scope items + quantities; skip is “in this demolition scope” | |
| G2 | Wall/floor/ceiling quantities wait until those items are in scope | |
| G3 | No access / carting / floor level / general services isolation / general hazmat | |
| G4 | Project Conditions still owns access/carry/waste/services/hazmat | |
| G5 | Estimate labour still looks single-consumed (DC-01) | |

## H. External stairs

| # | Check | Pass? |
| --- | --- | --- |
| H1 | Existing removal, risers/rise, width, material, landing, handrail, balustrade | |
| H2 | Landing area/count only if landing = Yes | |
| H3 | Ground condition is local to the stair, not general site access | |
| H4 | Estimate still single-consumes project access (DC-02) | |

## I. Commercial multi-WA

Confirm two or more of: internal walls, ceilings, doors, flooring, painting, plastering.

| # | Check | Pass? |
| --- | --- | --- |
| I1 | Access/carry asked **once** in Project Conditions | |
| I2 | No component asks general access/carry/floor/hours/occupancy | |
| I3 | Ceilings “working height” is height/equipment, not site access | |
| I4 | Internal walls can ask fire/acoustic without a long fire-system form | |
| I5 | No monolithic `commercial_fitout` calculator | |
| I6 | Estimate still generates | |

---

## Skip / save

Answers save on the existing batch/disclosure path (not per keystroke). Incomplete sections stay open (R6-R3).

---

Owner records PASS/FAIL. Do not start REQ-1, requirement emission, or Deck Takeoff until authorised after PASS.
