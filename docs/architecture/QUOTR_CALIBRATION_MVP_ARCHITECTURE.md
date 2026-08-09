# Quotr Calibration MVP Architecture

**Stage:** 3.1C.3-R2D  
**Status:** Complete — Local + Remote (033 Applied and Verified Remote)  
**Authority:** Evidence only — not rate resolution

---

## Purpose

Let contractors answer short, realistic example-job questions so Quotr can store **structured commercial evidence** about how that company tends to resource and price work.

Calibration must **not**:

- overwrite explicit company rates;
- mutate projects, facts, estimates, or quotes;
- change Stage 2B commercial formulas;
- become Company DNA;
- invent rates or auto-apply pricing adjustments.

---

## Components

| Piece | Location | Role |
| --- | --- | --- |
| Scenario catalogue | `lib/calibration/catalogue.ts` + `scenarios/*` | Static, versioned Deck + Bathroom |
| Compare | `lib/calibration/compare.ts` | Synthetic `EstimateContext` → existing `calculateEstimate` |
| Server actions | `lib/calibration/actions.ts` | Org-scoped compare; save **gated** |
| Setup hub | `components/calibration/CalibrationHub.tsx` | Optional, preference-ordered |
| Flow UI | `components/calibration/CalibrationFlow.tsx` | Brief → questions → compare → save |
| Route | `/app/setup/calibrate/[scenarioId]` | Mobile-first progressive card |

---

## MVP scenarios

1. **`deck.standard_pine.v1`** — 5×3 m pine deck, ~0.5 m up, no balustrade/stairs/demo  
2. **`bathroom.standard_reno.v1`** — ~8 m² soft strip reno, waterproofing/tiling, client vanity/toilet, plumbing/electrical mods  

Architecture allows more scenarios later without DB-stored definitions.

---

## Engine comparison

1. User completes answers once.  
2. Server builds synthetic estimate context from scenario facts + org rates (read-only).  
3. Runs **existing** deck/bathroom calculators via `calculateEstimate`.  
4. Shows Your vs Quotr cost/sell deltas and comparable category rows.  

Language: observational (“prices this higher/lower than Quotr’s current estimate”) — not right/wrong.

Performance: no per-keystroke regeneration.

---

## Persistence

Table `calibration_responses` (migration **033** — **Applied and Verified Remote**).

- Compare + Save work when Preview app includes R2D.1 wiring.
- Apply record: `docs/implementation/STAGE_3_1C3_R2D2_REMOTE_033_APPLY_COMPLETION.md`

### History semantics

- Responses bind to `scenario_id` + `scenario_version`.  
- Recalibrate → append; prior row `superseded`; one `active` per org+scenario.  
- Scenario catalogue changes bump version — old answers stay interpretable.

---

## Authority boundary (R2D live resolution)

```
PROJECT EXPLICIT OVERRIDE
> COMPANY EXPLICIT RATE
> QUOTR BENCHMARK
> MISSING
```

Calibration is **not** inserted into estimate rate resolution in R2D.

### Future stack (documentation only)

```
PROJECT EXPLICIT OVERRIDE
> COMPANY EXPLICIT RATE
> COMPANY DNA / CALIBRATION RECOMMENDATION
> QUOTR BENCHMARK
> MISSING
```

Presentation label today: **Calibration evidence** — never “Your rate” unless explicitly adopted.

---

## Setup / Dashboard

- Improve Quotr → **Calibrate** section after Rates.  
- Preference-ordered scenarios; **Show all** available; **Do this later**.  
- Dashboard Improve tip: “Calibrate your first work type · ~3 min” when basics ready.  
- Until at least one active calibration exists, tip cannot detect a saved calibration (honest: always available, never mandatory).
- After first active calibration, the “first work type” tip is removed (no nag).

---

## Privacy

Do not log expected sell/cost or detailed commercial answers. Operational logs: scenario id, gated status only. No AI.
