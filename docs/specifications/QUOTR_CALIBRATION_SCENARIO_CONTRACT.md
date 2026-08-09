# Quotr Calibration Scenario Contract

**Stage:** 3.1C.3-R2D implementation  
**Status:** Contract implemented for MVP catalogue + observational compare; persistence owner-gated  
**Purpose:** Deterministic, versioned calibration jobs that produce evidence for future DNA / recommendations — never silent rate authority

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
| `id` | string | Stable id e.g. `deck.standard_pine.v1` |
| `workAreaType` | string | Catalogue type (`deck`, `bathroom`, …) |
| `title` | string | Short label |
| `summary` | string | One-line list summary |
| `jobBrief` | string | Natural language brief |
| `facts` | Fact[] | Deterministic facts the engine would use |
| `constraints` | Constraint[] | Access, height, exclusions |
| `scopeItems` | string[] | Expected included scopes (display) |
| `questions` | QuestionSpec[] | Ordered UI prompts |
| `version` | string | Bumps when facts/questions change |

Implemented in `lib/calibration/scenarios/*` + `lib/calibration/catalogue.ts` (static; not DB).

### CalibrationResponse (org-owned)

| Field | Type | Value? |
| --- | --- | --- |
| `orgId` | uuid | Yes — server-derived |
| `scenarioId` | string | Yes |
| `scenarioVersion` | string | Yes — bind to scenario version |
| `labourHours` / `labourCost` | number? | Useful — primary signal |
| `materialsCost` | number? | Useful |
| `subcontractorsCost` | number? | Useful when applicable |
| `otherCost` | number? | Optional |
| `expectedTotalCost` | number? | High value; optional override of component sum |
| `expectedSell` | number? | High value for margin calibration |
| `notes` | string? | Free text |
| `confidence` | enum? | `high` \| `medium` \| `low` |
| `engineSnapshot` | jsonb | Frozen observational compare |
| `status` | active \| superseded | Append/supersede history |
| `createdAt` | timestamptz | Yes |

**Persistence:** proposed table `calibration_responses` (migration **033**) — **not applied** until owner approval.  
Compare runs without persistence; save returns `CALIBRATION_PERSISTENCE_GATED`.

**Deck minimal set:** labour hours + materials + optional other/total + sell + confidence.  
**Bathroom minimal set:** labour hours + subcontract trades + materials + optional other/total + sell + confidence.

---

## Example A — Deck calibration (implemented)

### Brief

> Build a new **5 m × 3 m** deck approximately **0.5 m** above ground, **new timber substructure**, standard access, **H3.2 treated pine decking**, **no balustrade**, **no stairs**, no demolition.

### Engine facts

- Area 15 m²; height 0.5 m; treated pine; substructure included; exclude balustrade/stairs/demo

### Comparison

`calculateEstimate` on synthetic context → Your vs Quotr cost/sell + comparable categories.

---

## Example B — Bathroom calibration (implemented)

### Brief

> Renovate ~**8 m²** bathroom: soft strip, waterproofing, tiled wet areas, client-supplied vanity/toilet, plumbing + electrical modifications, standard access.

### Comparison

Same protocol via bathroom calculator path.

---

## Engine comparison protocol (R2D)

1. Freeze scenario version + facts in catalogue.  
2. Run deterministic estimate (org rates read-only for Quotr side personalisation).  
3. Diff: labour, materials, subcontractors (when user provided), total cost, sell.  
4. Persist deltas + confidence when migration approved.  
5. **Do not** suggest or apply Layer 2 rate updates in R2D.

---

## Out of scope for R2D MVP

- Full DNA training loop  
- Automatic rate mutation / recommendations  
- Multi-currency calibration  
- Photo uploads  
- Broad ML  

**R2D shipped:** Deck + Bathroom scenarios, response capture UX, side-by-side vs engine (read-only), persistence gated.
