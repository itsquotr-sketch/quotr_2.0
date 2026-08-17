# Quotr Requirement Aggregation Contract

**Status:** CANONICAL for REQ-1 physical aggregation  
**Date:** 2026-08-17  
**HEAD baseline:** `5a6b8223e29e1bde369dc4a4bfe8cc11aeff2b6e`  
**Types:** `lib/estimate/requirements.ts` (`foundation-r1.1`)  
**Code:** `lib/estimate/requirement-normalize.ts`, `lib/estimate/requirement-validate.ts`, `lib/estimate/requirement-aggregate.ts`  
**Engine:** `docs/architecture/QUOTR_ESTIMATING_ENGINE_ARCHITECTURE.md`

This is **physical / information aggregation**. It is **not** pricing-authority promotion. Existing estimate line items remain money SoT until REQ-4.

---

## 1. Envelope

`CalculatorResult.requirements?: readonly EstimateRequirement[]`

- Omit or `[]` is valid.
- Production calculators omit the field except Deck surface (REQ-2.1) and Deck labour (REQ-3.1).
- `calculateEstimate` collects every Work Area envelope, normalises, and attaches `EstimateResult.requirements`.
- Requirement costs are **never** added to recommended cost/sell, Pricing, or Quote.

---

## 2. Pipeline

```
calculator results (optional requirements)
  → collectRequirements
  → normalizeRequirements (validate, clone, duplicate-ID fail, deterministic sort)
  → summarizeEstimateRequirements (physical groups + diagnostic cost totals)
```

Helpers stay domain-specific: `groupMaterialRequirements`, `summarizeLabourRequirements`, `groupPlantRequirements`, `groupSubcontractRequirements`, `groupWasteRequirements`, `aggregatePricedRequirementCosts`.

`aggregateEstimateRequirements` is an alias of `summarizeEstimateRequirements`. It does not promote authority.

---

## 3. Identity and ordering

Deterministic `requirementId` via `buildRequirementId`. Duplicate IDs in one result throw.

Sort: `workAreaId` → kind (`material`, `labour`, `plant`, `subcontract`, `waste`) → `componentKey` → `variantKey` → `requirementId`.

Input arrays are not mutated.

---

## 4. Material aggregation

Merge only when **semantic identity** matches:

- `materialKey` (required for merge; unkeyed rows stay separate)
- purchase unit (case-insensitive)
- specification
- variantKey

Do **not** merge by description or unit alone. H3.2 vs H1.2, hardwood vs pine, and `m²` vs `lm` stay separate. Same canonical key from two Deck Work Areas may merge.

Contributors always retained (`requirementId`, Work Area, quantities, priced flag).

**Waste:** sum `baseQuantity` and `purchaseQuantity`. Do not average waste factors. `impliedWasteFactor` is display-only from those totals.

No universal unit-conversion engine. Incompatible units → separate groups + diagnostic refusal.

---

## 5. Labour aggregation

Views: by task (`componentKey` + variant + trade), by trade, by Work Area, total hours.

Decking install and demolition do not merge as one task even if both are carpenter hours. Trade totals may sum them while retaining task rows.

`hoursAreElapsedDuration` is always `false`. Labour hours ≠ crew duration.

`adjustmentRef.factors[]` are preserved per contributor. REQ-1 does not multiply/add/cap (OD-PC-01 remains open). Project Conditions are not re-run.

REQ-3.1 current labour emitter: **Deck labour** (`componentKey: deck.labour`) only. Two Deck Work Areas retain two contributors. Trade totals may sum carpenter hours. Do not merge into one opaque task. DECK-3 later splits this lump. REQ-3 is **closed**.

---

## 6. Plant / subcontract / waste

**Plant:** identity `plantKey` + unit. No fake hour↔each conversion.

**Subcontract:** scope stays Work Area + trade + component. Trade totals are a view; bathroom plumbing and kitchen plumbing are not one opaque cost. SUB-AUTH-01 remains future.

**WasteRequirement:** project disposal/reuse stream. Distinct from `MaterialRequirement.wasteFactor`. Never auto-generated from material waste.

---

## 7. Priced vs unpriced

Physical groups may include both. `aggregatePricedRequirementCosts` sums **only** `priced: true`.

Even priced requirement totals are **diagnostic**, not commercial SoT.

---

## 8. Assumptions, confidence, diagnostics

Assumption dedupe: `key` + `source` + `text`. Same prose with different key/source is not merged.

Per-requirement confidence preserved. Diagnostics may count high/medium/low. No percentage roll-up. No estimate-level confidence from requirements.

Diagnostics: counts by kind, priced/unpriced, missing pricing, duplicate IDs, unsafe unit refusals. Cheap, deterministic, non-user-facing. No production logging.

---

## 9. Persistence

Derive-on-generate. `persistEstimateResult` does not write requirements. No migration. REQ-SNAPSHOT-01 still blocks REQ-4 promotion.

---

## 10. Shadow readiness

`toRequirementShadowFields` exposes component, quantity, cost, priced flag for later REQ-4 comparison. No comparison engine in REQ-1.

---

## 11. REQ-2 MaterialRequirement emission foundation

REQ-2 is **COMPLETE**. Capability is **ACTIVE**. Current production emitter: **Deck surface only**.

Width unknown emits nothing. Incomplete coverage is allowed when information is insufficient. Do not emit an m² requirement to keep coverage high.

**DECK-1** owns joists, bearers, posts/piles, concrete, fixings, improved surface takeoff.  
**DECK-2** owns face/fascia (Front / Rear / Left / Right).

`priced: true` means internally resolved pricing. It does **not** drive estimate totals until REQ-4.

Three truths: physical / pricing / commercial authority are independent. Commercial authority is not a field on `MaterialRequirement`.

Compatibility identity: `deck.material.*.lm`. CAT-V2 later separates physical identity from rate unit.

Reference fixture (16.12 m² / 140 mm / 10% hardwood): base **115.14 lm**, waste **11.51 lm**, purchase **126.65 lm**; Quotr $22/lm → cost **$2,786.30**. Same current Deck surface path. No duplicate pricing.

