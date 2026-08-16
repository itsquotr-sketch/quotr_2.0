# FOUNDATION-R1-R1 — Project Conditions availability + estimate-readiness

**Status:** Complete — Owner Preview Validated  
**Date:** 2026-08-16  
**Verify:** `npx tsx scripts/verify-foundation-r1r1-project-conditions-readiness.ts`

FOUNDATION-R1 shipped (PC authority + WA support contract + DC-01/DC-02). Owner Preview then found Generate unlocked with no visible Project Conditions. This batch remediates that regression.

**Owner Preview evidence (2026-08-16):** Owner manually tested the live Preview flow and confirmed Project Conditions appears in the correct order, is the sole project-wide conditions surface, and Generate Estimate stays blocked until required Project Conditions are resolved.

---

## Root causes (do not conflate)

| | Cause |
| --- | --- |
| **A. Missing PC UI** | Empty `saveConstraints([])` auto-unlocked `ready_to_estimate`; disclosure then led with Quick Estimate; compress-after-generate hid the PC card. Engine still had PROJECT ASK candidates. |
| **B. Premature Generate** | CTA + server gated on assistant **stage** only. Interview `canGenerateQuickEstimate` was unused. |

---

## Delivered

1. **Applicability** — `lib/project-conditions/applicability.ts`. Confirmed WAs + Facts decide which canonical keys are required / assumable / optional. Irrelevant keys are not asked.
2. **Registry** — Project Conditions ASK now includes waste/slope/consent/protection/client-supplied/by-others, filtered by applicability.
3. **Snapshot** — `buildProjectConditionsSnapshot` filters to applicable keys, ranks required first, `shouldShowStage`, `unresolvedRequiredKeys`.
4. **Readiness** — required unresolved keys hard-block `canGenerateQuickEstimate`. Skip / Not sure / deferred assume do not clear required keys.
5. **UI** — Generate disabled until required resolved. PC stage renders when known or applicable. Auto-unlock only when required keys are already resolved (e.g. brief extraction).
6. **Server** — `runEstimateGeneration` refuses with `USER_ERRORS.projectConditionsIncomplete`. Batch PC save advances stage to `ready_to_estimate` only when required are resolved.
7. **No** WA duplicate reintroduction. DC-01 / DC-02 unchanged. No migration. No requirement emission. No 3.2.3 UI. No extra AI.

---

## Readiness classes

| Class | Meaning | Generate |
| --- | --- | --- |
| **Required** | Materially changes estimate; no authorised assumption | HARD BLOCK until explicit known value |
| **Assumable** | Asked; “Use reasonable assumption” UI exists but is **not** persisted | Does not clear required; does not fake READY |
| **Optional** | Convenience / split | Never blocks |

**HARD BLOCK:** unresolved required applicable condition.  
**READY WITH ASSUMPTIONS:** only if a current persisted assumption exists (not available for PC writes in this batch).  
**READY:** no unresolved required keys.  
**Skip / Not sure:** remain unresolved.

---

## Per Work Area (always-required on every product WA)

`site_access`, `material_carry_distance`

Then union:

| WA | Additional required | Assumable | Optional / omit |
| --- | --- | --- | --- |
| Deck | `waste_bin_access` if existing removal | slope, consent | parking; no floor/services |
| Bathroom | — | floor, occupied, hours, services, hazmat, protection | parking, client-supplied, by-others |
| Demolition | floor, waste, services, hazmat | occupied, hours, protection | parking |
| External stairs | — | slope, consent | parking |
| Fence | — | slope | parking; no floor/services |
| Retaining | waste if excavation | slope, consent | parking |
| Kitchen | — | floor, occupied, hours, services, hazmat, protection | parking, client-supplied, by-others |
| Pergola | — | slope, consent | parking |
| Commercial components | union of components; **ask once** at project | union | no WA access clones |

---

## Verification (local)

| Suite | Result |
| --- | --- |
| `npx tsc --noEmit` | pass |
| `npm run lint` | pass |
| `npm run build` | pass |
| FOUNDATION-R1-R1 | **45 passed, 0 failed** |
| FOUNDATION-R1 | **80 passed, 0 failed** |
| Stage 3.2.1 | **53 passed, 0 failed** |
| Stage 3.2.2 core | **50 passed, 0 failed** |
| 3.2.2-R1 | **27 passed, 0 failed** |
| 3.2.2-R2 | **23 passed, 0 failed** |
| 3.2.2-R3 | **23 passed, 0 failed** |
| 3.2.2-R4 | **22 passed, 0 failed** |
| 3.2.2-R5 | **24 passed, 0 failed** |
| 3.1D | **45 passed, 0 failed** |
| R6 r1 / multi-WA / r2 / r3 | 25 / 30 / 67 / 18 passed, 0 failed |
| R6 r4 attention | **19 passed, 0 failed** (stale “no migration 034” updated to allow branding P0 `034`; still forbids 035+) |
| Bathroom commercial | **19 passed, 0 failed** |
| Outdoor calibration | passed |
| Outdoor AI extraction | passed |
| Commercial realism | passed |
| 2B.10 | PASSED |
| COMMERCIAL-P0 | **34 passed, 0 failed** |
| Cost-first Rates | **40 passed, 0 failed** |
| Org isolation | passed |
| RLS coverage | passed |
| 2A.5 tenant isolation | PASSED |
| 2A.3A pricing | PASSED |
| 2B.8 quote | **32/32 passed** |
| Quote safety | passed |

No migrations. No requirement emission. No Stage 3.2.3 UI.

---

## Status

| Item | Status |
| --- | --- |
| FOUNDATION-R1 | Complete / Preview regression remediated by R1-R1 |
| FOUNDATION-R1-R1 | **Complete — Owner Preview Validated** |
| FOUNDATION-R2 | Complete Local / Owner Preview Pending — `docs/implementation/FOUNDATION_R2_SCOPE_DETAILS_COMPLETION.md` |
| REQ-1 / Material / Labour emission | Not Started |
| Deck pilot | Not Started |
| Stage 3.2.3 | Not Started |
| Company DNA | Not Started |
| PERF-FUTURE-01 | Planned |
| Production Scope Discovery | Disabled |

**Exact next after this record:** FOUNDATION-R2 Owner Preview. REQ-1 stays Not Started until R2 Owner PASS.
