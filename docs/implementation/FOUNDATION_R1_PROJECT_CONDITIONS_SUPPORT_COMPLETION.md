# FOUNDATION-R1 — Project Conditions Support Completion

**Status:** Complete / Preview regression remediated by R1-R1. **FOUNDATION-R1-R1** corrects Project Conditions visibility + Generate Estimate gating.  
**Date:** 2026-08-15  
**Authorisation:** OD-R1-01, OD-R1-02, OD-CAT-01/02/03, OD-PC-01, OD-T1-01, OD-SNAP-01, OD-FACE-01 (deferred)

**Verify:** `npx tsx scripts/verify-foundation-r1-project-conditions-support.ts`  
**Remediation:** `docs/implementation/FOUNDATION_R1R1_PROJECT_CONDITIONS_READINESS_COMPLETION.md`

---

## Delivered

1. **Canonical Project Conditions** — `lib/project-conditions/canonical.ts` aliases onto existing `constraints` / `RESERVED_CONSTRAINT_KEYS`. No second store. No key rename.
2. **Scope Details** — project-condition duplicates removed from all 14 product WA templates and always suppressed even when the project value is unknown. Project Conditions interviewer owns the ask.
3. **Local questions kept** — `deck.access_type`, `deck.height_m`, `ceilings.access` (working height), `fence.slope_condition`, `fence.services_risk`, stair geometry.
4. **Legacy adapter** — historical `*.access` / demolition floor/hazmat/services Facts remain readable. Canonical constraint wins whenever present (including Easy / No). No bidirectional sync. No migration.
5. **DC-01 Demolition** — site access / carry / occupied / hours once via `getCombinedLabourAccessFactor`. Floor-level quantity factor independent. Carting $ only from historical metres (haulage), not access difficulty.
6. **DC-02 External stairs** — project access once. Ground condition / width / risers / landing / handrail kept.
7. **Supported WA contract** — `lib/work-areas/support-contract.ts`. Customer labels: Trial-supported / Developing / Component / Not supported yet. Never A–E. Never “Estimate-ready”.
8. **Commercial parent** — `commercial_fitout` is ISD/job-class only. No calculator. Components remain the seven interior WAs.
9. **EstimateRequirement types frozen** — `lib/estimate/requirements.ts`. Calculators do **not** emit.
10. **Analytics** — planned event types only (`lib/analytics/event-contract.ts`). No UI.

---

## Estimate output changes (intentional correctness)

| Path | Old (wrong) | New (correct) | Why |
| --- | --- | --- | --- |
| Demolition qty | access × floor (e.g. Moderate 1.1 × Upper 1.15 ≈ 1.265; historical 1.32 path) | floor only (Upper 1.15) | Access already in labour factor |
| Demolition labour | project access × WA access | project access once (WA only if project key absent) | DC-01 |
| Demolition carting $ | triggered by poor access **or** metres | metres > 20 only | haulage ≠ access labour |
| Outdoor AI retaining-wall golden | required `retaining_wall.carting_distance_m` | project `material_carry_distance` / `site_access` | R1 prompt writes Project Conditions, not WA carting |
| External stair hours | project labourAdjustment × WA accessFactor × ground × width | project once × ground × width | DC-02 |
| Bathroom in-house hours | WA Restricted 1.1 while ignoring project Difficult+carry | project combined 1.15 once | project authority |
| Occupied / restricted hours | persisted, not priced | +0.05 each, once in `getLabourAdjustmentFactor` | OD-PC-01; UNKNOWN/No ≠ Yes |
| Easy + WA Restricted | could multiply WA 1.1 | Easy is the project answer; factor 1.0 | no WA fallback |

Deck / Fence / Pergola labour single-consume from 3.2.2-R1 is **preserved**. Kitchen and fitout component calculators still do not consume labour access (under-consumption; backlog, not calibrated here).

---

## Non-goals honoured

- No FOUNDATION-R2  
- No MaterialRequirement / LabourRequirement emission  
- No Deck takeoff / face-board sides (OD-FACE-01 deferred)  
- No Stage 3.2.3 interview UI  
- No Production Scope Discovery  
- No Company DNA  
- No PERF-FUTURE-01  
- No migration  
- Requirement emission deferred to REQ-1 (not FOUNDATION-R2)  

---

## Status after local implementation

| Item | Status |
| --- | --- |
| FOUNDATION-R1 | **Complete / Preview regression remediated by R1-R1** |
| FOUNDATION-R1-R1 | See `FOUNDATION_R1R1_PROJECT_CONDITIONS_READINESS_COMPLETION.md` |
| FOUNDATION-R2 | Complete Local / Owner Preview Pending — `docs/implementation/FOUNDATION_R2_SCOPE_DETAILS_COMPLETION.md` |
| REQ-1 EstimateRequirement envelope | Not Started |
| MaterialRequirement emission | Not Started |
| LabourRequirement emission | Not Started |
| Deck transparent pilot | Not Started |
| Stage 3.2.3 | Not Started / superseded in part by this cleanup |
| Company DNA | Not Started |
| PERF-FUTURE-01 | Planned |
| Production Scope Discovery | Disabled |

## FOUNDATION-R2 backlog (ambiguous remaining questions — do not remove in R1)

Kept as Work-Area-physical or scope-inclusion. Review copy/conditionals in R2; do **not** treat as project-wide logistics:

| Question | Why ambiguous |
| --- | --- |
| `demolition.skip_bin_included` / `demolition.disposal_included` | Scope inclusion vs project `waste_bin_access` |
| `fence.disposal_required` | Fence-line spoil vs project waste logistics |
| `flooring.disposal_included` | Flooring strip-out vs project waste |
| `retaining_wall.spoil_disposal` | Wall spoil vs project waste |
| `deck.level` | Deck elevation (ground vs elevated), **not** project `floor_level` |
| `*.consent` / engineering on deck, retaining, pergola, stairs | WA consent vs project `consent_engineering` |
| WA client-supplied (fixtures, paint, hardware, flooring) | Local supply vs project `client_supplied_items` |

Owner preview runbook: `docs/runbooks/FOUNDATION_R1_OWNER_PREVIEW.md`  
**Preview regression remediation:** `docs/implementation/FOUNDATION_R1R1_PROJECT_CONDITIONS_READINESS_COMPLETION.md`  
**R1-R1 retest:** `docs/runbooks/FOUNDATION_R1R1_OWNER_PREVIEW.md`

R1 shipped, then Owner Preview found Generate unlocked with no visible Project Conditions. **FOUNDATION-R1-R1** corrects that (Owner Preview Validated 2026-08-16). Historical R1 completion remains truthful.

**Exact next after R1-R1 Owner Preview PASS:** FOUNDATION-R2 — now Complete Local / Owner Preview Pending. Do **not** emit requirements.
