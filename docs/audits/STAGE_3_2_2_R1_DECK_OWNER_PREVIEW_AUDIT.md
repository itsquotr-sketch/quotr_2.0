# Stage 3.2.2-R1 — Deck Owner Preview Audit

**Date:** 2026-08-12  
**Baseline commit:** `8a45ef4` (Stage 3.2.2)  
**Scenario:** Owner Deck brief (5.2×3.1 m elevated timber deck, removal, hardwood, fascia, one step, no balustrade, restricted rear access, 25–30 m carry)

---

## Deck data-flow trace

| Brief signal | Persistence | Estimate input |
| --- | --- | --- |
| Restricted rear access | Constraint `site_access` = Difficult (`ai_extracted` via enrich) | `getLabourAdjustmentFactor` +0.10 |
| 25–30 m carry | Constraint `material_carry_distance` = `10–30m`; may also Fact `demolition.carting_distance_m` | Labour +0.05; demo carting allowance if Fact >20 m |
| ~1.2 m height | Fact `deck.height_m` / `deck.level` (LLM) | Elevated productivity +0.25 hrs/m² |
| Existing removal | Fact `deck.existing_deck_removal` (+ Demolition WA) | Removal / demo labour lines |
| Substructure | Fact `deck.substructure_*` (defaults) | Framing package |
| Hardwood | Fact `deck.board_material` | Material rates |
| Fascia | Fact `deck.vertical_face_boards_required` | Face-board lines |
| One step | Fact `deck.access_type` | Step allowance |
| No balustrade | Fact `deck.balustrade_required` = false | No balustrade line |

`occupied_site` / project `floor_level` are interview taxonomy only — **not** consumed by the estimate engine today.

---

## Commercial double-count finding

**YES — access was double-applied on Deck (and Fence/Pergola) labour when:**

1. Project constraint `site_access` Difficult → `getLabourAdjustmentFactor` ×1.10  
2. WA Fact `deck.access` Restricted/Difficult → `getWorkAreaAccessFactor` ×1.10  

Compound ≈ **×1.21** for the same real-world access condition.

**Carry:** project constraint labour factor (+0.05) and demolition carting *allowance* (discrete haulage line when Fact >20 m) are **intentionally separate** commercial effects (productivity vs haulage allowance). Not treated as duplicate multipliers.

**Project Conditions vs Site Constraints:** presentation duplication only — both wrote/read the same `constraints` rows. Not two commercial consumers.

---

## Before / after labour access factor (Deck)

**Before (with Difficult constraint + Restricted WA Fact):**

`labourAdjustment = getLabourAdjustmentFactor × getWorkAreaAccessFactor ≈ 1.15 × 1.10 = 1.265`  
(with carry included in constraint factor)

**After (3.2.2-R1):**

`labourAdjustment = getCombinedLabourAccessFactor` → constraint-only when project `site_access` already applied → **≈ 1.15** (access once + carry once).

---

## Estimate increase vs prior Deck tests (legitimate causes)

1. Access double-count (bug — fixed in R1)  
2. Carry labour factor + demo carting allowance when Demolition WA present (intentional separate effects)  
3. Elevated height productivity when height Fact present  
4. Scope/catalogue baselines may differ from older fixtures  

Do **not** arbitrarily reduce rates to match historical outputs.

---

## Analyse → Work Areas latency (Owner evidence)

Observed: analysis slow; further delay before Work Areas appear.

Likely contributors:

- Anthropic provider time (Analyse Job)  
- Sequential Fact + constraint persistence  
- `revalidatePath` breadth / RSC remount  

R1 low-risk: parallel constraint upserts; project-scoped revalidate after brief seed. Deeper work remains **PERF-FUTURE-01**.
