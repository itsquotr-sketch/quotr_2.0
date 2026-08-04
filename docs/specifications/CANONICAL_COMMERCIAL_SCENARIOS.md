# Quotr Canonical Commercial Scenarios

**Status:** Canonical commercial truth (Batch 2B.2B)  
**Date:** 2026-08-04  
**Authority:** Desired commercial behaviour per Architecture Foundation and recommended MVP rules in `docs/decisions/STAGE_2B_OWNER_COMMERCIAL_DECISIONS.md`  
**Companion:** `GOLDEN_PRICING_EXPECTED_RESULTS.md` · `CALCULATION_REGRESSION_STANDARD.md` · `SCENARIO_COVERAGE_MATRIX.md`  

**Important:** These scenarios define **desired** commercial outcomes. They are **not** reverse-engineered from current code. Until owner decisions are marked Confirmed, scenarios assume the **recommended MVP commercial model**.

### Binding commercial assumptions (recommended MVP)

1. Store **cost** and **sell** (GST-exclusive).  
2. Missing sell: `Sell = round2(Cost ÷ (1 − GrossMargin/100))`.  
3. Gross margin primary; default **20%**; bounds **0–95%**.  
4. Markup is a **derived metric** only (`GP ÷ Cost`), not a sell driver.  
5. Waste adjusts **quantity before money**.  
6. Line money: round each line to **2 dp**, then sum, then GST once on sell subtotal.  
7. NZ GST default **15%** on document sell subtotal.  
8. Lump sums supported; credits/discounts **out of Stage 2B**.  
9. Sent/accepted quotes are **immutable snapshots**.  
10. Builder is final authority; AI never silently overwrites manuals.

### Notation

`round2(x)` = round to 2 decimal places (currency / committed %).  
`GP = round2(sell − cost)` · `Margin% = sell>0 ? round2(GP/sell×100) : 0` · `Markup% = cost>0 ? round2(GP/cost×100) : 0`  
`GST = round2(sellSubtotal × gstRate/100)` · `Incl = round2(sellSubtotal + GST)`

### Scenario index (52)

| ID | Title | Primary categories |
| --- | --- | --- |
| CCS-001 | Decking boards quantity × rate | A |
| CCS-002 | Deck labour productivity | B, C |
| CCS-003 | Decking with 10% waste | A, C |
| CCS-004 | Bathroom tiling labour + materials | C |
| CCS-005 | Kitchen install with electrician subcontractor | D |
| CCS-006 | Soft-strip demolition lump sum | E |
| CCS-007 | Tile selection allowance | F |
| CCS-008 | Electrical provisional sum | G |
| CCS-009 | Client-supplied fixtures no charge | H |
| CCS-010 | Informational existing structure note | I |
| CCS-011 | Travel to regional site | J |
| CCS-012 | Airport airside induction loading | K |
| CCS-013 | Occupied apartment bathroom | L, C |
| CCS-014 | Poor rear-access deck | M, B |
| CCS-015 | Restricted hours school holiday work | N |
| CCS-016 | Long material carry up stairs | O |
| CCS-017 | Steep hillside retaining | P, D |
| CCS-018 | Multi–work-area outdoor package | Q, C |
| CCS-019 | Quote revision after scope change | R, S |
| CCS-020 | Historical quote after rate rise | S |
| CCS-021 | Document GST 15% standard | T |
| CCS-022 | Document GST rate must follow document not hardcoded | T |
| CCS-023 | Estimate target margin override 25% | U |
| CCS-024 | Mixed effective margins on Final Pricing | V |
| CCS-025 | Estimate low / expected / high bands | W |
| CCS-026 | Builder corrects AI-suggested labour hours | X |
| CCS-027 | Fence labour-only | B, Y |
| CCS-028 | Material-only plasterboard supply | A, Y |
| CCS-029 | Subcontractor-only plumbing | D, Y |
| CCS-030 | GIB stopping + painting package | C, Z |
| CCS-031 | Timber framing quantity × rate | A |
| CCS-032 | Steel portal supply & erect (sub + labour) | D |
| CCS-033 | Concrete pad quantity × rate | A |
| CCS-034 | Window install productivity | B |
| CCS-035 | Exterior cladding labour + materials | C |
| CCS-036 | Roofing iron with waste | A, C |
| CCS-037 | Flooring vinyl with waste | A |
| CCS-038 | Commercial office fitout multi-trade | Q, D, Z |
| CCS-039 | Site establishment lump sum | E, J |
| CCS-040 | Variation: add pergola to deck job | R, C |
| CCS-041 | Zero quantity lump-sum preliminaries | E |
| CCS-042 | Sell-only lump sum (cost unknown) | E |
| CCS-043 | Reject negative credit attempt | validation |
| CCS-044 | Margin bound rejection at 96% | validation |
| CCS-045 | Hidden pricing line vs quote visibility | Q, R |
| CCS-046 | Recalibration preserves manual edit | X, U |
| CCS-047 | Scaffold hire lump sum cost+sell | E |
| CCS-048 | Contingency allowance line | F |
| CCS-049 | Extension framing + GIB + paint | Q, C, Z |
| CCS-050 | Night/weekend work as manual allowance (deferred product) | N, F, Z |
| CCS-051 | Small bathroom minimum labour floor | B, Y |
| CCS-052 | Company DNA candidate: repeated fencing uplift | Y, Z, X |

---

## Shared helper scenarios fields

Unless stated otherwise:

* **GST rate:** 15%  
* **Company default margin:** 20%  
* **Currency:** NZD GST-exclusive lines  
* **Range factors (where used):** low 0.90 · high 1.15  

Detailed numeric expected results for every scenario live in `GOLDEN_PRICING_EXPECTED_RESULTS.md`. Scenario bodies below carry the commercial story, inputs, and reasoning; they cross-reference golden IDs.

---

## CCS-001 — Decking boards quantity × rate

| Field | Value |
| --- | --- |
| **Scenario ID** | CCS-001 |
| **Category** | A |
| **Difficulty** | Basic |
| **Project Type** | Residential outdoor |
| **Work Area** | Decking |
| **Customer Context** | Auckland homeowner, new hardwood deck surface only |
| **Builder Notes** | Company has kwila rate card; sell derived from 20% margin |
| **Facts** | Area priced as 55 lm of board (already measured) |
| **Constraints** | Standard access |
| **Pricing Inputs** | Mode `quantity_rate`; qty 55 lm; unit cost $42.00; unit sell derived @ 20% → $52.50 |
| **Commercial Assumptions** | Waste already in measured lm; no delivery line |
| **Expected Line Calculations** | See golden CCS-001 |
| **Expected Work Area Totals** | Same as line (single line) |
| **Expected Project Totals** | Same |
| **GST** | On project sell @ 15% |
| **Margin** | 20% on line |
| **Warnings** | None |
| **Manual Overrides** | None |
| **Explanation** | Quantity × cost/sell rates; sell from margin formula |
| **Commercial Reasoning** | Builders price decking by lineal metre of board at known cost and target margin |
| **Future Learning Hooks** | Company lm rate vs outcomes; wastage later |
| **Coverage Tags** | `qty_rate`, `sell_from_margin`, `gst_doc`, `deck` |

---

## CCS-002 — Deck labour productivity

| Field | Value |
| --- | --- |
| **Scenario ID** | CCS-002 |
| **Category** | B, C |
| **Difficulty** | Intermediate |
| **Project Type** | Residential outdoor |
| **Work Area** | Decking |
| **Customer Context** | Same deck; labour only for this scenario |
| **Builder Notes** | 1.2 hrs/m² company productivity; carpenter $65/hr cost |
| **Facts** | Deck area 40 m² |
| **Constraints** | Standard access |
| **Pricing Inputs** | Mode `productivity_labour`; qty 40; productivity 1.2 hrs/m²; unit cost $65/hr; unit sell derived @ 20% → $81.25 |
| **Commercial Assumptions** | Hours = qty × productivity; cost/sell = hours × hourly rates; margin not applied twice |
| **Expected Line / WA / Project** | See golden CCS-002 |
| **GST** | 15% on sell |
| **Margin** | 20% |
| **Warnings** | None |
| **Manual Overrides** | None |
| **Explanation** | Productivity → hours → hourly cost/sell |
| **Commercial Reasoning** | Experienced builders estimate labour from area productivity then apply charge-out or margin on cost |
| **Future Learning Hooks** | Productivity DNA; access-adjusted hours later |
| **Coverage Tags** | `productivity`, `labour`, `sell_from_margin`, `deck` |

---

## CCS-003 — Decking with 10% waste

| Field | Value |
| --- | --- |
| **Scenario ID** | CCS-003 |
| **Category** | A, C |
| **Difficulty** | Intermediate |
| **Project Type** | Residential outdoor |
| **Work Area** | Decking |
| **Customer Context** | Material order includes cutting waste |
| **Builder Notes** | Company decking wastage 10% |
| **Facts** | Net board requirement 100 lm |
| **Constraints** | None |
| **Pricing Inputs** | Waste → qty 110 lm; unit cost $8.00; unit sell @ 20% → $10.00 |
| **Commercial Assumptions** | Waste on quantity only, before money |
| **Expected Line / WA / Project** | See golden CCS-003 |
| **GST** | 15% |
| **Margin** | 20% |
| **Warnings** | Optional: wastage applied 10% |
| **Manual Overrides** | None |
| **Explanation** | qty_net = round2(100 × 1.10) then qty × rates |
| **Commercial Reasoning** | Ordering always overshoots net measure; waste is not a second margin |
| **Future Learning Hooks** | Company wastage % by material |
| **Coverage Tags** | `waste`, `qty_rate`, `materials` |

---

## CCS-004 — Bathroom tiling labour + materials

| Field | Value |
| --- | --- |
| **Scenario ID** | CCS-004 |
| **Category** | C |
| **Difficulty** | Intermediate |
| **Project Type** | Residential renovation |
| **Work Area** | Bathroom |
| **Customer Context** | Remuera ensuite re-tile |
| **Builder Notes** | Separate labour and tile supply lines |
| **Facts** | Tile area 12 m² |
| **Constraints** | Occupied home — see also CCS-013 pattern; this scenario standard hours |
| **Pricing Inputs** | L1 labour productivity: 12 m² × 2.0 hrs/m²; $70 cost → sell @$87.50. L2 materials: 12 m² × $55 cost → sell @$68.75 |
| **Commercial Assumptions** | 20% margin both lines |
| **Expected Totals** | Sum of two lines; GST on combined sell — golden CCS-004 |
| **GST** | 15% |
| **Margin** | Blended from totals |
| **Warnings** | None |
| **Manual Overrides** | None |
| **Explanation** | Material + labour package, one margin rule |
| **Commercial Reasoning** | Bathroom quotes almost always split labour and tile supply |
| **Future Learning Hooks** | Bathroom $/m² company norms |
| **Coverage Tags** | `bathroom`, `labour`, `materials`, `aggregate` |

---

## CCS-005 — Kitchen with electrician subcontractor

| Field | Value |
| --- | --- |
| **Scenario ID** | CCS-005 |
| **Category** | D |
| **Difficulty** | Intermediate |
| **Project Type** | Residential renovation |
| **Work Area** | Kitchen |
| **Customer Context** | Full kitchen refresh; electrical by subbie |
| **Builder Notes** | Subbie quote known; priced with same margin rule (no special uplift product yet) |
| **Facts** | Cabinetry labour lump known; electrical sub cost $4,200 |
| **Constraints** | None |
| **Pricing Inputs** | L1 labour lump cost $6,400 sell $8,000; L2 materials $5,000/$6,250; L3 subcontractor cost $4,200 sell derived $5,250 |
| **Commercial Assumptions** | Subcontractor uses gross margin like other lines (OCD-10 deferred special uplift) |
| **Expected Totals** | Golden CCS-005 |
| **GST** | 15% |
| **Margin** | Blended |
| **Warnings** | None |
| **Manual Overrides** | None |
| **Explanation** | Mixed trade + sub on one job |
| **Commercial Reasoning** | Builder marks up or margins subbie invoices into the client sell |
| **Future Learning Hooks** | Subcontractor uplift DNA later |
| **Coverage Tags** | `kitchen`, `subcontractor`, `lump_sum`, `margin` |

---

## CCS-006 — Soft-strip demolition lump sum

| Field | Value |
| --- | --- |
| **Scenario ID** | CCS-006 |
| **Category** | E |
| **Difficulty** | Basic |
| **Project Type** | Residential renovation |
| **Work Area** | Demolition |
| **Customer Context** | Soft strip kitchen/bath before remodel |
| **Builder Notes** | Priced as experience-based lump |
| **Facts** | Single soft-strip package |
| **Constraints** | Skip bin included in lump |
| **Pricing Inputs** | Mode lump_sum; cost $2,800; sell $3,500 |
| **Commercial Assumptions** | Qty not required |
| **Expected Totals** | Golden CCS-006 |
| **GST** | 15% |
| **Margin** | Derived 20% |
| **Warnings** | None |
| **Manual Overrides** | None |
| **Explanation** | Lump cost+sell; metrics derived |
| **Commercial Reasoning** | Soft strip is rarely perfect qty×rate; builders use lumps |
| **Future Learning Hooks** | Soft-strip $/m² later vs lump |
| **Coverage Tags** | `lump_sum`, `demolition` |

---

## CCS-007 — Tile selection allowance

| Field | Value |
| --- | --- |
| **Scenario ID** | CCS-007 |
| **Category** | F |
| **Difficulty** | Basic |
| **Project Type** | Residential bathroom |
| **Work Area** | Bathroom |
| **Customer Context** | Client undecided on tile |
| **Builder Notes** | Allowance for supply only |
| **Facts** | Allowance $80/m² × 12 m² |
| **Constraints** | None |
| **Pricing Inputs** | qty_rate or lump equivalent: cost $960; sell $1,200 (20%) |
| **Commercial Assumptions** | Allowance is real money in total until selections finalise |
| **Expected Totals** | Golden CCS-007 |
| **GST** | 15% |
| **Margin** | 20% |
| **Warnings** | Allowance — final selection may vary |
| **Manual Overrides** | None |
| **Explanation** | Allowance priced into expected total |
| **Commercial Reasoning** | Stops underquoting while selection open |
| **Future Learning Hooks** | Allowance vs actual selection spend |
| **Coverage Tags** | `allowance`, `bathroom` |

---

## CCS-008 — Electrical provisional sum

| Field | Value |
| --- | --- |
| **Scenario ID** | CCS-008 |
| **Category** | G |
| **Difficulty** | Intermediate |
| **Project Type** | Residential extension |
| **Work Area** | Electrical |
| **Customer Context** | Extension; electrical design incomplete |
| **Builder Notes** | Treat as allowance/lump until firm quote (no distinct provisional engine required for MVP) |
| **Facts** | Provisional $4,000 sell; estimated cost $3,200 |
| **Constraints** | Must be labelled provisional in assumptions |
| **Pricing Inputs** | Lump cost $3,200 sell $4,000 |
| **Commercial Assumptions** | Affects document total if included/visible |
| **Expected Totals** | Golden CCS-008 |
| **GST** | 15% |
| **Margin** | 20% |
| **Warnings** | Provisional — subject to redesign |
| **Manual Overrides** | None |
| **Explanation** | Provisional = priced contingency of scope |
| **Commercial Reasoning** | NZ residential practice uses PS/PC sums openly |
| **Future Learning Hooks** | Provisional → actual variance |
| **Coverage Tags** | `provisional`, `allowance`, `lump_sum` |

---

## CCS-009 — Client-supplied fixtures no charge

| Field | Value |
| --- | --- |
| **Scenario ID** | CCS-009 |
| **Category** | H |
| **Difficulty** | Basic |
| **Project Type** | Residential bathroom |
| **Work Area** | Bathroom |
| **Customer Context** | Client supplies vanity and tapware |
| **Builder Notes** | Show inclusion at $0 so scope is clear |
| **Facts** | Install labour priced separately (not in this line) |
| **Constraints** | None |
| **Pricing Inputs** | Lump cost $0 sell $0; label included-at-no-charge |
| **Commercial Assumptions** | Zero intentional |
| **Expected Totals** | $0 contribution; no GST on zero sell |
| **GST** | $0 from this line |
| **Margin** | 0 (sell 0) |
| **Warnings** | Included at no charge — client supply |
| **Manual Overrides** | None |
| **Explanation** | Zero-value permitted when intentional |
| **Commercial Reasoning** | Prevents double-charging client-supplied goods |
| **Future Learning Hooks** | Frequency of client-supply |
| **Coverage Tags** | `no_charge`, `zero_value` |

---

## CCS-010 — Informational existing structure note

| Field | Value |
| --- | --- |
| **Scenario ID** | CCS-010 |
| **Category** | I |
| **Difficulty** | Basic |
| **Project Type** | Residential deck |
| **Work Area** | Decking |
| **Customer Context** | Existing piles retained |
| **Builder Notes** | Informational line; may be hidden from quote |
| **Facts** | “Existing piles retained — inspected OK” |
| **Constraints** | None |
| **Pricing Inputs** | $0/$0; not visible on quote |
| **Commercial Assumptions** | Does not affect totals |
| **Expected Totals** | No money impact |
| **GST** | N/A |
| **Margin** | N/A |
| **Warnings** | Informational only |
| **Manual Overrides** | None |
| **Explanation** | Scope clarity without money |
| **Commercial Reasoning** | Stops client assuming piles are in price |
| **Future Learning Hooks** | Scope communication patterns |
| **Coverage Tags** | `informational`, `zero_value`, `visibility` |

---

## CCS-011 — Travel to regional site

| Field | Value |
| --- | --- |
| **Scenario ID** | CCS-011 |
| **Category** | J |
| **Difficulty** | Basic |
| **Project Type** | Residential remote |
| **Work Area** | Preliminaries |
| **Customer Context** | Job 90 minutes from yard |
| **Builder Notes** | Travel as explicit allowance (not buried) |
| **Facts** | 2 trips × crew day travel |
| **Constraints** | Distance |
| **Pricing Inputs** | Lump cost $480 sell $600 |
| **Commercial Assumptions** | Explicit line preferred over hidden rate loading (OCD-56) |
| **Expected Totals** | Golden CCS-011 |
| **GST** | 15% |
| **Margin** | 20% |
| **Warnings** | Travel allowance |
| **Manual Overrides** | None |
| **Explanation** | Commercial loading as visible money |
| **Commercial Reasoning** | Clients accept travel when shown; burying erodes trust |
| **Future Learning Hooks** | Travel $/km DNA |
| **Coverage Tags** | `travel`, `allowance`, `lump_sum` |

---

## CCS-012 — Airport airside induction loading

| Field | Value |
| --- | --- |
| **Scenario ID** | CCS-012 |
| **Category** | K |
| **Difficulty** | Advanced |
| **Project Type** | Commercial / aviation precinct |
| **Work Area** | Preliminaries |
| **Customer Context** | Small fitout near airside; induction + escorts |
| **Builder Notes** | Manual allowance for security/induction (full OT product deferred) |
| **Facts** | Escort days known |
| **Constraints** | Airport security |
| **Pricing Inputs** | Lump cost $1,600 sell $2,000 |
| **Commercial Assumptions** | Explicit loading line |
| **Expected Totals** | Golden CCS-012 |
| **GST** | 15% |
| **Margin** | 20% |
| **Warnings** | Airport / security loading |
| **Manual Overrides** | None |
| **Explanation** | High-friction sites need visible prelims |
| **Commercial Reasoning** | Airport work burns unpaid hours if not allowed |
| **Future Learning Hooks** | Airport loading DNA |
| **Coverage Tags** | `airport`, `allowance`, `constraint_loading` |

---

## CCS-013 — Occupied apartment bathroom

| Field | Value |
| --- | --- |
| **Scenario ID** | CCS-013 |
| **Category** | L, C |
| **Difficulty** | Advanced |
| **Project Type** | Residential occupied |
| **Work Area** | Bathroom |
| **Customer Context** | Client living in apartment during works |
| **Builder Notes** | Protection + reduced productivity expressed as labour hours uplift via manual productivity or allowance |
| **Facts** | Base labour hours 24; occupied uplift +20% hours → 28.8 hrs |
| **Constraints** | Occupied building |
| **Pricing Inputs** | Productivity/hours 28.8; $70/$87.50; materials separate $1,100/$1,375 |
| **Commercial Assumptions** | Constraint impacts hours or allowance — not silent |
| **Expected Totals** | Golden CCS-013 |
| **GST** | 15% |
| **Margin** | ~20% |
| **Warnings** | Occupied building — productivity adjusted |
| **Manual Overrides** | Hours uplift manual |
| **Explanation** | Occupied work costs more labour time |
| **Commercial Reasoning** | Protection, limited hours, client presence slow crews |
| **Future Learning Hooks** | Occupied-site productivity DNA |
| **Coverage Tags** | `occupied`, `productivity`, `bathroom`, `override` |

---

## CCS-014 — Poor rear-access deck

| Field | Value |
| --- | --- |
| **Scenario ID** | CCS-014 |
| **Category** | M, B |
| **Difficulty** | Intermediate |
| **Project Type** | Residential outdoor |
| **Work Area** | Decking |
| **Customer Context** | No vehicle access; long carry |
| **Builder Notes** | Prefer explicit access allowance **or** documented hour factor; scenario uses +10% labour hours |
| **Facts** | Base hours 48; poor access → 52.8 hrs |
| **Constraints** | Poor access |
| **Pricing Inputs** | 52.8 hrs × $65/$81.25 |
| **Commercial Assumptions** | Many constraints may be capture-only today — this scenario defines **desired** priced behaviour when access is applied |
| **Expected Totals** | Golden CCS-014 |
| **GST** | 15% |
| **Margin** | 20% |
| **Warnings** | Poor access labour adjustment |
| **Manual Overrides** | Factor applied |
| **Explanation** | Access changes labour, not material rates |
| **Commercial Reasoning** | Wheelbarrow runs destroy productivity |
| **Future Learning Hooks** | Access → productivity DNA (**high**) |
| **Coverage Tags** | `poor_access`, `productivity`, `deck`, `dna_candidate` |

---

## CCS-015 — Restricted hours (school holiday window)

| Field | Value |
| --- | --- |
| **Scenario ID** | CCS-015 |
| **Category** | N |
| **Difficulty** | Intermediate |
| **Project Type** | Education-adjacent residential |
| **Work Area** | Preliminaries / labour |
| **Customer Context** | Work only during school holidays |
| **Builder Notes** | Compression premium as allowance (OT engine deferred) |
| **Facts** | Two-week window |
| **Constraints** | Restricted hours |
| **Pricing Inputs** | Allowance lump cost $900 sell $1,125 |
| **Commercial Assumptions** | Explicit commercial loading |
| **Expected Totals** | Golden CCS-015 |
| **GST** | 15% |
| **Margin** | 20% |
| **Warnings** | Restricted hours loading |
| **Manual Overrides** | None |
| **Explanation** | Time windows have a price |
| **Commercial Reasoning** | Crews reshuffled; overtime risk |
| **Future Learning Hooks** | Restricted-hours loadings |
| **Coverage Tags** | `restricted_hours`, `allowance` |

---

## CCS-016 — Long material carry

| Field | Value |
| --- | --- |
| **Scenario ID** | CCS-016 |
| **Category** | O |
| **Difficulty** | Intermediate |
| **Project Type** | Residential multi-storey |
| **Work Area** | Preliminaries |
| **Customer Context** | Third-floor apartment; no lift for materials |
| **Builder Notes** | Carry allowance |
| **Facts** | Multiple storeys |
| **Constraints** | Long carry |
| **Pricing Inputs** | Lump $640/$800 |
| **Commercial Assumptions** | Visible prelim |
| **Expected Totals** | Golden CCS-016 |
| **GST** | 15% |
| **Margin** | 20% |
| **Warnings** | Long carry |
| **Manual Overrides** | None |
| **Explanation** | Logistics line |
| **Commercial Reasoning** | Carry time is real cost |
| **Future Learning Hooks** | Carry loadings by storey |
| **Coverage Tags** | `long_carry`, `allowance` |

---

## CCS-017 — Steep hillside retaining

| Field | Value |
| --- | --- |
| **Scenario ID** | CCS-017 |
| **Category** | P, D |
| **Difficulty** | Advanced |
| **Project Type** | Residential earthworks/structures |
| **Work Area** | Retaining wall |
| **Customer Context** | Steep backyard timber retaining |
| **Builder Notes** | Labour hours uplift + excavator sub |
| **Facts** | Face 30 m²; steep factor on labour |
| **Constraints** | Steep site |
| **Pricing Inputs** | Labour hours adjusted; materials qty×rate; excavator sub lump $2,400/$3,000 |
| **Commercial Assumptions** | Steep affects labour productivity primarily |
| **Expected Totals** | Golden CCS-017 |
| **GST** | 15% |
| **Margin** | Blended |
| **Warnings** | Steep site labour adjustment |
| **Manual Overrides** | Hours factor |
| **Explanation** | Terrain changes labour and plant |
| **Commercial Reasoning** | Steep sites need more crew effort and machine time |
| **Future Learning Hooks** | Slope → hours DNA |
| **Coverage Tags** | `steep_site`, `retaining`, `subcontractor`, `productivity` |

---

## CCS-018 — Multi–work-area outdoor package

| Field | Value |
| --- | --- |
| **Scenario ID** | CCS-018 |
| **Category** | Q, C |
| **Difficulty** | Intermediate |
| **Project Type** | Residential outdoor |
| **Work Area** | Deck + Fence + Pergola |
| **Customer Context** | Combined outdoor living package |
| **Builder Notes** | Three confirmed work areas; aggregate project total |
| **Facts** | Three WA priced independently then summed |
| **Constraints** | Standard |
| **Pricing Inputs** | WA Deck sell $12,000 cost $9,600; Fence $4,000/$3,200; Pergola $7,000/$5,600 |
| **Commercial Assumptions** | Project total = sum WA; GST once at project/document |
| **Expected Totals** | Golden CCS-018 |
| **GST** | 15% on $23,000 |
| **Margin** | 20% overall |
| **Warnings** | None |
| **Manual Overrides** | None |
| **Explanation** | Multi-area aggregation |
| **Commercial Reasoning** | Clients buy packages; builders still cost by trade area |
| **Future Learning Hooks** | Package vs area performance |
| **Coverage Tags** | `multi_work_area`, `aggregate`, `outdoor` |

---

## CCS-019 — Quote revision after scope change

| Field | Value |
| --- | --- |
| **Scenario ID** | CCS-019 |
| **Category** | R, S |
| **Difficulty** | Intermediate |
| **Project Type** | Residential outdoor |
| **Work Area** | Deck (+ remove pergola) |
| **Customer Context** | Client drops pergola after quote v1 sent |
| **Builder Notes** | Create quote revision v2; v1 immutable |
| **Facts** | v1 included pergola $7,000 sell; v2 removes it |
| **Constraints** | None |
| **Pricing Inputs** | v2 project sell = previous − 7,000 |
| **Commercial Assumptions** | New revision required; old snapshot unchanged |
| **Expected Totals** | Golden CCS-019 |
| **GST** | Recalc on v2 only |
| **Margin** | Recalc v2 |
| **Warnings** | Revision of prior offer |
| **Manual Overrides** | None |
| **Explanation** | Revision ≠ overwrite |
| **Commercial Reasoning** | Sent offers are contractual memory |
| **Future Learning Hooks** | Scope-change patterns |
| **Coverage Tags** | `quote_revision`, `snapshot`, `immutability` |

---

## CCS-020 — Historical quote after company rate rise

| Field | Value |
| --- | --- |
| **Scenario ID** | CCS-020 |
| **Category** | S |
| **Difficulty** | Intermediate |
| **Project Type** | Any |
| **Work Area** | Historical quote |
| **Customer Context** | Quote accepted last month; labour rates rise this month |
| **Builder Notes** | Must not rewrite accepted quote |
| **Facts** | Accepted quote subtotal $18,000 excl |
| **Constraints** | N/A |
| **Pricing Inputs** | Company carpenter cost now +$5/hr |
| **Commercial Assumptions** | Snapshot immutable (OCD-45) |
| **Expected Totals** | Historical totals **unchanged** |
| **GST** | Historical GST unchanged |
| **Margin** | Historical unchanged |
| **Warnings** | None on historical; new jobs use new rates |
| **Manual Overrides** | None |
| **Explanation** | Settings changes do not mutate history |
| **Commercial Reasoning** | You cannot reprice a signed deal silently |
| **Future Learning Hooks** | Rate evolution vs locked deals |
| **Coverage Tags** | `snapshot`, `immutability`, `rates_change` |

---

## CCS-021 — Standard NZ GST 15%

| Field | Value |
| --- | --- |
| **Scenario ID** | CCS-021 |
| **Category** | T |
| **Difficulty** | Basic |
| **Project Type** | Any |
| **Work Area** | Document totals |
| **Customer Context** | Standard NZ residential quote |
| **Builder Notes** | Document gst_rate 15 |
| **Facts** | Sell subtotal $10,000 |
| **Constraints** | None |
| **Pricing Inputs** | Aggregate only |
| **Commercial Assumptions** | GST once at document |
| **Expected Totals** | GST $1,500; incl $11,500 |
| **GST** | 15% |
| **Margin** | N/A (aggregate demo) |
| **Warnings** | None |
| **Manual Overrides** | None |
| **Explanation** | Classic NZ GST arithmetic |
| **Commercial Reasoning** | Matches IRD-style exclusive quoting |
| **Future Learning Hooks** | None |
| **Coverage Tags** | `gst`, `aggregate` |

---

## CCS-022 — Document GST rate authoritative (bug-target)

| Field | Value |
| --- | --- |
| **Scenario ID** | CCS-022 |
| **Category** | T |
| **Difficulty** | Intermediate |
| **Project Type** | Any |
| **Work Area** | Final Pricing create |
| **Customer Context** | Company GST setting 15% (also protects non-15 cases) |
| **Builder Notes** | **Desired:** recalc uses **document** gst_rate. **Defect today:** hardcoded 15 after create (OCD-GST) — golden defines desired truth |
| **Facts** | Document gst_rate = 15; sell subtotal $8,000 |
| **Constraints** | None |
| **Pricing Inputs** | Must use document rate variable, not literal constant in logic |
| **Commercial Assumptions** | Engine/document rate is source of truth |
| **Expected Totals** | GST from document rate only |
| **GST** | Document rate |
| **Margin** | Unaffected |
| **Warnings** | None when consistent |
| **Manual Overrides** | None |
| **Explanation** | Prevents label/amount mismatch |
| **Commercial Reasoning** | Tax % on the document must match tax $ |
| **Future Learning Hooks** | Settings trust |
| **Coverage Tags** | `gst`, `document_rate`, `regression_bug_C28` |

---

## CCS-023 — Estimate target margin 25%

| Field | Value |
| --- | --- |
| **Scenario ID** | CCS-023 |
| **Category** | U |
| **Difficulty** | Intermediate |
| **Project Type** | Residential |
| **Work Area** | Whole estimate |
| **Customer Context** | Tight site; builder lifts target margin |
| **Builder Notes** | Target margin override recomputes sells from costs |
| **Facts** | Total cost $20,000 |
| **Constraints** | None |
| **Pricing Inputs** | Target margin 25% → sell = 20000/0.75 = 26666.67 |
| **Commercial Assumptions** | Override retained until cleared; regenerate reapplies if stored |
| **Expected Totals** | Golden CCS-023 |
| **GST** | If progressed to pricing, 15% on sell |
| **Margin** | 25% |
| **Warnings** | Target margin override active |
| **Manual Overrides** | Target margin 25% |
| **Explanation** | Job-level margin lever |
| **Commercial Reasoning** | Riskier jobs need more margin |
| **Future Learning Hooks** | Override frequency by job type |
| **Coverage Tags** | `margin_override`, `estimate` |

---

## CCS-024 — Mixed effective margins on Final Pricing

| Field | Value |
| --- | --- |
| **Scenario ID** | CCS-024 |
| **Category** | V |
| **Difficulty** | Advanced |
| **Project Type** | Residential |
| **Work Area** | Mixed |
| **Customer Context** | Negotiated glass balustrade sell; labour at company margin |
| **Builder Notes** | Line edits win; derived margins differ per line |
| **Facts** | L1 labour cost 4000 sell 5000 (20%); L2 glass cost 3000 sell 3300 (~9.09%) |
| **Constraints** | None |
| **Pricing Inputs** | Manual sell on glass |
| **Commercial Assumptions** | OCD-16: lines need not share one locked margin |
| **Expected Totals** | Golden CCS-024 |
| **GST** | 15% on combined sell |
| **Margin** | Blended ~15.66% |
| **Warnings** | Mixed margins |
| **Manual Overrides** | Glass sell |
| **Explanation** | Negotiation creates mixed margins |
| **Commercial Reasoning** | Real quotes are not uniform margin |
| **Future Learning Hooks** | Negotiation patterns |
| **Coverage Tags** | `mixed_margin`, `manual_override`, `final_pricing` |

---

## CCS-025 — Estimate range bands

| Field | Value |
| --- | --- |
| **Scenario ID** | CCS-025 |
| **Category** | W |
| **Difficulty** | Intermediate |
| **Project Type** | Residential |
| **Work Area** | Estimate summary |
| **Customer Context** | Early guidance before Final Pricing |
| **Builder Notes** | Budget 0.90 / premium 1.15 on recommended |
| **Facts** | Recommended sell $50,000; cost $40,000 |
| **Constraints** | None |
| **Pricing Inputs** | Range factors |
| **Commercial Assumptions** | Ranges are guidance; quotes use final only (OCD-39) |
| **Expected Totals** | sell low 45000; high 57500; cost low 36000; high 46000 |
| **GST** | Not applied on internal estimate bands in this scenario |
| **Margin** | 20% on recommended |
| **Warnings** | Range is guidance not a firm offer |
| **Manual Overrides** | None |
| **Explanation** | Document-level factors |
| **Commercial Reasoning** | Early jobs need a band before selections lock |
| **Future Learning Hooks** | Calibrate factors |
| **Coverage Tags** | `estimate_range`, `confidence_separate` |

---

## CCS-026 — Builder corrects AI-suggested hours

| Field | Value |
| --- | --- |
| **Scenario ID** | CCS-026 |
| **Category** | X |
| **Difficulty** | Intermediate |
| **Project Type** | Residential |
| **Work Area** | Decking |
| **Customer Context** | AI/productivity suggested 48 hrs; builder knows site needs 56 |
| **Builder Notes** | Manual hours override preserved |
| **Facts** | Corrected hours 56 |
| **Constraints** | None |
| **Pricing Inputs** | 56 × $65/$81.25 |
| **Commercial Assumptions** | AI must not silently revert |
| **Expected Totals** | Golden CCS-026 |
| **GST** | 15% |
| **Margin** | 20% |
| **Warnings** | Manual labour hours override |
| **Manual Overrides** | Hours 56 |
| **Explanation** | Human correction wins |
| **Commercial Reasoning** | Local knowledge beats generic productivity |
| **Future Learning Hooks** | Correction → DNA evidence (not auto-write) |
| **Coverage Tags** | `builder_correction`, `override`, `ai_non_authority`, `dna_candidate` |

---

## CCS-027 — Fence labour-only

| Field | Value |
| --- | --- |
| **Scenario ID** | CCS-027 |
| **Category** | B, Y |
| **Difficulty** | Basic |
| **Project Type** | Residential fencing |
| **Work Area** | Fence |
| **Customer Context** | Labour only; client supplies palings |
| **Builder Notes** | 0.6 hrs/lm × 40 lm |
| **Facts** | 40 lm fence |
| **Constraints** | None |
| **Pricing Inputs** | 24 hrs × $60/$75 |
| **Commercial Assumptions** | Labour-only job |
| **Expected Totals** | Golden CCS-027 |
| **GST** | 15% |
| **Margin** | 20% |
| **Warnings** | Client supplies materials |
| **Manual Overrides** | None |
| **Explanation** | Labour-only commercial shape |
| **Commercial Reasoning** | Common when DIY materials |
| **Future Learning Hooks** | Labour-only margins |
| **Coverage Tags** | `labour_only`, `fence`, `productivity` |

---

## CCS-028 — Material-only plasterboard supply

| Field | Value |
| --- | --- |
| **Scenario ID** | CCS-028 |
| **Category** | A, Y |
| **Difficulty** | Basic |
| **Project Type** | Residential |
| **Work Area** | Internal walls |
| **Customer Context** | Supply only; separate installer |
| **Builder Notes** | Sheets with waste ceil semantics represented as qty 22 sheets |
| **Facts** | 22 sheets |
| **Constraints** | None |
| **Pricing Inputs** | 22 × $28 cost / $35 sell |
| **Commercial Assumptions** | Material-only |
| **Expected Totals** | Golden CCS-028 |
| **GST** | 15% |
| **Margin** | 20% |
| **Warnings** | Supply only |
| **Manual Overrides** | None |
| **Explanation** | Qty × material rates |
| **Commercial Reasoning** | Merchants/builders often supply only |
| **Future Learning Hooks** | Supply-only GP |
| **Coverage Tags** | `material_only`, `gib`, `qty_rate` |

---

## CCS-029 — Subcontractor-only plumbing

| Field | Value |
| --- | --- |
| **Scenario ID** | CCS-029 |
| **Category** | D, Y |
| **Difficulty** | Basic |
| **Project Type** | Residential |
| **Work Area** | Plumbing |
| **Customer Context** | Entire trade subcontracted |
| **Builder Notes** | Single sub line |
| **Facts** | Sub invoice $6,000 |
| **Constraints** | None |
| **Pricing Inputs** | Cost 6000 sell 7500 |
| **Commercial Assumptions** | Margin on sub |
| **Expected Totals** | Golden CCS-029 |
| **GST** | 15% |
| **Margin** | 20% |
| **Warnings** | Subcontractor-only scope |
| **Manual Overrides** | None |
| **Explanation** | Pure sub pass-through with margin |
| **Commercial Reasoning** | Project managers often only manage subs |
| **Future Learning Hooks** | Sub-only jobs |
| **Coverage Tags** | `subcontractor_only`, `plumbing` |

---

## CCS-030 — GIB stopping + painting

| Field | Value |
| --- | --- |
| **Scenario ID** | CCS-030 |
| **Category** | C, Z |
| **Difficulty** | Intermediate |
| **Project Type** | Residential interior |
| **Work Area** | Ceilings / Painting |
| **Customer Context** | New linings finish |
| **Builder Notes** | Two related trades |
| **Facts** | 80 m² |
| **Constraints** | None |
| **Pricing Inputs** | Stopping 80×$18/$22.50; paint 80×$12/$15 |
| **Commercial Assumptions** | 20% |
| **Expected Totals** | Golden CCS-030 |
| **GST** | 15% |
| **Margin** | 20% |
| **Warnings** | None |
| **Manual Overrides** | None |
| **Explanation** | Finish trades package |
| **Commercial Reasoning** | Often tendered together |
| **Future Learning Hooks** | Interior finish $/m² DNA |
| **Coverage Tags** | `gib`, `painting`, `dna_candidate` |

---

## CCS-031 — Timber framing quantity × rate

| Field | Value |
| --- | --- |
| **Scenario ID** | CCS-031 |
| **Category** | A |
| **Difficulty** | Basic |
| **Project Type** | Residential extension |
| **Work Area** | Framing |
| **Customer Context** | Single-storey timber frame walls |
| **Builder Notes** | Scope rate $/m² wall |
| **Facts** | 45 m² wall framing |
| **Constraints** | None |
| **Pricing Inputs** | 45 × $95 cost / $118.75 sell |
| **Commercial Assumptions** | 20% |
| **Expected Totals** | Golden CCS-031 |
| **GST** | 15% |
| **Margin** | 20% |
| **Warnings** | None |
| **Manual Overrides** | None |
| **Explanation** | Classic qty×rate |
| **Commercial Reasoning** | Framing often scoped per wall m² |
| **Future Learning Hooks** | Framing rates |
| **Coverage Tags** | `timber_framing`, `qty_rate` |

---

## CCS-032 — Steel portal supply & erect

| Field | Value |
| --- | --- |
| **Scenario ID** | CCS-032 |
| **Category** | D |
| **Difficulty** | Advanced |
| **Project Type** | Light commercial / residential garage |
| **Work Area** | Steel |
| **Customer Context** | Portal frame garage |
| **Builder Notes** | Steel fab sub + on-site labour |
| **Facts** | Known fab quote |
| **Constraints** | Crane access OK |
| **Pricing Inputs** | Sub $12,000/$15,000; labour lump $3,200/$4,000 |
| **Commercial Assumptions** | 20% |
| **Expected Totals** | Golden CCS-032 |
| **GST** | 15% |
| **Margin** | 20% |
| **Warnings** | None |
| **Manual Overrides** | None |
| **Explanation** | Steel mix of sub + labour |
| **Commercial Reasoning** | Fabrication rarely in-house |
| **Future Learning Hooks** | Steel package DNA |
| **Coverage Tags** | `steel`, `subcontractor`, `lump_sum` |

---

## CCS-033 — Concrete pad

| Field | Value |
| --- | --- |
| **Scenario ID** | CCS-033 |
| **Category** | A |
| **Difficulty** | Basic |
| **Project Type** | Residential |
| **Work Area** | Concrete |
| **Customer Context** | Garden shed pad |
| **Builder Notes** | m² rate inclusive of mesh allowance in rate |
| **Facts** | 20 m² |
| **Constraints** | None |
| **Pricing Inputs** | 20 × $110/$137.50 |
| **Commercial Assumptions** | 20% |
| **Expected Totals** | Golden CCS-033 |
| **GST** | 15% |
| **Margin** | 20% |
| **Warnings** | None |
| **Manual Overrides** | None |
| **Explanation** | Qty×rate concrete |
| **Commercial Reasoning** | Small pads commonly m² all-in |
| **Future Learning Hooks** | Concrete $/m² |
| **Coverage Tags** | `concrete`, `qty_rate` |

---

## CCS-034 — Window install productivity

| Field | Value |
| --- | --- |
| **Scenario ID** | CCS-034 |
| **Category** | B |
| **Difficulty** | Intermediate |
| **Project Type** | Residential |
| **Work Area** | Windows |
| **Customer Context** | Replace 6 aluminium windows |
| **Builder Notes** | 3.5 hrs/window company norm |
| **Facts** | 6 windows |
| **Constraints** | Ground floor |
| **Pricing Inputs** | Hours 21 × $70/$87.50; units supply excluded |
| **Commercial Assumptions** | Install labour only |
| **Expected Totals** | Golden CCS-034 |
| **GST** | 15% |
| **Margin** | 20% |
| **Warnings** | Units by others |
| **Manual Overrides** | None |
| **Explanation** | Each × productivity |
| **Commercial Reasoning** | Window labour is unit-based |
| **Future Learning Hooks** | Hrs/window DNA |
| **Coverage Tags** | `windows`, `productivity` |

---

## CCS-035 — Exterior cladding

| Field | Value |
| --- | --- |
| **Scenario ID** | CCS-035 |
| **Category** | C |
| **Difficulty** | Intermediate |
| **Project Type** | Residential reclad |
| **Work Area** | Exterior cladding |
| **Customer Context** | Weatherboard replacement one elevation |
| **Builder Notes** | Labour + materials |
| **Facts** | 60 m² |
| **Constraints** | Scaffold separate (CCS-047 pattern) |
| **Pricing Inputs** | Labour 60×1.1 hrs ×$65/$81.25; materials 60×$85/$106.25 |
| **Commercial Assumptions** | 20% |
| **Expected Totals** | Golden CCS-035 |
| **GST** | 15% |
| **Margin** | ~20% |
| **Warnings** | Scaffold excluded |
| **Manual Overrides** | None |
| **Explanation** | Cladding package |
| **Commercial Reasoning** | Reclads need clear exclusions |
| **Future Learning Hooks** | Cladding $/m² |
| **Coverage Tags** | `cladding`, `labour`, `materials` |

---

## CCS-036 — Roofing with waste

| Field | Value |
| --- | --- |
| **Scenario ID** | CCS-036 |
| **Category** | A, C |
| **Difficulty** | Intermediate |
| **Project Type** | Residential reroof |
| **Work Area** | Roofing |
| **Customer Context** | Colorsteel longrun |
| **Builder Notes** | 8% waste on sheet area |
| **Facts** | Net 95 m² → qty 102.6 m² |
| **Constraints** | Single storey |
| **Pricing Inputs** | 102.6 × $55/$68.75 materials; labour separate lump $4,800/$6,000 |
| **Commercial Assumptions** | Waste on qty |
| **Expected Totals** | Golden CCS-036 |
| **GST** | 15% |
| **Margin** | Blended |
| **Warnings** | Wastage 8% |
| **Manual Overrides** | None |
| **Explanation** | Roof waste + labour lump |
| **Commercial Reasoning** | Roofing waste is material-first |
| **Future Learning Hooks** | Roof wastage DNA |
| **Coverage Tags** | `roofing`, `waste`, `lump_sum` |

---

## CCS-037 — Flooring vinyl with waste

| Field | Value |
| --- | --- |
| **Scenario ID** | CCS-037 |
| **Category** | A |
| **Difficulty** | Basic |
| **Project Type** | Residential |
| **Work Area** | Flooring |
| **Customer Context** | Kitchen/living vinyl |
| **Builder Notes** | 10% waste |
| **Facts** | Net 35 m² → 38.5 m² |
| **Constraints** | None |
| **Pricing Inputs** | 38.5 × $40/$50 |
| **Commercial Assumptions** | Supply+lay rate in unit (simplified) |
| **Expected Totals** | Golden CCS-037 |
| **GST** | 15% |
| **Margin** | 20% |
| **Warnings** | Wastage 10% |
| **Manual Overrides** | None |
| **Explanation** | Flooring waste qty |
| **Commercial Reasoning** | Pattern matching burns meters |
| **Future Learning Hooks** | Flooring waste |
| **Coverage Tags** | `flooring`, `waste`, `qty_rate` |

---

## CCS-038 — Commercial office fitout multi-trade

| Field | Value |
| --- | --- |
| **Scenario ID** | CCS-038 |
| **Category** | Q, D, Z |
| **Difficulty** | Advanced |
| **Project Type** | Commercial fitout |
| **Work Area** | Multiple (partitions, electrics, flooring, paint) |
| **Customer Context** | 120 m² office refit |
| **Builder Notes** | Mixed in-house + subs |
| **Facts** | Four work areas |
| **Constraints** | After-hours possible — use allowance if needed |
| **Pricing Inputs** | Aggregated sell $86,000 cost $68,800 (illustrative package totals in golden) |
| **Commercial Assumptions** | Multi-area + subs |
| **Expected Totals** | Golden CCS-038 |
| **GST** | 15% |
| **Margin** | 20% |
| **Warnings** | Commercial programme risks |
| **Manual Overrides** | None |
| **Explanation** | Complex aggregation |
| **Commercial Reasoning** | Fitouts are multi-trade programmes |
| **Future Learning Hooks** | Commercial $/m² DNA |
| **Coverage Tags** | `commercial_fitout`, `multi_work_area`, `subcontractor`, `dna_candidate` |

---

## CCS-039 — Site establishment lump sum

| Field | Value |
| --- | --- |
| **Scenario ID** | CCS-039 |
| **Category** | E, J |
| **Difficulty** | Basic |
| **Project Type** | Any site job |
| **Work Area** | Preliminaries |
| **Customer Context** | Temporary fence, toilet, power lead-in |
| **Builder Notes** | Single prelims lump |
| **Facts** | Establishment package |
| **Constraints** | None |
| **Pricing Inputs** | Cost $1,500 sell $1,875 |
| **Commercial Assumptions** | 20% |
| **Expected Totals** | Golden CCS-039 |
| **GST** | 15% |
| **Margin** | 20% |
| **Warnings** | None |
| **Manual Overrides** | None |
| **Explanation** | Site setup money |
| **Commercial Reasoning** | Every proper job has prelims |
| **Future Learning Hooks** | Prelims % of job |
| **Coverage Tags** | `site_establishment`, `lump_sum`, `prelims` |

---

## CCS-040 — Variation add pergola

| Field | Value |
| --- | --- |
| **Scenario ID** | CCS-040 |
| **Category** | R, C |
| **Difficulty** | Intermediate |
| **Project Type** | Residential outdoor |
| **Work Area** | Pergola (variation) |
| **Customer Context** | Mid-job add pergola |
| **Builder Notes** | Price variation; may revise quote |
| **Facts** | Pergola 16 m² |
| **Constraints** | None |
| **Pricing Inputs** | Labour + materials totals cost $4,800 sell $6,000 |
| **Commercial Assumptions** | Variation clearly identified |
| **Expected Totals** | Golden CCS-040 |
| **GST** | 15% |
| **Margin** | 20% |
| **Warnings** | Variation to original scope |
| **Manual Overrides** | None |
| **Explanation** | Variation pricing |
| **Commercial Reasoning** | Scope creep must be priced explicitly |
| **Future Learning Hooks** | Variation frequency |
| **Coverage Tags** | `variation`, `pergola`, `quote_revision_candidate` |

---

## CCS-041 — Zero quantity lump-sum preliminaries

| Field | Value |
| --- | --- |
| **Scenario ID** | CCS-041 |
| **Category** | E |
| **Difficulty** | Basic |
| **Project Type** | Any |
| **Work Area** | Preliminaries |
| **Customer Context** | Admin/prelims |
| **Builder Notes** | Qty 0 or null; totals authoritative |
| **Facts** | Prelims |
| **Constraints** | None |
| **Pricing Inputs** | Lump cost $400 sell $500; qty 0 |
| **Commercial Assumptions** | Zero qty valid **lump sum only** |
| **Expected Totals** | Golden CCS-041 |
| **GST** | 15% |
| **Margin** | 20% |
| **Warnings** | None |
| **Manual Overrides** | None |
| **Explanation** | OCD-35 |
| **Commercial Reasoning** | Prelims are not qty×rate |
| **Future Learning Hooks** | Prelims sizing |
| **Coverage Tags** | `lump_sum`, `zero_qty`, `validation` |

---

## CCS-042 — Sell-only lump (cost unknown)

| Field | Value |
| --- | --- |
| **Scenario ID** | CCS-042 |
| **Category** | E |
| **Difficulty** | Intermediate |
| **Project Type** | Residential |
| **Work Area** | Allowance |
| **Customer Context** | Client budget allowance before supplier quotes |
| **Builder Notes** | Sell $5,000; cost 0 unknown |
| **Facts** | Placeholder |
| **Constraints** | None |
| **Pricing Inputs** | Cost 0 sell 5000 |
| **Commercial Assumptions** | Allowed; margin display may be extreme — warn cost unknown |
| **Expected Totals** | Golden CCS-042 |
| **GST** | 15% on 5000 |
| **Margin** | 100% numeric artifact — warning required |
| **Warnings** | Cost unknown / not entered |
| **Manual Overrides** | None |
| **Explanation** | OCD-30 |
| **Commercial Reasoning** | Sometimes you must hold a client number before costs land |
| **Future Learning Hooks** | Unknown-cost frequency |
| **Coverage Tags** | `lump_sum`, `sell_only`, `warning` |

---

## CCS-043 — Reject negative “credit”

| Field | Value |
| --- | --- |
| **Scenario ID** | CCS-043 |
| **Category** | validation |
| **Difficulty** | Basic |
| **Project Type** | Any |
| **Work Area** | N/A |
| **Customer Context** | Attempt to enter −$500 credit |
| **Builder Notes** | Credits out of MVP |
| **Facts** | Invalid input |
| **Constraints** | N/A |
| **Pricing Inputs** | Negative total |
| **Commercial Assumptions** | Validation error; no persist |
| **Expected Totals** | Rejected |
| **GST** | N/A |
| **Margin** | N/A |
| **Warnings** | N/A |
| **Manual Overrides** | N/A |
| **Explanation** | OCD-52 |
| **Commercial Reasoning** | Credits need a proper future type |
| **Future Learning Hooks** | None |
| **Coverage Tags** | `validation`, `no_credits` |

---

## CCS-044 — Reject margin 96%

| Field | Value |
| --- | --- |
| **Scenario ID** | CCS-044 |
| **Category** | validation |
| **Difficulty** | Basic |
| **Project Type** | Any |
| **Work Area** | N/A |
| **Customer Context** | Invalid target margin |
| **Builder Notes** | Bounds 0–95 |
| **Facts** | 96% entered |
| **Constraints** | N/A |
| **Pricing Inputs** | Invalid |
| **Commercial Assumptions** | Reject |
| **Expected Totals** | Rejected |
| **GST** | N/A |
| **Margin** | Invalid |
| **Warnings** | N/A |
| **Manual Overrides** | N/A |
| **Explanation** | OCD-14 |
| **Commercial Reasoning** | ≥100% breaks sell-from-cost; 95% is product ceiling |
| **Future Learning Hooks** | None |
| **Coverage Tags** | `validation`, `margin_bounds` |

---

## CCS-045 — Hidden line vs quote visibility

| Field | Value |
| --- | --- |
| **Scenario ID** | CCS-045 |
| **Category** | Q, R |
| **Difficulty** | Intermediate |
| **Project Type** | Residential |
| **Work Area** | Mixed |
| **Customer Context** | Internal contingency hidden from client quote |
| **Builder Notes** | Pricing includes hidden $2,000 sell line; quote visible lines only |
| **Facts** | Visible sell $20,000; hidden $2,000 |
| **Constraints** | None |
| **Pricing Inputs** | inclusion_rule pricing=all; quote=visible_only |
| **Commercial Assumptions** | Intentional difference; product should eventually warn (S1-010 / CD-21) — golden records both totals |
| **Expected Totals** | Pricing sell 22000; quote sell 20000 — golden CCS-045 |
| **GST** | Each document on its sell base |
| **Margin** | Differ |
| **Warnings** | Desired: visibility mismatch warning |
| **Manual Overrides** | Visibility flag |
| **Explanation** | Two inclusion rules |
| **Commercial Reasoning** | Internal contingency may stay off client schedule |
| **Future Learning Hooks** | Hidden vs visible behaviour |
| **Coverage Tags** | `visibility`, `quote_vs_pricing`, `aggregate` |

---

## CCS-046 — Recalibration preserves manual edit

| Field | Value |
| --- | --- |
| **Scenario ID** | CCS-046 |
| **Category** | X, U |
| **Difficulty** | Advanced |
| **Project Type** | Residential |
| **Work Area** | Final Pricing |
| **Customer Context** | Estimate regenerated; one pricing line was manually set |
| **Builder Notes** | Manual line preserved on recalibration apply |
| **Facts** | Manual sell $3,300 on glass line |
| **Constraints** | None |
| **Pricing Inputs** | Recalibration policy: preserve manually_edited |
| **Commercial Assumptions** | Override metadata retained |
| **Expected Totals** | Manual line unchanged; others may update — golden CCS-046 |
| **GST** | Recalc document |
| **Margin** | Mixed |
| **Warnings** | Manual edit preserved |
| **Manual Overrides** | Glass sell |
| **Explanation** | Recalc must respect manuals |
| **Commercial Reasoning** | Negotiated numbers must survive estimate refresh |
| **Future Learning Hooks** | Preserve-vs-replace decisions |
| **Coverage Tags** | `recalibration`, `manual_override`, `persistence` |

---

## CCS-047 — Scaffold hire lump sum

| Field | Value |
| --- | --- |
| **Scenario ID** | CCS-047 |
| **Category** | E |
| **Difficulty** | Basic |
| **Project Type** | Residential reclad |
| **Work Area** | Preliminaries |
| **Customer Context** | Two-week scaffold |
| **Builder Notes** | Supplier hire cost known |
| **Facts** | Hire quote |
| **Constraints** | None |
| **Pricing Inputs** | Cost $2,200 sell $2,750 |
| **Commercial Assumptions** | 20% |
| **Expected Totals** | Golden CCS-047 |
| **GST** | 15% |
| **Margin** | 20% |
| **Warnings** | None |
| **Manual Overrides** | None |
| **Explanation** | Classic lump plant/hire |
| **Commercial Reasoning** | Scaffold is rarely productivity-rated |
| **Future Learning Hooks** | Hire margins |
| **Coverage Tags** | `scaffold`, `lump_sum` |

---

## CCS-048 — Contingency allowance line

| Field | Value |
| --- | --- |
| **Scenario ID** | CCS-048 |
| **Category** | F |
| **Difficulty** | Basic |
| **Project Type** | Residential renovation |
| **Work Area** | Contingency |
| **Customer Context** | Older home unknowns |
| **Builder Notes** | Manual contingency line (no auto % in Stage 2B) |
| **Facts** | $2,000 sell / $1,600 cost |
| **Constraints** | Unknown services risk |
| **Pricing Inputs** | Lump |
| **Commercial Assumptions** | OCD-20 manual lines |
| **Expected Totals** | Golden CCS-048 |
| **GST** | 15% |
| **Margin** | 20% |
| **Warnings** | Contingency allowance |
| **Manual Overrides** | None |
| **Explanation** | Explicit risk money |
| **Commercial Reasoning** | Renovations hide surprises |
| **Future Learning Hooks** | Contingency drawdown |
| **Coverage Tags** | `contingency`, `allowance`, `lump_sum` |

---

## CCS-049 — Extension framing + GIB + paint

| Field | Value |
| --- | --- |
| **Scenario ID** | CCS-049 |
| **Category** | Q, C, Z |
| **Difficulty** | Advanced |
| **Project Type** | Residential extension |
| **Work Area** | Framing, Linings, Painting |
| **Customer Context** | 20 m² room addition (simplified package) |
| **Builder Notes** | Three WA totals |
| **Facts** | Multi-trade extension |
| **Constraints** | Standard |
| **Pricing Inputs** | Framing $9,500/$11,875; GIB $3,200/$4,000; Paint $2,400/$3,000 |
| **Commercial Assumptions** | 20% |
| **Expected Totals** | Golden CCS-049 |
| **GST** | 15% |
| **Margin** | 20% |
| **Warnings** | None |
| **Manual Overrides** | None |
| **Explanation** | Extension multi-area |
| **Commercial Reasoning** | Extensions are sequenced trade stacks |
| **Future Learning Hooks** | Extension $/m² DNA |
| **Coverage Tags** | `extension`, `multi_work_area`, `dna_candidate` |

---

## CCS-050 — Night/weekend as manual allowance

| Field | Value |
| --- | --- |
| **Scenario ID** | CCS-050 |
| **Category** | N, F, Z |
| **Difficulty** | Intermediate |
| **Project Type** | Commercial |
| **Work Area** | Preliminaries |
| **Customer Context** | Must work Saturday to meet handover |
| **Builder Notes** | OT product deferred — use allowance |
| **Facts** | Weekend premium |
| **Constraints** | Restricted / weekend |
| **Pricing Inputs** | Allowance $1,200/$1,500 |
| **Commercial Assumptions** | OCD-04 defer engine; priced explicitly |
| **Expected Totals** | Golden CCS-050 |
| **GST** | 15% |
| **Margin** | 20% |
| **Warnings** | Weekend / after-hours loading |
| **Manual Overrides** | None |
| **Explanation** | Deferred OT still commercially real via allowance |
| **Commercial Reasoning** | Premium time costs money even without OT rate cards |
| **Future Learning Hooks** | OT DNA later |
| **Coverage Tags** | `weekend`, `allowance`, `deferred_product`, `dna_candidate` |

---

## CCS-051 — Small bathroom minimum labour floor

| Field | Value |
| --- | --- |
| **Scenario ID** | CCS-051 |
| **Category** | B, Y |
| **Difficulty** | Intermediate |
| **Project Type** | Residential |
| **Work Area** | Bathroom |
| **Customer Context** | Tiny powder room |
| **Builder Notes** | Calculated hours 10; minimum crew floor 16 hrs |
| **Facts** | Min hours applied |
| **Constraints** | Small job |
| **Pricing Inputs** | 16 hrs × $70/$87.50 |
| **Commercial Assumptions** | Minimum applied as modifier with warning |
| **Expected Totals** | Golden CCS-051 |
| **GST** | 15% |
| **Margin** | 20% |
| **Warnings** | Labour minimum applied |
| **Manual Overrides** | None (system minimum) |
| **Explanation** | Small jobs still need mobilisation |
| **Commercial Reasoning** | You cannot send a crew for a half-day profitably without a floor |
| **Future Learning Hooks** | Minimums DNA |
| **Coverage Tags** | `minimum_labour`, `bathroom`, `warning`, `modifier` |

---

## CCS-052 — DNA candidate: repeated fencing uplift

| Field | Value |
| --- | --- |
| **Scenario ID** | CCS-052 |
| **Category** | Y, Z, X |
| **Difficulty** | Advanced |
| **Project Type** | Residential fencing (series) |
| **Work Area** | Fence |
| **Customer Context** | Builder repeatedly lifts fence sell ~8% above derived margin sell |
| **Builder Notes** | Manual corrections across jobs — **learning candidate only** |
| **Facts** | Single representative job: cost $3,200; derived sell $4,000; builder sell $4,320 |
| **Constraints** | None |
| **Pricing Inputs** | Manual sell override |
| **Commercial Assumptions** | DNA must **not** auto-update rates; evidence only |
| **Expected Totals** | Golden CCS-052 |
| **GST** | 15% |
| **Margin** | 25.93% effective |
| **Warnings** | Manual sell above derived |
| **Manual Overrides** | Sell 4320 |
| **Explanation** | Correction evidence pattern |
| **Commercial Reasoning** | Local fence market may need more than default margin |
| **Future Learning Hooks** | **Company DNA** rate suggestion; **Scenario Learning** fence cohort; **AI coaching** “you often uplift fencing”; **confidence** in default margin for fences; **builder behaviour** consistent override |
| **Coverage Tags** | `dna_candidate`, `learning_candidate`, `manual_override`, `fence`, `benchmarking_candidate` |

---

## Document control

| Field | Value |
| --- | --- |
| Path | `docs/specifications/CANONICAL_COMMERCIAL_SCENARIOS.md` |
| Scenarios | **52** |
| Batch | 2B.2B |
| Code / formula / DB changes | **None** |
| Depends on owner confirmation | Blocking OCDs still Pending — scenarios use **recommended** MVP rules |
