# Stage 2B — Owner Commercial Decision Register

**Batch:** 2B.2A — Owner Commercial Decision Register  
**Status:** Confirmed for Batch 2B.3 blocking decisions (owner-approved 2026-08-04); deferred items marked Deferred  
**Date:** 2026-08-04  
**Audience:** Quotr product owner / construction business owner  
**Purpose:** Confirm commercial rules before golden pricing test cases and the authoritative pricing engine are built  

**Owner approval note (Batch 2B.3B — 2026-08-04):** The product owner has approved the recommended MVP commercial model recorded in this register. Blocking decisions required for Batch 2B.3 are **Confirmed**. Intentionally deferred items are **Deferred**. Substance of recommendations is unchanged.

**Related docs:** Architecture Foundation · Pricing Engine Audit · Authoritative Pricing Engine Spec · Stage 2B Implementation Plan · MVP Hardening Guide  

---

## How to use this register

For each decision:

1. Read the **practical construction example**.  
2. Check the **recommended MVP rule**.  
3. Fill **Owner decision** with your choice (or “agree with recommendation”).  
4. Set **Status** to Confirmed or Deferred.  

Do not leave a **Must decide before Batch 2B.3** item as Pending if you want engine work to start.

---

## Blocking summary

### Must decide before Batch 2B.3

These lock the pure line-item calculation engine and golden tests:

| ID | Topic |
| --- | --- |
| **OCD-01** | Labour rates: cost, sell, or both |
| **OCD-02** | Productivity labour: hours × cost → sell via margin vs charge-out rate |
| **OCD-05** | Material rates: cost, sell, or both |
| **OCD-06** | When waste is applied (quantity before money) |
| **OCD-08** | Materials: markup vs gross margin (or margin only) |
| **OCD-12** | Gross margin is Quotr’s primary commercial measure |
| **OCD-13** | Sell = Cost ÷ (1 − Gross Margin) |
| **OCD-14** | Margin bounds 0%–95% |
| **OCD-15** | Markup separate; only where explicitly configured |
| **OCD-16** | Line-level vs document/company margin |
| **OCD-17** | Manual margin override behaviour |
| **OCD-27**–**OCD-30** | Lump-sum cost/sell rules |
| **OCD-32**, **OCD-35** | Zero values and lump-sum quantity rules |
| **OCD-40**–**OCD-43** | Rounding and aggregation order |
| **OCD-52**, **OCD-54** | Credits out; discounts excluded from Stage 2B |

### Can be deferred until later Stage 2B batches

| ID | Topic | Earliest batch |
| --- | --- | --- |
| **OCD-09**–**OCD-11** | Subcontractor uplift / provisional ranges | 2B.7 / 2B.8 |
| **OCD-22**–**OCD-26** | GST presentation + **GST bug fix** | **2B.6** (bug fix authorised there; commercial confirm now preferred) |
| **OCD-31** | Lump-sum override visibility | 2B.9 |
| **OCD-33**–**OCD-34** | Allowance / provisional naming | 2B.7–2B.8 |
| **OCD-36**–**OCD-39** | Estimate range meaning vs quotes | 2B.7 / Stage 6 |
| **OCD-44** | Quote presentation rounding (whole dollars etc.) | 2B.8–2B.9 |
| **OCD-45**–**OCD-47** | Snapshot / revision rules | Before 2B.8 |
| **OCD-48**–**OCD-51** | Override metadata depth | 2B.9 / later DNA prep |
| **OCD-GST** | Document GST rate vs hardcoded 15% bug | **2B.6** (no code in 2B.2A) |

### Can be deferred until after beta

| ID | Topic |
| --- | --- |
| **OCD-03** | Mixed crew rate models (beyond simple labour keys) |
| **OCD-04** | Overtime / nightshift / weekend rate systems |
| **OCD-07** | Delivery & handling configurability |
| **OCD-18**–**OCD-21** | Separate overhead recovery engine; auto contingency % |
| **OCD-53** | Discount arithmetic before beta |
| **OCD-55**–**OCD-56** | Broad minimum-charge / commercial-loading product (beyond today’s limited helpers) |

---

## Important audit item — GST inconsistency (C-28 / CD-09)

| Field | Detail |
| --- | --- |
| **Decision ID** | **OCD-GST** (also audit **C-28 / CD-09**) |
| **Topic** | Pricing document GST rate vs hardcoded 15% on create |
| **Current Quotr behaviour** | When Final Pricing is created from an estimate, Quotr saves the company’s GST rate on the pricing document. After line items are inserted, a recalculation currently uses a hardcoded default of **15%** instead of that saved rate. |
| **Inconsistency or risk** | If your company GST is not 15%, GST amount and total including GST can be wrong even though the document still shows the correct GST % label. |
| **Practical construction example** | Company GST set to 15% → no visible problem today. If GST were ever 0% (or another rate), the document might show “0% GST” but still add 15% tax in the dollar totals. |
| **Recommended MVP rule** | All pricing calculations must use the **pricing document’s validated GST rate**, first copied from company settings. Never recalculate with a hardcoded 15% when the document already has a rate. |
| **Alternative options** | Always force NZ 15% and ignore company setting (not recommended). |
| **Customer impact** | Wrong tax on Final Pricing (and quotes derived from it) when org GST ≠ 15. |
| **Future Company DNA impact** | Tax must stay a clear, inspectable company setting — not a hidden constant. |
| **Blocks engine implementation?** | Does **not** block Batch 2B.3 line engine. **Must be fixed in Batch 2B.6.** |
 with recommended MVP rule (owner-approved 2026-08-04). Application bug fix remains Batch 2B.6. |
| **Status** | Confirmed |

**Batch 2B.2A authorisation:** No application code change in this task. Fix scheduled for **Batch 2B.6**.

---

## Recommended MVP commercial model (summary)

Until you confirm otherwise, Quotr should keep working as a **cost + sell, gross-margin business**:

1. Store **both** internal **cost** and customer **sell** where known.  
2. When sell is missing, derive it with: **Sell = Cost ÷ (1 − Gross Margin)**.  
3. **Gross margin** is the main company lever (default **20%**, allowed **0%–95%**).  
4. **Markup** may be shown as a derived figure; it does not drive sell unless you later configure that explicitly.  
5. **Waste** adjusts **quantity** before money.  
6. **GST** is **NZ 15%** by default, calculated **once** on GST-exclusive document totals.  
7. **Lump sums** stay fully supported (cost and sell where known).  
8. **Credits and discounts** stay out of Stage 2B.  
9. **Accepted/sent quotes** never change when company rates or margin change later.  
10. **You** remain the final decision-maker; AI never silently overwrites your numbers.

---

# Decision register

Legend for **Status:** Pending · Confirmed · Deferred  

---

## A. Labour

### OCD-01 — What company labour rates mean

| Field | Content |
| --- | --- |
| **Topic** | Are labour rates internal cost, charge-out, or both? |
| **Current Quotr behaviour** | Quotr already stores **both** cost and sell on labour rates. If sell is blank, sell is derived from cost using company gross margin. Built-in fallback when no company labour rate exists: about **$60/hr cost** and **$90/hr sell** (not re-derived from your margin). |
| **Inconsistency or risk** | Fallback sell ignores your company margin setting. |
| **Practical construction example** | You set carpenter cost at $65/hr and leave sell blank with 20% margin → Quotr should charge about $81.25/hr. With no rate set, today’s fallback still uses $90 sell. |
| **Recommended MVP rule** | Keep **both** cost and sell. Prefer company sell if set; otherwise derive sell from cost × gross margin. Decide separately (OCD-02) whether fallback should also use margin. |
| **Alternative options** | Cost-only + always derive sell; sell-only (lose true cost/profit). |
| **Customer impact** | Clearer profit; fewer “why didn’t my margin apply?” surprises. |
| **Future Company DNA impact** | Learning needs real cost vs charge-out history. |
| **Blocks Batch 2B.3?** | **Yes** |
| **Owner decision** | Agree with recommended MVP rule (owner-approved 2026-08-04)
| **Status** | Confirmed |

### OCD-02 — Productivity labour cost and sell

| Field | Content |
| --- | --- |
| **Topic** | Hours × cost rate, then margin? Or direct charge-out? |
| **Current Quotr behaviour** | Productivity uses hours (quantity × hours-per-unit). Cost ≈ hours × cost rate; sell ≈ hours × sell rate (or derived sell). |
| **Inconsistency or risk** | Ambiguity if users think “margin” is applied again on top of an already marked-up charge-out. |
| **Practical construction example** | 40 m² deck × 1.2 hrs/m² = 48 hrs. Cost $65/hr → $3,120. At 20% margin → sell ≈ $3,900 if sell was derived from cost. |
| **Recommended MVP rule** | **Labour cost = hours × internal cost rate.** Sell = hours × sell rate if set; else **derive sell from cost using gross margin.** Do not apply margin twice. |
| **Alternative options** | Always use charge-out only (weaker profit tracking). |
| **Customer impact** | Matches how most builders think about labour. |
| **Future Company DNA impact** | Productivity and margin become learnable separately. |
| **Blocks Batch 2B.3?** | **Yes** |
| **Owner decision** | Agree with recommended MVP rule (owner-approved 2026-08-04)
| **Status** | Confirmed |

### OCD-03 — Mixed crews

| Field | Content |
| --- | --- |
| **Topic** | Carpenter, apprentice, supervisor, labourer |
| **Current Quotr behaviour** | Simple labour keys exist (e.g. carpenter / labourer / apprentice). No full crew-composition modeller. |
| **Inconsistency or risk** | Complex crews may be oversimplified. |
| **Practical construction example** | 1 carpenter + 1 labourer for a day is often priced as blended hours or separate lines — Quotr does not yet build that automatically. |
| **Recommended MVP rule** | **Defer** rich crew modelling. Keep separate labour rate keys; builder adjusts hours/lines manually for now. |
| **Alternative options** | Build crew templates before beta (higher complexity). |
| **Customer impact** | Slightly more manual editing on mixed crews. |
| **Future Company DNA impact** | Strong DNA candidate later. |
| **Blocks Batch 2B.3?** | No — **after beta** |
| **Owner decision** | Agree with recommended MVP rule (owner-approved 2026-08-04)
| **Status** | Deferred |

### OCD-04 — Overtime, nightshift, weekend

| Field | Content |
| --- | --- |
| **Topic** | Multipliers, separate rates, or manual allowances |
| **Current Quotr behaviour** | No dedicated OT/night/weekend engine. Builders use allowances or edited rates. |
| **Inconsistency or risk** | Site loadings may be forgotten. |
| **Practical construction example** | Saturday work often charged at time-and-a-half — today that is a manual adjustment. |
| **Recommended MVP rule** | **Defer** specialised OT engine. Use **manual allowances** or edited rates until after beta. |
| **Alternative options** | Multipliers; separate rate cards. |
| **Customer impact** | Manual for uncommon cases. |
| **Future Company DNA impact** | High — company-specific loadings later. |
| **Blocks Batch 2B.3?** | No — **after beta** |
| **Owner decision** | Agree with recommended MVP rule (owner-approved 2026-08-04)
| **Status** | Deferred |

---

## B. Materials

### OCD-05 — What material rates mean

| Field | Content |
| --- | --- |
| **Topic** | Supplier cost, customer sell, or both |
| **Current Quotr behaviour** | Both cost and sell can be stored. Missing sell can be derived from margin. |
| **Inconsistency or risk** | Some users may enter sell-only and lose true cost. |
| **Practical construction example** | Kwila $45/lm cost; with 20% margin → about $56.25/lm sell if sell blank. |
| **Recommended MVP rule** | Store **both**. Prefer company sell if set; else derive from cost + gross margin. |
| **Alternative options** | Cost-only; sell-only. |
| **Customer impact** | Accurate material GP. |
| **Future Company DNA impact** | Supplier vs sell provenance. |
| **Blocks Batch 2B.3?** | **Yes** |
| **Owner decision** | Agree with recommended MVP rule (owner-approved 2026-08-04)
| **Status** | Confirmed |

### OCD-06 — When waste is applied

| Field | Content |
| --- | --- |
| **Topic** | Waste before margin, after markup, or quantity only |
| **Current Quotr behaviour** | Waste increases **quantity** in material build-ups (e.g. +10% lm), then quantity × rate. |
| **Inconsistency or risk** | Thinking waste is a second money markup causes double counting. |
| **Practical construction example** | 100 lm decking + 10% waste = 110 lm × rate — margin applies to the money, not as a second waste %. |
| **Recommended MVP rule** | Waste adjusts **quantity only**, **before** cost/sell money. Do not apply waste as a separate margin/markup. |
| **Alternative options** | Money uplift after rates (not current behaviour). |
| **Customer impact** | Matches site ordering practice. |
| **Future Company DNA impact** | Company wastage profiles. |
| **Blocks Batch 2B.3?** | **Yes** (calculation sequence) |
| **Owner decision** | Agree with recommended MVP rule (owner-approved 2026-08-04)
| **Status** | Confirmed |

### OCD-07 — Delivery and handling

| Field | Content |
| --- | --- |
| **Topic** | Separate lines, included in rates, or configurable |
| **Current Quotr behaviour** | Often handled as allowances or included in benchmarks; not a dedicated settings product. |
| **Inconsistency or risk** | Delivery may be missed on some jobs. |
| **Practical construction example** | Crane truck or yard delivery as a $800 allowance line. |
| **Recommended MVP rule** | **Defer** special delivery engine. Prefer **separate allowance lines** when needed. |
| **Alternative options** | Bake into material rates; company toggle later. |
| **Customer impact** | Explicit lines stay clear on quotes. |
| **Future Company DNA impact** | Configurable later. |
| **Blocks Batch 2B.3?** | No — **after beta** |
| **Owner decision** | Agree with recommended MVP rule (owner-approved 2026-08-04)
| **Status** | Deferred |

### OCD-08 — Material markup vs gross margin

| Field | Content |
| --- | --- |
| **Topic** | Markup, gross margin, or only one for materials |
| **Current Quotr behaviour** | Gross margin is the primary company commercial setting. Markup fields exist on rates/settings but are **not** the main sell driver in estimating. Markup % is also shown as a derived metric (profit ÷ cost). |
| **Inconsistency or risk** | Editing “markup %” in setup may feel like it should change sell when it does not. |
| **Practical construction example** | Cost $1,000 material; 20% gross margin → sell $1,250 (markup shows 25%). |
| **Recommended MVP rule** | Materials use the same rule as labour: **gross margin** (or explicit sell rate). Do **not** auto-apply a separate material markup in Stage 2B. Show derived markup for information. |
| **Alternative options** | Allow material-only markup mode (more complexity). |
| **Customer impact** | One commercial language across the job. |
| **Future Company DNA impact** | Some companies prefer markup — learn later without rewriting MVP. |
| **Blocks Batch 2B.3?** | **Yes** |
| **Owner decision** | Agree with recommended MVP rule (owner-approved 2026-08-04)
| **Status** | Confirmed |

---

## C. Subcontractors

### OCD-09 — Subcontractor amount basis

| Field | Content |
| --- | --- |
| **Topic** | Cost, customer allowance, or both |
| **Current Quotr behaviour** | Subcontractor lines behave like other cost/sell lines. |
| **Inconsistency or risk** | Unclear uplift expectations. |
| **Practical construction example** | Electrician quote $4,200 cost; you sell at $4,800 after margin/uplift. |
| **Recommended MVP rule** | Store **both** cost and sell. Same margin/derive rules as other lines unless you later choose a dedicated subcontractor uplift (OCD-10). |
| **Alternative options** | Sell allowance only. |
| **Customer impact** | Visible subcontractor GP. |
| **Future Company DNA impact** | Trade-specific DNA. |
| **Blocks Batch 2B.3?** | Soft — confirm with OCD-01/05 model; details can wait |
| **Owner decision** | Agree with recommended MVP rule (owner-approved 2026-08-04)
| **Status** | Deferred |

### OCD-10 — Subcontractor uplift method

| Field | Content |
| --- | --- |
| **Topic** | Gross margin, markup, company-wide uplift, or scope-specific |
| **Current Quotr behaviour** | No separate subcontractor uplift engine; treated as normal lines. |
| **Inconsistency or risk** | Builders who always add 10% on subs may do it manually. |
| **Practical construction example** | Plumbing $10,000 + 10% management uplift = $11,000 sell. |
| **Recommended MVP rule** | **MVP:** use normal **gross margin / sell**. **Defer** dedicated subcontractor uplift product until after beta unless you require it now. |
| **Alternative options** | Company-wide %; per-trade %. |
| **Customer impact** | Manual uplift lines if needed. |
| **Future Company DNA impact** | High-value DNA later. |
| **Blocks Batch 2B.3?** | No — later Stage 2B / after beta |
| **Owner decision** | Agree with recommended MVP rule (owner-approved 2026-08-04)
| **Status** | Deferred |

### OCD-11 — Provisional subcontractor ranges

| Field | Content |
| --- | --- |
| **Topic** | How to treat provisional subcontractor ranges |
| **Current Quotr behaviour** | Estimate low/expected/high ranges exist at estimate level; no dedicated provisional-subcontractor range type. Allowances cover many cases. |
| **Inconsistency or risk** | Client may confuse allowance with fixed subcontract price. |
| **Practical construction example** | “Electrical provisional $3,000–$5,000” shown as an allowance until quotes arrive. |
| **Recommended MVP rule** | Use **allowance / lump-sum** lines for MVP. Defer specialised provisional-sub range type. |
| **Alternative options** | New provisional type before beta. |
| **Customer impact** | Clear labelling in notes/assumptions matters. |
| **Future Company DNA impact** | Scenario learning later. |
| **Blocks Batch 2B.3?** | No |
| **Owner decision** | Agree with recommended MVP rule (owner-approved 2026-08-04)
| **Status** | Deferred |

---

## D. Gross margin and markup

### OCD-12 — Gross margin is primary

| Field | Content |
| --- | --- |
| **Topic** | Confirm gross margin is Quotr’s primary commercial measure |
| **Current Quotr behaviour** | Yes — company default margin drives sell-from-cost. Architecture already states this. |
| **Inconsistency or risk** | Markup language elsewhere can confuse. |
| **Practical construction example** | “We work on 20% margin” means $80 cost needs $100 sell. |
| **Recommended MVP rule** | **Confirm.** Gross margin remains primary. |
| **Alternative options** | Switch product to markup-primary (major redesign — not recommended). |
| **Customer impact** | Stable commercial language. |
| **Future Company DNA impact** | DNA learns the company’s margin culture. |
| **Blocks Batch 2B.3?** | **Yes** |
| **Owner decision** | Agree with recommended MVP rule (owner-approved 2026-08-04)
| **Status** | Confirmed |

### OCD-13 — Sell-from-cost formula

| Field | Content |
| --- | --- |
| **Topic** | Confirm `Sell Price = Cost ÷ (1 − Gross Margin)` |
| **Current Quotr behaviour** | This is already how Quotr derives sell from cost. |
| **Inconsistency or risk** | People sometimes multiply cost × (1 + margin) by mistake (that is markup thinking). |
| **Practical construction example** | Cost $8,000, margin 20% → Sell = 8000 ÷ 0.8 = **$10,000** (not $9,600). |
| **Recommended MVP rule** | **Confirm** this formula for all sell-from-cost paths. |
| **Alternative options** | Markup formula instead (reject for MVP). |
| **Customer impact** | Correct profit targets. |
| **Future Company DNA impact** | Replayable commercial math. |
| **Blocks Batch 2B.3?** | **Yes** |
| **Owner decision** | Agree with recommended MVP rule (owner-approved 2026-08-04)
| **Status** | Confirmed |

### OCD-14 — Margin bounds 0%–95%

| Field | Content |
| --- | --- |
| **Topic** | Confirm allowed gross margin range |
| **Current Quotr behaviour** | App enforces **0%–95%**. Default **20%**. (Database check allows up to 100% on settings — minor mismatch.) |
| **Inconsistency or risk** | 100% margin is mathematically invalid for sell-from-cost. |
| **Practical construction example** | 95% margin means cost is only 5% of sell — extreme but allowed; 100% is impossible. |
| **Recommended MVP rule** | **Confirm 0%–95%.** Align settings validation to 95% over time. |
| **Alternative options** | Narrower band (e.g. 5–40%) — product choice. |
| **Customer impact** | Prevents broken sell calculations. |
| **Future Company DNA impact** | Safe bounds for learning. |
| **Blocks Batch 2B.3?** | **Yes** |
| **Owner decision** | Agree with recommended MVP rule (owner-approved 2026-08-04)
| **Status** | Confirmed |

### OCD-15 — Markup remains separate

| Field | Content |
| --- | --- |
| **Topic** | Markup only where explicitly configured |
| **Current Quotr behaviour** | Markup is validated separately (0–1000%) and shown as derived; not auto-converted to/from margin. |
| **Inconsistency or risk** | Dual fields without dual drivers confuse users. |
| **Practical construction example** | Seeing “markup 25%” on a 20% margin job is normal maths — not a second charge. |
| **Recommended MVP rule** | **Confirm:** markup is informational/derived unless a future explicit “price by markup” mode is authorised. No silent conversion. |
| **Alternative options** | Remove markup from UI until needed. |
| **Customer impact** | Less false expectation. |
| **Future Company DNA impact** | Some firms think in markup — optional later. |
| **Blocks Batch 2B.3?** | **Yes** |
| **Owner decision** | Agree with recommended MVP rule (owner-approved 2026-08-04)
| **Status** | Confirmed |

### OCD-16 — Line margin vs company/document margin

| Field | Content |
| --- | --- |
| **Topic** | Own margin per line, or inherit only |
| **Current Quotr behaviour** | Company/default and estimate **target margin** can reprice sells from cost. Final Pricing lines usually edit cost/sell directly; margin % is then derived per line. |
| **Inconsistency or risk** | Unclear whether changing company margin should rewrite every line. |
| **Practical construction example** | Deck labour at 20% margin, specialist glass at a negotiated sell (different effective margin). |
| **Recommended MVP rule** | **MVP:** Company/estimate target margin can set sells from cost. After that, **line cost/sell edits win**; line margin is **derived**. Do not force every line to share one locked margin forever. |
| **Alternative options** | Strict document margin lock (less flexible for builders). |
| **Customer impact** | Matches real negotiating. |
| **Future Company DNA impact** | Per-line effective margins become learning signals. |
| **Blocks Batch 2B.3?** | **Yes** |
| **Owner decision** | Agree with recommended MVP rule (owner-approved 2026-08-04)
| **Status** | Confirmed |

### OCD-17 — Manual margin overrides

| Field | Content |
| --- | --- |
| **Topic** | How manual margin overrides behave |
| **Current Quotr behaviour** | Estimate target margin recomputes sells from costs until regenerate/stale rules apply. Pricing edits change money fields directly. |
| **Inconsistency or risk** | Regenerate may overwrite expectations if not understood. |
| **Practical construction example** | You set job margin to 25% for a tight site; later regenerate estimate — target margin should re-apply if still set. |
| **Recommended MVP rule** | Target margin overrides remain until cleared. Regenerating with a stored target margin re-applies it. Manual line sell edits in Final Pricing are preserved until you choose recalibration/replace. AI must not clear overrides. |
| **Alternative options** | Always reset to company default on regenerate. |
| **Customer impact** | Predictable control. |
| **Future Company DNA impact** | Overrides = correction evidence. |
| **Blocks Batch 2B.3?** | **Yes** |
| **Owner decision** | Agree with recommended MVP rule (owner-approved 2026-08-04)
| **Status** | Confirmed |

---

## E. Overheads and contingency

### OCD-18 — Separate overhead recovery required now?

| Field | Content |
| --- | --- |
| **Topic** | Does Quotr currently require separate overhead recovery? |
| **Current Quotr behaviour** | **No separate overhead engine.** Estimate assumptions say overhead/margin allowance is included in pricing approach; money goes through normal cost/sell/margin. |
| **Inconsistency or risk** | Builders who track overhead separately may think Quotr is missing a field. |
| **Practical construction example** | Yard, vehicles, insurance recovered inside the 20% margin rather than a second 8% overhead line. |
| **Recommended MVP rule** | **No separate overhead required for MVP.** Treat overhead as **included within gross margin**. |
| **Alternative options** | Add overhead % before beta (extra complexity). |
| **Customer impact** | Simpler estimating. |
| **Future Company DNA impact** | Optional overhead DNA later. |
| **Blocks Batch 2B.3?** | No — **defer after beta** unless you insist now |
| **Owner decision** | Agree with recommended MVP rule (owner-approved 2026-08-04)
| **Status** | Deferred |

### OCD-19 — If overhead exists, how applied?

| Field | Content |
| --- | --- |
| **Topic** | Overhead form (only if OCD-18 = yes) |
| **Current Quotr behaviour** | N/A — not implemented as a calculator. |
| **Recommended MVP rule** | **Defer.** If ever added: prefer explicit % or allowance with explanation — not hidden. |
| **Alternative options** | Inside margin; separate %; fixed allowance; scope-specific. |
| **Blocks Batch 2B.3?** | No |
| **Owner decision** | Agree with recommended MVP rule (owner-approved 2026-08-04)
| **Status** | Deferred |

### OCD-20 — Separate contingency field required?

| Field | Content |
| --- | --- |
| **Topic** | Contingency product requirement |
| **Current Quotr behaviour** | Contingency exists as a **line category**. Company settings include a default contingency **%**, but it is **not clearly auto-applied** as a calculated add-on across every estimate. |
| **Inconsistency or risk** | Settings % may look active when it does little. |
| **Practical construction example** | $2,000 contingency allowance line on an uncertain renovation. |
| **Recommended MVP rule** | **MVP:** contingency = **manual allowance/contingency lines**. Do not invent auto % application in Stage 2B. Decide later whether settings % should auto-create a line. |
| **Alternative options** | Auto % of sell/cost before beta. |
| **Customer impact** | Explicit contingency stays visible to the builder. |
| **Future Company DNA impact** | How often contingency is used/consumed. |
| **Blocks Batch 2B.3?** | Soft — line mode already supports contingency-like lump sums |
| **Owner decision** | Agree with recommended MVP rule (owner-approved 2026-08-04)
| **Status** | Deferred |

### OCD-21 — Contingency application order

| Field | Content |
| --- | --- |
| **Topic** | Apply to cost/sell; before/after margin; or separate line |
| **Current Quotr behaviour** | Separate line amounts (not an automatic pipeline step). |
| **Recommended MVP rule** | **Separate allowance line** (cost and/or sell). No automatic before/after margin cascade in Stage 2B. |
| **Alternative options** | % of cost before margin; % of sell after margin. |
| **Blocks Batch 2B.3?** | No — **defer** auto behaviour |
| **Owner decision** | Agree with recommended MVP rule (owner-approved 2026-08-04)
| **Status** | Deferred |

---

## F. GST

### OCD-22 — NZ GST default 15%

| Field | Content |
| --- | --- |
| **Topic** | Confirm default GST rate |
| **Current Quotr behaviour** | Default **15%**. |
| **Recommended MVP rule** | **Confirm 15%** NZ default. |
| **Blocks Batch 2B.3?** | No (needed before 2B.6) |
| **Owner decision** | Agree with recommended MVP rule (owner-approved 2026-08-04)
| **Status** | Confirmed |
| **Practical construction example** | $10,000 excl GST + 15% = $1,500 GST → $11,500 incl. |
| **Alternative options** | Other defaults (not for NZ MVP). |
| **Customer impact** | Matches NZ quoting norms. |
| **Future Company DNA impact** | Low. |
| **Inconsistency or risk** | See OCD-GST if org rate ≠ recalculation rate. |

### OCD-23 — Stored prices GST-exclusive

| Field | Content |
| --- | --- |
| **Topic** | Internal calculations / stored prices exclusive unless stated |
| **Current Quotr behaviour** | Line and document money fields are GST-exclusive; GST added at document/quote total. Estimates generally show excl GST. |
| **Recommended MVP rule** | **Confirm:** store and calculate **GST-exclusive**; show GST and incl totals on pricing/quotes. |
| **Blocks Batch 2B.3?** | Preferred before 2B.3 aggregates; soft |
| **Owner decision** | Agree with recommended MVP rule (owner-approved 2026-08-04)
| **Status** | Confirmed |
| **Practical construction example** | Line sell $1,000 means $1,000 before GST. |
| **Alternative options** | Tax-inclusive line pricing (not current design). |
| **Inconsistency or risk** | Mixing incl/excl confuses totals. |
| **Customer impact** | Clear client presentation. |
| **Future Company DNA impact** | Comparable history. |

### OCD-24 — GST once at document total

| Field | Content |
| --- | --- |
| **Topic** | Apply GST once at document level |
| **Current Quotr behaviour** | Yes — GST on sell subtotal, not per-line tax accumulation. |
| **Recommended MVP rule** | **Confirm.** |
| **Blocks Batch 2B.3?** | Soft (document engine 2B.4) |
| **Owner decision** | Agree with recommended MVP rule (owner-approved 2026-08-04)
| **Status** | Confirmed |
| **Practical construction example** | Ten lines sum to $10,000 excl; one GST calculation. |
| **Alternative options** | Per-line GST (rejected for MVP). |
| **Inconsistency or risk** | Rounding differs if taxed per line. |
| **Customer impact** | Matches typical NZ quotes. |
| **Future Company DNA impact** | Low. |

### OCD-25 — Item display GST-exclusive

| Field | Content |
| --- | --- |
| **Topic** | Are item prices shown GST-exclusive? |
| **Current Quotr behaviour** | Client quote lines use exclusive amounts; totals show GST and incl. |
| **Recommended MVP rule** | **Confirm** item prices GST-exclusive on quotes; totals show GST + incl. |
| **Blocks Batch 2B.3?** | No |
| **Owner decision** | Agree with recommended MVP rule (owner-approved 2026-08-04)
| **Status** | Confirmed |
| **Practical construction example** | Quote line “Decking labour $3,900” + GST in totals section. |
| **Alternative options** | Show incl GST per line (clutter). |
| **Inconsistency or risk** | Client assumes incl GST. |
| **Customer impact** | Needs clear labels (already print-checklist intent). |
| **Future Company DNA impact** | Low. |

### OCD-26 — Intended GST rule for Batch 2B.6

| Field | Content |
| --- | --- |
| **Topic** | Authoritative GST source for pricing calculations |
| **Current Quotr behaviour** | See **OCD-GST** defect. |
| **Recommended MVP rule** | Pricing calculations must use the **pricing document’s validated GST rate**, initially from company settings. |
| **Blocks Batch 2B.3?** | No — blocks clean **2B.6** |
| **Owner decision** | Agree with recommended MVP rule (owner-approved 2026-08-04)
| **Status** | Confirmed |
| **Practical construction example** | Company GST 15% → document 15% → all recalcs use 15%. |
| **Alternative options** | Hardcode 15% always (rejects company setting). |
| **Inconsistency or risk** | Hardcoded recalc today. |
| **Customer impact** | Correct tax. |
| **Future Company DNA impact** | Settings remain trustworthy. |

---

## G. Lump sums

### OCD-27 — Lump sums remain supported

| Field | Content |
| --- | --- |
| **Topic** | Keep lump-sum pricing |
| **Current Quotr behaviour** | Supported calculation mode; required for many allowances/contingencies. |
| **Recommended MVP rule** | **Confirm — keep.** |
| **Blocks Batch 2B.3?** | **Yes** |
| **Owner decision** | Agree with recommended MVP rule (owner-approved 2026-08-04)
| **Status** | Confirmed |
| **Practical construction example** | “Scaffold hire $2,500” as a single total. |
| **Alternative options** | Force everything to qty×rate (rejects real quoting). |
| **Inconsistency or risk** | None if preserved. |
| **Customer impact** | Essential for builders. |
| **Future Company DNA impact** | Override/lump patterns learnable. |

### OCD-28 — What a lump sum stores

| Field | Content |
| --- | --- |
| **Topic** | Cost and sell, sell only, or sell + optional cost |
| **Current Quotr behaviour** | Stores **both** total cost and total sell when provided. |
| **Recommended MVP rule** | Store **cost and sell separately** when known; allow sell with optional/estimated cost. |
| **Blocks Batch 2B.3?** | **Yes** |
| **Owner decision** | Agree with recommended MVP rule (owner-approved 2026-08-04)
| **Status** | Confirmed |
| **Practical construction example** | Allowance sell $1,000; estimated cost $700 → GP visible. |
| **Alternative options** | Sell-only (hides profit). |
| **Inconsistency or risk** | Sell-only lines show 100% margin if cost left at 0. |
| **Customer impact** | Better commercial control when cost known. |
| **Future Company DNA impact** | Better actuals later. |

### OCD-29 — Margin on lump sums when cost supplied

| Field | Content |
| --- | --- |
| **Topic** | Calculate margin metrics when cost exists |
| **Current Quotr behaviour** | Yes — GP/margin/markup derived from cost and sell totals. |
| **Recommended MVP rule** | **Confirm** — calculate margin metrics whenever cost and sell are present. |
| **Blocks Batch 2B.3?** | **Yes** |
| **Owner decision** | Agree with recommended MVP rule (owner-approved 2026-08-04)
| **Status** | Confirmed |
| **Practical construction example** | Lump cost $700 / sell $1,000 → 30% margin. |
| **Alternative options** | Hide margin on lump sums. |
| **Inconsistency or risk** | Low. |
| **Customer impact** | Same language as other lines. |
| **Future Company DNA impact** | Comparable. |

### OCD-30 — Only selling total known

| Field | Content |
| --- | --- |
| **Topic** | Behaviour when cost unknown |
| **Current Quotr behaviour** | Cost may be zero; sell holds the commercial figure; margin metrics may look extreme. |
| **Recommended MVP rule** | Allow sell-only lump sums. Treat cost **0** as “cost unknown / not entered,” not as a true zero-cost job, in explanations where possible. Do not invent a cost. |
| **Blocks Batch 2B.3?** | **Yes** |
| **Owner decision** | Agree with recommended MVP rule (owner-approved 2026-08-04)
| **Status** | Confirmed |
| **Practical construction example** | Client allowance $5,000 entered as sell before supplier quotes arrive. |
| **Alternative options** | Require cost always (too strict). |
| **Inconsistency or risk** | Misleading 100% margin display. |
| **Customer impact** | Needs clear UI labelling later (2B.9). |
| **Future Company DNA impact** | Flag unknown-cost lumps. |

### OCD-31 — Preserve and identify manual lump-sum overrides

| Field | Content |
| --- | --- |
| **Topic** | Preserve and visibly identify manual lump sums |
| **Current Quotr behaviour** | Manual totals preserved on save; visibility of “override” labelling is limited. |
| **Recommended MVP rule** | Preserve manual lump sums; AI must not overwrite. Improve visible identification in later UI batch. |
| **Blocks Batch 2B.3?** | Soft — full visibility in **2B.9** |
| **Owner decision** | Agree with recommended MVP rule (owner-approved 2026-08-04)
| **Status** | Deferred |
| **Practical construction example** | You override scaffold to $2,200; regenerate elsewhere must not silently revert it without recalibration choice. |
| **Alternative options** | Silent accept without labels. |
| **Inconsistency or risk** | Trust. |
| **Customer impact** | Builder confidence. |
| **Future Company DNA impact** | Override evidence. |

---

## H. Zero values, allowances and provisional sums

### OCD-32 — When zero-value items are permitted

| Field | Content |
| --- | --- |
| **Topic** | Zero-value permission |
| **Current Quotr behaviour** | Allowed when intentional (informational / included at no charge). Negatives rejected. |
| **Recommended MVP rule** | **Confirm** Stage 2A rule: zeros only when intentional; never silent coercion of bad input to zero. |
| **Blocks Batch 2B.3?** | **Yes** (validation) |
| **Owner decision** | Agree with recommended MVP rule (owner-approved 2026-08-04)
| **Status** | Confirmed |
| **Practical construction example** | “Existing deck removal by owner — $0 included.” |
| **Alternative options** | Forbid all zeros (too strict). |
| **Inconsistency or risk** | Accidental zero rates. |
| **Customer impact** | Clear inclusions. |
| **Future Company DNA impact** | Low. |

### OCD-33 — Definitions

| Field | Content |
| --- | --- |
| **Topic** | Informational / included-at-no-charge / allowance / provisional / excluded |
| **Current Quotr behaviour** | Categories and visibility flags exist; naming is not a full product taxonomy. |
| **Recommended MVP rule (definitions)** | **Informational:** shows scope, $0, may be hidden from quote. **Included-at-no-charge:** $0 sell, intentionally given. **Allowance:** sum set aside for undefined selection. **Provisional sum:** similar commercial intent — for MVP treat via allowance/lump until a distinct type is authorised. **Excluded:** listed in exclusions, not in priced total. |
| **Blocks Batch 2B.3?** | Soft |
| **Owner decision** | Agree with recommended MVP rule (owner-approved 2026-08-04)
| **Status** | Deferred |
| **Practical construction example** | Tile supply allowance $80/m² vs “client supply tiles — $0”. |
| **Alternative options** | New DB types before beta. |
| **Inconsistency or risk** | Terminology confusion. |
| **Customer impact** | Clearer quotes when labelled well. |
| **Future Company DNA impact** | Structured scope learning. |

### OCD-34 — What provisional sums affect

| Field | Content |
| --- | --- |
| **Topic** | Expected total / range / quote / all |
| **Current Quotr behaviour** | If entered as a priced line, they affect the totals of the document they sit on. |
| **Recommended MVP rule** | If included and visible, they affect **that document’s total**. Estimate ranges remain separate budget/premium factors unless you later define provisional-specific range rules. |
| **Blocks Batch 2B.3?** | Soft |
| **Owner decision** | Agree with recommended MVP rule (owner-approved 2026-08-04)
| **Status** | Deferred |
| **Practical construction example** | $4,000 electrical provisional inside Final Pricing → in quote if visible. |
| **Alternative options** | Exclude provisionals from quote until firm. |
| **Inconsistency or risk** | Client treats provisional as fixed. |
| **Customer impact** | Needs assumptions text. |
| **Future Company DNA impact** | Track provisional → actual. |

### OCD-35 — Zero quantity with positive total

| Field | Content |
| --- | --- |
| **Topic** | Valid for lump sums only? |
| **Current Quotr behaviour** | Lump-sum mode allows totals without relying on qty×rate. |
| **Recommended MVP rule** | **Yes — lump sums only.** Quantity×rate and productivity modes require meaningful quantity/hours. |
| **Blocks Batch 2B.3?** | **Yes** |
| **Owner decision** | Agree with recommended MVP rule (owner-approved 2026-08-04)
| **Status** | Confirmed |
| **Practical construction example** | “Preliminaries $1,500” with qty blank/0. |
| **Alternative options** | Always require qty=1. |
| **Inconsistency or risk** | Mode confusion. |
| **Customer impact** | Natural lump pricing. |
| **Future Company DNA impact** | Mode provenance. |

---

## I. Estimate ranges

### OCD-36 — What low / expected / high mean

| Field | Content |
| --- | --- |
| **Topic** | Meaning of range values |
| **Current Quotr behaviour** | Built from organisation **budget** and **premium** factors (defaults about 0.9× and 1.15×) applied to recommended cost/sell — not a full uncertainty model. |
| **Recommended MVP rule** | **Low** ≈ budget scenario; **Expected** ≈ recommended; **High** ≈ premium scenario. Label as guidance, not a guarantee. |
| **Blocks Batch 2B.3?** | Soft (estimate path) |
| **Owner decision** | Agree with recommended MVP rule (owner-approved 2026-08-04)
| **Status** | Deferred |
| **Practical construction example** | Recommended sell $50k → low ~$45k, high ~$57.5k with default factors. |
| **Alternative options** | Statistical uncertainty bands (future). |
| **Inconsistency or risk** | Users may read as firm quotes. |
| **Customer impact** | Internal planning aid. |
| **Future Company DNA impact** | Calibrate factors per company. |

### OCD-37 — How ranges are produced

| Field | Content |
| --- | --- |
| **Topic** | Line, work area, document %, or uncertainty |
| **Current Quotr behaviour** | Primarily **document-level factors** applied through line amounts, then summed. |
| **Recommended MVP rule** | Keep **document-level factors** for MVP. Deeper uncertainty models later. |
| **Blocks Batch 2B.3?** | Soft |
| **Owner decision** | Agree with recommended MVP rule (owner-approved 2026-08-04)
| **Status** | Deferred |
| **Practical construction example** | One company sets budget factor 0.85 for competitive tendering. |
| **Alternative options** | Per-line confidence widths. |
| **Inconsistency or risk** | Same factor on all trades. |
| **Customer impact** | Simple controls. |
| **Future Company DNA impact** | Scenario calibration. |

### OCD-38 — Confidence vs range

| Field | Content |
| --- | --- |
| **Topic** | Related but not interchangeable |
| **Current Quotr behaviour** | Confidence is a separate heuristic score (rate coverage, missing facts). Range is dollar bands. |
| **Recommended MVP rule** | **Confirm** they are related but **not** the same. Never invent confidence inside the money engine. |
| **Blocks Batch 2B.3?** | Soft |
| **Owner decision** | Agree with recommended MVP rule (owner-approved 2026-08-04)
| **Status** | Deferred |
| **Practical construction example** | High confidence with still a ±15% commercial range. |
| **Alternative options** | Merge into one score (rejected). |
| **Inconsistency or risk** | Misreading confidence as price accuracy. |
| **Customer impact** | Clearer UI copy later. |
| **Future Company DNA impact** | Separate learning signals. |

### OCD-39 — Quotes use final value, not range

| Field | Content |
| --- | --- |
| **Topic** | Detailed quotes: expected/final only |
| **Current Quotr behaviour** | Quotes show a single total path (subtotal + GST + incl), not low/high bands. |
| **Recommended MVP rule** | **Confirm** — customer quotes use **final/expected** figures only. Ranges stay internal to estimates. |
| **Blocks Batch 2B.3?** | No |
| **Owner decision** | Agree with recommended MVP rule (owner-approved 2026-08-04)
| **Status** | Deferred |
| **Practical construction example** | Client PDF shows one price, not a $45–57k band. |
| **Alternative options** | Publish ranges on quotes (usually undesirable). |
| **Inconsistency or risk** | Low. |
| **Customer impact** | Professional quotes. |
| **Future Company DNA impact** | Low. |

---

## J. Rounding

### OCD-40 — Currency precision

| Field | Content |
| --- | --- |
| **Topic** | Internal precision vs two-decimal display |
| **Current Quotr behaviour** | Money generally rounded to **2 decimals** when committed. |
| **Recommended MVP rule** | Compute with normal numeric precision; **commit/display money to 2 decimals**. |
| **Blocks Batch 2B.3?** | **Yes** |
| **Owner decision** | Agree with recommended MVP rule (owner-approved 2026-08-04)
| **Status** | Confirmed |
| **Practical construction example** | $12.345 → $12.35 stored. |
| **Alternative options** | Whole dollars only (too coarse for materials). |
| **Inconsistency or risk** | Parallel round helpers today. |
| **Customer impact** | Cent-accurate GST. |
| **Future Company DNA impact** | Replay stability. |

### OCD-41 — Round lines before sum, or sum then round?

| Field | Content |
| --- | --- |
| **Topic** | Aggregation order |
| **Current Quotr behaviour** | Lines rounded, then summed, then document GST rounded (effectively line-first). |
| **Recommended MVP rule** | **Round each line first; then sum; then calculate and round GST; then incl total.** |
| **Blocks Batch 2B.3?** | **Yes** |
| **Owner decision** | Agree with recommended MVP rule (owner-approved 2026-08-04)
| **Status** | Confirmed |
| **Practical construction example** | Avoids “mystery cent” drift between screens. |
| **Alternative options** | Sum raw then round once (can diverge from line display). |
| **Inconsistency or risk** | Display vs total mismatch. |
| **Customer impact** | Trust. |
| **Future Company DNA impact** | Replay. |

### OCD-42 — Quantity precision

| Field | Content |
| --- | --- |
| **Topic** | Quantity decimal places |
| **Current Quotr behaviour** | Generally 2 dp for money-affecting qty/hours; some sheet counts use whole sheets (ceil). |
| **Recommended MVP rule** | **2 decimal places** for general qty/hours; allow domain exceptions (whole sheets) where build-ups already do. |
| **Blocks Batch 2B.3?** | **Yes** |
| **Owner decision** | Agree with recommended MVP rule (owner-approved 2026-08-04)
| **Status** | Confirmed |
| **Practical construction example** | 12.5 m²; 18 sheets (ceil). |
| **Alternative options** | 3 dp everywhere. |
| **Inconsistency or risk** | Low. |
| **Customer impact** | Practical site units. |
| **Future Company DNA impact** | Low. |

### OCD-43 — Percentage precision

| Field | Content |
| --- | --- |
| **Topic** | Margin/markup % decimals |
| **Current Quotr behaviour** | Stored/displayed to **2 decimal places**. |
| **Recommended MVP rule** | **Confirm 2 dp** for margin/markup metrics. |
| **Blocks Batch 2B.3?** | **Yes** |
| **Owner decision** | Agree with recommended MVP rule (owner-approved 2026-08-04)
| **Status** | Confirmed |
| **Practical construction example** | 20.00%, 23.53%. |
| **Alternative options** | Whole percents only. |
| **Inconsistency or risk** | Breakdown modal sometimes unrounded today (display-only). |
| **Customer impact** | Consistency. |
| **Future Company DNA impact** | Low. |

### OCD-44 — Quote presentation rounding

| Field | Content |
| --- | --- |
| **Topic** | Cents vs whole dollars vs $5/$10 / configurable |
| **Current Quotr behaviour** | Cent precision (2 dp). |
| **Recommended MVP rule** | **MVP: cents (2 dp).** Defer company-configurable presentation rounding until after beta. |
| **Blocks Batch 2B.3?** | No |
| **Owner decision** | Agree with recommended MVP rule (owner-approved 2026-08-04)
| **Status** | Deferred |
| **Practical construction example** | Quote total $11,487.50 not forced to $11,490. |
| **Alternative options** | Round sell to nearest $10 for client friendliness. |
| **Inconsistency or risk** | Presentation vs cost tracking. |
| **Customer impact** | Optional polish later. |
| **Future Company DNA impact** | Company preference later. |

---

## K. Historical snapshots

### OCD-45 — Accepted/sent quotes immutable

| Field | Content |
| --- | --- |
| **Topic** | Quotes stay fixed when company rates/margin/GST/engine change |
| **Current Quotr behaviour** | Quote revisions keep old rows; company setting changes do not rewrite existing quotes. |
| **Recommended MVP rule** | **Confirm binding:** accepted/sent (and historical) quotes are **immutable snapshots**. |
| **Blocks Batch 2B.3?** | Soft for 2B.3; **hard before 2B.8** |
| **Owner decision** | Agree with recommended MVP rule (owner-approved 2026-08-04)
| **Status** | Confirmed |
| **Practical construction example** | Quote sent Monday remains Monday’s price after you raise rates Tuesday. |
| **Alternative options** | Live-linked quotes (dangerous — reject). |
| **Inconsistency or risk** | Client disputes. |
| **Customer impact** | Professional trust. |
| **Future Company DNA impact** | Stable history for learning. |

### OCD-46 — Which drafts recalculate automatically

| Field | Content |
| --- | --- |
| **Topic** | Auto-recalc policy for drafts |
| **Current Quotr behaviour** | Editing pricing items recalculates document totals. Estimates can be marked stale and need regenerate. Recalibration is explicit for pricing vs estimate drift. |
| **Recommended MVP rule** | **Draft Final Pricing:** recalc on item edit. **Estimates:** regenerate explicitly (or margin update path). **Do not** auto-mutate sent quotes. |
| **Blocks Batch 2B.3?** | Soft |
| **Owner decision** | Agree with recommended MVP rule (owner-approved 2026-08-04)
| **Status** | Deferred |
| **Practical construction example** | Change a labour rate on a draft pricing line → totals update immediately. |
| **Alternative options** | Fully live estimates always (heavier). |
| **Inconsistency or risk** | Stale banners must stay clear. |
| **Customer impact** | Controlled refresh. |
| **Future Company DNA impact** | Explicit regenerate events. |

### OCD-47 — When a new quote revision is required

| Field | Content |
| --- | --- |
| **Topic** | Revision trigger |
| **Current Quotr behaviour** | Revising creates a new quote version; old marked superseded. |
| **Recommended MVP rule** | New revision when commercial offer to the client changes (price, GST, scope on quote). Draft internal pricing edits before send do not need a client revision until a quote is created/updated for the client. |
| **Blocks Batch 2B.3?** | No — before 2B.8 |
| **Owner decision** | Agree with recommended MVP rule (owner-approved 2026-08-04)
| **Status** | Deferred |
| **Practical construction example** | Client asks to remove pergola → new quote revision, not silent edit of sent PDF numbers. |
| **Alternative options** | Overwrite same quote row (rejects history). |
| **Inconsistency or risk** | Lost history. |
| **Customer impact** | Clear paper trail. |
| **Future Company DNA impact** | Revision learning. |

---

## L. Manual overrides and future learning

### OCD-48 — Builder is final decision-maker

| Field | Content |
| --- | --- |
| **Topic** | Human authority |
| **Current Quotr behaviour** | User confirms work areas; edits pricing; reviews before quote. |
| **Recommended MVP rule** | **Confirm.** |
| **Blocks Batch 2B.3?** | Soft (architecture already binds) |
| **Owner decision** | Agree with recommended MVP rule (owner-approved 2026-08-04)
| **Status** | Confirmed |
| **Practical construction example** | AI suggests three work areas; you delete one before estimating. |
| **Alternative options** | Auto-accept AI (rejected). |
| **Inconsistency or risk** | Over-trusting AI. |
| **Customer impact** | Accountability. |
| **Future Company DNA impact** | Human corrections teach DNA. |

### OCD-49 — AI must not silently overwrite manuals

| Field | Content |
| --- | --- |
| **Topic** | AI vs manual values |
| **Current Quotr behaviour** | AI assists structure/facts; money is deterministic; proposals generally require confirmation patterns. |
| **Recommended MVP rule** | **Confirm:** AI never silently overwrites manual commercial values. |
| **Blocks Batch 2B.3?** | Soft |
| **Owner decision** | Agree with recommended MVP rule (owner-approved 2026-08-04)
| **Status** | Confirmed |
| **Practical construction example** | You set sell $12,000; AI must not change it on reopen. |
| **Alternative options** | Soft AI nudges only with accept. |
| **Inconsistency or risk** | Trust collapse. |
| **Customer impact** | Critical. |
| **Future Company DNA impact** | Clean correction signals. |

### OCD-50 — Override metadata to capture

| Field | Content |
| --- | --- |
| **Topic** | Previous/new value, reason, user, time, source, reuse scope |
| **Current Quotr behaviour** | Partial audit logging exists for some pricing/quote mutations; not a full override reason product. |
| **Recommended MVP rule** | **MVP minimum hooks:** previous value, new value, user, timestamp, source (manual/AI/recalc). **Reason** and **reuse scope** can start optional and deepen later for DNA. |
| **Blocks Batch 2B.3?** | Soft — deepen in 2B.9 / post-beta |
| **Owner decision** | Agree with recommended MVP rule (owner-approved 2026-08-04)
| **Status** | Deferred |
| **Practical construction example** | “Reduced glass balustrade sell — client budget” stored as reason later. |
| **Alternative options** | Capture nothing (hurts DNA). |
| **Inconsistency or risk** | Incomplete learning substrate. |
| **Customer impact** | Slightly more friction if reason required too early. |
| **Future Company DNA impact** | Core. |

### OCD-51 — Edits become DNA evidence, not auto-rules

| Field | Content |
| --- | --- |
| **Topic** | Learning must not auto-update company rates/margins |
| **Current Quotr behaviour** | No DNA auto-update exists (correct for now). |
| **Recommended MVP rule** | **Confirm:** future DNA may **suggest** from edits; never silently rewrite company rules without explicit accept. |
| **Blocks Batch 2B.3?** | No |
| **Owner decision** | Agree with recommended MVP rule (owner-approved 2026-08-04)
| **Status** | Deferred |
| **Practical construction example** | You often uplift fencing 8% — DNA later suggests updating the rate card; you approve. |
| **Alternative options** | Auto-write rates (rejected). |
| **Inconsistency or risk** | Silent commercial drift. |
| **Customer impact** | Safety. |
| **Future Company DNA impact** | Governance of learning. |

---

## M. Discounts and credits

### OCD-52 — Credits excluded from MVP

| Field | Content |
| --- | --- |
| **Topic** | Credits |
| **Current Quotr behaviour** | Negatives rejected; no credit line type. |
| **Recommended MVP rule** | **Confirm excluded** from current MVP / Stage 2B. |
| **Blocks Batch 2B.3?** | **Yes** (confirm exclusion so engine does not invent credits) |
| **Owner decision** | Agree with recommended MVP rule (owner-approved 2026-08-04)
| **Status** | Confirmed |
| **Practical construction example** | Client credit for materials supplied — handle outside Quotr or future credit type. |
| **Alternative options** | Build credits now (out of scope). |
| **Inconsistency or risk** | Using negatives as fake credits. |
| **Customer impact** | Clear boundary. |
| **Future Company DNA impact** | Dedicated type later. |

### OCD-53 — Discounts required before beta?

| Field | Content |
| --- | --- |
| **Topic** | Discount feature timing |
| **Current Quotr behaviour** | Not supported as discount arithmetic. |
| **Recommended MVP rule** | **Not required before beta.** Adjust sell prices or allowances manually. |
| **Blocks Batch 2B.3?** | No — **after beta** |
| **Owner decision** | Agree with recommended MVP rule (owner-approved 2026-08-04)
| **Status** | Deferred |
| **Practical construction example** | 5% goodwill — lower a lump-sum sell manually. |
| **Alternative options** | Discount % field before beta. |
| **Inconsistency or risk** | Extra formula complexity. |
| **Customer impact** | Acceptable manual workaround. |
| **Future Company DNA impact** | Optional later. |

### OCD-54 — Exclude discount arithmetic from Stage 2B

| Field | Content |
| --- | --- |
| **Topic** | Stage 2B scope exclusion |
| **Current Quotr behaviour** | No discount engine. |
| **Recommended MVP rule** | **Confirm:** Stage 2B authoritative engine **excludes** discount arithmetic. |
| **Blocks Batch 2B.3?** | **Yes** (scope lock) |
| **Owner decision** | Agree with recommended MVP rule (owner-approved 2026-08-04)
| **Status** | Confirmed |
| **Practical construction example** | Engine calculates cost/sell/margin/GST only. |
| **Alternative options** | Pull discounts into 2B (reject). |
| **Inconsistency or risk** | Scope creep. |
| **Customer impact** | Faster hardening. |
| **Future Company DNA impact** | Separate track. |

---

## N. Minimum charges and commercial loadings

### OCD-55 — Minimum charges before beta?

| Field | Content |
| --- | --- |
| **Topic** | Minimum project or line charges |
| **Current Quotr behaviour** | Some **labour/allowance minimum helpers** exist inside estimating for certain scopes; not a general company minimum-charge product. |
| **Recommended MVP rule** | Keep existing limited helpers. **Do not** build a full minimum-charge system before beta unless you require it now. |
| **Blocks Batch 2B.3?** | No — engine can accept pre-adjusted hours/amounts |
| **Owner decision** | Agree with recommended MVP rule (owner-approved 2026-08-04)
| **Status** | Deferred |
| **Practical construction example** | Small bathroom still gets a minimum crew-day in some calculators. |
| **Alternative options** | Company-wide minimum fee product now. |
| **Inconsistency or risk** | Uneven coverage across trades. |
| **Customer impact** | Mostly OK for beta. |
| **Future Company DNA impact** | Strong later. |

### OCD-56 — Access, nightshift, airport, occupied site, travel, small-job loading

| Field | Content |
| --- | --- |
| **Topic** | How commercial loadings work now |
| **Current Quotr behaviour** | Some constraints/factors adjust labour in places; many captured constraints **do not yet change price**. Manual allowances cover the rest. |
| **Inconsistency or risk** | Users may believe a recorded “poor access” constraint always changed the price when it did not. |
| **Practical construction example** | Inner-city occupied apartment → access factor or a clear “access allowance” line. |
| **Recommended MVP rule** | **MVP:** prefer **explicit allowance lines** for uncommon loadings; keep today’s limited productivity factors where they already exist. **Defer** a full company loading-rules product. Document that many constraints are capture-only until later stages. |
| **Alternative options** | Wire all constraints into price before beta (large scope). |
| **Customer impact** | Honesty about what affects price. |
| **Future Company DNA impact** | **High** — company loading rules are core DNA later. |
| **Blocks Batch 2B.3?** | No — **after beta** for full system |
| **Owner decision** | Agree with recommended MVP rule (owner-approved 2026-08-04)
| **Status** | Deferred |

---

## Decision count

| Category | Count |
| --- | --- |
| OCD-01 … OCD-56 | 56 |
| OCD-GST (C-28 / CD-09) | 1 |
| **Total decision items** | **57** |

All statuses start as **Pending**. Recommendations are **not** approved until you confirm them.

---

## Document control

| Field | Value |
| --- | --- |
| Path | `docs/decisions/STAGE_2B_OWNER_COMMERCIAL_DECISIONS.md` |
| Batch | 2B.2A |
| Application / formula / migration / UI / prompt changes | **None** |
| Next | Owner fills decisions → Batch **2B.2B** golden test cases (when authorised) |
| Stage 2B status | **Auditing** |
