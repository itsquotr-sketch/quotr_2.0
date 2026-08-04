# Authoritative Pricing Engine Specification

**Status:** Draft specification for Stage 2B (pending Batch 2B.2 owner commercial decisions)  
**Date:** 2026-08-04  
**Governing architecture:** `docs/architecture/QUOTR_ARCHITECTURE_FOUNDATION.md`  
**Supporting audit:** `docs/audits/STAGE_2B_PRICING_ENGINE_AUDIT.md`  
**Process:** `docs/MVP_HARDENING_GUIDE.md`  

**Constraint:** This specification defines the intended pricing engine **independently of** React components, API routes, or database tables. File paths below appear only as migration anchors from the audit, not as required implementation shape.

**Non-implementation notice:** Batch 2B.1 does not implement this engine. Unresolved commercial decisions in the audit Part 2 remain open; formulas marked **recommended change** require owner approval before altering user-visible numbers.

---

## 1. Purpose

The Quotr Pricing Engine is the **single authoritative financial-calculation service** for:

* internal estimates;
* final pricing documents;
* customer-facing quotes;
* future learning systems that **consume** commercial results (Company DNA, scenario calibration, estimate-versus-actual).

It exists so every surface shares one commercial meaning for cost, sell, gross profit, gross margin, markup (where supported), GST, and aggregates — fulfilling Architecture Foundation philosophy: deterministic money and one commercial truth.

---

## 2. Customer outcome

When the engine is adopted:

1. **Consistent numbers everywhere** — the same inputs produce the same cost, sell, profit, tax and totals across estimate, pricing and quote views (modulo intentional document rules such as visibility).
2. **Clear explanations** — users can eventually see what rates, margin and modifiers produced a number.
3. **Safe editing** — edits recalculate predictably by mode (quantity×rate, productivity labour, lump sum).
4. **Predictable save/reopen** — persisted values match the last authoritative server calculation.
5. **Improved estimate trust** — company rates and gross margin behave coherently; surprises from duplicated formulas disappear.

---

## 3. Strategic outcome

1. **One calculation source** for commercial arithmetic.  
2. **Versioned calculations** so historical results remain interpretable.  
3. **Replayable decisions** from stored inputs + version.  
4. **Company DNA compatibility** without embedding ML in arithmetic.  
5. **Estimate-versus-actual learning readiness** via stable identifiers and structured results (actuals capture is future work).

---

## 4. Engine boundaries

### 4.1 The engine does

* Validate calculation inputs against declared modes and commercial bounds (as configured by product rules).  
* Calculate line-item cost and sell.  
* Calculate gross profit, gross margin and markup metrics from cost/sell (and sell-from-cost when margin is the driver).  
* Aggregate line results into document totals.  
* Calculate GST from a GST-exclusive sell subtotal when requested.  
* Produce explainable, deterministic structured outputs.  
* Apply declared modifiers supplied as inputs (waste-adjusted quantities, labour minimums, range factors) when callers provide them.

### 4.2 The engine does not

* Interpret photos or unstructured site media.  
* Decide project scope or confirm work areas.  
* Call an LLM or treat model output as money authority.  
* Persist directly to the database (callers persist).  
* Silently modify company settings or rates.  
* Determine arbitrary market prices (callers supply rates/benchmarks).  
* Perform authentication, organisation ownership or RLS (Stage 2A responsibilities remain **outside** the engine).  
* Fabricate confidence scores as if they were priced uncertainty (confidence hooks may be passed through; scoring stays a separate heuristic unless product later defines otherwise).

**Architecture authorisation:** AI Principles §8; Security governance from Stage 2A; Philosophy §4.5.

---

## 5. Canonical input model

Technology-neutral structured input. Identifiers are opaque strings for traceability.

### 5.1 Envelope

| Field | MVP | Meaning |
| --- | --- | --- |
| `calculation_id` | Optional | Caller correlation id |
| `calculation_version` | Required when versioning enabled | Engine semver / formula pack id (see §10) |
| `document_kind` | Required | `estimate_line` \| `pricing_line` \| `quote_line` \| `document_aggregate` \| `sell_from_cost` |
| `mode` | Required for lines | `quantity_rate` \| `productivity_labour` \| `lump_sum` |
| `currency` | Optional | Display/metadata (e.g. NZD); does not alter arithmetic |
| `source` | Optional | Provenance: `company_rate` \| `benchmark` \| `manual` \| `derived_margin` \| `estimate_snapshot` \| … |
| `company_setting_refs` | Optional | Opaque refs (margin default id, gst rate id, wastage profile id) |
| `constraint_modifier_refs` | Optional / future-compatible | Opaque refs for modifiers already applied upstream |
| `manual_override` | Optional | See §9 |

### 5.2 Line inputs by mode

#### `quantity_rate`

| Field | Required | Notes |
| --- | --- | --- |
| `quantity` | Yes (>0 for forward calc) | |
| `unit` | Optional | |
| `unit_cost` | Optional* | *Needed to compute cost |
| `unit_sell` | Optional* | *Needed to compute sell; or derive via margin |
| `target_gross_margin_percent` | Optional | If sell missing and policy is derive-from-cost |
| `waste_percent` | Optional | Prefer waste already applied to quantity; if both present, policy must be explicit (owner) |

#### `productivity_labour`

| Field | Required | Notes |
| --- | --- | --- |
| `quantity` | Typical | Scope quantity (e.g. m²) |
| `productivity_rate` | Typical | Hours per unit |
| `calculated_quantity` | Optional | Labour hours; may be derived `quantity × productivity_rate` |
| `unit_cost` / `unit_sell` | Hourly rates | Applied to hours |
| `target_gross_margin_percent` | Optional | Derive hourly sell from cost if policy allows |

#### `lump_sum`

| Field | Required | Notes |
| --- | --- | --- |
| `total_cost` | Typical | Finite ≥ 0 |
| `total_sell` | Typical | Finite ≥ 0 |
| `quantity` / unit rates | Optional | Informational; do not force qty×rate equality |

### 5.3 Aggregate inputs

| Field | Required | Notes |
| --- | --- | --- |
| `lines[]` | Yes | Each with `total_cost`, `total_sell`, inclusion flags |
| `inclusion_rule` | Yes | `all` \| `visible_only` (maps today’s pricing vs quote behaviour) |
| `gst_rate_percent` | Optional | If tax block requested |
| `range_factors` | Optional | `{ low, high }` for estimate bands |

### 5.4 Future-compatible (not MVP-required)

* `scenario_id`, `dna_profile_id`, `actuals_linkage_id`  
* `overhead_percent`, `discount`, `credit_lines`  
* Structured constraint impact vectors  
* Multi-currency conversion  

---

## 6. Canonical result model

| Field | MVP | Meaning |
| --- | --- | --- |
| `line_cost` / `total_cost` | Yes | GST-exclusive cost |
| `line_sell` / `total_sell` | Yes | GST-exclusive sell |
| `gross_profit` | Yes | `sell − cost` |
| `gross_margin_percent` | Yes | `GP / sell × 100` (0 if sell=0) |
| `markup_percent` | Yes | `GP / cost × 100` (0 if cost=0) |
| `gst_exclusive_total` | Aggregate | Sell subtotal |
| `gst_amount` | When tax requested | |
| `gst_inclusive_total` | When tax requested | |
| `components` | Yes | Structured breakdown (qty, rates, hours, mode) |
| `warnings[]` | Yes | Non-fatal issues |
| `validation_errors[]` | Yes | Fatal for persistence callers |
| `assumptions_used[]` | Optional | Opaque strings/refs supplied by caller |
| `source_references[]` | Optional | Rate keys, setting refs |
| `calculation_version` | Yes when versioning on | Echo input version |
| `explanation` | Yes (hooks) | See §11 |
| `confidence` | Hook only | **Must not be fabricated by money engine**; pass-through or omit |
| `range` | Optional | `cost_low/high`, `sell_low/high` when factors supplied |

---

## 7. Formula specification

Notation: values are real numbers; `round2` means round to 2 decimal places (see §13).  
Status tags: **Approved existing** · **Recommended change (needs owner)** · **Future**

### 7.1 Quantity × rate — **Approved existing**

\[
cost = round2(quantity \times unit\_cost),\quad
sell = round2(quantity \times unit\_sell)
\]

Worked example: qty 10, unit_cost 50, unit_sell 62.50 → cost 500.00, sell 625.00.

### 7.2 Productivity labour — **Approved existing**

\[
hours = round2(quantity \times productivity\_rate)
\]
(or use provided `calculated_quantity` as hours)

\[
cost = round2(hours \times unit\_cost),\quad
sell = round2(hours \times unit\_sell)
\]

Example: 20 m² × 1.2 h/m² = 24 h; × $60 / $75 → cost 1440.00, sell 1800.00.

### 7.3 Cost-to-sell using gross margin — **Approved existing**

Gross margin \(m\) is percent where \(m \in [0, 95]\).

\[
sell = round2\left(\frac{cost}{1 - m/100}\right)
\]

Example: cost 800, m=20 → sell = 800 / 0.8 = 1000.00.

**Architecture:** Product Scope §3.2.

### 7.4 Markup (metric and optional driver) — **Approved as derived metric; driver undecided**

Derived markup from cost/sell:

\[
markup\% = cost > 0\ ?\ round2((sell - cost)/cost \times 100)\ :\ 0
\]

**Recommended change (owner):** whether any path may set sell from markup \(k\%\) via \(sell = cost \times (1 + k/100)\) in MVP. Audit finds dual fields; sell-from-cost today is margin-based. **Do not implement markup-driven sell until CD-01/CD-04 decided.**

### 7.5 Gross profit — **Approved existing**

\[
GP = round2(sell - cost)
\]

### 7.6 Gross margin (metric) — **Approved existing**

\[
margin\% = sell > 0\ ?\ round2(GP/sell \times 100)\ :\ 0
\]

### 7.7 GST — **Approved existing**

Given GST-exclusive sell subtotal \(S\) and rate \(g\%\):

\[
gst = round2(S \times g/100),\quad
total_{incl} = round2(S + gst)
\]

Example: S=1000, g=15 → gst 150.00, incl 1150.00.

Estimates today typically omit GST; pricing/quotes include it — **presentation rule CD-09**.

### 7.8 Line aggregation — **Approved existing with explicit inclusion rule**

\[
subtotal\_cost = round2(\sum_i cost_i),\quad
subtotal\_sell = round2(\sum_i sell_i)
\]

only over lines matching `inclusion_rule`.

Then apply §7.5–7.6 on subtotals.

### 7.9 Document aggregation — **Approved existing**

Pricing documents: `inclusion_rule = all`.  
Quotes: `inclusion_rule = visible_only` (**Approved existing behaviour**; **CD-21** may add warnings — Recommended change is process/UX, not silent redefinition).

### 7.10 Estimate range handling — **Approved existing**

Given factors \(L\) (budget), \(H\) (premium):

\[
cost_{low}=round2(cost\times L),\ \ldots\ similarly\ for\ high\ and\ sell
\]

Defaults today: L=0.9, H=1.15 from organisation settings when present.

### 7.11 Waste application — **Approved existing (quantity layer)**

Prefer applying waste **before** money:

\[
qty_{net} = f(qty_{gross}, waste\%)
\]

(as today’s buildup helpers: percent adders; sheet counts may ceil). Engine accepts `quantity` already waste-adjusted unless owner standardises in-engine waste (**Future** unification).

### 7.12 Lump-sum treatment — **Approved existing**

`total_cost` / `total_sell` are authoritative. Do not require:

\[
quantity \times unit\_* = total\_*
\]

Validation: finite, ≥ 0; Stage 2A bounds on derived margin/markup when persisted.

### 7.13 Rounding — **Approved existing intent; Recommended single helper**

See §13. Recommended change: one shared `round_money` / `round_percent` implementation used by all call sites (behaviour-preserving).

### 7.14 Labour / allowance minimums — **Approved existing modifiers**

Hours or allowance floors may raise cost/sell before profit metrics. Treated as **pre-engine or engine modifiers** with explanation entries; formulas remain those in commercial-realism today until owner changes them.

---

## 8. Calculation modes

### 8.1 `quantity_rate`

| | |
| --- | --- |
| Required | quantity > 0; unit_cost and/or unit_sell (or margin derive policy) |
| Optional | unit, waste (pre-applied), override metadata |
| Invalid | negative qty/rates/totals; non-finite; margin out of bounds when deriving |
| Sequence | validate → compute cost/sell from qty×rates (or derive sell) → profit metrics → explanation |
| Results | full line result model |
| Overrides | editing qty/rates/totals per existing edit-field cascade (audit C-25) |
| Warnings | missing sell with derive; benchmark source |

### 8.2 `productivity_labour`

| | |
| --- | --- |
| Required | enough data to obtain hours and hourly rates |
| Optional | explicit hours vs productivity_rate |
| Invalid | negative hours/rates; inconsistent forced triples outside tolerance without override |
| Sequence | resolve hours → qty×hourly rates → profit metrics |
| Overrides | changing hours updates productivity; changing rates updates totals; changing totals may back-solve hourly rate |
| Warnings | inferred productivity; minimum hours applied |

### 8.3 `lump_sum`

| | |
| --- | --- |
| Required | total_cost, total_sell (non-negative finite) |
| Optional | informational qty/unit |
| Invalid | negatives/non-finite; out-of-bounds derived margin/markup on persist |
| Sequence | accept totals → profit metrics |
| Overrides | totals are primary; AI must not overwrite (§9) |
| Warnings | zero-value informational |

---

## 9. Manual overrides

| Rule | Specification |
| --- | --- |
| What users may override | Line quantities, unit rates, totals (by mode), target estimate margin, quote line presentation fields; lump-sum totals |
| Replace input vs result | Mode-specific: typically override **inputs** and recompute results; lump-sum overrides **result totals** directly |
| Labelling | Results must mark `manual_override: true` with optional reason when caller indicates override |
| Metadata | `overridden_fields[]`, `reason`, `actor_ref`, `at` (caller-supplied) |
| Recalculation | Preserve override until user clears it or explicitly regenerates (estimate regenerate / recalibration policies unchanged unless owner says otherwise) |
| Company DNA | Future learning may treat overrides as correction evidence — engine only **records** metadata hooks |
| AI | **Must not** silently overwrite manual overrides (Architecture AI Principles) |

---

## 10. Versioning

| Concept | Spec |
| --- | --- |
| Engine version | Logical version string of the pricing engine package (e.g. `2B.0.0`) |
| Formula version | Sub-identifier for formula pack (margin divisor, GST, modes) |
| Input snapshot | Caller should persist the validated input envelope used for a committed document |
| Result snapshot | Persist engine outputs that documents display |
| Replay | Same version + same inputs ⇒ same outputs (bit-stable given §13) |
| Historical estimates/quotes | **Do not rewrite** historical quotes when formulas change; new calculations use new version (CD-20) |
| Backward compatibility | Readers must tolerate missing version on pre-2B rows (treat as `legacy-unversioned`) |
| DB columns | **Do not add** version columns in Batch 2B.1; add only when an implementation batch authorises schema |

---

## 11. Explainability

Every result should eventually answer:

1. What inputs were used?  
2. What rates were used?  
3. What formula / mode was used?  
4. What margin was applied?  
5. What modifiers were applied (waste, minimums, range factors)?  
6. Why the number changed (changed_field / override)?  
7. Whether it was manually overridden?

**MVP hooks (required now in the result model, even if UI does not show them yet):**

```text
explanation: {
  mode,
  formula_ids: string[],      // e.g. "qty_rate", "sell_from_gross_margin", "gst_on_sell"
  inputs_used: object,         // redacted/safe subset
  rates_used: object,
  margin_applied: number | null,
  modifiers: object[],
  override: object | null,
  source_references: string[]
}
```

**Architecture authorisation:** Intelligence-Ready §9; Future Learning §10.4 — hooks avoid a rebuild for Company DNA.

---

## 12. Error and warning model

| Class | Meaning | Persistence |
| --- | --- | --- |
| Invalid input | Schema/bounds failure | Must not persist |
| Missing critical input | Cannot compute mode | Must not persist as priced (caller may save draft incomplete only if product allows — today prefer reject) |
| Permitted preliminary estimate | Missing rates with benchmark fallback | Persist with warnings |
| Outlier warning | Future / optional | Persist OK |
| Stale rate warning | Future / optional | Persist OK |
| Inconsistent stored result | Forward totals ≠ recomputed beyond tolerance | Server should recompute or reject (pricing save path today recomputes non-lump-sum) |
| Manual override | Informational | Persist OK |
| Engine failure | Unexpected | Fail closed; no partial corrupt money writes |

---

## 13. Precision and rounding

| Topic | MVP rule |
| --- | --- |
| Internal precision | IEEE numbers OK; **commit** via `round2` |
| Currency rounding | 2 decimal places |
| Quantity precision | 2 dp for money-affecting qty/hours unless domain ceil (sheets) applied upstream |
| Percentage precision | 2 decimal places for stored margin/markup metrics |
| Aggregation order | Round **each line** first; sum; round subtotal; then GST; round GST; round incl |
| Drift prevention | Do not mix unrounded client totals with rounded server lines; server engine is authority before persist |

**Recommended change:** eliminate parallel `round2` / `roundMoney` / inline Math.round duplicates without changing numeric policy.

---

## 14. Security and trust

Retain Stage 2A requirements **outside** the pure engine:

* Authenticated organisation context  
* Ownership checks  
* Validated inputs (Zod / bounds: gross margin 0–95 default 20; markup 0–1000; no negatives; lump-sum secured)  
* No client-trusted totals as sole authority on pricing paths  
* No raw internal errors to clients  
* Deterministic **server-side** recalculation before persistence  

Engine may be imported by client for **preview only**; persistence callers must re-run on server.

**Architecture authorisation:** Governance §13.10; Stage 2A completion evidence.

---

## 15. Future-learning compatibility

Calculation results must later support (without implementing now):

| Capability | How this spec helps |
| --- | --- |
| Company DNA | Structured rates, margin, overrides, sources on results |
| Scenario calibration | Versioned replay + stable project/estimate/quote ids (caller) |
| Estimate edits as corrections | `target_margin` + manual_override metadata |
| Actual-versus-estimate | Stable line identities + cost/sell snapshots |
| Constraint impact learning | `constraint_modifier_refs` hooks |
| Company productivity | productivity mode fields preserved |
| Rate provenance | `source_references` / source enums |
| Explainable recommendations | `explanation` block consumed by future intelligence — **intelligence must not redefine totals** |

**Forbidden coupling:** training loops or automatic rate mutation inside the arithmetic engine (Architecture §10.6).

---

## 16. Migration strategy

Move call sites without a flag-day rewrite:

1. **Shadow calculation** — run new engine beside old; compare outputs.  
2. **Parity checks** — golden vectors from Batch 2B.2; CI/scripts.  
3. **Module-by-module adoption** — pricing actions → estimates → quotes → client display.  
4. **Read-only comparison logs** — dev/safe logs of mismatches (no sensitive over-capture; follow Stage 5/8 privacy later).  
5. **Feature flags** (optional) — per-surface adopt flag if needed; default off until parity green.  
6. **Historical compatibility** — old rows remain valid; new writes stamp version when columns exist.  
7. **Rollback** — revert adopt flag / commit; formulas unchanged behind flag.

Detailed batching: `docs/plans/STAGE_2B_IMPLEMENTATION_PLAN.md`.

---

## Binding product rules (already decided)

From Architecture Foundation / Stage 2A (not open unless owner amends architecture):

* Gross margin primary; definition GP ÷ sell  
* Default 20%; bounds 0–95%  
* Markup separate; bounds 0–1000%; no silent convert  
* No credits / negatives in MVP  
* Lump sum remains supported  
* Quotes are snapshots; company setting changes do not rewrite existing quotes  

---

## Document control

| Field | Value |
| --- | --- |
| Path | `docs/specifications/AUTHORITATIVE_PRICING_ENGINE_SPEC.md` |
| Created | 2026-08-04 |
| Implements code? | **No** (specification only) |
| Owner decisions pending | Audit Part 2 CD-01…CD-23 → Batch 2B.2 |
| Next | `docs/plans/STAGE_2B_IMPLEMENTATION_PLAN.md` Batch 2B.2 |
