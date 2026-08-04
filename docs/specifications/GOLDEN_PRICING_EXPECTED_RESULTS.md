# Golden Pricing Expected Results

**Status:** Canonical expected outcomes for Batch 2B.2B  
**Authority:** `CANONICAL_COMMERCIAL_SCENARIOS.md` + recommended MVP commercial model  
**Rounding:** `round2(x)` commits money and % to 2 decimal places  
**Aggregation:** Round lines → sum → GST on sell subtotal → incl  

Every future Authoritative Pricing Engine version **must** reproduce these outcomes unless an owner commercial rule intentionally changes.

---

## Global formulas

| ID | Formula |
| --- | --- |
| F-QTY | `cost = round2(qty × unit_cost)`; `sell = round2(qty × unit_sell)` |
| F-PROD | `hours = round2(qty × productivity)`; `cost = round2(hours × unit_cost)`; `sell = round2(hours × unit_sell)` |
| F-SFM | `unit_sell = round2(unit_cost ÷ (1 − m/100))` (or total sell from total cost) |
| F-GP | `GP = round2(sell − cost)` |
| F-M | `margin% = sell>0 ? round2(GP/sell×100) : 0` |
| F-MU | `markup% = cost>0 ? round2(GP/cost×100) : 0` |
| F-GST | `gst = round2(sellSubtotal × gstRate/100)`; `incl = round2(sellSubtotal + gst)` |
| F-RANGE | `low = round2(x × 0.90)`; `high = round2(x × 1.15)` |
| F-WASTE | `qty = round2(net × (1 + waste%/100))` then F-QTY |

---

## Results by scenario

### CCS-001 Decking boards

| Item | Value | Formula |
| --- | --- | --- |
| qty | 55 lm | given |
| unit_cost | 42.00 | given |
| unit_sell | 52.50 | F-SFM m=20: 42/0.8 |
| **Expected Cost** | **2310.00** | F-QTY |
| **Expected Sell** | **2887.50** | F-QTY |
| **Expected GP** | **577.50** | F-GP |
| **Expected Margin** | **20.00%** | F-M |
| **Expected Markup** | **25.00%** | F-MU |
| WA / Project (ex GST) | cost 2310 / sell 2887.50 | single line |
| **GST (15%)** | **433.13** | F-GST |
| **Final incl GST** | **3320.63** | F-GST |
| Quote totals | same if visible | |
| Rounding | line-first 2 dp | |
| Validation | none | |
| Warnings | none | |
| Manual override | none | |
| Persistence | store line + doc totals | |
| Snapshot | N/A (pre-quote) | |

### CCS-002 Deck labour productivity

| Item | Value | Formula |
| --- | --- | --- |
| hours | 48.00 | 40 × 1.2 |
| unit_cost | 65.00 | |
| unit_sell | 81.25 | 65/0.8 |
| **Cost** | **3120.00** | 48×65 |
| **Sell** | **3900.00** | 48×81.25 |
| **GP** | **780.00** | |
| **Margin** | **20.00%** | |
| **Markup** | **25.00%** | |
| GST | 585.00 | |
| Incl | 4485.00 | |
| Warnings | none | |
| Persistence | store productivity fields + totals | |

### CCS-003 Decking waste 10%

| Item | Value | Formula |
| --- | --- | --- |
| qty | 110.00 | 100 × 1.10 |
| unit_cost / sell | 8.00 / 10.00 | 8/0.8 |
| **Cost** | **880.00** | 110×8 |
| **Sell** | **1100.00** | 110×10 |
| **GP** | **220.00** | |
| **Margin** | **20.00%** | |
| GST | 165.00 | |
| Incl | 1265.00 | |
| Warnings | wastage 10% applied | |

### CCS-004 Bathroom labour + materials

| Line | Cost | Sell | Formula |
| --- | --- | --- | --- |
| Labour hours 24 | 1680.00 | 2100.00 | 12×2.0 hrs; 70→87.50 |
| Materials 12 m² | 660.00 | 825.00 | 55→68.75 |
| **Project Cost** | **2340.00** | | sum |
| **Project Sell** | **2925.00** | | sum |
| **GP** | **585.00** | | |
| **Margin** | **20.00%** | | |
| GST | 438.75 | | |
| Incl | 3363.75 | | |
| WA totals | same | bathroom | |

### CCS-005 Kitchen + subbie

| Line | Cost | Sell |
| --- | --- | --- |
| Labour lump | 6400.00 | 8000.00 |
| Materials | 5000.00 | 6250.00 |
| Electrical sub | 4200.00 | 5250.00 |
| **Project Cost** | **15600.00** | |
| **Project Sell** | **19500.00** | |
| **GP** | **3900.00** | |
| **Margin** | **20.00%** | |
| GST | 2925.00 | |
| Incl | 22425.00 | |

### CCS-006 Soft-strip lump

| Item | Value |
| --- | --- |
| Cost / Sell | 2800.00 / 3500.00 |
| GP / Margin / Markup | 700.00 / 20.00% / 25.00% |
| GST / Incl | 525.00 / 4025.00 |

### CCS-007 Tile allowance

| Item | Value |
| --- | --- |
| Cost / Sell | 960.00 / 1200.00 |
| GP / Margin | 240.00 / 20.00% |
| GST / Incl | 180.00 / 1380.00 |
| Warnings | allowance may vary |

### CCS-008 Electrical provisional

| Item | Value |
| --- | --- |
| Cost / Sell | 3200.00 / 4000.00 |
| GP / Margin | 800.00 / 20.00% |
| GST / Incl | 600.00 / 4600.00 |
| Warnings | provisional |

### CCS-009 No charge

| Item | Value |
| --- | --- |
| Cost / Sell / GP / GST / Incl | 0 / 0 / 0 / 0 / 0 |
| Margin | 0 |
| Warnings | included at no charge |
| Persistence | allowed zero intentional |

### CCS-010 Informational

| Item | Value |
| --- | --- |
| Money impact | none |
| Quote | not visible |
| Persistence | optional zero line or note-only |

### CCS-011 Travel

| Item | Value |
| --- | --- |
| Cost / Sell | 480.00 / 600.00 |
| GP / Margin | 120.00 / 20.00% |
| GST / Incl | 90.00 / 690.00 |

### CCS-012 Airport

| Item | Value |
| --- | --- |
| Cost / Sell | 1600.00 / 2000.00 |
| GP / Margin | 400.00 / 20.00% |
| GST / Incl | 300.00 / 2300.00 |

### CCS-013 Occupied bathroom

| Line | Cost | Sell |
| --- | --- | --- |
| Labour 28.8 hrs ×70/87.50 | 2016.00 | 2520.00 |
| Materials | 1100.00 | 1375.00 |
| **Project Cost / Sell** | **3116.00 / 3895.00** | |
| GP / Margin | 779.00 / 20.00% | |
| GST / Incl | 584.25 / 4479.25 | |
| Warnings | occupied productivity adjusted |

### CCS-014 Poor access deck labour

| Item | Value | Formula |
| --- | --- | --- |
| Hours | 52.80 | 48 × 1.10 |
| Cost / Sell | 3432.00 / 4290.00 | ×65 / ×81.25 |
| GP / Margin | 858.00 / 20.00% | |
| GST / Incl | 643.50 / 4933.50 | |
| Warnings | poor access |

### CCS-015 Restricted hours allowance

| Item | Value |
| --- | --- |
| Cost / Sell | 900.00 / 1125.00 |
| GP / Margin | 225.00 / 20.00% |
| GST / Incl | 168.75 / 1293.75 |

### CCS-016 Long carry

| Item | Value |
| --- | --- |
| Cost / Sell | 640.00 / 800.00 |
| GP / Margin | 160.00 / 20.00% |
| GST / Incl | 120.00 / 920.00 |

### CCS-017 Steep retaining (illustrative package)

| Line | Cost | Sell |
| --- | --- | --- |
| Labour (adjusted) | 4800.00 | 6000.00 |
| Materials | 3600.00 | 4500.00 |
| Excavator sub | 2400.00 | 3000.00 |
| **Project** | **10800.00 / 13500.00** | |
| GP / Margin | 2700.00 / 20.00% | |
| GST / Incl | 2025.00 / 15525.00 | |
| Warnings | steep site |

### CCS-018 Multi work area outdoor

| WA | Cost | Sell |
| --- | --- | --- |
| Deck | 9600.00 | 12000.00 |
| Fence | 3200.00 | 4000.00 |
| Pergola | 5600.00 | 7000.00 |
| **Project** | **18400.00 / 23000.00** | |
| GP / Margin | 4600.00 / 20.00% | |
| GST / Incl | 3450.00 / 26450.00 | |
| Quote | same if all visible | |

### CCS-019 Quote revision remove pergola

| Version | Sell excl | GST | Incl | Snapshot |
| --- | --- | --- | --- | --- |
| v1 (immutable) | 23000.00 | 3450.00 | 26450.00 | preserved |
| v2 | 16000.00 | 2400.00 | 18400.00 | new revision |
| Behaviour | v1 unchanged after v2 created | | | |

### CCS-020 Historical after rate rise

| Item | Value |
| --- | --- |
| Accepted quote sell | 18000.00 |
| After company rate rise | **still 18000.00** |
| GST/Incl historical | unchanged |
| Persistence | no rewrite |
| Snapshot | immutable |

### CCS-021 GST 15% on 10000

| Item | Value | Formula |
| --- | --- | --- |
| Sell subtotal | 10000.00 | |
| GST | 1500.00 | ×0.15 |
| Incl | 11500.00 | |

### CCS-022 Document GST authoritative

| Item | Value |
| --- | --- |
| Document gst_rate | 15 |
| Sell | 8000.00 |
| GST | 1200.00 |
| Incl | 9200.00 |
| Rule | Must use document.gst_rate (not hardcoded constant in adoption code) |
| Regression | Protects OCD-GST / C-28 fix in 2B.6 |

### CCS-023 Target margin 25% on cost 20000

| Item | Value | Formula |
| --- | --- | --- |
| Cost | 20000.00 | |
| Sell | 26666.67 | round2(20000/0.75) |
| GP | 6666.67 | |
| Margin | 25.00% | |
| Override | target_margin=25 retained | |

### CCS-024 Mixed margins

| Line | Cost | Sell | Margin |
| --- | --- | --- | --- |
| Labour | 4000.00 | 5000.00 | 20.00% |
| Glass | 3000.00 | 3300.00 | 9.09% |
| **Doc** | **7000.00 / 8300.00** | | **15.66%** blended |
| GST / Incl | 1245.00 / 9545.00 | | |
| Override | glass sell manual | |

### CCS-025 Estimate ranges

| Item | Value | Formula |
| --- | --- | --- |
| Cost recommended | 40000.00 | |
| Sell recommended | 50000.00 | |
| Cost low/high | 36000.00 / 46000.00 | ×0.9 / ×1.15 |
| Sell low/high | 45000.00 / 57500.00 | ×0.9 / ×1.15 |
| Confidence | separate heuristic — not invented by money engine | |
| Quote | uses final only — no range on client quote | |

### CCS-026 Builder hours correction

| Item | Value |
| --- | --- |
| Hours | 56.00 |
| Cost / Sell | 3640.00 / 4550.00 |
| GP / Margin | 910.00 / 20.00% |
| GST / Incl | 682.50 / 5232.50 |
| Override | hours manual; AI must not revert |
| Persistence | store override metadata hooks |

### CCS-027 Fence labour-only

| Item | Value |
| --- | --- |
| Hours | 24.00 |
| Cost / Sell | 1440.00 / 1800.00 |
| GP / Margin | 360.00 / 20.00% |
| GST / Incl | 270.00 / 2070.00 |

### CCS-028 Material-only sheets

| Item | Value |
| --- | --- |
| Cost / Sell | 616.00 / 770.00 |
| GP / Margin | 154.00 / 20.00% |
| GST / Incl | 115.50 / 885.50 |

### CCS-029 Sub-only plumbing

| Item | Value |
| --- | --- |
| Cost / Sell | 6000.00 / 7500.00 |
| GP / Margin | 1500.00 / 20.00% |
| GST / Incl | 1125.00 / 8625.00 |

### CCS-030 GIB + paint

| Line | Cost | Sell |
| --- | --- | --- |
| Stopping | 1440.00 | 1800.00 |
| Paint | 960.00 | 1200.00 |
| **Project** | **2400.00 / 3000.00** | |
| GST / Incl | 450.00 / 3450.00 | |

### CCS-031 Timber framing

| Item | Value |
| --- | --- |
| Cost / Sell | 4275.00 / 5343.75 |
| GP / Margin | 1068.75 / 20.00% |
| GST / Incl | 801.56 / 6145.31 |

### CCS-032 Steel portal

| Line | Cost | Sell |
| --- | --- | --- |
| Sub | 12000.00 | 15000.00 |
| Labour | 3200.00 | 4000.00 |
| **Project** | **15200.00 / 19000.00** | |
| GST / Incl | 2850.00 / 21850.00 | |

### CCS-033 Concrete pad

| Item | Value |
| --- | --- |
| Cost / Sell | 2200.00 / 2750.00 |
| GP / Margin | 550.00 / 20.00% |
| GST / Incl | 412.50 / 3162.50 |

### CCS-034 Window install

| Item | Value |
| --- | --- |
| Hours | 21.00 |
| Cost / Sell | 1470.00 / 1837.50 |
| GP / Margin | 367.50 / 20.00% |
| GST / Incl | 275.63 / 2113.13 |

### CCS-035 Exterior cladding

| Line | Cost | Sell | Formula |
| --- | --- | --- | --- |
| Labour hrs 66 | 4290.00 | 5362.50 | 60×1.1×65/81.25 |
| Materials | 5100.00 | 6375.00 | 60×85/106.25 |
| **Project** | **9390.00 / 11737.50** | | |
| GP / Margin | 2347.50 / 20.00% | | |
| GST / Incl | 1760.63 / 13498.13 | | |

### CCS-036 Roofing waste + labour

| Line | Cost | Sell |
| --- | --- | --- |
| Materials 102.6 ×55/68.75 | 5643.00 | 7053.75 |
| Labour lump | 4800.00 | 6000.00 |
| **Project** | **10443.00 / 13053.75** | |
| GP / Margin | 2610.75 / 20.00% | |
| GST / Incl | 1958.06 / 15011.81 | |

### CCS-037 Vinyl flooring waste

| Item | Value |
| --- | --- |
| qty | 38.50 |
| Cost / Sell | 1540.00 / 1925.00 |
| GP / Margin | 385.00 / 20.00% |
| GST / Incl | 288.75 / 2213.75 |

### CCS-038 Commercial fitout package

| Item | Value |
| --- | --- |
| Cost / Sell | 68800.00 / 86000.00 |
| GP / Margin | 17200.00 / 20.00% |
| GST / Incl | 12900.00 / 98900.00 |
| WA | four areas sum to project (detail expandable in fixtures later) |

### CCS-039 Site establishment

| Item | Value |
| --- | --- |
| Cost / Sell | 1500.00 / 1875.00 |
| GP / Margin | 375.00 / 20.00% |
| GST / Incl | 281.25 / 2156.25 |

### CCS-040 Variation pergola

| Item | Value |
| --- | --- |
| Cost / Sell | 4800.00 / 6000.00 |
| GP / Margin | 1200.00 / 20.00% |
| GST / Incl | 900.00 / 6900.00 |
| Warnings | variation |

### CCS-041 Zero qty lump

| Item | Value |
| --- | --- |
| qty | 0 |
| Cost / Sell | 400.00 / 500.00 |
| Valid | yes (lump_sum only) |
| GST / Incl | 75.00 / 575.00 |

### CCS-042 Sell-only lump

| Item | Value |
| --- | --- |
| Cost / Sell | 0 / 5000.00 |
| GP / Margin / Markup | **null** (cost unknown — do not fabricate) |
| Warnings | **cost unknown** |
| GST / Incl | 750.00 / 5750.00 |
| Rule | OCD-30 / Batch 2B.3B — sell-only must not invent cost or margin |

### CCS-043 Negative credit

| Item | Value |
| --- | --- |
| Result | **validation error** — do not persist |
| Message | Negatives / credits not supported |

### CCS-044 Margin 96%

| Item | Value |
| --- | --- |
| Result | **validation error** |
| Message | Gross margin must be at most 95% |

### CCS-045 Visibility mismatch

| Document | Sell excl | GST | Incl |
| --- | --- | --- | --- |
| Pricing (all) | 22000.00 | 3300.00 | 25300.00 |
| Quote (visible) | 20000.00 | 3000.00 | 23000.00 |
| Warning (desired) | visibility mismatch between pricing and quote | | |

### CCS-046 Recalibration preserve manual

| Item | Behaviour |
| --- | --- |
| Manual glass sell | remains 3300.00 |
| Other lines | may refresh from estimate |
| Document GST | recalc from document rate |
| Persistence | manually_edited flag preserved |
| Snapshot | prior quotes untouched |

### CCS-047 Scaffold

| Item | Value |
| --- | --- |
| Cost / Sell | 2200.00 / 2750.00 |
| GP / Margin | 550.00 / 20.00% |
| GST / Incl | 412.50 / 3162.50 |

### CCS-048 Contingency

| Item | Value |
| --- | --- |
| Cost / Sell | 1600.00 / 2000.00 |
| GP / Margin | 400.00 / 20.00% |
| GST / Incl | 300.00 / 2300.00 |

### CCS-049 Extension package

| WA | Cost | Sell |
| --- | --- | --- |
| Framing | 9500.00 | 11875.00 |
| GIB | 3200.00 | 4000.00 |
| Paint | 2400.00 | 3000.00 |
| **Project** | **15100.00 / 18875.00** | |
| GST / Incl | 2831.25 / 21706.25 | |

### CCS-050 Weekend allowance

| Item | Value |
| --- | --- |
| Cost / Sell | 1200.00 / 1500.00 |
| GP / Margin | 300.00 / 20.00% |
| GST / Incl | 225.00 / 1725.00 |

### CCS-051 Minimum labour floor

| Item | Value | Formula |
| --- | --- | --- |
| Calculated hours | 10 | discarded by floor |
| Final hours | 16 | minimum |
| Cost / Sell | 1120.00 / 1400.00 | 16×70/87.50 |
| Warnings | labour minimum applied | |

### CCS-052 DNA fencing uplift

| Item | Value | Formula |
| --- | --- | --- |
| Cost | 3200.00 | |
| Derived sell @20% | 4000.00 | 3200/0.8 |
| Builder sell | 4320.00 | manual |
| GP / Margin | 1120.00 / 25.93% | |
| GST / Incl | 648.00 / 4968.00 | |
| Learning | evidence only — no auto rate write | |

---

## Document control

| Field | Value |
| --- | --- |
| Path | `docs/specifications/GOLDEN_PRICING_EXPECTED_RESULTS.md` |
| Scenarios covered | 52 |
| Application code | **Unchanged** |
