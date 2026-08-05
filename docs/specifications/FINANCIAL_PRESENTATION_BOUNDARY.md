# Financial Presentation Boundary

**Stage:** 2B — Authoritative Pricing Engine  
**Batch:** 2B.9  
**Status:** Binding for UI / presentation financial display  

This document separates commercial arithmetic from presentation. The UI must not independently determine commercial truth.

---

## 1. Server / commercial layer owns

- All deterministic financial calculations (commercial engine + production adapters)
- Persisted line and document totals
- Aggregate totals (estimate GST-exclusive; pricing/quote with document GST)
- Gross profit, gross margin, markup
- GST amount and GST-inclusive totals
- Unknown-cost semantics (`cost_known` / honest null → sentinel)
- Calculation version and source metadata
- Quote snapshots and revision money copies
- Estimate expected money and domain range factors applied on the server

---

## 2. UI layer owns

- Currency, percent, and quantity formatting
- Layout, labelling, loading and empty states
- Visual grouping (work area / section / category lists) without inventing money
- User input collection
- Controlled draft previews that call an **approved production adapter**
- Explanatory copy and badges (manual override, on-quote, ownership)

---

## 3. UI preview rule

A client preview is allowed only if:

1. It calls the production commercial engine through an approved pure adapter (e.g. `lib/pricing/presentation-item-preview.ts` → `commercial-engine-adapter`).
2. It is clearly a draft preview until save (existing muted preview chrome is sufficient; no redesign required).
3. It does not overwrite persisted server authority.
4. Server recalculation still occurs before persistence (Stage 2B.6–2B.8).
5. Preview and persisted outputs are covered by regression.

Prefer displaying persisted/server values wherever the user is not actively editing.

Do not create new preview surfaces that do not already exist.

---

## 4. Explicit non-ownership

| Concern | Must not |
| --- | --- |
| React components | Calculate sell, GP, margin, markup, GST, or document totals with local formulas |
| Formatting helpers | Aggregate items or derive sell-from-cost |
| Quote print/preview | Recalculate historical snapshots |
| Confidence | Alter money |
| Company DNA | Control arithmetic |
| Parity helpers | Be imported into UI |

---

## 5. Unknown-cost presentation

When `cost_known === false` (or equivalent sell-only inference):

- Do not show a real gross profit figure as commercial truth
- Do not show a real gross margin (including fabricated 100% or misleading 0%)
- Prefer labels: “Cost unknown”, “Profitability unavailable”, “Margin unavailable”
- Known-zero cost (`cost=0`, `sell=0`, known) remains distinct from unknown cost

---

## 6. Formatting vs calculation

Formatting may round for display only after authority is established. It must not change the authoritative numeric inputs used for persistence.

---

## 7. Rollback

Revert Batch 2B.9 UI wiring; server adoption switches (pricing/estimate/quote) remain independent. No dual client/server formula ownership after this batch.
