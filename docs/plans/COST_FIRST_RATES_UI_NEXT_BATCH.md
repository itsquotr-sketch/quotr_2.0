# Rates UI — Cost-First Direction (Next Batch Spec)

**Status:** Spec only — COMMERCIAL-P0  
**Implementation:** **Not Started** (next batch after P0: cost-first rates)

Do **not** treat this document as authorisation to redesign Rates in P0.

---

## Current UI (audit)

- Rates pages / setup collect **cost_rate** and **sell_rate** (charge-out).
- Markup field largely hidden (`showMarkup = false` in edit dialog).
- Org `default_margin_percent` is separate settings authority.
- Catalogue/starter rates seed cost+sell pairs.

## Required next-batch direction (CF-D1 / CF-D3 / CF-D5)

Primary entry:

> Your cost: $60/hr  
> Company/project gross margin: 20%  
> Quotr derived charge-out: $75/hr

Materials analogously: cost primary; sell derived unless explicit override.

## Exact changes for next implementation batch

1. Rates form labels: “Your cost” primary; “Charge-out / sell” derived (read-only by default).
2. Show applicable GM and derived sell live using F-SFM.
3. Optional “Set explicit sell” control → `explicit_sell_override` provenance (CF-D6 minimal).
4. Grandfather existing pairs: show both; do not overwrite on open (CF-D2).
5. Benchmarks: display benchmark **cost**; derived sell from org GM; keep paired sell as legacy hint until converted (CF-D5).
6. Do not enable Production SD / DNA / takeoff in that batch.

## Out of scope until that batch

- Bulk DB conversion of sell rates
- MaterialRequirement / takeoff UI
- Deck face-board questions
