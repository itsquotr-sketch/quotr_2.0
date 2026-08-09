# Quotr Calibration Scenario Contract

**Stage:** 3.1C.3-R1 specification  
**Status:** Contract only — no schema / no implementation  
**Purpose:** Deterministic, versioned calibration jobs that produce evidence for company rates / future DNA

---

## Design goals

- Smallest useful question set (not a form wall).  
- Work-area-dependent exemplars.  
- Comparable to Quotr’s own deterministic calculation for the same facts.  
- Evidence, not silent authority.

---

## Conceptual types

### CalibrationScenario (catalogue / product-owned)

| Field | Type | Notes |
| --- | --- | --- |
| `id` | string | Stable id e.g. `deck.raised_simple.v1` |
| `workAreaType` | string | Catalogue type (`deck`, `bathroom`, …) |
| `title` | string | Short label |
| `jobBrief` | string | Natural language brief |
| `facts` | Fact[] | Deterministic facts the engine would use |
| `constraints` | Constraint[] | Access, height, exclusions |
| `scopeItems` | ScopeItem[] | Expected included scopes |
| `expectedInputTypes` | enum[] | Which response fields are prompted |
| `version` | string | Bumps when facts/questions change |
| `minQuestions` | QuestionSpec[] | Ordered UI prompts |

### CalibrationResponse (org-owned)

| Field | Type | Value? |
| --- | --- | --- |
| `orgId` | uuid | Yes |
| `scenarioId` | string | Yes |
| `scenarioVersion` | string | Yes — bind to scenario version |
| `labourHours` / `labourCost` | number? | Useful — primary signal |
| `materialAllowance` | number? | Useful |
| `subcontractAllowance` | number? | Useful when applicable |
| `plantOrWasteAllowance` | number? | Optional |
| `totalExpectedCost` | number? | High value; may make component totals redundant |
| `expectedSell` | number? | High value for margin calibration |
| `notes` | string? | Free text |
| `confidence` | enum? | `high` \| `medium` \| `low` / “guess” |
| `createdAt` | timestamptz | Yes |

**Redundant if total cost given:** many component splits — keep optional for builders who think that way.  
**Most useful minimal set:** labour + materials + total cost + expected sell + confidence.

---

## Example A — Deck calibration

### Brief

> Build a new **5 m × 3 m** deck approximately **0.5 m** above ground, **new timber substructure**, standard access, **pine decking**, **no balustrade**, **no stairs**.

### Engine facts (illustrative)

- Area ≈ 15 m²  
- Height ~0.5 m  
- Decking: treated pine  
- Substructure: new timber  
- Exclude balustrade, stairs  

### Minimal questions (prefer ≤6)

1. Rough **carpenter hours** (or crew days) for this deck?  
2. **Material allowance** for substructure + decking (cost)?  
3. Any **other costs** (plant, waste, fasteners) lump sum?  
4. **Total cost** you would expect?  
5. **Typical sell** to the client?  
6. How sure are you? (high / medium / guess)

### Comparison

Run Quotr deck calculator on the same facts → compare labour hours, material $, total cost, implied margin vs user sell.  
Gaps become calibration evidence (e.g. “your labour runs ~20% above benchmark”).

---

## Example B — Bathroom calibration

### Brief

> Standard **full bathroom renovation** (~6–8 m²), gut-out and rebuild, mid-range fittings, tiled wet areas, standard access, no structural wall moves.

### Minimal questions

1. Own **labour hours** (or labour $)?  
2. **Demolition** allowance?  
3. **Plumbing** (trade) allowance?  
4. **Electrical** allowance?  
5. **Waterproofing + tiling** allowance (or combined finishes)?  
6. **Total cost** + **typical sell** + confidence?

Avoid asking every fixture SKU. Allow “Later” on any line.

### Comparison

Bathroom calculator / package path vs user totals — especially labour and wet-trade packages.

---

## Engine comparison protocol (future)

1. Freeze scenario version + facts.  
2. Run deterministic estimate (no user rates preferred for baseline, or with Layer 1 only).  
3. Diff: labour, materials, total cost, sell.  
4. Store deltas + confidence as CalibrationEvidence.  
5. Suggest Layer 2 rate updates for user confirmation — never silent overwrite.

---

## Out of scope for R1 / R2D MVP

- Full DNA training loop  
- Automatic rate mutation  
- Multi-currency calibration  
- Photo uploads  

R2D MVP: one deck scenario + response capture + side-by-side vs engine (read-only).
