# Quotr Estimating Engine Architecture

**Status:** CANONICAL  
**Date:** 2026-08-17  
**HEAD:** `a4de0f875b3497f11d4bcd0379865a811ca4bf1c`  
**Mode:** PHASE 0 frozen. **REQ-1 COMPLETE / TECHNICALLY VALIDATED.** **REQ-2 COMPLETE / MATERIAL EMISSION FOUNDATION VALIDATED.** **REQ-2.1 COMPLETE / TECHNICALLY VALIDATED.** REQ-3 **COMPLETE / LABOUR EMISSION FOUNDATION VALIDATED**. REQ-3.1 **COMPLETE / TECHNICALLY VALIDATED**. REQ-4 **IN PROGRESS**. REQ-4A **COMPLETE / TECHNICALLY VALIDATED**. REQ-4B **BLOCKED / NOT STARTED**. Does not authorise commercial promotion.  
**Challenge:** `docs/audits/MASTER_ARCHITECTURE_INDEPENDENT_CHALLENGE_REVIEW.md`  
**Absorbs:** `docs/architecture/QUOTR_ESTIMATE_REQUIREMENTS_ARCHITECTURE.md` (SUPPORTING)  
**Commercial SoT:** `docs/architecture/QUOTR_COST_FIRST_COMMERCIAL_MODEL.md`  
**Types:** `lib/estimate/requirements.ts` (`ESTIMATE_REQUIREMENT_CONTRACT_VERSION = foundation-r1.1`; planning freeze `foundation-r1.0`)  
**Product:** `docs/architecture/QUOTR_PRODUCT_ARCHITECTURE.md`

**Hard stop:** Do not create a second pricing engine. Requirements are the physical/commercial **quantity** basis. Money remains cost-first resolvers + commercial engine until a requirement is promoted with `priced: true` after parity.

---

## 1. Engine purpose

The estimating engine turns:

Facts + Project Conditions + Scope Details + company/supplier/Quotr rates

into:

1. physical requirements;
2. resolved unit costs;
3. job cost;
4. sell via gross margin;
5. an explainable estimate.

It answers the six north-star questions. It does not invent contractor prices.

---

## 2. Canonical pipeline (engine view)

```
Facts + Constraints + Scope
  → Work Area calculator
  → EstimateRequirement[]          // quantity authority (target)
  → line items                     // money projection (current SoT)
  → commercial engine totals
  → Breakdown / Materials / Labour UI (projections)
```

**Today:** line items are money SoT. REQ-1 envelope + physical aggregation exist; production calculators omit `requirements`.  
**Target:** requirements become the physical basis; line items aggregate them.

REQ-1 made emission **possible**. Empty `requirements[]` is valid. Existing calculators stay unchanged. See `docs/architecture/QUOTR_REQUIREMENT_AGGREGATION_CONTRACT.md`.

---

## 3. Quantity-driven vs package pricing

### A. Quantity-driven is authoritative when all of:

- a physical base quantity exists;
- priced quantity unit matches rate unit, or an explicit deterministic conversion exists;
- a resolvable unit cost exists (company / converted company / supplier / benchmark);
- the component is not an intentional allowance (e.g. plumbing package).

Reference: Deck surface decking after FOUNDATION-R2-R1 / R2-R1-R1.

### B. Package rates are acceptable when:

- the Work Area is immature (Tier 2 / component);
- the trade is commercially a package or subcontract allowance (kitchen cabinetry, bathroom plumbing/electrical);
- physical takeoff would be fake SKU precision.

### C. Package rates are fallback only when:

- a quantity path exists (e.g. board lm) but width, spec, or exact rate is missing;
- UI must say the price is an allowance / area package, not takeoff.

### D. Pricing required when:

- no company rate;
- conversion forbidden or impossible;
- Quotr benchmark disabled or missing;
- no approved explicit allowance.

Honest `MISSING` / `priced: false` beats silent money.

### E. Legacy package retained during migration

Keep the old package line as money authority. Emit parallel requirements with `priced: false` until shadow/parity promotes the new path. See `QUOTR_LEGACY_RETIREMENT_AND_PARITY_STRATEGY.md`.

Do **not** move every calculator immediately.

---

## 4. EstimateRequirement domain

Canonical union (`RequirementKind`):

`material | labour | plant | subcontract | waste`

Requirements are **not** decorative takeoff metadata. They must progressively become the physical/commercial basis for estimate lines.

### 4.1 Shared base

| Field | Role |
| --- | --- |
| `requirementId` | Deterministic identity (`buildRequirementId`) — not array position |
| `kind` | Union discriminant |
| `workAreaId` / `workAreaType` | Ownership |
| `componentKey` | e.g. `deck.face_boards`, `deck.labour.decking` |
| `variantKey` | Optional semantic discriminator when kind+component can repeat |
| `description` | Contractor-readable |
| `confidence` | `high \| medium \| low` |
| `assumptions` | Structured `{ key, text, source }` — not `string[]` |
| `provenance` | `calculatorSource`, `factKeys`, `constraintKeys`, optional `generatedAt` |
| `priced` | Commercial participation **and** required pricing fields resolved |

### 4.2 Cross-cutting policies

| Topic | Policy |
| --- | --- |
| **Calculator ownership** | The Work Area calculator that knows the physical model emits the requirement. No central BOM inventor. |
| **Aggregation** | REQ-1 aggregates **physical** requirements independently from priced estimate-line money. Do not assume all requirements = money. Sum cost only for `priced: true`. |
| **Persistence** | REQ-4A append-only snapshots (`035`, remote applied). Do not make editable requirement rows the commercial SoT. |
| **UI exposure** | Materials / Labour / Breakdown project requirements. Do not dump internal objects. |
| **Provenance** | Always preserved. Future calibration reads provenance; it must not be stripped. |
| **Confidence / assumptions** | Canonical metadata; never multiply money. |

---

## 5. MaterialRequirement

### PURPOSE

State the physical material needed, convert to a purchase quantity, resolve unit **cost**, and (when `priced`) contribute material cost.

### CANONICAL FIELDS

| Field | Notes |
| --- | --- |
| `workAreaId`, `workAreaType`, `componentKey` | Owner |
| `materialKey` | Canonical catalogue key; null if unknown |
| `category` | FRAMING, DECKING, SHEET, … |
| `description`, `specification` | Human |
| `baseQuantity`, `baseUnit` | Physical qty **before** waste |
| `wasteFactor` | Fraction (0.10 = 10%). Org wastage by category, else explicit |
| `conversion` | Canonical when units differ; omit when same |
| `priced` | Policy flag |

### DERIVED FIELDS

| Field | Rule |
| --- | --- |
| `purchaseQuantity` | `baseQuantity × (1 + wasteFactor)` then conversion / pack rounding |
| `purchaseUnit` | After conversion |
| `unitCost` | Resolved at generate; not SoT |
| `rateSource` | Shared `RequirementRateSource`: `company \| project_override \| supplier \| benchmark \| hardcoded_legacy \| missing`. Conversion is **not** a source. |
| `totalCost` | `purchaseQuantity × unitCost` when known |

### PRICE AUTHORITY

Same hierarchy as material-domain architecture. Requirement does not invent rates.

### UNIT CONSISTENCY (Deck R2-R1 invariant)

**Priced quantity unit must match rate unit**, or an explicit documented conversion must exist.

Valid: `126.65 lm × $18.50/lm` · `16.12 m² × $145/m²`  
Invalid: `126.65 lm × $145/m²` without conversion.

Waste is applied **once**. If purchase lm already includes waste, converted `$/m² → $/lm` must not apply waste again.

Deck reference arithmetic (16.12 m² · 140 mm · 10%):

```
baseLm    = round2(16.12 / 0.14) = 115.14
wastageLm = round2(115.14 × 0.10) = 11.51
purchase  = 126.65 lm
```

Converted company `$/m²`: `equivalent_cost_per_lm = cost_m² × (width_mm / 1000)`.

### PROVENANCE / CONFIDENCE / ASSUMPTIONS

Required. Face-board count-only fallback is lower confidence than F/R/L/R edges (OD-FACE-01).

### CALCULATOR OWNERSHIP / AGGREGATION / PERSISTENCE / UI

Deck (then Bathroom, components, Tier 2) emit. Aggregate purchase qty + cost per materialKey/workArea. Show on Materials section when UI exists. Persist as generate output, not an editable BOM table.

---

## 6. LabourRequirement

### PURPOSE

State hours for a physical task, apply **one** project productivity adjustment at rollup, resolve contractor labour cost.

### CALCULATION

```
physical task × productivity     = baseHours
baseHours × project productivity = adjustedHours
adjustedHours × contractor $/h   = labour cost
```

Quality/spec factor may also apply at rollup if it is a project/WA commercial factor — still **once**, not baked into every task and reapplied.

### CANONICAL FIELDS

| Field | Notes |
| --- | --- |
| `workAreaId`, `componentKey` (task key) | e.g. `deck.labour.joists` |
| `trade` | carpenter, labourer, painter, … |
| `description` | Contractor-readable task |
| `productivityBasis` | `{ key, hoursPerUnit, unit, quantity }` — quantity basis lives here |
| `baseHours` | Hours **before** project productivity |
| `adjustmentRef` | `{ factors: [{ key, value }, …] }` — provenance/calculation reference, not the composition algorithm |
| `rateKey` | e.g. `labour.carpenter.hour` |
| `priced` | Policy |

Do **not** copy a single opaque numeric `adjustmentFactor` onto every task. That is how double-consumption returns. REQ-3.1 Deck labour carries the **combined** live factor as one `project.labour_productivity` entry when it is not 1. It does not decompose access × carry. **OD-PC-01** remains open for multiplicative / additive / capped / combined composition. Do not change current Project Condition calculations.

### DERIVED FIELDS

| Field | Rule |
| --- | --- |
| `adjustedHours` | `baseHours × projectFactor × qualityFactor` at rollup |
| `hourlyCost` | `resolveLabourRate` |
| `totalCost` | `adjustedHours × hourlyCost` |
| `rateProvenance` | Shared `RequirementRateSource` (company / project_override / supplier / benchmark / hardcoded_legacy / missing). Conversion is metadata, not a source. |

### HARD INVARIANT

**One semantic Project Condition = one commercial consumption.**

Forbidden: bake `site_access` into each task’s `baseHours` **and** multiply `adjustedHours` by the same factor.

Required:

1. Calculators compute unadjusted task hours from quantity × productivity.
2. Combined access / Project Condition helper runs **once** per WA (or once per estimate if no WA override).
3. Rollup: `adjustedHours = baseHours × factor`.
4. Haulage $ is WasteRequirement or carting line — not a second labour multiplier.

FOUNDATION-R1 already fixed DC-01 (demolition) and DC-02 (external stairs) stacking. Do not reintroduce it when emitting LabourRequirements.

### CURRENT vs TARGET

Today: typically one labour line per WA (`qty × hrs/unit × adjustment × quality`). Deck face labour is still a money lump 35/55 per lm, not hours. Hardcoded labour fallback 60/90 remains compatibility.

Target Deck tasks: demolition, setout, foundations/piles, bearers, joists, decking, fascia, stairs, balustrade, cleanup.

### UI

Show hours, cost, rate source, and a single project-adjustment note — not internal factor objects.

---

## 7. PlantRequirement / SubcontractRequirement / WasteRequirement

### Plant

**Purpose:** equipment hours or hire qty (excavator, scaffold, mixer).  
**Canonical:** `plantKey`, description, hours or quantity+unit.  
**Price:** company/plant rate or allowance.  
**Emit later** when a calculator has a real qty. Until then keep allowance lines.

### Subcontract

**Purpose:** trade package the contractor will buy in.  
**Canonical:** trade, scope description, `allowanceCost` or `quotedCost`.  
**Price:** adopted **cost**; GM derives sell.  
**Future RFQ** writes `quotedCost`. Reserved authority states (`allowance | benchmark | rfq_quoted | rfq_adopted`) wait for **SUB-AUTH-01**. Do not put Phase-9 workflow fields on live requirements now. Do not build RFQ tables in REQ-1.

### Waste

**Purpose:** skip, disposal, spoil, carting **allowance or qty** — distinct from labour productivity and from material `wasteFactor`.  
**Canonical:** `wasteKey`, quantity/unit or lump.  
**Project** `waste_bin_access` may affect haulage; demolition `skip_bin_included` is a **scope inclusion**, not a second Project Condition ask.

---

## 8. Project Conditions authority (permanent)

Restate FOUNDATION-R1 / R1-R1 as a permanent contract.

Project Conditions own project/site circumstances, **once**:

- site access
- carry distance
- floor level / vertical logistics
- occupied site
- working hours
- parking / loading
- waste / bin logistics
- project-wide services isolation
- project-wide hazmat
- general site slope
- protection / dust
- consent/engineering when job-wide
- client-supplied / by-others when project-wide

**Unknown Project Condition:** Project Conditions owns the ask.  
**Generate:** unresolved **required applicable** keys hard-block (UI + server).  
**Work Areas may consume them.** Work Areas may ask **local physical** conditions only.

Named local exceptions (not site logistics):

| Key | Why local |
| --- | --- |
| `deck.access_type` | Stairs / step-down from the deck |
| `deck.height_m` / `deck.level` | Structure height, not building floor |
| `ceilings.access` | Working height for that ceiling |
| `fence.slope_condition` | Fence-line ground |
| `fence.services_risk` | Fence-line underground services |
| `external_stairs.ground_condition` | Footing at the stair |
| `demolition.skip_bin_included` | Skip as demolition **scope inclusion** |

Do not reintroduce `*.access` site-access questions in Scope Details.

Persistence: Project Conditions → `constraints` (canonical keys; aliases resolve, not dual-write).

OD-PC-01 remains open: occupied / hours / parking are persist/disclosure today; labour consumption is a later design, not a silent factor.

---

## 9. Scope Details authority (permanent)

Scope Details own Work-Area-specific physical/build characteristics:

- dimensions / quantity / count
- construction system
- materials / specification
- existing condition
- local demolition scope
- local inclusions / exclusions
- finishes
- interfaces
- local compliance drivers

**Question rule (FOUNDATION-R2 contract):** a question must materially affect at least one of:

scope · quantity · material · labour · risk · price · quote disclosure

Otherwise challenge / remove / defer.

E-class keys (Owner approved 2026-08-16) may be collected before a calculator consumes them. They remain optional (except bathroom waterproofing yes/no, which is consumed). Unconsumed answers must not change current price as if priced.

`commercial_fitout` has no Scope Details template. It is not a calculator Work Area.

---

## 10. Rate resolution (engine consumption)

Requirements call the **existing** resolvers. Hierarchy is locked in the material-domain architecture. Summary for estimators:

1. Project-specific override where applicable
2. Company exact canonical cost
3. Supplier / account-specific cost (future)
4. Company compatible rate via explicit valid conversion
5. Company calibrated / historical cost where **approved**
6. Quotr exact benchmark
7. Quotr calibrated package fallback
8. Explicit pricing required

Company outranks Quotr for the same physical material.  
Sell is never stored on the requirement as authority. Commercial engine derives sell from cost × GM, except grandfathered paired benchmark / explicit override (COMMERCIAL-P0).

---

## 11. Commercial engine

Unchanged contract:

```
requirement / line COST
  → estimate recommended_cost
  → margin authority (project target → org default → 20%)
  → recommended_sell = cost / (1 − gm)
  → range from org budget/premium factors
  → Pricing / Quote consume the same sell authority
```

GST only on quote. Markup is display-only.

Snapshot kinds: `COMMERCIAL_SNAPSHOT_SAFETY.md`.

---

## 12. Breakdown as explainability layer

The user should be able to answer: **Why is the job this price?**

Target (not current UI):

```
Deck
  Labour      38.2 h    $2,292 cost
  Materials             $4,820 cost
  Plant                 $320
  Waste                 $480

  Decking     126.65 lm hardwood    $22/lm    $2,786
  Project adjustment: Restricted access +10% labour productivity
```

Rules:

- Group by Work Area, then kind, then component.
- Show hours, purchase qty, unit, unit cost, rate source, total cost.
- Show one project-adjustment sentence where it affected labour.
- Do not expose `adjustmentRef`, resolver traces, or debug objects.
- Display-only takeoff must be labelled **not used for this price**.

MVP Breakdown can stay line-oriented until DECK-5. Architecture target is the explainability layer above.

---

## 13. Work Area calculator maturity framework

Every Work Area progresses through:

1. Recognition
2. Scope contract
3. Project Condition consumption
4. Physical quantity model
5. MaterialRequirements
6. LabourRequirements
7. Rate resolution
8. Commercial reconciliation
9. Golden fixtures
10. Breakdown transparency
11. Owner Preview
12. Support promotion (trial_supported → later Supported only when defensible)

This is the template for Deck, Bathroom, Retaining, Fence, Pergola, Kitchen, Commercial components, Cladding, Roofing.

Internal audit grades A–E stay engineering language. **Customer UI never shows A–E.** Current customer bands remain Trial-supported / Developing / Component / Not supported yet (OD-T1-01).

---

## 14. Deck — reference calculator

Deck is the reference implementation. Future transparent Deck:

### Materials

- decking
- joists
- bearers
- posts / piles
- concrete
- fixings
- face / fascia boards
- stairs
- balustrade
- demolition / waste where applicable

### Labour

- demolition
- setout
- foundations
- posts / piles
- bearers
- joists
- decking
- fascia
- stairs
- balustrade
- cleanup

Project Conditions consumed **once**.

**OD-FACE-01 (future):** Front / Rear / Left / Right face-board edges. Quantity:

```
edge_length = Σ selected edges (front/rear → width; left/right → length)
face_lm_before_waste = (edge_length × face_height_m) / (board_width_mm / 1000)
face_lm = face_lm_before_waste × (1 + waste)
```

Keep `deck.vertical_face_board_length_lm` as irregular override. Count-only `n × perimeter/4` is lower-confidence fallback.

### Remaining Facts / calculator gaps (do not implement in this lock)

| Gap | Notes |
| --- | --- |
| Face-edge selection | Not present |
| Distinct face height / width / material | Defaults to decking facts |
| Joist / bearer / post takeoff | Still `deck.substructure.m2` package |
| Fixings | Still `$/m²` package |
| Face labour | Hardcoded 35/55 per lm |
| Task-level hours | One deck labour 1.2 hrs/m² + elevated + demo |
| Disposal line | Removal labour only |
| Nominal board width as coverage | Gaps / effective cover / orientation / offcuts **not** modelled. 126.65 lm is estimate-level takeoff, not fabrication accuracy |

Pilot sequence: DECK-1 explainable surface takeoff + lumped labour → DECK-2 face boards → DECK-3 task labour → DECK-4 calibration hooks → DECK-5 transparency UI. Framing members (joists/bearers/posts/concrete) follow Catalogue V2 keys.

---

## 15. Other Work Area target models (not implementation)

### Bathroom

Demolition · framing/linings · waterproofing · tiling · fixtures · plumbing · electrical · ventilation · painting · labour/material requirements.  
Fixtures and services remain Subcontract/allowance until a real quoted cost exists. Do not fake fixture SKUs.

### Retaining

Posts · sleepers · concrete · drainage · aggregate · geotextile · excavation · spoil · labour.  
Carting is Project Conditions / waste, not a second WA access multiplier. `backfill.m3` should eventually be consumed (today face m² is priced).

### Fence

Posts · rails · palings/panels · concrete · gates · labour.  
`fence.slope_condition` and `fence.services_risk` stay local.

### Pergola

Posts · beams · rafters · battens · roofing/cover · footings · labour.  
Do not treat this as building roofing WA.

### Kitchen

Cabinetry · benchtop · hardware · demolition · services · finishes · **allowance/subcontract model**.  
Do not invent lineal kitchen SKU takeoff.

### Cladding (future greenfield)

Area · cladding system · wrap · cavity battens · flashings · trims · scaffold/access · labour.  
Hidden until built.

### Roofing (future greenfield)

Area · pitch · profile · underlay · purlins/battens · flashings · ridges/valleys · gutters/downpipes · scaffold/access · labour.  
Hidden until built.

### Commercial components

Each of demolition, internal_walls, ceilings, doors, flooring, painting, plastering owns its own physical model. Project Conditions apply once at project level. See supported Work Areas doc.

---

## 16. Requirement identity

Deterministic `requirementId` via `buildRequirementId`:

```
workAreaId + kind + componentKey [+ variantKey]
```

Examples: `WA123:material:decking.surface` · `WA123:labour:decking.install` · `WA123:material:joist:140x45-h3.2`

Unchanged inputs → identical IDs. Changing the discriminator changes the ID. Do **not** use output-array position as normal identity. Index fallback (`:#n`) is lower stability and only when the domain lacks a better identifier.

## 17. Priced invariant

- `priced = true` → participates in commercial pricing **and** required pricing fields for that kind are resolved/non-null.
- `priced = false` → physical/provenance may exist; **not** money authority.
- Do **not** use `priced = true` + `totalCost = null` as “pricing required”. Unresolved money stays `priced: false` (or `rateSource: missing`).
- **Zero is a real number.** **Null is not zero.**

## 18. Component pricing authority (future — not REQ-1)

**AC-01.** Before REQ-4 promotion, each `(workArea, component)` has explicit authority:

`LEGACY_AUTHORITATIVE` → `SHADOW` → `REQUIREMENT_AUTHORITATIVE` → `LEGACY_FALLBACK` → `LEGACY_RETIRED`

Component-level, not whole Work Area only. **Do not implement the map in REQ-1.** REQ-1 aggregation must not assume all requirements = money.

**REQ-SNAPSHOT-01** blocks REQ-4: before any requirement is canonical commercial authority, implement the minimum snapshot/provenance needed to answer “why did this estimate/quote cost X then?”

## 19. Confidence

Bands: `high | medium | low` — not fake percentages.

Dimensions (conceptual): input completeness · physical quantity certainty · rate certainty · calculator maturity · assumption burden.

Future aggregate confidence: materiality-aware conservative / worst-material-driver behaviour — **not** arithmetic averaging, and **not** one low-value low-confidence line marking a $100k job “low”. Do not lock simplistic math now. No UI in this batch.

## 20. Work Area target depths

The maturation ladder is a path, not a claim that every WA must become fully detailed.

| Class | Meaning | Likely |
| --- | --- | --- |
| **A. DEEP QUANTITY** | Physical materials + task labour become primary authority | Deck, Retaining, Fence, Pergola, selected commercial components, future roofing/cladding where practical |
| **B. HYBRID** | Requirements where useful; allowances/subcontracts where more commercial | Bathroom, Kitchen, Commercial Interior composition |
| **C. PACKAGE / ALLOWANCE** | Package estimating may remain intentional | Where detail does not create enough value |

Do not permanently assign every type today if evidence is insufficient. Architecture must support all three.

## 21. REQ-1 envelope (COMPLETE / TECHNICALLY VALIDATED)

REQ-1 is **COMPLETE / TECHNICALLY VALIDATED**.

- optional `requirements[]` on `CalculatorResult`;
- empty / omitted arrays valid;
- `calculateEstimate` collects and normalises across Work Areas;
- aggregation of **physical** requirements, independent of current priced line authority;
- provenance preserved;
- **no** new physical quantities from production calculators;
- **no** UI takeoff;
- **no** pricing-authority change;
- shadow field helper only — comparison engine is REQ-4.

`foundation-r1.1` remains the contract. **REQ-2** is the MaterialRequirement emission foundation. **REQ-2.1** emits Deck surface decking (`priced: true` when lm pricing resolves, SHADOW — not estimate money). **REQ-3.1** emits Deck labour (`priced: true` when labour cost resolves, SHADOW). Face/fascia waits for DECK-2 / OD-FACE-01. Structure waits for DECK-1. Task-level labour waits for DECK-3.

## 21.1 Three-truth model

Every `EstimateRequirement` has three independent truths. Do not collapse them into one flag.

| Truth | Question | REQ-2.1 Deck surface | REQ-3.1 Deck labour |
| --- | --- | --- | --- |
| **Physical** | What physical work/material is required? | YES (when area + board width exist) | YES (lumped Deck labour hours) |
| **Pricing** | Can it resolve a cost, and from which source? | YES where company/Quotr lm resolves; else `missing` | YES — company, or grandfathered 60/90 `hardcoded_legacy`. Current labour resolver has no unpriced path |
| **Commercial authority** | Does it currently determine estimate money? | NO / SHADOW | NO / SHADOW |

`priced: true` is pricing-truth completeness, not commercial authority. Do not add `commercialAuthority` on the requirement object. REQ-4 owns authority externally at component level.

## 21.2 REQ-2.1 Deck surface shadow (COMPLETE / TECHNICALLY VALIDATED)

- One `MaterialRequirement`, `componentKey: decking.surface`.
- Reuses `calculateDeckingBoardLm` + `resolveDeckingBoardPricing` — no second formula or resolver.
- Compatibility identity: `deck.material.*.lm` (not CAT-V2).
- Width unknown: **no requirement** (no fake lm; m² package line may remain).
- Physical known + rate missing: `priced: false`, `rateSource: missing`.
- Requirement cost is not added to estimate totals.
- No UI, persistence, or component-authority promotion.
- REQ-2 is **closed**. Further materials emit during WA maturation, not as REQ-2.2.

## 21.3 REQ-3.1 Deck labour shadow (COMPLETE / TECHNICALLY VALIDATED)

- One `LabourRequirement`, `componentKey: deck.labour`, trade `carpenter`.
- Reuses `shapeLabourHours` + the same `resolveLabourRate` object as the Deck labour line.
- `baseHours` = hours before Project Condition combined factor (quality included because the live formula already applies it).
- `adjustedHours` = current line hours. Combined PC factor recorded as `project.labour_productivity` when not 1. Not decomposed.
- Hours ≠ crew elapsed duration. No duration fields.
- No company labour rate: resolver still returns grandfathered 60/90. Requirement is `priced: true`, `rateProvenance: hardcoded_legacy`, exact line-cost parity. `sourceType: "missing"` is a label only (CM-03); the line is not unpriced. Do not omit 60/90 in REQ-3.1.
- Requirement cost is not added to estimate totals.
- Demolition / face-fascia labour not emitted. DECK-3 owns task split.
- REQ-3 is **closed**. Further labour emits during WA maturation, not as REQ-3.2.

## 21.4 REQ-4A (COMPLETE / TECHNICALLY VALIDATED)

Infrastructure only. Contracts: `docs/architecture/QUOTR_COMPONENT_COMMERCIAL_AUTHORITY_CONTRACT.md`, `docs/architecture/QUOTR_REQUIREMENT_SNAPSHOT_CONTRACT.md`.

- REQ-SNAPSHOT-01 **COMPLETE / REMOTE VALIDATED** (`035_estimate_requirement_snapshots.sql`, applied on `lxvnylhsbvudzzupxeqr`).
- Commercial lineage: `pricing_documents.requirement_snapshot_id`; `component_key` on estimate/pricing lines.
- REQ-TXN-01 **COMPLETE LOCAL / READY FOR COMMIT** (`persist_estimate_generation_v1`; v1 requires snapshot; migration 036 local only).
- Deck `decking.surface` and `deck.labour` remain **SHADOW**.
- Shadow reconciliation + eligibility exist. **No promotion.**
- First REQ-4B candidate: Deck `decking.surface`. Do not start REQ-4B here.

**Critical principle:** never switch an entire Work Area because one requirement is correct. Authority is **component level**. Mixed maturity must remain valid.

---

## 22. Non-goals of this lock

Calculator changes beyond authorised batches · live rate resolver redesign · UI · migrations · Catalogue V2 population · Company DNA · AN-1 emitters. REQ-2.1 Deck surface and REQ-3.1 Deck labour shadow emission are the authorised exceptions to “no calculator emission”.

