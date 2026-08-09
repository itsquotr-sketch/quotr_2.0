# Stage 3.1C.3-R2E — Preview Defect Register

**Status:** Open for Owner Preview E2E  
**Date:** 2026-08-10  
**Scope:** First-run / Setup / Rates / Calibration polish after R2A–R2D.2

## Classification

| Severity | Meaning |
| --- | --- |
| Critical | Blocks first-run / commercial correctness |
| High | Serious UX/authority defect before close |
| Medium | Clear polish; fix if low-risk |
| Low | Minor; optional |
| Polish | Copy/affordance |

## Code-proven findings (fixed in R2E)

| ID | Severity | Finding | Resolution |
| --- | --- | --- | --- |
| R2E-01 | Medium | Empty Dashboard duplicated “Improve Quotr…” title (CTA link + card) | Empty secondary link → “Optional company setup”; ImproveSetupCard retained for tips |
| R2E-02 | Medium | Estimate UI labels lagged R2C (`Your rate` / `Benchmark allowance`) | `lib/estimate/rate-source-labels.ts` → Your company rate / Quotr benchmark / Pricing required |
| R2E-03 | Low | Fence-only prefs fell back to Deck/Bathroom with no explanation | Hub dashed note when preferred types have no scenarios |
| R2E-04 | Polish | Hub CTA hardcoded Deck/Bathroom ternary | Uses `scenario.title` |
| R2E-05 | Medium | Setup Rates field count for Deck+Bathroom+Fence (~10 rows) | Component starter cap 4→3 per work type |
| R2E-07 | Low | `verify-stage-3-1b5c` still asserted “no migration after 029” | Updated to “no further scope-discovery migrations after 029” so 030–033 (unrelated stages) do not false-fail |

## Owner Preview checklist (pending live evidence)

| ID | Severity | Area | Status |
| --- | --- | --- | --- |
| R2E-P01 | Critical | Fresh account: no Dashboard flash before Basics | Pending Owner |
| R2E-P02 | Critical | NZ/AU country→currency→GST suggestions | Pending Owner |
| R2E-P03 | High | Preferences Deck/Fence still allow Bathroom analyse | Pending Owner |
| R2E-P04 | High | Deck calibration Save + recalibrate history on remote 033 | Pending Owner |
| R2E-P05 | High | Bathroom calibration natural / not too long | Pending Owner |
| R2E-P06 | Medium | Mobile 390×844 Basics/Setup/Rates/Calibrate | Pending Owner |
| R2E-P07 | Medium | Quick Estimate source wording after label change | Pending Owner |
| R2E-P08 | Medium | Quote Mark sent uses company contact readiness only | Pending Owner |
| R2E-P09 | Low | Performance timings (basics/rates/calibrate save) | Pending Owner |

## Non-findings (code audit)

- Incomplete sidebar badge = basics only  
- No Review/Mark Complete in Improve Setup  
- Calibration not in rate resolution  
- persistenceGated removed; Save uses RPC  
- No Fence scenario invented  
- Legacy scope.* not primary Setup Rates  
- Quote readiness independent of setup-complete  

## Gate rule

Fix Critical/High release blockers found in Owner Preview. Do not rewrite architecture in R2E.
