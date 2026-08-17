# Quotr Component Commercial Authority Contract

**Status:** CANONICAL for REQ-4A / REQ-4B  
**Date:** 2026-08-18  
**Mode:** REQ-4B **COMPLETE LOCAL / OWNER COMMERCIAL REVIEW PENDING**. First promotion: Deck `decking.surface` only.

Authority is **external** to `EstimateRequirement`. Requirements do not store `commercialAuthority`. `priced: true` means cost data is complete; it does not mean the requirement owns estimate money.

---

## 1. Lifecycle

`LEGACY_AUTHORITATIVE` → `SHADOW` → `REQUIREMENT_AUTHORITATIVE` → `LEGACY_FALLBACK` → `LEGACY_RETIRED`

Keyed by **Work Area type + `componentKey`**, never by user-facing description, never by whole Work Area.

Unregistered components default to **LEGACY_AUTHORITATIVE**. The registry only lists migrating components.

## 2. REQ-4A initial states

| Component | Authority | Parity class |
| --- | --- | --- |
| Deck `decking.surface` | **REQUIREMENT_AUTHORITATIVE** | SEMANTIC_REIMPLEMENTATION |
| Deck `deck.labour` | **SHADOW** | SEMANTIC_REIMPLEMENTATION |
| All other priced components | **LEGACY_AUTHORITATIVE** (default) | — |

REQ-4B promotes **only** `decking.surface`. Resolver + composer select money source; Pricing/Quote remain line-based.

## 3. Future fallback / retirement (not activated)

**REQUIREMENT_AUTHORITATIVE:** requirement is the normal money source.

**LEGACY_FALLBACK (REQ-4B activated):** generation may use legacy when requirement missing/unpriced; registry policy stays REQUIREMENT_AUTHORITATIVE. **Both sources must never contribute money in the same generation.**

**LEGACY_RETIRED:** legacy calculation unused for new estimates. Historical snapshots/quotes remain readable. Helper deletion is a later cleanup.

## 4. Mapping

In-memory `EstimateLineItemInput.componentKey` maps to the requirement `componentKey`. Rate/`itemKey` is a different identity.

Deck:

- `decking.surface` ↔ Decking materials line (`componentKey`, not label)
- `deck.labour` ↔ Deck labour line

Line UUIDs change on regenerate. **`component_key` is persisted** on `estimate_line_items` and copied to `pricing_items` when present (nullable for legacy lines). Rate/`itemKey` remains a separate identity and is not persisted as component identity.

## 5. Parity classes

**SEMANTIC_REIMPLEMENTATION** — exact deterministic cost (and quantity/hours where comparable). No “within 1%” pass.

**INTENTIONAL_MODEL_IMPROVEMENT** — documented calculation change, new golden, commercial review, Owner approval. Not used in REQ-4A.

## 6. Promotion eligibility (compute only)

Eligible when: authority SHADOW (pre-promotion), semantic reimplementation, requirement + legacy exist, priced, exact cost parity, quantity/hours parity where comparable, no duplicate requirement, snapshot persisted.

REQ-4B promoted Deck `decking.surface` locally. Deck labour stays SHADOW until separately approved.

`generationRequiresRequirementSnapshot()` is true iff any registered component is `REQUIREMENT_AUTHORITATIVE`. Persist **always** snapshots regardless; this helper is not a snapshot-optionality switch. See `docs/architecture/QUOTR_ATOMIC_ESTIMATE_GENERATION_CONTRACT.md`.

## 7. Lookup

`getComponentCommercialAuthority({ workAreaType, componentKey })` is the single authority resolver. Persist always snapshots; `generationRequiresRequirementSnapshot()` is not a snapshot-optionality switch.
