# Quotr Rate & Calibration Architecture

**Stage:** 3.1C.3-R1  
**Status:** Proposed architecture (forward-compatible with Company DNA)  
**Does not change commercial formulas in R1**

---

## Goals

- Capture high-quality pricing data builders actually understand.
- Avoid fake precision from generic $/m² package rates.
- Support current deterministic calculators.
- Leave clean evidence for future Company DNA.

---

## Three-layer rate model

### Layer 1 — Business base rates (high confidence)

Explicit org inputs Quotr should ask early (optional after basics):

- Carpenter cost/hr + sell/hr  
- Labourer cost/hr + sell/hr  
- Default gross margin (already defaulted 20%)  
- Optional default subbie markup (only if wired to consumers)  
- GST / currency (from company basics)

**Authority:** Company explicit. Used today by `resolveLabourRate` / margin derivation.

### Layer 2 — Component / assembly rates

Work-area-specific building blocks calculators already understand, e.g.:

| Deck | Bathroom |
| --- | --- |
| Decking material $/m² or $/lm | Demolition allowance |
| Substructure $/m² | Waterproofing |
| Balustrade $/lm | Tiling $/m² |
| Fascia $/lm | Plumbing / electrical allowances |
| Steps assembly | Fixtures |

These may become Assemblies later. **Prefer these over generic `scope.*.m2`.**

**Authority:** Company explicit material/component rates. Used today by deck/fence/bathroom calculators via material keys + benchmarks.

### Layer 3 — Calibration scenarios

Representative jobs: “How would your business resource/price this?”

Outputs are **evidence**, not blindly authoritative unit rates.

**Authority:** Calibration adjustment — below explicit rates, above or beside curated benchmarks depending on confidence.

---

## Current vs recommended precedence

### Implemented today (`resolveRate`)

1. Exact company `rates` row (`item_key` + `rate_type`, aliases)  
2. Work-area fallback row (same type + work_area + cost) — **risky cross-bind**  
3. Caller benchmark fallback if `allow_benchmark_rates`  
4. Sell from company sell_rate or margin derivation  

`prefer_user_rates` is **dead**.  
Generic `scope.*` keys are **not** calculator step-1 hits.

### Recommended conceptual order (future)

```
project / pricing-line explicit override
  > company explicit rate (Layer 1–2)
  > calibrated company adjustment (Layer 3, versioned, confidence-gated)
  > curated benchmark
  > generic safe fallback / missing (honest “Pricing required”)
```

Do not implement this order in R1 unless aligning an existing path. Document conflicts: work_area_rate fallback; unused scope keys; dead prefer_user_rates.

---

## Generic unit rates

| Rate | Verdict | Notes |
| --- | --- | --- |
| Deck $/m² scope | DEPRECATE as primary | Calculators use materials + labour |
| Retaining $/m² scope | DEPRECATE | Use material face_m2 |
| Bathroom $/m² scope | REPOSITION / DEPRECATE | Benchmark package exists separately |
| Kitchen $/m² scope | REPOSITION / DEPRECATE | Same |
| Fence $/lm scope | DEPRECATE | Use material lm |
| Pergola $/m² scope | DEPRECATE | Use frame/roof keys |

**Do not delete yet.** Remove from first-run Rates UX; keep rows if already stored.

---

## Work Area preferences

**Should mean:** “Work types my business commonly prices.”  
**Must not mean:** “Quotr cannot estimate other scopes.”

**R2B complete:** Analyse Job / note analysis use full capability catalogue
(`getAnalysisCapableWorkAreaTypes`). Preferences personalise Rates/tips only.
See `docs/architecture/QUOTR_WORK_AREA_CAPABILITY_AND_PREFERENCE_MODEL.md`.

**R2C complete:** Setup/Rates primary UX = labour + consumed component rates;
generic `scope.*` package rates demoted to Legacy benchmarks. Authority labels in
`docs/architecture/QUOTR_RATE_AUTHORITY_AND_PROVENANCE_MODEL.md`.

Uses of preferences:

- Setup personalisation  
- Calibration suggestions (R2D)  
- Rates UI filtering (R2C)  
- Dashboard tips  
- Future DNA priors  

Not: AI capability lock.

---

## Rate UX principles

- Builders think in labour, components, and allowances — not abstract package $/m².  
- Natural construction terminology.  
- Avoid false-precision generic unit rates.  
- Explain cost vs sell.  
- Distinguish company rates vs benchmarks.  
- Allow “I don’t know” / Later.  
- Show why each rate matters.  
- Ask progressively in context.  
- Never require a complete rate library before first estimate.

### Mobile

- One rate or scenario concept at a time.  
- Avoid giant tables and multi-column numeric walls.  
- Site-usable numeric keyboards.  
- Short job brief + few high-value questions for calibration.

---

## Company DNA forward compatibility (not implemented)

Future DNA may consume:

- Explicit Layer 1–2 rates  
- Calibration responses (evidence)  
- User estimate corrections  
- Pricing/quote overrides  
- Chosen scope / accepted AI suggestions  
- Project outcomes  

**Rules:**

- DNA must **not** silently overwrite explicit user rates.  
- Calibration is evidence with scenario version + confidence.  
- Authority remains: project override > explicit company rate > DNA suggestion > benchmark.  
- DNA outputs should be reviewable (“Suggested from your past jobs”) before adopting.

---

## Coexistence with current engine

| Layer | Current engine hook |
| --- | --- |
| L1 labour | `resolveLabourRate` + margin |
| L2 materials | Calculator keys + `resolveRate` |
| L2 scope packages | Catalogue `planned` — do not pretend live |
| L3 calibration | New store later; compare scenario engine run vs user totals |
| Benchmarks | Keep as disclosed fallback |

---

## Schema proposals (not implemented)

See `docs/plans/STAGE_3_1C3_SETUP_REDESIGN_PLAN.md` § migrations.

MVP-necessary vs DNA-future separated there.
