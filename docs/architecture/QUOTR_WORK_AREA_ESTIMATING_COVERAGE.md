# Quotr Work Area Estimating Coverage

**Status:** CANONICAL — FOUNDATION-EXPANSION-0-R1 (independent-audit reconciled)  
**Date:** 2026-08-20  
**Related:** [QUOTR_SUPPORTED_WORK_AREA_CONTRACT.md](./QUOTR_SUPPORTED_WORK_AREA_CONTRACT.md), [QUOTR_COMPANY_MATERIALS_AND_RATES_CONTRACT.md](./QUOTR_COMPANY_MATERIALS_AND_RATES_CONTRACT.md), [QUOTR_ESTIMATING_ENGINE_ARCHITECTURE.md](./QUOTR_ESTIMATING_ENGINE_ARCHITECTURE.md)

This document is the canonical Work Area estimating coverage map for the 14 product creatable types.

It does **not** implement new calculators or rates. Claims below are **code-verified** against `lib/estimate/calculators/*`, Job Plan / Refine registries, and FE-0 assistant wiring.

---

## How to read this document

Every coverage claim is one of:

| Marker | Meaning |
| --- | --- |
| **CURRENT IMPLEMENTATION** | What the code does today |
| **KNOWN DEFECT / RISK** | Present behaviour that is unsafe, misleading, or commercially incomplete |
| **TARGET ARCHITECTURE** | Intended future shape — **not** current behaviour |
| **FUTURE CAPABILITY** | Optional later work; not required for first expansion |

Do not write target or future behaviour in present tense.

---

## 1. Product principle (locked)

Quotr must **ASK** only information worth interrupting the builder for, **ASSUME** where safe and disclose, **REFINE** for additional useful inputs, and expose **ADVANCED** only where the current estimator **consumes** the data.

Never appear confident while missing material-pricing-sensitive facts that are neither asked nor disclosed.

---

## 2. Work Area estimating contract (conceptual)

**CURRENT IMPLEMENTATION:** existing metadata already covers parts of this. Do not create a parallel TypeScript contract yet.

| Concept | Existing home |
| --- | --- |
| Product / display band | `lib/work-areas/support-contract.ts` — **not** estimator maturity |
| Scope catalogue | `lib/scopes/catalogue.ts`, scope templates |
| Job Plan projection | `lib/assistant/job-plan/adapters/*` |
| Clarify / Refine candidates | `lib/assistant/clarify/*`, `lib/assistant/refine/*` |
| Physical model + requirements | `lib/estimate/calculators/*`, `lib/estimate/requirement-*` |
| Material identity vs rate | `QUOTR_COMPANY_MATERIALS_AND_RATES_CONTRACT.md` |
| Commercial lines | `lib/estimate/calculate-estimate.ts`, component authority |

**TARGET ARCHITECTURE** (documentation only — not implemented as a type):

```
WorkAreaEstimatingContract {
  workAreaType
  scopeCatalogue
  factCatalogue
  questionPolicy          ASK_NOW | ASSUME | REFINE | ADVANCED | DERIVED
  refinementPolicy        only consumed facts
  materialRequirementCapabilities
  labourCapabilities
  allowanceCapabilities
  pricingFallbacks
  confidenceDrivers
}
```

---

## 3. Estimator expansion pipeline (locked)

**TARGET ARCHITECTURE:**

```
SUPPORTED SCOPE
  → CANONICAL FACTS
  → PHYSICAL MODEL
  → MATERIAL / LABOUR / OTHER REQUIREMENTS
  → RATE RESOLUTION
  → COMMERCIAL LINES
  → BUILDER REVIEW
```

Do not jump from scope directly to an arbitrary rate line.

**CURRENT IMPLEMENTATION:** several calculators still emit package / allowance money before a full physical model (retaining wall face m² package, kitchen appliance lump sums, most fitout m² packages).

---

## 4. Requirement taxonomy (canonical)

These labels describe **what the calculator emits as priced commercial quantity**, not what a human estimator would conceptually take off.

| Label | Meaning |
| --- | --- |
| **DETAILED_REQUIREMENT** | Calculator emits a priced quantity for a named physical product/family (identity + unit), then rate-resolves it |
| **SHADOW_REQUIREMENT** | Physical quantity/spec is computed or disclosed, but **does not own money** (or money stays on a package line) |
| **PACKAGE_ALLOWANCE** | One commercial line (m² / lm / ea / lump) owns money for a whole family; subcomponents are not separately priced |
| **NOT_MODELLED** | No quantity and no priced line for that family |
| **PRICING_REQUIRED** | Identity/quantity may exist; no trusted rate — must not invent price |

Apply the **same** label to identical calculator behaviour. Do not upgrade a package line because the domain conceptually has posts, tiles, or linings.

---

## 5. Coverage score legend

Estimator maturity (this document) is independent of product display band (§12).

| Score | Meaning |
| --- | --- |
| **MATURE / CONDITIONAL** | Reference wiring exists; some commercial lines remain allowances; geometry/labour conditions apply |
| **PARTIAL** | Calculator + some interview wiring; mixed package and resolved lines; not a full physical model |
| **MINIMAL** | Package/allowance-heavy; interview thin or generic |
| **MINIMAL / ACTIVE RISK** | Can emit a complete-looking price from silent defaults — commercially unsafe |
| **NOT_READY** | No calculator |
| **UNVERIFIED** | Independent audit / this reconciliation did not inspect that axis in source |

---

## 6. All Work Areas — reconciled maturity matrix

| Work Area | Display band | Scope | Facts/Q | Materials | Labour | Commercial | Confidence | Overall |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| deck | trial_supported | MATURE / CONDITIONAL | MATURE / CONDITIONAL | hybrid DETAILED + PACKAGE + SHADOW | PARTIAL | MATURE / CONDITIONAL | PARTIAL | **MATURE / CONDITIONAL** |
| bathroom | trial_supported | PARTIAL | PARTIAL | PACKAGE_ALLOWANCE (mixed resolve) | PARTIAL (per-trade exists) | PARTIAL | PARTIAL | **PARTIAL** — labour ahead of material |
| retaining_wall | developing | MINIMAL | MINIMAL | PACKAGE + SHADOW defect | PARTIAL | MINIMAL / misleading | MINIMAL | **MINIMAL / ACTIVE RISK** |
| kitchen | developing | MINIMAL | MINIMAL | PACKAGE + resolver defect | MINIMAL (no shared access factor) | MINIMAL | MINIMAL | **MINIMAL** + **KITCHEN-RATE-AUTHORITY-01** |
| fence | developing | MINIMAL | MINIMAL | PACKAGE_ALLOWANCE | PARTIAL (slope flag) | MINIMAL | MINIMAL | **MINIMAL** |
| pergola | developing | MINIMAL | MINIMAL | PACKAGE_ALLOWANCE | PARTIAL | MINIMAL | MINIMAL | **MINIMAL** — not ahead of fence |
| external_stairs | component | PARTIAL | PARTIAL | PACKAGE_ALLOWANCE + some resolveRate | PARTIAL | PARTIAL | PARTIAL | **PARTIAL** — calculator ahead of display band |
| demolition | component | MINIMAL | MINIMAL | PACKAGE_ALLOWANCE | PARTIAL | MINIMAL | MINIMAL | **MINIMAL** — relatively honest |
| painting | component | PARTIAL | PARTIAL | PACKAGE + paint-litre SHADOW | UNVERIFIED | PARTIAL | PARTIAL | **PARTIAL** — ahead of display band |
| internal_walls | component | MINIMAL | MINIMAL | PACKAGE_ALLOWANCE | UNVERIFIED | MINIMAL | MINIMAL | **MINIMAL** |
| ceilings | component | MINIMAL | MINIMAL | PACKAGE_ALLOWANCE | UNVERIFIED | MINIMAL | MINIMAL | **MINIMAL** — same pattern as internal_walls |
| doors | component | MINIMAL | MINIMAL | PACKAGE_ALLOWANCE | UNVERIFIED | MINIMAL | MINIMAL | **MINIMAL** |
| flooring | component | MINIMAL | MINIMAL | PACKAGE_ALLOWANCE | UNVERIFIED | MINIMAL | MINIMAL | **MINIMAL** |
| plastering | component | MINIMAL | MINIMAL | PACKAGE_ALLOWANCE | UNVERIFIED | MINIMAL | MINIMAL | **MINIMAL** |

---

## 7. Deck — reference for wiring / domain architecture

**CURRENT IMPLEMENTATION**

Deck is the **reference for Assistant wiring and domain architecture**, not proof that every component is detailed.

What is real today:

- Dedicated Job Plan adapter (`lib/assistant/job-plan/adapters/deck.ts`)
- Dedicated Refine adapter (`lib/assistant/refine/adapters/deck.ts`)
- Real **decking surface** quantity model (board lm takeoff exists)
- Real **structural shadow requirement** model where facts permit (joist/post takeoff can exist without owning money)
- Calculator: `lib/estimate/calculators/deck.ts`
- Access labour factor applied via `getCombinedLabourAccessFactor`
- Component commercial authority path for decking vs allowance fallback

Hybrid commercial model (intentional):

- Decking can price as **package allowance** when board width / lm pricing is not confirmed
- Framing/substructure often prices as `deck.substructure.m2` **package**
- Stairs, balustrade, handrail, pile replacement remain **allowances**
- Irregular / insufficient geometry can remain legacy/fallback

**KNOWN DEFECT / RISK**

- None of the silent-complete-price class of retaining wall
- `consumedByCalculator: true` is **manually asserted** on Refine candidates (see **CONSUMED-FACT-CONTRACT-01**)

**FUTURE CAPABILITY (deferred)**

- LABOUR-CREW-01
- Non-rectangular structural detail
- Promoting every allowance to DETAILED_REQUIREMENT

**Do not copy universally**

- Height / access / steps coupling
- Deck structural material identity contracts
- Fascia level-1 check remapping

---

## 8. Retaining Wall — MINIMAL / ACTIVE ESTIMATING RISK

**CURRENT IMPLEMENTATION**

| Layer | Status |
| --- | --- |
| Calculator | `lib/estimate/calculators/retaining-wall.ts` — present |
| Job Plan adapter | **None** — falls through to `genericJobPlanAdapter` |
| Refine adapter | **None** — `getRefineAdapter("retaining_wall")` is `null` |
| Clarify policy | **None** specific — no retaining-wall clarify adapter |

Silent complete-price behaviour:

| Missing fact | What the calculator does |
| --- | --- |
| `retaining_wall.length_m` | Defaults to **10 m** via `recordDefaultedNumber` |
| `retaining_wall.height_m` (and no high/low) | Defaults to **1.5 m** |
| `retaining_wall.material` | `getWallMaterialRates(null)` falls through to **timber face** benchmark rates |

Therefore a substantially unspecified wall can receive a **complete-looking commercial estimate**.

This is **ACTIVE ESTIMATING RISK**. Do not soften this language.

### 8.1 Fact contract (code-verified)

| Fact | Asked in Job Plan / Refine? | Consumed by calculator? | Class now |
| --- | --- | --- | --- |
| `retaining_wall.length_m` | No dedicated ASK_NOW | Yes (face m²; default 10) | **HARD_MINIMUM** / **ASK_NOW** (target) |
| `retaining_wall.height_m` | No | Yes (or default 1.5) | **HARD_MINIMUM** / **ASK_NOW** (target) |
| `height_high_m` / `height_low_m` | No | Yes — average height derive | **REFINE** (target) |
| `retaining_wall.material` | No | Yes — rate family; null → timber fallback | **HARD_MINIMUM** / **ASK_NOW** (target) |
| `retaining_wall.fixing_type` | No | Yes — face-fixed labour ×1.15 | **REFINE** (target) |
| `retaining_wall.excavation_required` | No | Yes — extra hours/face m² | **REFINE** (target) |
| `retaining_wall.drainage_required` | No | Yes — drain lm / novacoil | **REFINE** (target) |
| `retaining_wall.drain_connection_required` | No | Yes | **REFINE** (target) |
| carting / disposal | Partial via PC / facts | Yes | **REFINE** (target) |
| `retaining_wall.is_raking` | No | Indirect via high/low height | **REFINE** (target) |
| `retaining_wall.post_spacing_m` | Template only | **NOT CONSUMED** | **NOT_CURRENTLY_CONSUMED** — not ADVANCED refinement |
| engineering/consent | Template | Exclusion text only | INFORMATIONAL / ADVANCED (target, if consumed) |
| existing wall removal | — | No | **NOT_CURRENTLY_CONSUMED** |
| ground conditions | — | No | **NOT_CURRENTLY_CONSUMED** |

### 8.2 Backfill — DISCLOSURE / CALCULATION INTEGRITY DEFECT

**KNOWN DEFECT / RISK**

When `backfill_included` and `backfill_depth_m` are present, the calculator:

1. Computes `volume` via `calculateBackfillVolume`
2. Pushes assumption: `"Backfill volume calculated: X m³"`
3. Attaches a volume build-up as **shadow metadata**
4. Prices the line as **quantity = `faceArea`**, unit **`face m²`**, item key `retaining_wall.backfill.face_m2`

The disclosed m³ **does not drive the priced quantity**.

Must resolve before Retaining Wall maturity expansion. **Do not treat the m³ disclosure as commercial truth.**

**TARGET ARCHITECTURE:** priced backfill quantity = computed volume (or drop the volume disclosure).

---

## 9. Question coverage (current vs target)

Classification keys: **HARD_MINIMUM**, **ASK_NOW**, **ASSUME_IF_SKIPPED**, **REFINE**, **ADVANCED**, **DERIVED_NEVER_ASK**, **NOT_CURRENTLY_CONSUMED**.

### deck (CURRENT IMPLEMENTATION)

Job Plan + Refine adapters exist. ASK_NOW-class facts are wired for dimensions, board material, access/steps. Joist section / centres are **not** Refine candidates (`DECK_NOT_CONSUMED_REFINE_KEYS`).

### retaining_wall (CURRENT IMPLEMENTATION)

No dedicated interview. HARD_MINIMUM facts are **not asked** before estimate. See §8.

### bathroom (CURRENT IMPLEMENTATION)

Job Plan + Refine adapters exist. Room size / wet-area facts partially asked. Finish still quality-driven.

### kitchen, fence, pergola (CURRENT IMPLEMENTATION)

Generic Job Plan. No Refine adapter. Dimension facts live in templates, not ASK_NOW interview.

### external_stairs (CURRENT IMPLEMENTATION)

Generic Job Plan. Calculator consumes riser count, width, ground condition, handrail/balustrade flags. **TARGET:** dedicated adapter is relatively cheap because the calculator is already ahead of the band.

### painting (CURRENT IMPLEMENTATION)

Job Plan + Refine adapters exist. Paint litres are SHADOW on a m² material line.

### demolition / remaining fitout (CURRENT IMPLEMENTATION)

Generic Job Plan. Area/count templates. Quality ASSUME.

---

## 10. Material capability matrix (corrected)

Labels = **priced emission**, not conceptual takeoff.

| Work Area | What the calculator actually prices | Taxonomy |
| --- | --- | --- |
| deck | Decking (lm takeoff or m² package); substructure m² package; stair/balustrade/handrail **allowances**; structural takeoff may be SHADOW | hybrid DETAILED + PACKAGE_ALLOWANCE + SHADOW |
| retaining_wall | Face m² material package; drainage lm; backfill **face m² package** (volume is SHADOW / defective) | PACKAGE_ALLOWANCE + SHADOW defect |
| bathroom | Waterproofing / tiling / fixtures / lining as **benchmark or resolved package lines**, not separate product identities | PACKAGE_ALLOWANCE |
| kitchen | Cabinetry + benchtop via `resolveRate`; appliances / install / splashback / rangehood **hardcoded benchmarks** | PACKAGE_ALLOWANCE + **resolver defect** |
| fence | Timber/metal **per lm package** — not posts / rails / panels | PACKAGE_ALLOWANCE |
| pergola | Frame + roof package rates | PACKAGE_ALLOWANCE |
| external_stairs | Material per riser + landing m² + handrail/balustrade lm packages | PACKAGE_ALLOWANCE |
| demolition | Wall lm / floor m² / ceiling m² / fixture ea packages | PACKAGE_ALLOWANCE |
| internal_walls | m² package + skirting/insulation/stopping/painting add-ons | PACKAGE_ALLOWANCE |
| ceilings | m² package + battens/insulation/stopping/painting add-ons — **same pattern as internal_walls** | PACKAGE_ALLOWANCE |
| doors | ea package + architrave/paint add-ons | PACKAGE_ALLOWANCE |
| flooring | m² package + prep/underlay/skirting add-ons | PACKAGE_ALLOWANCE |
| painting | m² labour/material; paint litres SHADOW | PACKAGE_ALLOWANCE + SHADOW |
| plastering | m² package | PACKAGE_ALLOWANCE |

Do not describe bathroom waterproofing/tiles/fixtures/linings, fence posts/rails/panels, or ceiling grid/tiles/plaster as DETAILED_REQUIREMENT unless the calculator emits separately priced identities.

---

## 11. Labour capability matrix (corrected)

| Work Area | CURRENT IMPLEMENTATION | Access / site | Notes |
| --- | --- | --- | --- |
| deck | Productivity hours + access factor | `getCombinedLabourAccessFactor` | LABOUR-CREW-01 deferred |
| retaining_wall | Hours per face m² + excavation add | Access factor yes | Volume labour not tied to backfill m³ |
| bathroom | **Per-trade breakdown exists** (demo, carpentry/prep, fixture install, lining, coordination) | Access factor yes | Labour more mature than material |
| kitchen | Package hours / lump labour | **Does not call `getCombinedLabourAccessFactor`** | Prior coverage claim was wrong |
| fence | Hours per lm | Access factor yes; **`fence.slope_condition` steep/slope multiplies labour** | Terrain/slope is **partial**, not absent |
| pergola | Hours per m² | Access factor yes | Not materially ahead of fence |
| external_stairs | Hours with ground/width factors | Access factor yes | Comparatively mature |
| demolition | Hours by element | Access + carting | Hazardous material **FUTURE** |
| painting / internal_walls / ceilings / doors / flooring / plastering | Package hours in `fitout.ts` | **UNVERIFIED** — `fitout.ts` does not call `getCombinedLabourAccessFactor` | Do not mark PASS |

---

## 12. Capability band ≠ estimator maturity

**CURRENT IMPLEMENTATION:** `trial_supported` / `developing` / `component` in `lib/work-areas/support-contract.ts` is a **PRODUCT / DISPLAY BAND** (Add Work Area badges, customer copy). It does **not** gate calculator selection, interview adapters, or commercial authority.

Evidence: `external_stairs` and `painting` are `component` but calculator/adapters are ahead of several `developing` types.

**Do not use display band as the primary engineering-expansion ordering signal.**

**TARGET ARCHITECTURE:** later simplification or explicit dual fields (`displayBand` vs `estimatorMaturity`). **Do not delete the band in this task.**

---

## 13. Kitchen — KITCHEN-RATE-AUTHORITY-01

**KNOWN DEFECT / RISK — MUST-FIX BEFORE KITCHEN EXPANSION / broader commercial release**

| Line | Rate path |
| --- | --- |
| Cabinetry | `resolveRate` + `KITCHEN_BENCHMARKS.cabinetry` fallback |
| Benchtop | `resolveRate` + fallback |
| Appliances | **Hardcoded** `KITCHEN_BENCHMARKS.appliances` |
| Appliance install | **Hardcoded** |
| Splashback | **Hardcoded** |
| Rangehood | **Hardcoded** |
| Flooring / plumbing / electrical / materials package | Also hardcoded benchmarks (related, same defect class) |

Consequence: a **company rate for those item keys is ignored**.

Backlog: **KITCHEN-RATE-AUTHORITY-01**. Do not fix in this documentation batch.

---

## 14. consumedByCalculator — CONSUMED-FACT-CONTRACT-01

**CURRENT IMPLEMENTATION:** Deck (and bathroom/painting) Refine adapters set `consumedByCalculator: true` **manually**. Compose then filters on that flag. Acceptable for the current three adapters.

**KNOWN DEFECT / RISK (architecture):** unsafe to copy by hand across 13 Work Areas. UI can claim a field improves the estimate when the calculator ignores it (`post_spacing_m` is the retaining-wall example of a template fact that is not consumed).

**MUST-FIX before large-scale adapter rollout:** **CONSUMED-FACT-CONTRACT-01**

**TARGET ARCHITECTURE:** derived consumed-fact metadata **or** static/lint/test verification against actual calculator `getNumberFact` / `getStringFact` / `getBooleanFact` reads.

Do not implement in this task.

---

## 15. Attention fallthrough — ATTENTION-SEMANTICS-01

**CURRENT IMPLEMENTATION:** `classifyAttentionSemanticBucket` handles known `attentionKind` values then `return "ACTIONABLE_REFINEMENT"`.

**KNOWN DEFECT / RISK:** an unknown future `attentionKind` becomes a false-positive “improve estimate” item.

Backlog: **ATTENTION-SEMANTICS-01** — default unknown → CHECK or INFORMATIONAL, or exhaustive compile-time handling. Not expanded in FE-0-R1.

---

## 16. Legacy / runtime disposition (reconciled)

| System | Disposition | Notes |
| --- | --- | --- |
| Job Plan | **KEEP** | Canonical |
| Clarify | **KEEP** | Canonical |
| Refine | **KEEP** | Canonical |
| Project Conditions | **KEEP** | Canonical |
| Attention navigation resolver | **KEEP** | `lib/assistant/mode/attention.ts` |
| Scope Discovery **suggestion data path** | **KEEP (data)** | May still feed suggestions |
| Scope Discovery **dedicated review UI** | **REMOVE LATER / DEAD UI** | Orphaned as a primary surface |
| Scope Details / QuestionBlock | **REMOVE LATER / DEAD UI** | Removed from Edit Job in FE-0; may remain in planning legacy |
| ScopeSummaryBlock diagnostics | **REMOVE LATER / DEAD UI** | Planning Scope Review only |
| Old generic “N items need attention” | **REMOVE LATER / DEAD UI** | Replaced by semantic labels |
| Breakdown-first Estimate Ready | **REMOVE LATER / DEAD UI** | Builder Review is primary |
| Monolithic `commercial_fitout` WA | **BLOCKING_REMOVAL** | Parent use-case only |

Do **not** mass-delete in this task.

---

## 17. MUST-FIX before estimator expansion

| ID | Item | Blocks |
| --- | --- | --- |
| A | Retaining Wall zero/low-input complete-price (10 m / 1.5 m / timber fallback) | Any RW expansion / trust |
| B | Retaining Wall misleading backfill-volume disclosure vs face m² price | RW maturity |
| C | Kitchen resolver bypass — **KITCHEN-RATE-AUTHORITY-01** | Kitchen expansion / commercial release of those lines |
| D | **CONSUMED-FACT-CONTRACT-01** before adapter replication | Multi-WA Refine/Job Plan rollout |
| E | Material capability taxonomy consistency (this document now defines labels) | Planning honesty |
| F | Capability-band ≠ estimator maturity (this document; later code simplification) | Expansion ordering |

---

## 18. Can wait (deferred)

Unless business priorities change:

- Deck non-rectangular structural detail
- Fence full terrain model (steep flag already partial)
- Pergola roof detail
- External stairs balustrade compliance detail
- Demolition hazardous-material model
- Company Material UX
- LABOUR-CREW-01
- Fitout detailed material decomposition
- ATTENTION-SEMANTICS-01 (unless a one-line exhaustiveness fix is cheap later)

---

## 19. Expansion order (after UX-PREMIUM + safety blockers)

Display band is **not** the order.

| Order | Work Area | Why |
| --- | --- | --- |
| 1 | **retaining_wall** | Current behaviour presents **trust / commercial risk** (silent complete price + backfill disclosure defect) |
| 2 | **bathroom** | Job Plan + Refine already exist; **per-trade labour** exists; material maturity can make a second reference WA |
| 3 | **external_stairs** | Calculator already ahead of `component` band; dedicated Assistant adapter is relatively cheap |

Then reassess:

| Candidate | Gate |
| --- | --- |
| Fence | After RW interview patterns; slope already partial |
| Pergola | Same package class as fence — not automatically next |
| Kitchen | Depends on **KITCHEN-RATE-AUTHORITY-01** |

Fitout batch later, after labour verification (`getCombinedLabourAccessFactor` gap in `fitout.ts`).

---

## 20. Company Material / Rate — future programme

Existing contract: `QUOTR_COMPANY_MATERIALS_AND_RATES_CONTRACT.md`.

**CURRENT IMPLEMENTATION:** Deck structural identity path is furthest. Company create / save-to-company UX is not built.

**FUTURE CAPABILITY:** Change material → Common / Company / project custom → PRICING_REQUIRED if no rate → optional Save to Company.

**Permanent rule:** MATERIAL = physical identity; RATE = commercial evidence.

---

## 21. Performance baseline (PERF-01)

**CURRENT IMPLEMENTATION (FE-0 marks):**

- `work_area_remove_complete`
- `canonical_write_stale_projection`

Primary remaining delay: full `router.refresh()` RSC reload after canonical writes.

**FUTURE CAPABILITY:** partial revalidation, debounced fact writes, lazy Builder Review slices. No optimisation in this batch.

---

## 22. FE-0 functional hardening (implemented — code, not docs)

| Item | CURRENT IMPLEMENTATION |
| --- | --- |
| Remove WA | Confirmation dialog, inline error, optimistic exclusion, stale bridge |
| Refine | All actionable candidates visible; no More detail gate |
| Stale | `bridgeEstimateStaleAfterCanonicalWrite` on canonical write success |
| Attention | Semantic labels; informational excluded |
| Edit Job | Work Areas / Site & Project Conditions / Additional Details; Advanced optional |

---

## 23. Independent audit reconciliation

This R1 pass accepts the read-only audit unless code inspection disproved a claim. Inspection **confirmed**:

- RW 10 m / 1.5 m defaults and timber material fallback
- Backfill volume disclosed, face m² priced
- `post_spacing_m` unused by calculator
- Kitchen hardcoded appliance/install/splashback/rangehood
- Kitchen has no shared access factor
- Fence slope condition is partial
- Bathroom per-trade labour exists
- Deck Refine `consumedByCalculator` is manual
- Display bands do not gate calculators
- Attention unknown-kind fallthrough

---

## 24. Next actions

1. Commit / push FE-0 + this canonical map (this task).
2. UX-PREMIUM-01 (paused until Owner starts it).
3. **ESTIMATOR-SAFETY-0** (not started): RW silent-price + backfill integrity, then CONSUMED-FACT-CONTRACT-01, then Kitchen resolver — **before** estimator expansion.
4. Do **not** start retaining-wall or kitchen calculator fixes in this task.
