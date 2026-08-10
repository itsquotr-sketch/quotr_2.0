# Stage 3.1B — Bathroom Commercial Detail Audit / Remediation

**Status:** Complete — Local  
**Date:** 2026-08-10  
**Branch:** `hardening/stage-2a-security`  
**Verify:** `scripts/verify-stage-3-1b-bathroom-commercial-detail.ts`

---

## Audit findings

### Access-factor source
Bathroom **Demolition/strip-out** and **Bathroom carpentry/prep labour** Commercial detail came from `formatLabourMinimumDisplay` in `lib/estimate/commercial-realism.ts`.

Canonical source for Bathroom lines:
- Work-area Fact `bathroom.access` (not project constraint `site_access`)
- Multiplier via `getWorkAreaAccessFactor` → applied once in `applyLabourMinimums` as  
  `calculatedHours × accessFactor × smallJobFactor` (then crew/duration minimums)

### Exact commercial effect
| Access label | Factor | Effect |
| --- | ---: | --- |
| Easy / Standard / blank | 1.0 | No labour uplift |
| Moderate | 1.05 | +5% labour hours before minimums |
| Difficult / Poor / **Restricted** | 1.1 | +10% labour hours before minimums |

Recognition defect: AI/owner often stores `Restricted`, which previously returned **1.0** while still displaying `Access factor: Restricted`. Restricted now maps to **1.1** (same as Difficult).

Lines consuming Bathroom access uplift (when demolition / lining included):
- Demolition/strip-out
- Bathroom carpentry/prep labour
- Wall lining install labour (when wall lining included)

### Double-counting
**None on Bathroom labour lines.**

- Bathroom calculator does **not** call `getLabourAdjustmentFactor` (project `site_access` + `material_carry_distance` compound).
- Access is applied **once** per affected line via `applyLabourMinimums`.
- Same access uplift on Demolition and Carpentry is intentional — each line’s own labour hours are scaled independently (not a global second pass).

### Carry-distance interaction
| Driver | Key | Models |
| --- | --- | --- |
| Work-area access | `bathroom.access` | Congested / difficult access for install & strip-out labour inside the Bathroom package |
| Site access constraint | `site_access` | Project-level site access used by Deck/Fence/Demolition-WA paths via `getLabourAdjustmentFactor` |
| Material carry | `material_carry_distance` | Extra carting labour on packages that use `getLabourAdjustmentFactor` |

On Bathroom package lines these are **not** the same adjustment: carry does not currently scale Bathroom in-house labour. No duplicate allowance between access and carry inside Bathroom.

### Other internal labels found (narrow fixes)
- Demolition WA quantity-basis `Access factor: …` / unit `factor` → contractor-facing allowance wording
- External stairs `Width factor ×N` → wider-flight % wording

No commercial formula redesign beyond Restricted recognition alignment.

---

## Bathroom PASS
**FUNCTIONAL PASS** (Owner journey) with Commercial Detail presentation remediation Complete — Local.

Owner retest of full Bathroom journey **not required** unless Preview deploy is used to spot-check Commercial detail wording on Demolition + Carpentry lines.

---

## Boundaries
- No Stage 3.2 / Company DNA  
- Production Scope Discovery remains Disabled  
- No Bathroom redesign  
- Commercial Fitout not started  
