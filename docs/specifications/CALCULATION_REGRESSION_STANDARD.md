# Calculation Regression Standard

**Status:** Permanent regression contract for Quotr pricing  
**Batch:** Stage 2B · 2B.2B  
**Authority:** Architecture Foundation · Authoritative Pricing Engine Spec · Canonical Commercial Scenarios · Golden Expected Results · Owner Commercial Decisions (when Confirmed)  

---

## 1. Purpose

This standard defines what **must not break** when the Authoritative Pricing Engine is introduced or later changed.

It is Quotr’s commercial regression law:

* Commercial validation  
* Pricing verification  
* Release gate for money paths  
* Protection of builder trust  
* Protection of historical quotes  
* Foundation for future Company DNA (without implementing DNA here)

---

## 2. Non-negotiable invariants

Future pricing-engine changes **MUST**:

1. **Produce identical outputs** to `GOLDEN_PRICING_EXPECTED_RESULTS.md` for every active canonical scenario, within declared rounding rules — unless an owner decision intentionally amends commercial rules and goldens are updated in the same change set.  
2. **Preserve commercial reasoning** documented in each scenario (why the number is correct for a builder).  
3. **Preserve historical snapshots** — accepted/sent quotes and superseded revisions must not be rewritten by rate, margin, GST setting, or engine-version changes.  
4. **Preserve manual overrides** — manually edited commercial values must not be silently replaced by AI, regenerate, or recalibration unless the product path explicitly offers and the user accepts replace/preserve behaviour (CCS-046).  
5. **Preserve validation** — reject negatives/credits, out-of-bounds margins, and invalid mode combinations per decisions/spec.  
6. **Preserve explainability hooks** — results must remain able to state mode, rates, margin, modifiers, and override flags.  
7. **Preserve deterministic behaviour** — same version + same inputs ⇒ same outputs.  
8. **Apply GST from the document’s validated GST rate** (never a competing hardcoded constant after document rate is set) — CCS-022 / OCD-GST.  
9. **Keep AI non-authoritative for money.**  
10. **Keep Stage 2A security outside the pure engine** (auth, ownership, Zod bounds).

**No undocumented commercial behaviour changes may occur.**

---

## 3. Rounding and aggregation contract

| Rule | Required behaviour |
| --- | --- |
| Money | `round2` to 2 decimal places on committed line amounts |
| Percents | 2 decimal places for stored margin/markup metrics |
| Order | Round each line → sum subtotals → GST → incl |
| Waste | Quantity first, then money |
| Sell-from-cost | `sell = round2(cost / (1 − m/100))` for m in [0, 95] |

Golden failures caused by alternate rounding order are **defects**, not “close enough.”

---

## 4. Document inclusion contract

| Document | Inclusion rule |
| --- | --- |
| Estimate / pricing aggregate | All money lines in scope (`inclusion_rule = all` unless line excluded from total) |
| Quote aggregate | Visible lines only (`visible_only`) |
| Intentional mismatch | Must be detectable (CCS-045 warning desired) |

---

## 5. Persistence and snapshot contract

| Record state | Recalculation |
| --- | --- |
| Draft pricing item edit | Recalc document totals |
| Estimate regenerate | Explicit; apply stored target margin if set |
| Accepted/sent quote | **Never** auto-recalc from new company settings |
| Quote revision | New row; prior immutable |
| Engine version bump | New calculations versioned; history untouched |

---

## 6. Required regression suite mapping

| Suite slice | Scenarios (minimum) |
| --- | --- |
| Quantity × rate | CCS-001, 028, 031, 033, 037 |
| Productivity | CCS-002, 027, 034, 051 |
| Waste | CCS-003, 036, 037 |
| Material+labour | CCS-004, 030, 035 |
| Subcontractor mix | CCS-005, 017, 029, 032 |
| Lump sum | CCS-006, 039, 041, 042, 047 |
| Allowances / provisional | CCS-007, 008, 048 |
| Zero / no-charge / info | CCS-009, 010 |
| Loadings | CCS-011–016, 050 |
| Multi-area | CCS-018, 038, 049 |
| Revision / snapshot | CCS-019, 020 |
| GST | CCS-021, 022 |
| Margin override / mixed | CCS-023, 024 |
| Ranges | CCS-025 |
| Builder correction | CCS-026, 046, 052 |
| Validation | CCS-043, 044 |
| Visibility | CCS-045 |

Every capability in `SCENARIO_COVERAGE_MATRIX.md` must remain mapped to ≥1 scenario.

---

## 7. Change control for goldens

Allowed reasons to change expected results:

1. Owner **Confirms** a commercial decision that differs from the recommended MVP model used to author goldens.  
2. Product-authorised amendment to Architecture Foundation commercial rules.  
3. Correction of an arithmetic error in the golden document itself (with explicit errata note).

**Not allowed:** changing goldens to match a buggy implementation, or “fixing” drift silently.

Process:

1. Update decision register status.  
2. Update scenario reasoning if meaning changes.  
3. Update golden numbers + formulas.  
4. Update coverage matrix if needed.  
5. Note engine version / formula version impact.  
6. Only then change implementation.

---

## 8. Pass / fail definition

A pricing engine build **passes** commercial regression when:

* All executable golden fixtures derived from this standard pass.  
* No scenario in the active set fails equality on cost, sell, GP, margin%, GST, incl, validation outcome, or required warnings (where automated).  
* Snapshot scenarios prove immutability.  
* Override scenarios prove non-silent overwrite.

A build **fails** if any undocumented numeric drift occurs on an active golden.

---

## 9. Relationship to Stage 2B batches

| Batch | Role relative to this standard |
| --- | --- |
| 2B.2B | Authors this standard + scenarios + goldens |
| 2B.3–2B.4 | Implement engine to satisfy goldens (after owner confirms blocking OCDs) |
| 2B.5 | Shadow parity against goldens / old helpers |
| 2B.6–2B.9 | Adoption must keep goldens green |
| 2B.10 | Final regression sign-off cites this standard |

**Batch 2B.3 must not begin** until blocking owner decisions in `STAGE_2B_OWNER_COMMERCIAL_DECISIONS.md` are Confirmed or explicitly Deferred with safe defaults aligned to these goldens.

---

## Document control

| Field | Value |
| --- | --- |
| Path | `docs/specifications/CALCULATION_REGRESSION_STANDARD.md` |
| Batch | 2B.2B |
| Code changes | **None** |
