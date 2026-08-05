# Stage 2B — Pricing Engine Audit (Batch 2B.1)

**Status:** Auditing complete for Batch 2B.1 (specification and plan issued separately)  
**Audit date:** 2026-08-04  
**Batch:** 2B.1 — Authoritative Pricing Engine Audit and Specification  
**Governing architecture:** `docs/architecture/QUOTR_ARCHITECTURE_FOUNDATION.md`  
**Governing process:** `docs/MVP_HARDENING_GUIDE.md`  
**Prior evidence:** Stage 1 audit; Stage 2A Complete (local + remote)  

**Method:** Static, evidence-based inspection of calculation call sites, persistence paths and UI preview arithmetic. No application code, migrations, Supabase, UI, prompts or formulas were changed during this batch.

**Architecture alignment:** Findings and recommended dispositions cite Architecture Foundation principles (deterministic money; one commercial truth; company-specific before generic; estimates guide / quotes commit; DNA/learning compatibility without implementing learning).

---

## 1. Executive summary

Quotr already has a working deterministic estimate → final pricing → quote progression. **Monetary arithmetic is not singly authoritative.** The same gross-profit / gross-margin / markup pattern is independently implemented in **at least ten places** (seven core server modules + client profit preview + estimate breakdown area rollup + category-breakdown partial profit). Sell-from-cost uses a shared `deriveSellFromCost` path for rate resolution, but line/document profit fields are re-derived repeatedly. Quote totals use a **different aggregation set** than pricing-document totals (`visible` / `visible_on_quote` vs all items), which can diverge silently (Stage 1 **S1-010**, deferred to Stage 6 for UX/progression, still relevant to Stage 2B commercial truth).

**Confirmed defect (re-verified 2026-08-04; corrected Batch 2B.5):** `createPricingFromEstimate` previously inserted `gst_rate` from organisation defaults, then called `recalculateAndPersistDocumentTotals(..., DEFAULT_GST_RATE, …)` with the hardcoded default **15**. If the organisation GST rate differed from 15, GST amount / total incl. GST were rewritten incorrectly after item insert.

**Batch 2B.4 update (2026-08-04):** Legacy implementations remapped to stable **LEG-*** IDs with shadow-parity fixtures under `lib/commercial-engine/parity/`. C-28 was recorded as **BLOCKING_ADOPTION_MISMATCH** (fixture `PAR-P-GST-BUG-C28`); **not fixed** in 2B.4. Compatibility matrix: `docs/specifications/LEGACY_COMMERCIAL_COMPATIBILITY_MATRIX.md`. Engine still unwired.

**Batch 2B.10 update (2026-08-05):** Final authority audit complete. Dead unused wrappers removed (`calculations.calculatePricingItemEdit` re-export; unused estimate category-margin helper). Authority switches retained (documented rollback). Full regression green. Stage 2B marked **Complete — Local**. No migrations. Deployment owner-gated.

**Batch 2B.9 update (2026-08-05):** Client/presentation financial authority removed. UI displays persisted/server values or approved engine-backed edit previews. Unknown-cost labels honest. Quotes remain snapshot-only. No migrations.

**Batch 2B.8 update (2026-08-05):** Quote-domain aggregates (`visible_only` + document GST) and draft line total resolution adopted via `lib/quotes/quote-commercial-engine-adapter.ts`. Historical quotes immutable; revise-copy unchanged. UI/client calc removal remains 2B.9. No migrations.

**Batch 2B.7 update (2026-08-04):** Estimate-domain line money, margin override, and GST-exclusive aggregates adopted via `lib/estimate/estimate-commercial-engine-adapter.ts`. Confidence/ranges remain domain metadata. Quotes/UI still legacy. No migrations.

**Batch 2B.6B update (2026-08-04):** Pricing-domain server mutations adopted: create-from-estimate, document GST aggregate, recalibration (manual preserve), read `cost_known` derivation. Quotes/UI still legacy at that time. No migrations.

**Batch 2B.6A update (2026-08-04):** Item CRUD + document aggregate after mutations adopted via production adapter.

Stage 2A secured auth, ownership and input validation around money-bearing actions **without** consolidating formulas. Stage 2B must now specify and (in later batches) adopt one authoritative engine while preserving current MVP behaviour until owner commercial decisions and golden tests land.

**Verdict:** Safe to proceed to Batch 2B.2 (owner commercial decisions + golden cases). **Do not refactor formulas until decisions are confirmed.** The org-GST overwrite defect was fixed in Batch **2B.5** using the document’s stored / org GST rate — not a new commercial rule. Engine adoption remains Batch **2B.6**.

---

## 2. Architecture authorisation for this audit

| Proposed future change class | Architecture authorisation |
| --- | --- |
| Single authoritative commercial arithmetic | Philosophy §4.5–4.6; Governance §13.8; Roadmap Stage 2B |
| Keep AI out of money totals | AI Principles §8.1–8.2; Philosophy §4.4 |
| Preserve estimate → pricing → quote progression | Domain Relationships §7.4–7.6; Workflow §5 |
| Explainable / versioned / replayable results | Intelligence-Ready §9; Future Learning §10 |
| No Company DNA / ML implementation in 2B | Out of Scope §12; Learning §10.6 |
| Preserve lump-sum, gross margin primary, markup separate | Product Scope §3.2 |

---

## 3. Part A — Calculation implementation inventory

Legend for **Authoritative / duplicated:**

* **Canonical candidate** — closest to a reusable shared helper today  
* **Duplicated** — same commercial meaning re-implemented  
* **Domain-specific** — intentional specialised behaviour (not pure margin GP)  
* **Display-only** — UI preview; must not remain authority after 2B  

| ID | File | Function / component | Responsibility | Inputs | Outputs | Caller(s) | Persistence | Side | Auth / dup | Validation | Rounding | GST | Margin / markup | Risk | Recommended disposition |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| **C-01** | `lib/estimate/rates.ts` | `deriveSellFromCost` | Cost → sell via gross margin | cost, margin % | sell rate/amount | Rate resolvers, margin-override | Indirect (feeds line amounts) | Server | **Canonical candidate** for sell-from-cost | `assertMarginPercentForEstimating` 0–95 | `round2` | None | Gross margin divisor `(1 − m/100)` | Med | Become engine primitive; keep single export |
| **C-02** | `lib/estimate/rates.ts` | `resolveRate` / `resolveLabourRate` / range helpers | Resolve cost+sell rates; derive sell if missing | org rates, settings, fallbacks | `ResolvedRate` / labour rate + low/high | Calculators, material resolver | Via estimate lines | Server | Domain-specific + uses C-01 | Margin assert on derive | `round2` | None | Sell may be stored or derived | Med | Stay as rate resolution layer **calling** engine; do not own GP% |
| **C-03** | `lib/estimate/resolve-material-rate.ts` | `resolveMaterialRate` | Material rate cascade + sell derive | org rates, keys, benchmarks | cost/sell + provenance | `material-rate-pricing` | Via estimate lines | Server | Uses C-01; duplicates range factor application pattern | Margin assert | `round2` | None | Same as C-01 when sell missing | Med | Call shared sell-from-cost + shared range helper |
| **C-04** | `lib/estimate/material-rate-pricing.ts` | `resolveBuildUpMaterialPricing` | Quantity × resolved material rates | buildup qty/unit, rates | qty, costRate, sellRate | Calculators | Via line items | Server | Domain-specific | Relies on resolver | Indirect | None | Cost/sell rates only | Low | Keep; multiply via engine line mode later |
| **C-05** | `lib/estimate/material-buildups.ts` | buildup helpers | Waste-adjusted quantities | area/lm + wastage % | quantities | Calculators | Metadata / qty | Server | Domain-specific | None on money | `round2` / ceil sheets | None | N/A | Low | Quantity layer; waste formula owned here or settings |
| **C-06** | `lib/settings/material-wastage.ts` | `resolveMaterialWastage` | Resolve wastage % | org wastage settings, category | percent 0–50 | Calculators | Settings only | Server | Domain-specific | Clamp 0–50 | N/A | None | N/A | Low | Keep; engine accepts waste as input |
| **C-07** | `lib/estimate/productivity.ts` | `resolveProductivity` | Benchmark hours/unit | productivity key | hoursPerUnit | Calculators | Indirect hours | Server | Domain-specific | Fallback hours | N/A | None | N/A | Low | Company DNA later; MVP keep benchmarks |
| **C-08** | `lib/estimate/line-items.ts` | `deriveMargins` (private) | GP, margin%, markup% from cost/sell | cost, sell | GP, margin%, markup% | `create*LineItem` factories | estimate_line_items | Server | **Duplicated** (#1 of core GP set) | None | `round2` | None | GP÷sell; GP÷cost | **High** | Merge into engine `deriveProfitMetrics` |
| **C-09** | `lib/estimate/line-items.ts` | `buildAmounts` / line factories | Apply ranges + margins to line | cost, sell, settings | full line amounts | All calculators | estimate_line_items | Server | Uses C-08 + range factors | None | `round2` | None | Via C-08 | High | Call engine line result builder |
| **C-10** | `lib/estimate/commercial-realism.ts` | `deriveMargins` (private) | Same GP triad | cost, sell | GP, margin%, markup% | `rebuildLineItemAmounts` | estimate lines | Server | **Duplicated** (#2) | None | `round2` | None | Same | **High** | Delete; call shared |
| **C-11** | `lib/estimate/commercial-realism.ts` | `applyLabourMinimums` / `applyAllowanceMinimum` / rebuild helpers | Minimum hours/allowance floors | hours, min crew, min $ | adjusted hours/cost/sell | Calculators | Line metadata | Server | Domain-specific | None | `round2` | None | Rebuild via C-10 | Med | Keep domain; profit via engine |
| **C-12** | `lib/estimate/summary.ts` | `sumLineItems` | Aggregate line cost/sell/ranges | line items | sum fields | `finalizeEstimateResult` | estimates | Server | Domain aggregation | Filters `includedInTotal` | None until finalize | None | N/A | Med | Engine document aggregate (estimate flavour) |
| **C-13** | `lib/estimate/summary.ts` | `finalizeEstimateResult` | Estimate totals + GP triad + confidence | lines, assumptions | `EstimateResult` | `calculateEstimate` | estimates | Server | **Duplicated** GP (#3) | None | `round2` | None | Same triad | **High** | Totals via engine; confidence stays heuristic (not money) |
| **C-14** | `lib/estimate/summary.ts` | `computeConfidence` | Heuristic confidence score | rate sources, missing facts | 35–95 score | finalize | estimates.confidence | Server | Domain-specific (not money formula) | Clamped | `round2` | None | N/A | Low | Out of money engine; keep separate |
| **C-15** | `lib/estimate/margin-override.ts` | `recalculateSellFromCost` | Sell-from-cost + GP triad | cost, margin% | sell, GP, margin%, markup% | Margin apply paths | estimates / lines | Server | **Duplicated** GP (#4) + uses C-01 | Via C-01 | `round2` | None | Primary path for target margin | **High** | Engine: apply margin + metrics |
| **C-16** | `lib/estimate/margin-override.ts` | `sumLineItemTotals` | Aggregate + GP triad | adjusted lines | totals | regenerate + margin update | estimates | Server | **Duplicated** GP (#5) | None | `round2` | None | Same | **High** | Engine aggregate |
| **C-17** | `lib/estimate/margin-override.ts` | `applyMarginToAmounts` / `applyTargetMarginToLineItems` | Reprice sells from cost at target margin + ranges | cost, margin%, settings | line amounts | `updateEstimateMargin`, regenerate | estimates / lines | Server | Uses C-15 | Client Zod + validateTargetMargin | `round2` | None | Target margin drives sell | Med | Engine mode `apply_target_margin` |
| **C-18** | `lib/estimate/calculate-estimate.ts` | `calculateEstimate` | Orchestrate calculators → finalize | `EstimateContext` | `EstimateResult` | `runEstimateGeneration` | via persist | Server | Orchestrator | Throws if no work areas | Via children | None | Via C-13 | Med | Keep orchestrator; money via engine |
| **C-19** | `lib/estimate/calculators/*` (9+ modules) | e.g. `calculateDeck` | qty × rates, allowances, labour hours | facts, rates, productivity, waste | line items | `calculateEstimate` | via persist | Server | Domain-specific money construction | Limited | `round2`; some hardcoded pairs | None | Mostly precomputed cost/sell; some bypass org margin (**S1-012**) | **High** (hardcodes) | Keep calculators; all money lines through engine helpers; resolve hardcodes in later batches / Stage 4 |
| **C-20** | `lib/estimate/adjustments.ts` | access/quality factors | Labour multipliers | constraint-ish inputs | factors | Some calculators | Indirect | Server | Domain-specific; **near-duplicates** vs calculator-local factors | None | N/A | None | N/A | Med | Consolidate factors later; not core GP merge |
| **C-21** | `lib/assistant/actions.ts` | `runEstimateGeneration` | Generate/regenerate estimate; optional target margin | projectId | persist | UI EstimatePanel | estimates, estimate_line_items | Server | Orchestrator | Stage gates; auth/ownership (2A) | Via engine modules | None | May apply C-17 | Med | Adopt engine for margin apply + totals |
| **C-22** | `lib/assistant/margin-actions.ts` | `updateEstimateMargin` | Edit target margin; rewrite sells | targetMarginPercent | updated estimate+lines | MarginEditControl | estimates, lines | Server | Uses C-15–C-17 | Zod + 0–95 | Via C-15 | None | Target gross margin | Med | Call engine only |
| **C-23** | `lib/estimate/persist-estimate.ts` | `persistEstimateResult` | Persist result fields as stored | `EstimateResult` | DB rows | C-21 | estimates, estimate_line_items | Server | Persistence only | Relies on upstream | Stored rounded | None | Stores triad | Low | Must store engine outputs / version later |
| **C-24** | `lib/pricing/pricing-item-calculation.ts` | `computeProfitFields` | GP triad for pricing items | totalCost, totalSell | GP, margin%, markup% | resolve/edit/save | pricing_items | Server | **Duplicated** GP (#6) | None here | `roundMoney` / `roundPercent` | None | Same triad | **High** | Engine line profit |
| **C-25** | `lib/pricing/pricing-item-calculation.ts` | `calculatePricingItemEdit` / `calculatePricingItemTotalsForSave` / modes | quantity_rate, productivity_labour, lump_sum edits + cross-check | mode, qty, rates, totals, changedField | full item fields | pricing actions, UI | pricing_items | Server (+ imported by client) | **Canonical candidate** for line modes | Stage 2A Zod on actions; lump_sum skips forward cross-check by design | `roundMoney` | None | Derived after totals | **High** | Core of authoritative line engine |
| **C-26** | `lib/pricing/calculations.ts` | wrappers + `calculateDocumentTotals` | Re-export line calcs; document aggregate + GST | items, gstRate | document totals | pricing actions, recalibration | pricing_documents | Server | **Duplicated** GP (#7) for doc; GST canonical-ish | None | `roundMoney` | **GST = sell × rate/100** | Doc triad + GST | **High** | Engine document aggregate |
| **C-27** | `lib/pricing/actions.ts` | `recalculatePricingDocumentTotals` / mutations | Persist item + recalc doc | item edits, gst | DB | UI | pricing_* | Server | Uses C-25/C-26 | Zod (2A) | Via C-25/26 | Via C-26 | Stores derived | Med | Shadow then adopt engine |
| **C-28** | `lib/pricing/actions.ts` | `createPricingFromEstimate` | Copy estimate → pricing doc/items | estimate | pricing snapshot | UI | pricing_* | Server | Copies estimate money; GST via org settings on insert **and** post-item recalc (**fixed 2B.5**; previously hardcoded `DEFAULT_GST_RATE` 15) | Zod (2A) | Mixed | Org/document GST consistent after 2B.5 | Copies estimate triad; GST amounts agree with `gst_rate` for new creates | **Resolved (2B.5)** | Engine snapshot from estimate + item build via C-25 in 2B.6 |
| **C-29** | `lib/pricing/recalibration.ts` | recalibration apply/preview | Diff estimate vs pricing; recalc docs | estimate + pricing items | preview / updates | UI Recalibration | pricing_* | Server | Uses C-26 | Ownership | Via C-26 | Via C-26 | Reuses doc totals | Med | Must use same engine as live pricing |
| **C-30** | `lib/quotes/calculations.ts` | `calculateQuoteTotals` | Sum **visible** quote items + GST | items.visible, gstRate | subtotal, gst, incl | quote actions/build | quotes | Server | GST similar to C-26; **different item filter** | Default gst 15 if NaN | `roundMoney` | Same GST pattern | **No cost/GP on quote header** | **High** (divergence) | Engine quote aggregate with explicit visibility rule |
| **C-31** | `lib/quotes/calculations.ts` | `calculateQuoteItemTotal` | Prefer client `total`, else qty×unitPrice | qty, unitPrice, total | total | quote item updates | quote_items | Server | Domain-specific | 2A schemas on actions | `roundMoney` | None | Sell-side only | Med | Engine quote line; **no client-trusted total without recompute policy** (owner decision) |
| **C-32** | `lib/quotes/from-pricing.ts` | `mapPricingItemsToQuoteItems` | Copy sell → quote lines; productivity unit price special-case | pricing items | quote item inputs | create/revise | quote_items | Server | Transform | Sanitise labels | `roundMoney` for productivity unit price | None | Uses `total_sell` | Med | Preserve transform; totals via C-30 |
| **C-33** | `lib/quotes/build-from-pricing.ts` | build quote payload | Assemble quote + `calculateQuoteTotals` | pricing doc | quote insert | actions | quotes | Server | Uses C-30/C-32 | Reviewed gate | Via C-30 | Via C-30 | Snapshot | Med | Adopt engine |
| **C-34** | `lib/quotes/actions.ts` | create/revise/update item | Persist quotes; recalc | user input | quotes | UI | quotes, quote_items | Server | Uses C-30/C-31 | Zod (2A) | Via calcs | Via C-30 | Snapshot immutability of old revisions | Med | Adopt engine; preserve revision history |
| **C-35** | `components/pricing/PricingItemEditForm.tsx` | `profitPreview` | Client GP triad preview | form totals | display | Edit form | None until save | **Client** | **Duplicated** (#8) | Relies on shared edit calc for fields; profit inlined | `Math.round` ×100 | None | Same triad | Med | Display engine result only (Batch 2B.9) |
| **C-36** | `components/assistant/EstimateBreakdownModal.tsx` | `sumWorkAreaTotals` | Client sum cost/sell/profit for display | estimate lines | display % | Modal | None | **Client** | Display aggregation (**GP triad variant #9**; margin **unrounded**) | None | Ad hoc / no round2 on area margin% | None | profit/sell for area margin | Low | Prefer server-provided rollups; apply round2 in 2B.9 |
| **C-37** | `lib/assistant/mock-seed.ts` / mock-data | static seeds | Demo numbers | constants | fake estimate | Demo only | Optional | Server/client | Non-production | N/A | Fixed | None | Hardcoded triad | Low | Keep out of engine authority |
| **C-38** | Quote print / preview components | display stored totals | Render `subtotal`, `gst_amount`, `total_incl_gst` | quote row | UI/PDF print | Print route | Read-only | Client display | Display-only | N/A | Stored | Shows stored GST | No recalc | Low | Must remain snapshot display |
| **C-39** | DB migrations | defaults/checks only | `default_margin` 20% (025); GST 0–100 checks; **no money triggers** | N/A | constraints | N/A | Schema | DB | Integrity only | CHECK | numeric scale | Constraints | Default margin; DB margin check ≤100 vs app estimating ≤95 | Low | No DB formula authority; bounds alignment is validation not formula |
| **C-40** | Verification scripts (2A.* + recalculation) | security/validation / preservation proofs | Not formula parity | N/A | pass/fail | CI-manual | None | Server scripts | N/A | N/A | N/A | N/A | N/A | Low | Add 2B parity scripts later |
| **C-41** | `components/pricing/PricingWorkAreaSection.tsx` | section `useMemo` totals | Client section aggregate via `calculateDocumentTotals(..., gstRate=0)` | section items | display sell/margin | Pricing UI | None | **Client** | Uses C-26 with GST forced 0 (display-only) | None | Via C-26 | Intentionally excluded | Section rollup | Low | Display engine aggregate with inclusion=section; no GST |
| **C-42** | `lib/estimate/category-breakdown.ts` | `sumByCategoryWithSplits` | Category cost/sell/**profit only** (no margin%/markup%) | line items | category totals | EstimateBreakdownModal | None | Shared | Partial GP (**variant #10**) | None | Unrounded profit | None | profit = sell − cost only | Low | Call shared profit metrics if % needed; else leave display helper |

### A.1 Sell-from-cost (distinct from GP triad)

| ID | Location | Formula | Notes |
| --- | --- | --- | --- |
| C-01 | `deriveSellFromCost` | `sell = round2(cost / (1 − margin/100))` | Shared export; used by rate resolution and margin override |
| Labour defaults | `resolveLabourRate` fallback | Fixed **$60 cost / $90 sell** | Does **not** use org margin (**commercial decision**) |
| Hardcoded calculator pairs | `fitout.ts` / `deck.ts` (S1-012) | Literal cost/sell | Bypass org margin |

### A.2 Rounding helpers (duplicated utilities)

| Helper | Files | Behaviour |
| --- | --- | --- |
| `round2` | `lib/estimate/facts.ts` (used widely in estimate) | `Math.round(value * 100) / 100` |
| `roundMoney` / `roundPercent` | `lib/pricing/calculations.ts` and private copies in `pricing-item-calculation.ts` | Same 2-dp pattern |
| Inline `Math.round` | `PricingItemEditForm` | Same 2-dp |

**Confirmed:** rounding intent is consistently 2 decimal places for money and percents in these paths. **Risk:** parallel helpers can drift.

---

## 4. Part B — Financial field inventory

Only fields that exist in schema/types today. Future-only needs are listed in §4.2.

### 4.1 Existing fields

| Entity | Field | Meaning | Unit | Cost/Sell | Req? | Client vs derived | Source of truth (today) | Validation (today) | Persistence | Historical snapshot? |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `organisation_settings` | `default_margin_percent` | Default gross margin | % | Basis for sell derive | Yes | Config | Org settings | DB check; app 0–95 | Yes | Informs new estimates; must not rewrite old quotes |
| `organisation_settings` | `default_markup_percent` | Optional default markup | % | Markup | Optional | Config | Org settings | DB ≥0 | Yes | Unclear app consumption — **owner decision** |
| `organisation_settings` | `default_contingency_percent` | Default contingency | % | — | Yes default 10 | Config | Org settings | DB 0–100 | Yes | Not clearly applied as automatic estimate line — **owner decision** |
| `organisation_settings` | `budget_rate_factor` / `premium_rate_factor` | Low/high range multipliers | factor | Both | Yes | Config | Org settings | DB bounds | Yes | Applied at estimate generation |
| `organisation_settings` | `default_gst_rate` | Default GST | % | Tax | Yes default 15 | Config | Org settings | 0–100 | Yes | Copied into pricing/quotes |
| `organisation_settings` | wastage percent fields | Material waste defaults | % | Qty modifier | Optional | Config | Org settings | App clamp 0–50 | Yes | Embedded in estimate qty/notes |
| `rates` | `cost_rate` | Company cost rate | $/unit | Cost | Optional | Config | Org rates | App validation | Yes | Provenance via item_key |
| `rates` | `sell_rate` | Company sell rate | $/unit | Sell | Optional | Config | Org rates | App | Yes | If null, sell derived from margin |
| `rates` | `markup_percent` | Rate-row markup | % | Markup | Optional | Config | Org rates | Setup UI | Yes | Usage vs margin unclear — **owner decision** |
| `estimates` | `recommended_cost` / `recommended_sell` | Estimate totals | $ | Both | Yes | Derived | Engine result at generate/margin | Upstream | Yes | Internal; not customer quote |
| `estimates` | `cost_low`/`cost_high`/`sell_low`/`sell_high` | Ranges | $ | Both | Yes | Derived | Range factors × recommended | Upstream | Yes | Display |
| `estimates` | `gross_profit` / `margin_percent` / `markup_percent` | Totals metrics | $ / % | Derived | Yes | Derived | finalize / margin override | Upstream | Yes | Internal |
| `estimates` | `target_margin_percent` | User override target | % | Margin | Optional | Client → server | Column | 0–95 | Yes | Correction evidence later |
| `estimates` | `confidence` | Heuristic score | score | N/A | Optional | Derived | `computeConfidence` | Clamped | Yes | Not money |
| `estimate_line_items` | `recommended_cost`/`recommended_sell` | Line amounts | $ | Both | Yes | Derived | Calculators | Upstream | Yes | Learning substrate |
| `estimate_line_items` | range + GP triad fields | Line metrics | $ / % | Derived | Yes | Derived | line-items / realism | Upstream | Yes | Yes |
| `estimate_line_items` | `category` | labour/materials/subcontractor/allowance/contingency | enum | — | Yes | Derived | Calculators | DB check | Yes | Yes |
| `estimate_line_items` | `notes` (JSON metadata) | qty, unit, rates, productivity, waste notes | mixed | Mixed | Optional | Derived/user | Metadata parser | Soft | Yes | Critical for pricing mode inference |
| `pricing_documents` | `subtotal_cost`/`subtotal_sell` | Doc totals excl GST | $ | Both | Yes | Derived (recalc) | `calculateDocumentTotals` | Upstream | Yes | Basis for quote |
| `pricing_documents` | GP triad | Doc metrics | $ / % | Derived | Yes | Derived | C-26 | Upstream | Yes | Yes |
| `pricing_documents` | `gst_rate`/`gst_amount`/`total_incl_gst` | Tax | % / $ | Tax on sell | Yes | Rate config + derived | Org default → doc; amount recalc | 0–100 GST | Yes | Yes |
| `pricing_items` | `quantity`/`unit` | Commercial qty | qty | — | Optional | Client/server | Item | Zod ≥0 | Yes | Yes |
| `pricing_items` | `unit_cost`/`unit_sell` | Unit rates | $/unit | Both | Optional | Client/server | Item | Zod ≥0 | Yes | Yes |
| `pricing_items` | `total_cost`/`total_sell` | Line totals | $ | Both | Yes | Derived/edited | C-25 + save path | Zod ≥0; modes | Yes | Yes |
| `pricing_items` | GP triad | Line metrics | $ / % | Derived | Yes | Derived | C-24 | Zod bounds on persist (2A) | Yes | Yes |
| `pricing_items` | `calculation_mode` | quantity_rate / productivity_labour / lump_sum | enum | — | Optional | Inferred/edited | Item | Zod enum | Yes | Yes |
| `pricing_items` | `productivity_rate`/`productivity_unit`/`calculated_quantity` | Labour productivity | hrs/unit, hours | Labour | Optional | Edited | Item | Zod | Yes | DNA productivity later |
| `pricing_items` | `visible_on_quote` / `optional` | Quote inclusion flags | bool | — | Yes/opt | Client | Item | Zod | Yes | Causes S1-010 |
| `quotes` | `subtotal`/`gst_*`/`total_incl_gst` | Customer totals | $ | Sell + tax | Yes | Derived | C-30 visible items | Zod/GST check | Yes | **Immutable snapshot** for revision |
| `quote_items` | `quantity`/`unit_price`/`total` | Client line | qty / $ | Sell | Yes | Copied/edited | from pricing / edits | Zod | Yes | Snapshot |
| `quote_items` | `visible` | Include in totals | bool | — | Yes | Client | Item | Zod | Yes | Affects C-30 |

### 4.2 Future-compatible fields (not present / not required for MVP engine)

Labelled for Company DNA / learning readiness — **do not invent in DB this stage:**

* calculation_engine_version / formula_version on results  
* structured explanation payload (inputs, rates, formula id, modifiers)  
* actual cost/sell / outcome linkage  
* scenario calibration identifiers  
* explicit overhead recovery line type beyond current contingency category  
* discount / credit line types (credits explicitly out of MVP)  
* provisional-sum distinct type (may overlap allowance today — owner decision)

---

## 5. Part C — End-to-end calculation flows

### C1. AI estimate generation

AI extracts brief/facts/work areas (**not** money). Deterministic `calculateEstimate` prices confirmed work areas. **Architecture:** AI Principles — AI non-authoritative for money.

**Transforms:** facts → calculator qty/rates → line cost/sell → finalize triad/ranges/confidence → persist.

### C2. Quick estimate

Same as C1 via `generateEstimate` / `runEstimateGeneration`. If `target_margin_percent` set, sells recomputed via `applyTargetMarginToLineItems` before persist.

### C3. Estimate editing

Primary money edit today: **target margin** (`updateEstimateMargin`) recomputes sells from costs. Line-item field editing of estimates is limited compared to final pricing. Breakdown modal may re-aggregate for display (C-36).

### C4. Pricing document creation

`createPricingFromEstimate`: copies estimate header money fields; builds pricing items from estimate lines via `buildPricingItemFieldsFromEstimateLineItem`; computes GST from org default using document totals helper (initially fed estimate totals); items then drive later recalcs.

### C5. Pricing-item editing

Client calls shared `calculatePricingItemEdit` for live fields; server `calculatePricingItemTotals` / `TotalsForSave` re-derives before persist; document totals recalculated (C-26/C-27).

### C6. Pricing-document total aggregation

`calculateDocumentTotals`: sum **all** item `total_cost`/`total_sell` → GP triad → GST on sell subtotal → incl GST.

### C7. Quote creation

`mapPricingItemsToQuoteItems` copies **visible_on_quote** items’ `total_sell` → quote `total`; `calculateQuoteTotals` sums **visible** quote items + GST. **No cost/GP on quote header.**

### C8. Quote revision

New quote row + items; prior superseded. Totals recomputed for new revision from then-current pricing/items path. Old revision rows retained (historical accuracy).

### C9. Quote-item editing

`calculateQuoteItemTotal` may trust provided `total` if present; else qty×unitPrice. Document totals recalculated with visibility filter.

### C10. Quote preview/export

Renders **stored** quote totals (print-to-PDF). No independent money engine in print path.

### C11. Save / refresh / reopen

Server-rendered reads of persisted rows. Correctness depends on what was stored at last authoritative write.

### C12. Calibration / scenario paths present today

* **Pricing recalibration** (`lib/pricing/recalibration.ts`): compares estimate vs pricing; preview/apply; uses same document totals helper.  
* **Estimate calibration metadata** (`estimate-calibration.ts`, `calibration-version.ts`, rate-source summaries): provenance/confidence — **not** full Quotr DNA scenario calibration.  
* **No** actual-versus-estimate learning loop.

**Repeated / transformed money:** estimate triad → pricing item fields → pricing doc aggregate → (filtered) quote lines → quote aggregate. GST introduced at pricing/quote layers. Visibility filter introduced at quote layer.

---

## 6. Part D — Duplicated logic map

### D.1 Mathematically equivalent (confirmed same meaning)

**Gross profit triad** (given cost C, sell S):

* `GP = round(S − C)`  
* `margin% = S>0 ? round(GP/S×100) : 0`  
* `markup% = C>0 ? round(GP/C×100) : 0`  

Found at: C-08, C-10, C-13, C-15, C-16, C-24, C-26, C-35, C-36 (unrounded margin%), C-42 (profit only).

**Sell from cost at gross margin m%:** `S = round(C / (1 − m/100))` — C-01 (+ callers).

**GST:** `gst = round(sellSubtotal × gstRate/100)`; `incl = round(sellSubtotal + gst)` — C-26 and C-30 (equivalent formula; different inputs).

**2-dp rounding:** `round2` / `roundMoney` equivalents.

### D.2 Similar but intentionally different

| Pair | Difference | Treat as |
| --- | --- | --- |
| Pricing doc aggregate vs quote aggregate | All items vs visible-only | **Product rule**, not accidental merge |
| Estimate ranges vs pricing GST totals | Ranges use budget/premium factors; pricing adds GST | Different document purposes |
| `calculateQuoteItemTotal` trusts `total` | vs pricing forward cross-check | Policy difference — owner decision |
| Lump-sum mode skips forward qty×rate match | vs quantity_rate/productivity | Intentional (2A secured validation) |
| Labour default 60/90 vs margin-derived sell | Hardcoded benchmark pair | Commercial decision |
| Calculator-local access factors vs `adjustments.ts` | Different multipliers | Similar intent, inconsistent scale |

### D.3 Inconsistent (confirmed or high-confidence)

| Issue | Evidence | Impact |
| --- | --- | --- |
| **S1-001** multiple GP implementations | Ten copies / variants | Drift hazard; violates one commercial truth |
| **S1-010** quote vs pricing subtotal sets | visible filter | Customer total may be lower than reviewed pricing |
| **S1-012** hardcoded cost/sell bypassing org margin | fitout/deck literals | Company margin setting does not apply |
| Access-factor near-duplicates | adjustments vs demolition vs stairs | Same constraint language → different labour $ |
| **`createPricingFromEstimate` GST overwrite** | **Corrected 2B.5:** insert and post-item recalc use the same organisation/document GST via `lib/pricing/gst-source.ts`. Historic defect: `recalculateAndPersistDocumentTotals` previously passed `DEFAULT_GST_RATE` (15) | Pre-2B.5 docs may still disagree; not bulk-rewritten |
| Estimate breakdown margin unrounded | C-36 `sumWorkAreaTotals` | Display-only drift vs 2-dp everywhere else |
| Confidence heuristic vs money | Not inconsistent formulas but must not be treated as priced confidence | Trust presentation |

### D.4 Uncertain (needs owner / runtime confirmation)

* Whether `default_markup_percent` / rate `markup_percent` are product-meaningful for MVP pricing or legacy UI.  
* Whether `default_contingency_percent` should auto-generate contingency lines.  
* Whether quote-item edits should always recompute from qty×unitPrice (ignore client total).  
* Whether productivity unit price on quotes (`total_sell/quantity`) is the intended customer presentation.  
* Whether estimate line `includedInTotal === false` paths are used in production data.  
* Exact remote historical rows with pre-20% default margins (accepted: no bulk rewrite).

**Rule for Stage 2B:** do not merge “intentionally different” paths until commercial meaning is confirmed in Batch 2B.2.

---

## 7. Part 2 — Commercial decisions requiring owner confirmation

| ID | Topic | Current behaviour | Inconsistency | Customer impact | Recommended MVP rule (proposal only) | Company DNA relevance | Blocks 2B implementation? |
| --- | --- | --- | --- | --- | --- | --- | --- |
| **CD-01** | Gross margin vs markup | Margin primary for sell-from-cost; markup stored as derived metric; separate validators 0–95 / 0–1000 | Setup still exposes markup fields; unclear if markup ever drives sell | Confusion if users edit markup expecting sell change | **Confirm:** margin drives sell-from-cost; markup is display/derived unless explicitly selected mode exists | DNA should learn which lever company uses | **Yes** for formula ownership |
| **CD-02** | Labour rates cost vs sell | Rates have both; sell nullable → derive from margin; labour fallback 60/90 without margin | Fallback ignores org margin | Orgs without labour rates get fixed 90 sell | Fallback should use margin on 60 **or** keep 60/90 as published benchmark — pick one | Company labour DNA | **Yes** for estimate parity tests |
| **CD-03** | Material rates cost vs sell | Same dual rates + derive | Benchmarks often supply both | Generally OK | Keep dual; prefer company sell if set else derive | Material DNA | No if documented |
| **CD-04** | Material markup | Rate markup field exists | May not affect calculateEstimate | False expectation | MVP: do not auto-apply rate markup to engine unless confirmed | Future | Soft block for rate UI semantics |
| **CD-05** | Subcontractor markup/margin | Subcontractor lines priced like other categories | No distinct subcontractor margin | Unknown if markup expected | Treat as normal cost/sell lines unless owner wants discrete uplift | Trade DNA | Soft |
| **CD-06** | Overhead recovery | Assumption text says overhead included in margin | No separate overhead engine | Opacity | MVP: overhead inside gross margin; no separate overhead calc | Later overhead DNA | No |
| **CD-07** | Contingency | Category + org default %; not clearly auto-applied | Settings vs engine gap | Contingency % may do nothing | Confirm: manual contingency lines only **or** auto % of sell | Scenario learning | Soft |
| **CD-08** | Waste | Applied in material buildups via settings | Not all materials/work areas | Qty under/over | Keep category wastage; engine accepts waste-adjusted qty | Productivity/waste DNA | No |
| **CD-09** | GST | Default 15%; applied on pricing/quote sell subtotals; estimates typically excl GST | Estimate vs quote tax presentation; **createPricing post-recalc hardcodes 15 (fixed 2B.5)** | Wrong tax totals when org GST ≠ 15 (pre-2B.5) | Estimates excl GST; pricing/quotes use **document/org gst_rate consistently** (never overwrite with hardcoded 15) | N/A | Soft for presentation; **overwrite bug corrected in 2B.5** |
| **CD-10** | Rounding | 2 dp money/percent throughout | Parallel helpers | Usually fine | Single round-half-up 2 dp for currency; define aggregation order | Replay | **Yes** for golden tests |
| **CD-11** | Minimum charges | Labour/allowance minimums in commercial-realism | Not universal | Small jobs | Keep existing minimum helpers; document as modifiers | Learning from minimums | No |
| **CD-12** | Zero-value items | Allowed intentional | Risk of silent zeros mitigated in 2A | Edge cases | Keep 2A rule | N/A | No |
| **CD-13** | Lump sums | Supported mode; totals authoritative; qty×rate cross-check skipped | ForwardTotalsMatch always true | Manual commercial control | Keep; engine mode `lump_sum` | Override learning | No |
| **CD-14** | Estimate ranges | budget/premium factors on cost & sell | Not GST-aware | Guidance only | Keep as estimate-only; not quote ranges | Scenario bands later | No |
| **CD-15** | Provisional sums | No distinct type | May use allowance | Naming | Treat allowances as provisional unless new type authorised | Later | No |
| **CD-16** | Allowances | Category + lump-sum inference for allowance/contingency types | OK | OK | Keep | DNA | No |
| **CD-17** | Discounts | Not supported | N/A | N/A | Out of MVP | Later | No |
| **CD-18** | Credits | Rejected in 2A | N/A | N/A | Out of MVP | Later dedicated type | No |
| **CD-19** | Tax-incl vs excl presentation | Quotes show subtotal + GST + incl; print checklist | Currency AUD/NZD notes in Stage 1 | Confusion | NZ GST exclusive lines + GST; confirm currency display | N/A | Soft |
| **CD-20** | Historic quote immutability | Revisions preserve old rows; company setting changes do not rewrite quotes | Recalibration is pricing-side | Trust | **Confirm as binding:** quotes immutable snapshots | Learning needs stable history | **Yes** (adoption constraint) |
| **CD-21** | Quote vs pricing visibility totals | Quote sums visible only; pricing sums all | **S1-010** | Client total ≠ reviewed total possible | Require warning or force visibility alignment before quote — **owner picks** | Explainability | Soft for 2B core; hard for “one truth” UX (Stage 6 may own UX) |
| **CD-22** | Client-trusted quote totals | `calculateQuoteItemTotal` prefers `total` | vs pricing recompute | Tamper/drift | Prefer recompute when qty+price present | N/A | Soft |
| **CD-23** | Constraints affecting price | Many constraints unused by engine (S1-020) | Capture without effect | Distrust | Document non-effect; wire later Stage 3/2B residual | Constraint impact learning | Soft for 2B.1 |
| **CD-24** | DB vs app margin ceiling | DB `organisation_settings.default_margin_percent` check ≤100; estimating assert ≤95 | Settings could theoretically store 96–100 that estimating rejects | Confusing save vs estimate | Align product ceiling to **95** everywhere (DB check optional later migration — not required to start 2B.3) | N/A | Soft |

**Silent decisions forbidden:** unresolved rows above must be decided in Batch 2B.2 before formula consolidation that changes user-visible numbers.

---

## 7.1 Cross-check addendum (Batch 2B.1 follow-up)

Independent repository exploration ([Audit pricing calculations](f7c96631-7e40-4ee7-8331-687cba69bb4e)) re-confirmed the inventory above and surfaced the **org GST vs `DEFAULT_GST_RATE` overwrite** on `createPricingFromEstimate`, plus display-only sites C-41/C-42 and unrounded breakdown margins. Those findings are merged into this audit; **no application code was changed** in this follow-up.

---

## 8. Risks and non-goals for remaining Stage 2B

### In scope for later 2B batches (after decisions)

* Consolidate GP triad + sell-from-cost + document/quote aggregates into one engine  
* Shadow parity then adopt pricing → estimate → quote → remove client authority  
* Preserve lump-sum and Stage 2A validation bounds  

### Out of scope for Stage 2B

* Company DNA / scenario ML / actuals learning implementation  
* UI redesign, upload features, package redesign  
* Fixing S1-010 UX unless owner folds a minimal cross-check into 2B acceptance  
* Rewriting all work-area calculators’ domain logic (beyond routing money through engine)  
* Changing AI prompts  

---

## 9. Evidence cross-reference

| Prior ID | Stage 2B relevance |
| --- | --- |
| S1-001 | Core duplication — owned by 2B |
| S1-012 | Hardcoded rates — address in estimate adoption / residual |
| S1-010 | Visibility divergence — commercial decision CD-21; likely Stage 6 UX with optional 2B invariant |
| S1-020 | Constraints unused — not formula merge |
| Stage 2A | Auth/validation retained outside engine (Architecture + Spec §14) |

---

## Document control

| Field | Value |
| --- | --- |
| Path | `docs/audits/STAGE_2B_PRICING_ENGINE_AUDIT.md` |
| Created | 2026-08-04 |
| Batch | 2B.1 (+ 2B.4 LEG-* remapping note) |
| Application / migration / UI / prompt changes | **None** |
| Companion spec | `docs/specifications/AUTHORITATIVE_PRICING_ENGINE_SPEC.md` |
| Companion plan | `docs/plans/STAGE_2B_IMPLEMENTATION_PLAN.md` |
| Legacy ID registry (2B.4) | `lib/commercial-engine/parity/registry.ts` |
| Compatibility matrix (2B.4) | `docs/specifications/LEGACY_COMMERCIAL_COMPATIBILITY_MATRIX.md` |
