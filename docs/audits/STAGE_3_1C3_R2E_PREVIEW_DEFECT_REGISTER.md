# Stage 3.1C.3-R2E Preview Defect Register

**Status:** R2E-R1 remediations Complete Local — Owner Retest Pending  
**Date:** 2026-08-10  
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
| R2E-01 | Medium | Empty Dashboard duplicated “Improve Quotr…” title (CTA link + card) | Empty secondary link → “Optional company setup”; ImproveSetupCard retained for tips |
| R2E-02 | Medium | Estimate UI labels lagged R2C (`Your rate` / `Benchmark allowance`) | `lib/estimate/rate-source-labels.ts` → Your company rate / Quotr benchmark / Pricing required |
| R2E-03 | Low | Fence-only prefs fell back to Deck/Bathroom with no explanation | Hub dashed note when preferred types have no scenarios |
| R2E-04 | Polish | Hub CTA hardcoded Deck/Bathroom ternary | Uses `scenario.title` |
| R2E-05 | Medium | Setup Rates field count for Deck+Bathroom+Fence (~10 rows) | Component starter cap 4→3 per work type |
| R2E-06 | Low | After first calibration tip vanished with no gentle next step | Subtle “Calibrate another work type” until MVP scenarios done |
| R2E-07 | Low | `verify-stage-3-1b5c` still asserted “no migration after 029” | Updated to “no further scope-discovery migrations after 029” so 030–033 (unrelated stages) do not false-fail |

## Owner Preview findings (R2E-R1)

| ID | Severity | Finding | Resolution / Status |
| --- | --- | --- | --- |
| R2E-R1-01 | High | First-run Basics blank until manual refresh | **Fixed Local** — soft Server Action redirect after Set-Cookie; now `continueTo` + `window.location.assign` to `/app/setup?mode=basics` |
| R2E-R1-02 | Medium | Dashboard Hide not persistent / misleading | **Fixed Local** — Collapse/Expand + localStorage; default collapsed when projects exist |
| R2E-R1-03 | Medium | Default margin tip opened Core labour | **Fixed Local** — `/app/rates?section=defaults` via shared recommendation map |
| R2E-R1-04 | Medium | Calibration scenario not visible while answering | **Fixed Local** — desktop sticky Example job; mobile Show/Hide details |
| R2E-R1-05 | Low | Labour monetary “You —” when only hours known | **Fixed Local** — monetary labour comparable only when labour $ provided; hours row separate |
| R2E-R1-06 | Polish | Calibration purpose / compare wording | **Fixed Local** — clearer evidence-only value proposition |

## Owner Retest checklist (pending live evidence)

| ID | Severity | Area | Status |
| --- | --- | --- | --- |
| R2E-R1-T01 | High | Fresh signup → Basics visible without refresh | Pending Owner |
| R2E-R1-T02 | Medium | Collapse persists across Dashboard navigation | Pending Owner |
| R2E-R1-T03 | Medium | Confirm default margin → Defaults section | Pending Owner |
| R2E-R1-T04 | Medium | Calibration sticky scenario desktop + mobile | Pending Owner |
| R2E-R1-T05 | Low | Hours-only compare shows hours, not You — | Pending Owner |

## Non-findings (code audit)

- Incomplete sidebar badge = basics only  
- No Review/Mark Complete in Improve Setup  
- Calibration not in rate resolution  
- No Fence scenario invented  
- Quote readiness independent of setup-complete  
- No migration 034  

## Gate rule

Fix Critical/High release blockers found in Owner Preview. Do not rewrite Setup architecture in R2E-R1.
