# Stage 3.1C.3-R2E Preview Defect Register

**Status:** Closed — Owner Preview Passed (2026-08-10)  
**Scope:** First-run / Setup / Rates / Calibration polish after R2A–R2D.2 + Owner Preview

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
| R2E-01 | Medium | Empty Dashboard duplicated “Improve Quotr…” title | Secondary → “Optional company setup” |
| R2E-02 | Medium | Estimate UI labels lagged R2C | Your company rate / Quotr benchmark / Pricing required |
| R2E-03 | Low | Fence-only prefs fell back with no explanation | Hub note when preferred types have no scenarios |
| R2E-04 | Polish | Hub CTA hardcoded ternary | Uses `scenario.title` |
| R2E-05 | Medium | Setup Rates field count high | Component starter cap 4→3 |
| R2E-06 | Low | No gentle tip after first calibration | Subtle “Calibrate another work type” |
| R2E-07 | Low | 3.1B.5C “no migration after 029” false-fail | Gate scoped to scope-discovery migrations |

## Owner Preview findings (R2E-R1) — Closed

| ID | Severity | Finding | Status |
| --- | --- | --- | --- |
| R2E-R1-01 | High | Basics blank until refresh | **Closed** — Owner retest passed |
| R2E-R1-02 | Medium | Hide not persistent | **Closed** — Collapse/Expand + localStorage |
| R2E-R1-03 | Medium | Margin tip → wrong Rates section | **Closed** — `?section=defaults` |
| R2E-R1-04 | Medium | Scenario not visible while answering | **Closed** — sticky / mobile disclosure |
| R2E-R1-05 | Low | Labour “You —” when only hours | **Closed** — hours-only compare |
| R2E-R1-06 | Polish | Purpose/compare wording | **Closed** |
| R2E-R1.1 | High (build) | `initialSection` missing on CompanySettingsContent | **Closed** — prop contract fix |

## Owner sign-off areas (passed)

- Signup / login / account recovery  
- First-run Company Basics  
- Dashboard first-run state  
- Optional Setup navigation  
- Work Type preferences  
- Rates onboarding  
- Calibration compare / save / recalibrate  
- Contextual recommendation deep links  
- Profile / Company boundary  

## Gate

Stage **3.1C.3** and Stage **3.1C** closed on this evidence.  
No Setup redesign. No DNA. No Stage 3.2. Production Scope Discovery remains Disabled.
