# REQ-3.1 — Deck labour LabourRequirement shadow emission

**Classification:** COMPLETION  
**Status:** COMPLETE / TECHNICALLY VALIDATED  
**Date:** 2026-08-17  
**Branch:** `hardening/stage-2a-security`  
**Baseline HEAD:** `63012c7ed5e2145381e3da1fc12e8c58c6c0caa0`  
**Verify:** `npx tsx scripts/verify-req-3-1-deck-labour-requirement.ts`  
**Owner gate:** `docs/runbooks/REQ_3_1_OWNER_TECHNICAL_GATE.md`

REQ-3 is **COMPLETE / LABOUR EMISSION FOUNDATION VALIDATED**. LabourRequirement capability is **ACTIVE** — current emitter: **Deck labour only**. Does not authorise REQ-3.2, DECK-3 task split, REQ-4 promotion, labour UI, persistence, or Production.

---

## Purpose

Prove that the Deck calculator can emit **one** real `LabourRequirement` for existing **Deck labour** that reuses the existing hours formula and `resolveLabourRate` result, without becoming estimate-money authority.

---

## Current Deck labour formula (code evidence)

Authoritative path: `lib/estimate/calculators/deck.ts` → `createLabourLineItem` → `shapeLabourHours`.

| Step | Reality |
| --- | --- |
| Base physical quantity | `effectiveArea` m² (`deck.area_m2`, else L×W, else assumed 20 m²) |
| Productivity | `deck.base_labour_hours_per_m2` = **1.2 h/m²**. If elevated (`level` contains elevated OR `deck.height_m > 0.3`): add `deck.elevated_extra_hours_per_m2` = **0.25**. Combined `hoursPerM2`. |
| Minimum hours | **None** on this line (bathroom strip-out minimums do not apply) |
| Demolition | **Not included.** `Existing deck removal` is a separate `createLabourLineItem` when `deck.existing_deck_removal` / `deck.demolition_required` |
| Height/geometry | Elevated extra hours as above. Height > 1 m is **assumption text only**, not an hours multiplier |
| Project Condition | `getCombinedLabourAccessFactor` — **one combined number**. Cap 1.35 lives inside that helper (OD-PC-01 unchanged) |
| Access/carry | Consumed **inside** the combined factor. Not preserved as separate constituents |
| Quality/spec | `getQualityFactor` (standard = 1.0). Applied inside hours, **not** a Project Condition |
| Hours | `round2(area × hoursPerM2 × labourAdjustment × qualityFactor)` |
| Rate key | `labour.carpenter.hour` then `labour.general.hour`; hardcoded 60/90 if unresolved |
| Cost / sell | Same `resolveLabourRate` object as the line. Engine `requireEstimateLabourMoney` |
| Line money | `labourHours × hourly cost/sell` via commercial engine. **Line remains money SoT** |

This is **lumped general construction labour**, not a task schedule.

---

## Labour scope represented

**Included today:** one combined carpenter-hours allowance covering substructure + decking construction labour for the Deck Work Area.

**Explicitly not this requirement (separate lines remain lines only):**

- Existing deck removal (independent hour line)
- Face board labour allowance (hardcoded lump $/lm)
- Stair / balustrade allowances
- Materials, framing package, fixings

**Not invented:** demolition, setout, piles/posts, bearers, joists, decking installation, fascia, stairs, balustrade, cleanup as separate LabourRequirements.

**DECK-3 owns** the future task split of this lump.

---

## Shared labour-result design

`shapeLabourHours` in `lib/estimate/labour-hours.ts` is the single hours formula.

`createLabourLineItem` and the Deck labour requirement both consume it.

Deck computes `deckLabourHours` once from the same inputs passed to the labour line, then `buildDeckLabourRequirement` maps that result. No second productivity, PC, or rate formula.

---

## Base hours vs adjusted hours

Current calculator does **not** store a named `baseHours`. Honest reconstruction from the same inputs (not by dividing adjusted hours):

- `baseHours` = `round2(area × hoursPerM2 × qualityFactor)` — labour **before** Project Condition `labourAdjustment`
- `adjustedHours` = `round2(area × hoursPerM2 × labourAdjustment × qualityFactor)` — equals `line.labourHours`

Quality is included in **both** because it is spec/finish, not a Project Condition, and the live formula already multiplies it into hours.

Limitation: there is no independently persisted pre-quality hours value. Do not treat `baseHours` as “task hours before all commercial factors”.

---

## Project Condition provenance

Invariant: **one semantic condition = one commercial consumption.**

The requirement consumes already-resolved `adjustedHours`. Aggregation does not multiply again.

`adjustmentRef.factors[]` carries only what the current calculation preserves:

- Combined factor === 1 → `factors: []`
- Combined factor !== 1 → one factor `{ key: "project.labour_productivity", value: <combined> }`

Do **not** decompose 1.10 into site_access × carry. Those constituents are not preserved on the live result. OD-PC-01 composition is unchanged.

---

## Rate authority

Same `resolveLabourRate({ rates, organisationSettings })` object as the Deck labour line. No second resolver.

| Resolver `sourceType` | `rateProvenance` | `priced` |
| --- | --- | --- |
| `user_rate` | `company` | true |
| `default` (hardcoded 60/90, benchmarks allowed) | `hardcoded_legacy` | true |
| `missing` (benchmarks disabled, no company labour rate) | `hardcoded_legacy` | true |

`sourceType: "missing"` is a **label** on the same 60/90 injection. Current `resolveLabourRate` never returns an unpriced labour result. REQ-3.1-R1 maps that label to `hardcoded_legacy` so the requirement describes the line’s actual cost. Do not copy the dishonest “Pricing required” label onto a component that is already priced at $60.

Trade identity: **`carpenter`** — matches the default labour key order (`labour.carpenter.hour`). Not a full trade taxonomy.

`rateKey` is `labourRate.itemKey` or `labour.carpenter.hour` when the fallback has no item key.

Changing the rate does **not** change `requirementId`.

---

## Missing-rate reconciliation (REQ-3.1-R1)

**Current commercial truth (Option A):** hardcoded $60/$90 remains the intentional legacy labour fallback inside `resolveLabourRate`. It is injected **in the resolver**, not later by `createLabourLineItem`. `allow_benchmark_rates: false` only changes `sourceType` from `default` to `missing`. Cost/sell stay 60/90. The Deck labour line cannot currently be genuinely unpriced.

**Materials differ:** `resolveMaterialRate` with benchmarks off returns cost 0 / `missing`, and Deck surface then uses a “pricing required” package. Labour has no equivalent unpriced path.

**CM-03** records the label-vs-money split as a pre-existing medium issue. Remediating it by actually omitting $60/$90 would change estimate money. Not in REQ-3.1.

There is **no** currently unpriced Deck labour scenario. Shadow parity is required for company, legacy-default, and benchmarks-disabled cases.

---

## Confidence

**medium**

Known: area (or assumed), elevated extra, combined PC factor, company or legacy rate path.  
Unknown: task-level hours, contractor-learned productivity, crew composition. Current model is a broad calibrated lump, not Company DNA.

Not **high**. Not **low** — physical inputs and the live hour path are real.

---

## Assumptions (only real ones)

| Key | When |
| --- | --- |
| `deck.labour.assumed_area` | Defaulted 20 m² used |
| `deck.labour.elevated_productivity` | Elevated extra 0.25 h/m² applied |

Project Conditions are **not** assumptions. They live in `adjustmentRef`.

---

## Commercial boundary — three truths

| Truth | REQ-3.1 Deck labour |
| --- | --- |
| **Physical** | YES — lumped carpenter hours for Deck labour |
| **Pricing** | YES — company cost, or grandfathered 60/90 hardcoded legacy. Current labour resolver has no unpriced path |
| **Commercial authority** | NO / SHADOW — estimate labour line remains money SoT |

`priced: true` means internal cost fields are resolved. It does **not** mean the requirement drives estimate totals, Pricing, or Quote. No `commercialAuthority` field. No sell fields on the requirement. REQ-4 owns promotion.

---

## REQ-3 close

REQ-3 is the LabourRequirement **emission foundation**, not an open queue of extra labour lumps.

Current production emitter: **Deck labour only**. Capability is **ACTIVE**. Future labour emits during Work Area maturation (**DECK-3** for Deck task split). Do not manufacture REQ-3.2.

**Recommend: CLOSED after REQ-3.1 technical validation.**

---

## Handoffs (do not start here)

**DECK-3 owns:** demolition, setout, foundations/posts/piles, bearers, joists, decking installation, fascia/face, stairs, balustrade, cleanup as task-level labour. Replace the current lump only after physical/task formulas exist, shadow parity or intentional-difference review is complete, and component authority promotion is available.

**REQ-4 owns:** the commercial-authority **migration framework**, not further emission:

- REQ-SNAPSHOT-01 (must be resolved before any requirement becomes money authority)
- component-level authority lifecycle (never switch a whole Work Area because one component is ready)
- shadow reconciliation, parity classes, intentional-difference handling
- requirement-authoritative promotion, legacy suppression/fallback
- historical reproducibility boundaries

Example mixed maturity: `decking.surface` requirement-authoritative while `deck.substructure` and `deck.face` remain legacy fallback. Mixed maturity must remain valid.

**CM-03** remains **BACKLOG / NOT STARTED**. Do not remove 60/90 to “fix” the missing label.

**REQ-2.1 Deck surface MaterialRequirement remains unchanged** (115.14 / 10% / 126.65 lm). Material and labour coexist.
