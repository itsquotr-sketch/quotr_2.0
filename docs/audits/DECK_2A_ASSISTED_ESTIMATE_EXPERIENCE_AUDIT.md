# DECK-2A - Assisted Estimate Experience Audit

**Status:** COMPLETE LOCAL / OWNER PRODUCT REVIEW PENDING  
**Date:** 2026-08-18  
**Mode:** Product-direction audit only. No production behavior change. No rate changes. No migration.  
**Fixtures:** `tests/fixtures/deck-calibration/EXEMPLAR-AI-01.json`, `tests/fixtures/deck-calibration/REAL-JOB-01.json`  
**Contract:** `docs/architecture/QUOTR_ASSISTED_ESTIMATE_EXPERIENCE_CONTRACT.md`  
**Roadmap:** `docs/plans/DECK_2_ASSISTED_ESTIMATE_ROADMAP.md`

This audit treats Quotr as an **assisted estimating product**, not only a Deck calculator. The question is whether an everyday builder can move from brief to useful estimate, builder review, edits, and clean quote without being forced through a pseudo-engineering interview.

---

## 1. Product principle (locked)

Quotr should:

1. extract what the builder already told us;
2. infer what it safely can;
3. use company defaults/rates where available;
4. use Quotr benchmarks and allowances where appropriate;
5. ask only high-value questions early;
6. disclose assumptions;
7. estimate even when information is incomplete;
8. show a useful builder review breakdown;
9. allow easy edits;
10. convert cost into commercially controlled sell;
11. produce a clean customer-facing quote.

DECK-1 foundations remain intact:

- `decking.surface` stays `REQUIREMENT_AUTHORITATIVE`
- `deck.labour` stays `SHADOW`
- structural children stay `SHADOW`
- legacy structural money stays live
- no rates or goldens are restamped in DECK-2A

---

## 2. Three estimate levels

### LEVEL 1 - QUICK ESTIMATE

Goal: price the job quickly from a short brief plus a few high-value facts.

Allowed:

- assumptions
- company defaults
- Quotr benchmarks
- residual allowances
- pricing-required flags where honesty requires them

Should show:

- estimate or range
- confidence
- 1-3 key assumptions
- material issues or attention items only

Should not show:

- a 25-question detail form
- internal rate provenance noise
- engineering-detail interrogation

### LEVEL 2 - BUILDER REVIEW

Goal: give the builder enough transparency to trust and edit the number.

Should show:

- major materials
- labour
- allowances
- other direct costs
- project conditions
- assumptions
- pricing-required or uncertain items
- margin and sell

Must be editable.

### LEVEL 3 - FINAL QUOTE

Goal: builder-approved commercial output for the customer.

Should show:

- grouped scope
- inclusions
- exclusions
- qualifications/assumptions
- final price
- GST

Should not expose:

- benchmark labels
- requirement snapshots
- rate-source internals
- takeoff/debug metadata by default

---

## 3. Current Deck flow (today)

Current path:

`Create Project -> Analyse Job -> Work Areas -> Scope Details -> Project Conditions -> Quick Estimate -> Pricing -> Quote`

Observed current behavior:

- Project creation is light.
- Analyse Job can already infer a Deck work area and some facts from brief text.
- Scope Details for Deck contains both genuinely high-value questions and many optional structural questions.
- Project Conditions correctly owns project/site logistics such as access and carry distance.
- Estimate generation already supports assumptions and a breakdown surface.
- Pricing and Quote already support editing and customer-safe output.

Today’s strongest mismatch:

**the product promises a fast assisted estimate, but Deck still exposes too many optional structural questions too early while the sold estimate remains mostly legacy commercial packaging.**

---

## 4. Current friction points

### High friction

1. Too many Deck optional structural questions can appear before the user gets value.
2. Some questions ask for construction-detail knowledge the builder may not know at quick-estimate stage.
3. Current product can infer or assume some facts, but the questioning model still behaves like a partial takeoff form.
4. Project Conditions adds a second gate after Scope Details, which is correct architecturally but can feel like repeated friction if not presented as high-value.

### Low-value / early-friction candidates

- joist direction
- joist size
- joist spacing
- framing treatment
- bearer size
- bearer rows
- support type
- supports per bearer
- support size
- footing dimensions
- some fine-grain face-board detail

These are useful for deeper review, but they are poor Quick Estimate blockers.

---

## 5. P0 / P1 / P2 / P3 question map

| Topic | Class | Why |
| --- | --- | --- |
| Deck size / area | **P0** | Primary quantity and price driver |
| Height / low vs elevated | **P0** | Labour, access attention, balustrade risk |
| Existing deck removal | **P0** | Scope and demolition cost driver |
| Decking material | **P0** | Major material and rate driver |
| Board width | **P0** | Decking lm quantity / pricing path |
| Access / carry conditions | **P0** | Real labour/productivity driver |
| Stairs / step access | **P1** | Often material and labour relevant, but can follow initial estimate |
| Fascia / vertical face boards | **P1** | Useful review refinement; not always Quick Estimate blocker |
| Balustrade | **P1** | Important scope/compliance item; ask when height suggests relevance |
| Substructure included | **P1** | High-value structural scope switch |
| Joist section | **P1** | Useful for Builder Review; not a Quick Estimate blocker |
| Joist centres | **P1** | Useful refinement where known |
| Bearer configuration | **P1** | Useful refinement where known |
| Supports / piles arrangement | **P1** | High-value if known; otherwise assume/qualify |
| Demolition subtype detail | **P1** | Valuable review detail |
| Quality level | **P1** | Commercial refinement |
| Treatment / grade / KD | **P2** | Helpful later; should not block Quick Estimate |
| Footing dimensions | **P2** | Detailed structural refinement, not early UX |
| Fixings / delivery / waste micromodel | **P2** | Better represented as allowance strategy initially |
| Board direction / joist direction | **P2** | Usually not worth interrupting Quick Estimate |
| DPC / end-seal / small tools / consumables | **P3** | Internal or allowance-layer concerns |
| Derived area from known dimensions | **P3** | Quotr should derive |
| Decking lm from area + width | **P3** | Quotr should derive |
| Margin math | **P3** | Commercial engine concern, not user question |

---

## 6. Assume + disclose model

When the builder gives a short brief, Quotr should estimate immediately using:

- known extracted facts
- company defaults where approved
- common Quotr assumptions
- benchmark rates
- residual allowances
- pricing-required flags only where honesty requires them

Quotr should distinguish:

- **estimating assumption**: practical commercial assumption for a fast estimate
- **structural design / code assertion**: not to be invented by the Assistant

Examples of acceptable estimating assumptions:

- standard access if not stated
- standard treated substructure where rate path requires a benchmark category
- no demolition unless stated
- no balustrade pricing unless requested or confirmed

Examples of unacceptable fabrication:

- invented footing dimensions
- invented support lengths
- invented code-compliance outcomes
- invented task-level labour decomposition presented as fact

---

## 7. Major detailed materials vs residual allowances

### Better as detailed by default

- decking boards
- joists
- rim / boundary framing
- bearers
- major supports/posts when enough facts exist
- fascia / face boards where geometry is available

### Better as residual allowance / hybrid initially

- decking screws
- structural fixings/connectors
- DPC / isolating materials
- end-seal / adhesives
- minor blocking / nogs / trimmers
- small sundries / consumables
- delivery
- small tools
- waste handling where no real quantity model exists

The product goal is **commercial completeness with low friction**, not microscopic takeoff.

---

## 8. Labour experience audit

Current generic Deck labour is useful as a commercial starting point, but it does not map cleanly to the builder mental model in the exemplar task list.

### Exemplar task concepts vs current Quotr

| Task concept | Current state |
| --- | --- |
| Site setup | **Covered generically** inside Deck labour |
| Decking demolition | **Separate legacy** removal labour line |
| Framing / pile demolition | **Not explicitly represented** as a separate task |
| Manual waste carry | **Project condition effect** / not task-explicit |
| Setout / excavate | **Covered generically** if included at all |
| Piles / supports | **Covered generically** in labour, not task-explicit |
| Bearers | **Covered generically** |
| Joists / blocking / rim | **Covered generically** |
| Decking install | **Covered generically** |
| Steps / fascia | stairs partly separate legacy allowances; fascia labour separate hardcoded path |
| Cleanup | **Covered generically** |

### High-value future DECK-3 gaps

- demolition split
- access/manual handling effect on labour tasks
- supports/foundations task visibility
- fascia/steps task visibility

Do not implement DECK-3 in DECK-2A.

---

## 9. Project Conditions / access analysis

Exemplar access condition:

- restricted rear access
- 25-30m manual carry for materials and waste

Current architecture is directionally correct:

- project/site logistics belong in Project Conditions
- access must not be double-counted across Scope Details and labour shaping

Current UX gap:

- access is commercially important enough to be P0, but it should be asked as one high-value project condition, not distributed across many Deck-specific detail asks

Future targeting should separate:

- labour productivity effect
- waste handling effect
- material handling effect

without multiplying the same condition twice.

---

## 10. Demolition analysis

Today:

- existing deck removal has a labour path
- there is not yet a full demolition architecture for decking removal + framing removal + piles + disposal + waste handling

Recommended direction:

- keep simple removal as a labour/allowance-friendly model for Quick Estimate
- allow later hybrid decomposition for Builder Review
- do not force a full demolition task model into the first estimate interaction

---

## 11. Waste / other direct cost analysis

Current requirement architecture can eventually represent:

- `waste`
- `plant`
- `subcontract`
- `material`
- `labour`

Current product gap is not missing architecture primitives; it is missing clean user-facing modeling and category usage for deck waste/disposal/direct-cost items.

Recommended initial categories:

| Bucket | Best current category |
| --- | --- |
| Skip/disposal | `waste` or allowance |
| Manual waste handling | labour / project-condition effect |
| Delivery | allowance / other direct cost |
| Small tools | allowance / other direct cost |
| Site protection | allowance / other direct cost |
| Plant | `plant` or allowance |

Genuine domain gap:

- these buckets are not yet surfaced as a clean builder review layer for Deck

---

## 12. P&G / overhead / risk / margin

Current Quotr already preserves the correct commercial boundary:

- estimate builds **cost**
- commercial engine owns **sell**
- gross margin remains cost-first

What exists now:

- cost -> margin -> sell flow
- pricing and quote layers

What is missing:

- a first-class builder-facing distinction between direct cost, project overhead/risk, and final sell in the review experience

Recommendation:

- keep P&G / overhead / risk as a **separate commercial layer**, not a hidden material/labour mutation
- do not infer exemplar overhead percentages as product truth

---

## 13. Quick Estimate target

Target first screen for Deck:

```
DECK REPLACEMENT

27m2 Vitex deck
Low-level
New substructure
Attached to existing deck

Estimated sell: $X or $X-$Y + GST
Confidence: Medium

Key assumptions:
- standard access unless noted
- standard structural benchmark path where exact spec unknown
- demolition / direct-cost items shown if confirmed or assumed

Attention:
- only material issues

CTA: Review estimate
```

Do not dump 25 line items on the first screen.

---

## 14. Builder Review target

Target hierarchy:

1. Overview
2. Materials
3. Labour
4. Other direct costs
5. Assumptions / attention
6. Pricing required / uncertainties

Builder Review should expose:

- major quantified materials
- residual allowances
- direct cost subtotal
- margin / sell
- editable assumptions and rate/allowance decisions

---

## 15. Materials target

Deck should eventually get a first-class builder review surface:

`Overview | Breakdown | Materials | Assumptions`

Materials should show:

- material
- spec
- estimated quantity
- unit
- rate
- rate source
- cost
- confidence/status

This does **not** require a full Company Materials DB.

---

## 16. Editing target

Best product model:

- AI proposes
- builder edits
- commercial engine recalculates

Simplest editing priorities:

1. scope assumption
2. material choice
3. quantity override where appropriate
4. rate or allowance edit
5. labour hours / allowance edit
6. margin / sell

---

## 17. Attention/conflict target

The exemplar shows a valid attention pattern:

- elevated deck around 1.2m
- no balustrade requested

Product requirement:

- surface a possible scope/compliance conflict
- ask / qualify
- do **not** silently add money
- do **not** pretend to make a code determination

Current attention architecture appears capable of this direction, but Deck does not yet use it as a first-class product feature.

---

## 18. Customer quote target

Customer quote should remain concise and grouped:

- grouped scope
- clear price
- assumptions / exclusions / qualifications
- no benchmark/rate-source language
- no unnecessary material micro-detail by default

Current quote system is directionally compatible, but the builder review breakdown is richer than the customer quote and should stay separate.

---

## 19. EXEMPLAR capability matrix

| Capability | Exemplar expectation | Quotr today | Status | Gap | Phase |
| --- | --- | --- | --- | --- | --- |
| Brief extraction | Recognize deck replacement brief | Deck WA + some facts inferred | PARTIAL | More controlled assumptions/attention needed | DECK-2A |
| Work area recognition | Deck | Yes | PASS | — | current |
| Deck area | 16.12 m2 | Yes | PASS | — | current |
| Decking lm | Approx surface material quantity | Yes | PASS | Exemplar vs Quotr quantity difference should be explainable | current |
| Joist lm | Major framing quantity | Shadow only | PARTIAL | Not sold as authority | DECK-1D / later |
| Bearer lm | Major framing quantity | Shadow only | PARTIAL | Not sold as authority | DECK-1D / later |
| Supports | Major support concept | Shadow count only when known | PARTIAL | Pricing + UX coverage gap | later |
| Concrete | Present | Shadow only | PARTIAL | Pricing + UX coverage gap | later |
| Fascia | Present | Legacy face/fascia path exists | PARTIAL | Better review UX needed | DECK-2 |
| Steps | Present | Legacy allowances only | PARTIAL | Better Builder Review transparency | later |
| Demolition | Present | Basic removal labour only | PARTIAL | Waste/disposal/deeper demolition gap | later |
| Waste | Present | Not first-class Deck UX | GAP | direct-cost category gap | DECK-2A/B |
| Manual carry | Present | Project condition effect only | PARTIAL | review transparency gap | DECK-2A/B |
| Decking screws | Present | fixings package only | PARTIAL | residual allowance UX gap | DECK-2A |
| Structural fixings | Present | not decomposed | PARTIAL | hybrid allowance strategy needed | DECK-2A |
| DPC/protection | Present | not explicit | GAP | residual allowance strategy | DECK-2A |
| Consumables | Present | fixings/consumables package only | PARTIAL | residual allowance UX gap | DECK-2A |
| Delivery | Present | not first-class Deck UX | GAP | other-direct-cost exposure | later |
| Labour hours | Present | generic deck labour only | PARTIAL | task transparency missing | DECK-3 later |
| Task labour | Present | no | GAP | task-level labour later | DECK-3 |
| P&G | Present | not explicit as builder review layer | GAP | commercial presentation gap | DECK-2A |
| Margin | Present | yes | PASS | clearer Builder Review presentation needed | DECK-2A |
| Attention/conflict | Needed | limited today | PARTIAL | explicit attention UX gap | DECK-2A |
| Builder breakdown | Needed | partial | PARTIAL | materials/direct-costs hierarchy gap | DECK-2A |
| Editing | Needed | pricing/quote edits exist | PARTIAL | earlier estimate-review editing needs simplification | DECK-2A/B |
| Customer quote | Needed | yes | PASS | quote grouping polish only | current |

---

## 20. Safe replacement strategy

| Area | Recommendation |
| --- | --- |
| Deck foundations | **KEEP** |
| Surface requirement authority | **KEEP** |
| Structural calibration infrastructure | **KEEP** |
| Early question load | **IMPROVE** |
| Builder Review output shape | **IMPROVE** |
| Residual allowance visibility | **IMPROVE** |
| Deck labour task decomposition | **PROMOTE LATER** |
| Structural money replacement | **PROMOTE LATER** |
| Legacy package retirement | **RETIRE LATER** only after authority/promotion proof |

No big-bang rewrite is justified.

---

## 21. DECK-2A current audit conclusion

Today Quotr is already capable of becoming a strong assisted estimate experience for Deck, but the user-facing experience is behind the underlying architecture.

The next product-value step is **not** more hidden calculator detail. It is:

- fewer early questions
- clearer assumptions
- stronger Builder Review grouping
- better residual allowance visibility
- better attention-item handling
- safe use of current detailed quantities where they already exist

That is the DECK-2A direction.

---

## 22. EXEMPLAR-AI-01 current engine run

Using current deterministic local engine behavior, with restricted access / `10-30m` carry represented as Project Conditions, current output is directionally:

- recommended cost: **$9,832.00**
- recommended sell: **$14,863.00**

Current priced lines:

- Deck labour
- Decking materials
- Framing/substructure
- Fixings and consumables
- Existing deck removal
- Stair set allowance
- Vertical face/fascia boards
- Face board labour allowance

What the exemplar expects conceptually but Quotr does not yet expose cleanly in Builder Review:

- piles/supports as a commercial bucket
- concrete as a commercial bucket
- structural fixings separated from catch-all fixings
- DPC / isolating materials
- delivery
- waste/disposal
- small tools/site protection
- task-level labour
- overhead/risk as an explicit Builder Review layer

Current engine also produces attention-relevant assumptions about elevated height and possible balustrade/consent confirmation, which is directionally useful for DECK-2A.

### Exemplar gap conclusion

Quotr today can produce a useful estimate from this brief, but its output structure is still closer to a priced legacy breakdown than to the ideal assisted Builder Review hierarchy.

---

## 23. REAL-JOB-01 current engine run

Using current deterministic local engine behavior against the known brief only:

- recommended cost: **$10,526.30**
- recommended sell: **$16,069.10**
- actual sold job (context only): **$13,000 + GST**

Current priced lines:

- Deck labour
- Decking materials
- Framing/substructure
- Fixings and consumables

Known current assumptions in effect:

- standard access (because no project conditions were supplied)
- standard structural benchmark path
- no demolition/removal
- no stairs, fascia, balustrade, or other additions unless stated
- Hardwood-class deck pricing path used because current taxonomy does not have a distinct Vitex option

### Directional comparison

Current Quotr result is **DIRECTIONALLY HIGH** versus the known actual sell.

### Why this is not a rate calibration signal

This does **not** prove Quotr rates are wrong because:

- actual internal cost build-up is unknown
- actual margin is unknown
- actual labour/productivity is unknown
- actual substructure detail is unknown
- actual inclusions/exclusions are incomplete
- current engine uses a generic legacy substructure package and hardwood benchmark path

Therefore `REAL-JOB-01` is useful as **partial commercial evidence**, not authority.
