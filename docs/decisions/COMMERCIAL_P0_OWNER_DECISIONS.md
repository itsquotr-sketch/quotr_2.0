# COMMERCIAL-P0 — Owner Decisions (CF-D1–D7)

**Status:** OWNER APPROVED — 2026-08-13  
**Batch:** COMMERCIAL-P0 Cost-First Commercial Authority Lock  
**Prerequisite audits:**  
- `docs/audits/COMMERCIAL_MARGIN_RATE_AUTHORITY_AUDIT.md`  
- `docs/audits/MATERIAL_PRICING_TAKEOFF_CURRENT_STATE_AUDIT.md`  
**Model:** `docs/architecture/QUOTR_COST_FIRST_COMMERCIAL_MODEL.md`  
**Plan:** `docs/plans/POST_3_2_2_COMMERCIAL_MATERIALS_PLAN.md`

---

## CF-D1 — Canonical commercial model

**APPROVED:** Cost-first is Quotr’s canonical commercial model.

- Primary user input = what labour / material / subcontract / etc. **costs** the contractor.
- Gross margin determines recommended selling value.
- Formula: `sell = cost / (1 − gross_margin)`
- Markup is derived/display only — **not** a competing authority.

---

## CF-D2 — Existing rate transition

**APPROVED:** Grandfather existing stored cost/sell pairs safely.

- Do **not** silently reinterpret or overwrite historical/existing sell rates in P0.
- Existing estimates/quotes must remain commercially reproducible.
- Explicit transition path toward cost-first semantics (later rates batch).
- No destructive global conversion in COMMERCIAL-P0.

---

## CF-D3 — Sell persistence

**APPROVED:** Cost is canonical rate authority.

- Sell may be persisted/cached for commercial snapshots, estimate reproducibility, quote history, explicit overrides.
- Persisted sell must have clear provenance/semantics.
- Derived sell must be reproducible from `cost + applicable GM` unless an explicit sell override applies.

---

## CF-D4 — Margin → Pricing / Quote consistency

**APPROVED:** Fix CM-02.

- When estimate margin changes and Pricing artefacts exist, mark them needing recalibration via existing architecture.
- Do **not** silently rewrite issued/final historical quotes (immutable snapshots / revision flow).
- User informed through existing RecalibrationBanner / product mechanisms.

---

## CF-D5 — Benchmark authority

**APPROVED:** Long-term benchmark authority = benchmark **COST**.

- Recommended sell derives via company/project GM.
- Do **not** bulk-convert all paired benchmarks in P0.
- P0 establishes contract + compatibility path (paired benchmarks labelled legacy).

---

## CF-D6 — Explicit sell / premium override

**APPROVED:** Explicit sell/commercial overrides allowed where genuine.

- Must be deliberate, labelled, provenanced, visible to the engine, snapshot-safe.
- Do **not** build large override UX in P0 unless minimal compatibility requires it.
- Pricing `PROJECT_OVERRIDE` remains the existing escape hatch.

---

## CF-D7 — Sequencing

**APPROVED:**

```
COMMERCIAL-P0
→ cost-first rates implementation
→ MaterialRequirement / takeoff foundation
→ Deck takeoff pilot + face boards
→ material catalogue/rate expansion
→ reconcile/resume Stage 3.2.3
```

PERF-FUTURE-01 remains Planned separately. Stage 3.2.3 / Company DNA / Production SD unchanged.

---

## Settlement map

| Decision | Settlement |
| --- | --- |
| CF-D1 | Cost-first + F-SFM |
| CF-D2 | Grandfather (S2) |
| CF-D3 | Hybrid persist + provenance |
| CF-D4 | Mark Pricing needing recalibration on margin edit |
| CF-D5 | Benchmark cost long-term; paired legacy in P0 |
| CF-D6 | Explicit override allowed; no large P0 UX |
| CF-D7 | Commercial sequence before 3.2.3 resume |
