# Estimate Commercial Boundary

**Stage:** 2B — Authoritative Pricing Engine  
**Batch:** 2B.7  
**Status:** Binding for estimate-domain financial adoption  

This document separates AI/workflow reasoning from deterministic commercial arithmetic for quick estimates. No layer may silently cross these boundaries.

---

## 1. AI and workflow layer owns

- Work-area identification
- Scope description and trade identification
- Suggested quantity, unit, and rate source selection
- Assumptions, constraints, questions
- Uncertainty narratives and confidence scores
- Low/high **drivers** (org range factors, qualitative uncertainty) — not invented money
- Calculator orchestration and rate lookup / resolution
- Material build-ups, productivity tables, quality/site factors that **shape inputs** (hours, quantities) before money
- Persistence orchestration and user messaging copy

AI-generated monetary suggestions are **inputs** to be validated or replaced by the commercial engine. They are never final financial authority.

---

## 2. Commercial engine owns

- Quantity × rate multiplication
- Productivity / labour hours × hourly rates (after domain has shaped hours)
- Material waste arithmetic only when an explicit waste percent is part of a commercial request (estimate factories currently bake waste into quantity/rate upstream)
- Line cost, sell, gross profit, gross margin, markup
- Deterministic rounding (`roundMoney` / `round2` via engine)
- Aggregate totals from included lines (GST omitted for estimates)
- Sell-from-margin (F-SFM): `sell = cost ÷ (1 − gross margin)`
- Cost-first sell authority classification (COMMERCIAL-P0): derived / legacy paired / explicit override — see `docs/architecture/QUOTR_COST_FIRST_COMMERCIAL_MODEL.md`
- Honest unknown-cost treatment (null margin/profit → persistence sentinel `0`, never 100%)

---

## 3. Application layer owns

- Authentication, organisation ownership, Stage 2A validation
- Persistence of estimate and line-item rows
- Lifecycle (generate, edit margin, refresh, stale flags)
- Mapping estimate → pricing documents (`createPricingFromEstimate`)
- Manual override / target-margin application orchestration
- Returning persisted authoritative fields on read (no silent money rewrite)
- Rollback switch (`ESTIMATE_CALCULATION_AUTHORITY`) independent of pricing

---

## 4. Explicit non-ownership

| Concern | Owner | Must not |
| --- | --- | --- |
| Confidence (35–95 heuristic) | Workflow | Multiply money |
| Low / high expected bands | Domain factors × expected | Engine invent bands |
| Photo → quantity | AI / workflow | Engine invent qty |
| Company DNA | Future | Alter arithmetic |
| Quote totals | Quote domain (2B.8) | Estimate adapter |
| UI live recalculation | Client (2B.9) | Server authority |

---

## 5. Range and confidence contract

- **Expected** cost/sell: deterministic engine outputs.
- **Low / high**: `expected × org budget/premium factors` (defaults 0.9 / 1.15), applied after expected settles. Not confidence-scaled.
- **Confidence**: metadata only; never a financial multiplier.
- If low/high were only AI guesses without replayable inputs, they remain non-authoritative; current product uses deterministic factors on expected totals.

---

## 6. Omitted vs null vs zero

| Value | Meaning |
| --- | --- |
| Omitted optional input | Not supplied; engine/adapters must not invent |
| `null` engine profit/margin | Unknown cost — honest absence |
| Persisted `0` profit/margin with unknown cost | Sentinel for NOT NULL columns; not a real 0% margin |
| Cost `0` + sell `> 0` | Unknown-cost / sell-only path |
| Cost `0` + sell `0` | Zero-value informational / empty line |
| `includedInTotal === false` | Excluded from aggregate |

---

## 7. Manual overrides

- Target margin override recalculates sell through the engine (F-SFM) and rewrites line expected + ranges.
- Manual values are never silently overwritten by AI regeneration without an explicit regenerate path.
- Estimate→pricing preserves `manually_edited` on pricing items after conversion/recalibration (pricing domain).

---

## 8. Estimate → pricing

- Pricing conversion uses the pricing-domain adapter (Batch 2B.6B).
- Qty/productivity lines use rates, not stale recommended totals.
- Lump / missing-rate lines use recommended cost/sell as approved lump inputs.
- Source estimate is not mutated.
- Pricing GST is independent; estimates remain GST-exclusive.

---

## 9. Rollback

Set `ESTIMATE_CALCULATION_AUTHORITY = "legacy"` in `lib/estimate/adoption-authority.ts`, or git revert Batch 2B.7. Does not affect `PRICING_ITEM_CALCULATION_AUTHORITY`.
