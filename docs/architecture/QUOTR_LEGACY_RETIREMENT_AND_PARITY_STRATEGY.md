# Quotr Legacy Retirement and Parity Strategy

**Status:** CANONICAL  
**Date:** 2026-08-17  
**HEAD:** `a4de0f875b3497f11d4bcd0379865a811ca4bf1c`  
**Mode:** Architecture lock. Does not remove live behaviour.

Rule: **Do not remove legacy behaviour until** no live consumer; compatibility need understood; replacement has parity; tests prove safe removal.

---

## 1. Lifecycle classes

| Class | Meaning |
| --- | --- |
| **ACTIVE** | Current authority; extend here |
| **COMPATIBILITY** | Still live; labelled; not the target SoT |
| **FALLBACK** | Used only when the active path cannot resolve |
| **DEPRECATED** | Documented for removal; still compiled/served |
| **REMOVE** | Safe to delete after consumer proof |

---

## 2. Application (conceptual)

| Domain | Class now | Target | Notes |
| --- | --- | --- | --- |
| Generic `scope.*` package rates | COMPATIBILITY (Advanced UI) | DEPRECATED → REMOVE after RATE-LEGACY-01 | CF-D5; DEMO-R6 hid from primary nav |
| Legacy paired sell benchmarks | COMPATIBILITY | Remain until cost-only conversion opted-in | COMMERCIAL-P0 CF-D2; no silent convert |
| Hardcoded labour 60/90 | FALLBACK | REMOVE when `resolveLabourRate` always hits company/benchmark | Honest label |
| Deck face `DECK_BENCHMARKS.faceBoardLm` + labour 35/55 | ACTIVE money / hardcoded | FALLBACK then REMOVE after DECK-2 | OD-FACE-01 |
| `materialBuildUp` `priced: false` footnotes | COMPATIBILITY | ACTIVE MaterialRequirement `priced: true` per component | Do not dual-price |
| Deck `deck.substructure.m2` / `deck.fixings.m2` | ACTIVE package | FALLBACK after DECK-R2 | Not converted to lm |
| Old WA PC Facts (`deck.access`, demo carting, …) | DEPRECATED (suppressed) | REMOVE after no readers | R1 suppressed asks; keep resolvers for old rows |
| Question template aliases | ACTIVE | Consolidate with ISD map later | Do not drop until ISD uses product types |
| ISD `commercial_fitout` parent | ACTIVE recognition | Stay; never ACTIVE calculator | OD-CAT-01 |
| Unused rate fields (`rates.markup_percent`) | DEPRECATED | REMOVE later | Dead as sell driver |
| Dead helper functions | case-by-case | REMOVE only with grep + tests | |
| Stale question templates (PC clones) | DEPRECATED | Already hidden; delete after evidence | |
| Package calculators (kitchen $/m², fence lm) | ACTIVE immature | FALLBACK as WA matures | Not an emergency delete |
| Hardcoded material lines | COMPATIBILITY | Catalogue keys | Face boards first |

---

## 3. Shadow / parity migration

Preferred promotion:

```
OLD AUTHORITATIVE OUTPUT
  vs
NEW REQUIREMENT OUTPUT
  run in parallel (shadow)

Compare: quantity · cost · sell

Promote new engine only when parity or documented intentional difference is proven.
```

Applies especially to MaterialRequirements, LabourRequirements, Deck reference calculator, later Work Areas.

Where new output **intentionally** differs (e.g. lm takeoff replacing m² package, as R2-R1 did: Deck 1 sell $53,440 → $48,340): require documented commercial justification **before** Owner Preview.

REQ-4 is the first dedicated reconciliation batch. REQ-1 envelope is in place and must not change money so that shadow has a clean baseline. Physical aggregation: `docs/architecture/QUOTR_REQUIREMENT_AGGREGATION_CONTRACT.md`.

### Parity classes (AC-11 refined)

**A. Semantic reimplementation** — new engine intended to reproduce the old formula. Target: exact deterministic parity subject to documented currency rounding.

**B. Intentional model improvement** — new physical model changes the result. Require: documented reason; fixture expected output updated explicitly; commercial review; Owner Preview. Numeric variance is **reported**, not auto-accepted because it sits under a generic % band.

Component-level authority lifecycle (reserved, not implemented): `LEGACY_AUTHORITATIVE` → `SHADOW` → `REQUIREMENT_AUTHORITATIVE` → `LEGACY_FALLBACK` → `LEGACY_RETIRED`. **REQ-SNAPSHOT-01** blocks promotion.

Existing verification to reuse: `scripts/verify-batch-2b4-shadow-parity.ts`, outdoor calibration, commercial goldens — extend, do not replace.

---

## 4. Golden fixture strategy

Every supported Work Area should eventually have:

**SIMPLE · MEDIUM · COMPLEX · EDGE**

Protect for each:

- Facts
- Project Conditions
- Scope
- requirements
- hours
- material quantities
- cost
- sell
- margin
- assumptions

### Naming / versioning

```
golden/{workArea}/{simple|medium|complex|edge}/v{n}
```

Examples: `golden/deck/simple/v1`, `golden/deck/edge/v2`.

Bump `v` when intentional commercial change is approved. Do not silently retune expected $ to hide a bug.

### Golden classes (AC-12)

**DETERMINISTIC GOLDENS** — exact facts, quantities, hours, cost, sell, documented rounding.

**AI / RECOGNITION GOLDENS** — expected canonical Work Area, expected Facts/constraints or semantic properties, confidence/support classification. **Not** exact generative prose unless prose is a deterministic contract.

Do not create a new AI test system in this batch.

Reuse:

- `docs/specifications/CANONICAL_COMMERCIAL_SCENARIOS.md`
- `docs/specifications/GOLDEN_PRICING_EXPECTED_RESULTS.md`
- `docs/specifications/GOLDEN_SCENARIO_EXECUTION_MAP.md`
- `scripts/verify-outdoor-calibration.ts`
- `scripts/verify-batch-2b3b-golden-commercial-engine.ts`

Add requirement fields to fixtures when REQ-2/3 emit. Do not create a second golden religion.

---

## 5. Non-goals of this lock

Deleting `scope.*` rows · converting grandfathered sell pairs · removing 60/90 fallback · rewriting Owner rates.
