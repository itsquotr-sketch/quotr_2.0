# Stage 3.1C — Closure

**Status:** Complete — Preview Validated  
**Closed:** 2026-08-10  
**Owner Preview:** Passed (auth/account, first-run Setup, rates, calibration, deep links)

## Verdict

Stage **3.1C** is **Complete — Preview Validated**.

Stage **3.1C.3** and all redesign batches (R1 → R2E-R1 / R2E-R1.1) are **Complete**.

Do **not** interpret this as:

- Stage 3.1B complete  
- Stage 3.2 started  
- Company DNA started  
- Production Scope Discovery enabled  
- Migration 034 required  

## What Stage 3.1C delivered

| Area | Capability |
| --- | --- |
| Auth safety | Safe error taxonomy; structured auth logging; no secret leakage |
| Provisioning | Transactional signup org+profile RPC (migration **032**) |
| Session / account | Login, logout, Profile, logged-in password change |
| Recovery | Confirmation callback, forgot/reset password, safe redirect-back |
| First-run | Hard-gated Company Basics (country/currency/GST); no Dashboard flash |
| Preferences | Work Types as preferences only — not capability locks |
| Rates | Contractor-native explicit rates; benchmark vs company authority |
| Calibration | Optional Deck/Bathroom evidence MVP; compare without auto rate change |
| Persistence | Calibration append/supersede (migration **033**); one active per scenario |
| Readiness | Progressive ACCOUNT / BASICS / ESTIMATE / PRICING / QUOTE — no binary “setup complete” authority |
| Deep links | Recommendation → exact Rates/Setup/Company section |
| Profile boundary | Profile = personal; Company = business/commercial |

## Batch status (closed)

| Batch | Status |
| --- | --- |
| 3.1C.0 | Complete |
| 3.1C.1A | Complete |
| 3.1C.1B | Complete (032 Applied Remote) |
| 3.1C.2A / R1 / R2 | Complete — Preview Validated |
| 3.1C.2B / R1 / R2 | Complete — Preview Validated |
| 3.1C.3 | Complete |
| 3.1C.3-R1 | Complete |
| 3.1C.3-R2A | Complete |
| 3.1C.3-R2B | Complete |
| 3.1C.3-R2C | Complete |
| 3.1C.3-R2D | Complete |
| 3.1C.3-R2D.1 | Complete |
| 3.1C.3-R2D.2 | Complete (033 Applied Remote) |
| 3.1C.3-R2E | Complete |
| 3.1C.3-R2E-R1 | Complete — Owner Preview Passed |
| 3.1C.3-R2E-R1.1 | Complete (Company Settings `initialSection` build fix) |

## Migrations

| Migration | Remote (`quotr_2.0` / `lxvnylhsbvudzzupxeqr`) |
| --- | --- |
| 032 transactional signup | Applied and Verified |
| 033 calibration_responses | Applied and Verified |
| 034 | **Not created** |

## Explicitly deferred

- Email address change workflow  
- Deeper quote/account administration polish  
- Company DNA  
- Calibration → rate recommendations  
- Automatic calibration application to estimates/rates  
- Additional calibration scenarios beyond Deck/Bathroom MVP  
- Full rate-library expansion  
- Stage **3.2**  
- Production Scope Discovery enablement  

## Next development focus

**Stage 3.1B Owner Preview E2E completion** (not Stage 3.2).

Owner tests remaining for 3.1B:

1. Deck  
2. Bathroom  
3. Commercial Fitout  

Production Scope Discovery remains **Disabled**.

After those pass → Stage 3.1B closure/release gate.  
Only after **both** 3.1B and 3.1C are closed should the owner choose Stage 3.2.

## Closure references

- Defect register: `docs/audits/STAGE_3_1C3_R2E_PREVIEW_DEFECT_REGISTER.md`  
- R2E sign-off: `docs/runbooks/STAGE_3_1C3_R2E_FINAL_PREVIEW_SIGNOFF.md`  
- R2E-R1 retest: `docs/runbooks/STAGE_3_1C3_R2E_R1_OWNER_RETEST.md`  
- Roadmap: `docs/plans/STAGE_3_PRODUCT_ROADMAP.md`  
- Backlog: `docs/product/QUOTR_PRODUCT_BACKLOG.md`
