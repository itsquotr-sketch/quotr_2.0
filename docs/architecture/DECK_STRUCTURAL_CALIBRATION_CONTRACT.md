# Deck Structural Calibration Contract

**Status:** CANONICAL for DECK-1D — **DECK-1D-A OWNER CALIBRATION MODEL VALIDATED**  
**Date:** 2026-08-18  
**Owner gate:** `docs/runbooks/DECK_1D_A_OWNER_CALIBRATION_GATE.md`  
**Audit:** `docs/audits/DECK_1D_LEGACY_SUBSTRUCTURE_DECOMPOSITION.md`  
**Plan:** `docs/plans/DECK_1D_CALIBRATION_PLAN.md`

This contract does **not** change estimate money. It does **not** promote structural children.

---

## 1. Philosophy (locked)

DECK-1 is **INTENTIONAL_MODEL_IMPROVEMENT** (`REQUIREMENT_PARITY_CLASSES`).

The detailed model is **not** required to reproduce `deck.substructure.m2` exactly.

Calibration asks:

1. Are physical quantities reasonable for the stated spec?
2. Are rates traceable (company / project / Quotr sourced public-list benchmark)?
3. Are material and labour **categories** complete enough that a contractor would not be systematically underpriced?
4. Can variance vs legacy be **explained** (missing buckets, not “the package is wrong”)?
5. Does the detailed model **directionally** track real jobs when facts and rates are known?
6. Are unpriced / missing items visible (never collapsed to $0)?
7. Comparisons are labelled **MATERIAL / SUBSTRUCTURE COMPARISON** — Deck labour is current labour authority, not DECK-3, and is not inside detailed structural children.

Exact parity is **not** the objective. Goldens (Deck 1 **$48,340**) are regression references, not proof the detailed model is economically correct. **No restamp** in DECK-1D planning.

Owner D1–D9 are locked in `docs/runbooks/DECK_1D_A_OWNER_CALIBRATION_GATE.md`.

---

## 1.1 Terminology lock (Owner D3/D4/D9)

| State | Meaning |
| --- | --- |
| **NOT_REQUIRED** (EXCLUDED) | Project genuinely does not require that work/material |
| **PRICED** | Required and has a trustworthy cost |
| **UNPRICED** | Required; no trustworthy cost (`priced=false` is this, **not** excluded) |
| **NOT_MODELLED** | Physical/economic bucket not in the detailed model |
| **LEGACY_FALLBACK** | Covered by a retained legacy money line |
| **ALLOWANCE** | Explicit allowance covers the bucket |
| **UNKNOWN** | Insufficient evidence to classify |
| **ECONOMIC_GAP** | Required + (UNPRICED or NOT_MODELLED) and no allowance / legacy fallback / project-company rate |

`priced=false` **must not** be treated as excluded.

---

## 1.2 Economic-hole prohibition (Owner D9)

**NO COMMERCIAL PROMOTION MAY CREATE AN ECONOMIC HOLE.**

If a required cost bucket is not physically/deterministically priced, it must be:

- **A.** legitimately outside project scope (`NOT_REQUIRED`)
- **B.** covered by explicit allowance
- **C.** covered by safe retained legacy fallback
- **D.** resolved by project/company rate
- **E.** treated as a blocking pricing-required condition (`UNPRICED`)

Required-but-unpriced may **not** silently disappear.

**Minimum viable commercial completeness:** promotion does not need every connector takeoff. Promotion **does** need every commercially material required cost represented by one of the five representations above.

**No generic % tolerance** (Owner D8). Do not lock ±10% / ±20%.

**Residual allowance is not a failure:** a mature hybrid model may intentionally represent lower-variability/incidentals as `ALLOWANCE` / `LEGACY_FALLBACK`. Only required work that is `UNPRICED` / `NOT_MODELLED` *without* an allowance/fallback/rate becomes an `ECONOMIC_GAP` under this calibration contract.

---

## 2. Money vs diagnostic layers

| Layer | Role in calibration |
| --- | --- |
| Legacy Framing/substructure | **Commercial money** until DECK-1R |
| Legacy fixings / labour / replacement allowances | **Separate** money — never silently merge into timber children |
| Shadow structural children | **Diagnostic only** |
| PARTIAL PRICED STRUCTURAL CHILD COST | Joists + rim + bearers when priced — **not** substructure cost |

Do not label diagnostic timber as:

- substructure cost
- total structural cost
- complete detailed cost
- savings vs legacy

---

## 2.1 Legacy cost basis comparability (locked)

Calibration must distinguish:

- **CURRENT SYSTEM SEMANTICS:** the live estimator stores/uses `$120/m²` as a benchmarked recommended cost for `deck.substructure.m2`.
- **ORIGINAL ECONOMIC PROVENANCE:** whether historical `$120/m²` was net material, material+incidental allowances, included labour/P&G/overhead/contingency, or a broader commercial package.

If original economic provenance cannot be established from repository evidence, classify as:

**`LEGACY COMMERCIAL ESTIMATING PACKAGE — COST PROVENANCE UNKNOWN`**

Only calculate meaningful economic variance where compared figures share comparable basis (net-material vs net-material, labour vs labour, etc.). If legacy basis is uncertain, keep fixture outcomes at:

- `NOT_COMPARABLE` or `PARTIAL_COVERAGE` (directional comparison only)

Do not calibrate detailed net-material timber rates to `$120/m²` on an assumed like-for-like basis.

---

## 3. Company vs Quotr calibration

Two useful comparisons, never mixed into one “true rate”:

| Track | Rate source | Purpose |
| --- | --- | --- |
| **Quotr fallback** | Sourced public-list benchmarks | Product default honesty |
| **Contractor actual** | Company / project rates + invoices | Job tracking |

Do **not** overwrite Quotr benchmarks with one contractor’s actual rate.

Company DNA boundary (locked):

```
observe → calculate → recommend → user approves
```

No silent mutation of Company Rates or assumptions. No DNA implementation in DECK-1D.

---

## 4. Comparison output contract

Every fixture report uses this shape. Missing items stay listed with quantity, **not $0**.

```
MATERIAL / SUBSTRUCTURE COMPARISON

LEGACY
  substructure package          $  (area × deck.substructure.m2)  — separate from fixings
  LEGACY CATCH-ALL FIXINGS      $  (deck.fixings.m2 — not in detailed child subtotal)
  CURRENT LABOUR AUTHORITY      $  (Deck labour — not in detailed child subtotal)
  other structural-related      $  (replacement allowances if triggered)

DETAILED
  each structural child: qty / identity / price state / rate / cost if known
  PARTIAL PRICED STRUCTURAL CHILD COST
  unpriced required buckets     ECONOMIC_GAP (not $0, not excluded)
  NOT_MODELLED blocking/trimmers  KNOWN_MODEL_GAP


DETAILED
  priced timber children        $  PARTIAL PRICED STRUCTURAL CHILD COST
  unpriced support              qty EA  (no $)
  unpriced concrete             qty m³  (no $)
  missing connectors            status
  missing blocking / trimmers   status
  labour                        $ or “see legacy lump”
  known allowances              $

REAL JOB (if available)
  actual cost                   $  (state materials / labour / all-in)

THEN
  variance $ and %              only among comparable buckets
  coverage explanation
  missing-value explanation
  confidence                    HIGH / MEDIUM / LOW
  status                        see §5
```

---

## 5. Variance classification

Reuse existing reconciliation where possible (`COVERAGE_PARTIAL`, `NOT_COMPARABLE`, `AGGREGATE_READY`, `INTENTIONAL_MODEL_IMPROVEMENT`). Docs-only labels for calibration narrative:

| Status | Meaning |
| --- | --- |
| **NOT_COMPARABLE** | Identity/spec incomplete, or real-job basis unknown |
| **PARTIAL_COVERAGE** | Some children priced; unpriced/missing buckets remain |
| **DETAILED_BELOW_LEGACY_EXPLAINED** | Detailed < legacy **and** missing buckets explain the gap |
| **DETAILED_ABOVE_LEGACY_EXPLAINED** | Detailed > legacy **and** extra spec/rates explain the gap |
| **UNEXPLAINED_VARIANCE** | Residual after missing buckets named; needs Owner/real-job |
| **CALIBRATED** | Owner accepts directional tracking for that fixture class — **not** promotion |

Do not introduce production enums in DECK-1D-A.

---

## 6. Underpricing risk (locked test)

A model that only prices joists + rim + bearers **will look cheaper** than a bundled $120/m² package. That is **not** evidence the legacy benchmark is too high.

DECK-1D must:

- Name missing-cost buckets **before** interpreting variance
- Refuse “% complete” from 3-of-5 children
- Treat systematic timber-only under-recovery as **expected** until supports, concrete, connectors, and labour basis are decided

---

## 7. Fixture classes

Do **not** implement new formulas. Facts below are the **contract** for later DECK-1D-B fixture files.

### 7.1 SIMPLE

**Purpose:** baseline rectangular low/ground deck; maximum current detailed coverage with minimal complexity.

| Fact | Value / rule |
| --- | --- |
| Geometry | Rectangle; prefer 5.20 × 3.10 (**16.12 m²**) or 4.00 × 4.03 |
| Height / level | ≤ 0.3 m **or** explicitly Ground-level (avoid elevated labour if isolating materials) |
| Joists | 140×45, centres 450 mm |
| Bearers | 190×45, 2 rows |
| Supports | Post 90×90, 4 per bearer (8 EA on REF geometry) |
| Footings | 300 × 300 × 450 mm |
| Identity | H3.2 SG8 KD |
| Fixings | No extra assumption — legacy `deck.fixings.m2` remains |
| Labour | Record lump separately; do not fold into timber |

**Expected:** all five children emit; joists/rim/bearers priced; supports/concrete unpriced.  
**Missing:** connectors, blocking, trimmers, post length, small-load.  
**Compare:** legacy package vs PARTIAL PRICED STRUCTURAL CHILD COST — status PARTIAL_COVERAGE.

**Seed:** DECK-RATE-REF-01 is SIMPLE-elevated-labour (height 0.4). A true SIMPLE-materials isolate may copy RATE-REF-01 with `deck.height_m = 0.2`.

### 7.2 MEDIUM

**Purpose:** normal post-supported deck; expose support, concrete, connector gaps.

| Fact | Value / rule |
| --- | --- |
| Geometry | e.g. 7.00 × 5.00 m (35 m²) |
| Height | 0.6–1.0 m (elevated labour) |
| Spec | Same KD identities as SIMPLE unless Owner supplies others |
| Supports | 3 bearer rows × 4 supports (or stated spacing) |
| Access | Standard / not difficult |
| Footings | Same mm facts unless Owner supplies |

**Expected:** timber priced; support/concrete quantities larger still unpriced.  
**Compare:** whether $120/m² under/over-recovers as area and post count grow.

### 7.3 ELEVATED

**Purpose:** height/support complexity — **not** a structural-design engine.

| Fact | Value / rule |
| --- | --- |
| Height | > 1.0 m |
| Spec | Full KD identity |
| Supports | Higher count; **post length still unknown** unless Owner supplies |
| Access | Record Project Conditions if known |
| Flags | Balustrade/consent may be true — those $ are **separate** |

**Assess:** post length uncertainty, bracing (unmodelled), labour +0.25 plus access, whether DECK-1 should **fallback** to package when length unknown.  
**Do not** invent span/bracing rules.

### 7.4 PARTIAL-SPEC

**Purpose:** honest degradation.

| Fact | Value / rule |
| --- | --- |
| Geometry | Same as SIMPLE |
| Sections | 140×45 / 190×45 present |
| Missing | grade **or** treatment **or** processing |

**Expected:** physical requirements remain; **no** Quotr KD benchmark; `priced=false` unless company/project rate.  
**Seed:** DECK-REF-01 (`H3.2` only).

### 7.5 CUSTOM-MATERIAL

**Purpose:** no false benchmark.

| Fact | Value / rule |
| --- | --- |
| Joist section | `200x50` (or other non-catalogue) |
| Other spec | May be SG8 H3.2 KD |

**Expected:** valid physical requirement; no 140×45 benchmark match; company/project pathway only.

### 7.6 REAL-JOB

**Purpose:** ground both legacy and detailed against a completed deck.  
Input contract: §8.

---

## 8. REAL-JOB data contract

Make this easy for Owner. One job is useful; two (low + elevated) are better.

| Field | Class |
| --- | --- |
| Deck plan dimensions (L × W) or area + note if irregular | **REQUIRED** |
| Height / level | **REQUIRED** |
| Board material | **HIGH VALUE** |
| Board direction | OPTIONAL |
| Joist section | **REQUIRED** |
| Joist centres | **HIGH VALUE** |
| Bearer section + row count | **REQUIRED** if known |
| Support type + count | **REQUIRED** if known |
| Support section / length | **HIGH VALUE** |
| Footing dimensions | **HIGH VALUE** |
| Treatment / grade / KD or green | **REQUIRED** for rate track |
| Actual framing material $ or invoices | **REQUIRED** (at least one of materials $ / quoted substructure $) |
| Quoted substructure amount | **HIGH VALUE** |
| Actual final cost (state inclusions) | **HIGH VALUE** |
| Actual labour hours or $ | **HIGH VALUE** |
| Fixings / connectors $ | **HIGH VALUE** |
| Concrete $ (incl. small-load / bags) | **HIGH VALUE** |
| Delivery / cartage | OPTIONAL |
| Waste notes | OPTIONAL |
| Actual purchase quantities (lm / EA) | **HIGH VALUE** |
| Region / date | OPTIONAL |
| What was excluded (stairs, demo, engineer) | **REQUIRED** |

If only a lump “substructure” invoice exists, say so — still useful as NOT_COMPARABLE on children, comparable on package.

### Import method (future DECK-1D-B — do not build UI)

Prefer a **checked-in anonymized JSON fixture** under `tests/fixtures/deck-calibration/`, loaded by `scripts/deck-calibration/run-deck-calibration.ts`. REAL-JOB-TEMPLATE is schema-only until Owner supplies data.

---

## 9. Closure options (Owner D3–D6 locked for DECK-1D-B)

DECK-1D-B: **diagnostics only**. No new benchmarks. No post length. No bag conversion. No structural connector money.

### Supports (D3)

Required + unresolved price = **ECONOMIC_GAP** (`UNPRICED`). Not an exclusion.

Later: project/company rate, explicit allowance, legacy fallback, or quote-blocking pricing-required. Do not price EA from $/lm posts. Do not invent length.

### Concrete (D4)

Required + unresolved price = **ECONOMIC_GAP**. Same later options. No Firth unknown-mix public rate. No bag conversion in DECK-1D-B.

### Fixings (D5)

Keep `deck.fixings.m2` as **LEGACY CATCH-ALL FIXINGS**, shown separately from `deck.substructure`. Do not put it in the detailed structural child subtotal. Surface vs structural split remains UNKNOWN.

### Blocking / trimmers (D6)

**NOT_MODELLED** / **KNOWN_MODEL_GAP**. Do not invent quantities. Do not treat as $0. Economic-blocker status is a later Owner calibration decision.

### Labour sequencing (D2)

**Locked:** material/substructure authority may mature independently from DECK-3. Existing generic Deck labour remains current labour commercial source. Label **MATERIAL / SUBSTRUCTURE COMPARISON**. Do not start DECK-3.

---

## 10. Group authority (Owner D7 — do not implement in DECK-1D-B)

**Locked preference:** detailed internal structural children → parent commercial group **Framing/substructure**. Customer-facing quote remains grouped where practical.

Do not skip `LEGACY_AUTHORITATIVE → SHADOW → REQUIREMENT_AUTHORITATIVE → LEGACY_FALLBACK → LEGACY_RETIRED`.

After children (or parent group) become authoritative, `deck.substructure.m2` becomes **LEGACY_FALLBACK** when children cannot price, then **LEGACY_RETIRED** when fallback unused. Historical snapshots remain readable.

---

## 11. Metrics (no dashboard)

Per fixture:

- Legacy relevant cost (state line set)
- Detailed priced child cost (PARTIAL)
- Known unpriced components (list)
- Actual job cost (if REAL-JOB)
- Variance $ and % **only on comparable buckets**
- Physical quantity variance vs invoices (if known)
- Rate variance (Quotr vs company vs invoice)
- Labour variance (lump vs actual hours)
- Coverage confidence HIGH/MED/LOW

---

## 12. Promotion gate (Owner D9 draft — not executed)

Minimum **viable commercial completeness** — not every edge case:

1. Physical model: current five children remain; blocking/trimmers **NOT_MODELLED** (deferred, not $0)
2. Required priced children: joists, rim, bearers **when identity complete**
3. Required supports/concrete: **UNPRICED / ECONOMIC_GAP** until A–E (scope-out, allowance, legacy fallback, company/project rate, or blocking pricing-required). **Not an exclusion because unpriced**
4. Fixings: legacy `deck.fixings.m2` retained as catch-all
5. Labour: materials may mature without DECK-3; labour stays current lump
6. Real-job: **required before promotion**; synthetic fixtures allowed now
7. Variance: no generic % band; PARTIAL_COVERAGE explained; no UNEXPLAINED_VARIANCE on Owner-signed fixtures without a named bucket
8. **No economic hole:** required-but-unpriced must not silently disappear
9. Goldens unchanged unless Owner restamp
10. Preview validation + Owner Preview signoff

**Do not promote because joists/rim/bearers now have Quotr benchmarks.**
**Do not promote in DECK-1D-B.**
