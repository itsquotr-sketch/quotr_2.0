# Quotr Estimate Requirements Architecture

**Classification:** SUPPORTING. **CANONICAL estimating engine:** `docs/architecture/QUOTR_ESTIMATING_ENGINE_ARCHITECTURE.md`.  
**Status:** Planning freeze `foundation-r1.0`. **Final pre-emission contract `foundation-r1.1`**. **REQ-1 COMPLETE / TECHNICALLY VALIDATED.** **REQ-2 COMPLETE / MATERIAL EMISSION FOUNDATION VALIDATED.** **REQ-2.1 COMPLETE / TECHNICALLY VALIDATED** (Deck surface only). REQ-3 **COMPLETE / LABOUR EMISSION FOUNDATION VALIDATED**. REQ-3.1 **COMPLETE / TECHNICALLY VALIDATED** (Deck labour only). REQ-4 **IN PROGRESS**. REQ-4A **COMPLETE / TECHNICALLY VALIDATED**. REQ-4B **BLOCKED / NOT STARTED**.  
**Mode:** Architecture lock + TypeScript contracts only. Calculators must not emit requirements until **REQ-1**. FOUNDATION-R2 is Scope Details completeness. FOUNDATION-R2-R1 reconciles Deck priced qty/rate units. Neither emits requirements.  
**Supersedes in part:** `docs/architecture/QUOTR_MATERIAL_TAKEOFF_ARCHITECTURE.md` (MaterialRequirement §4 is absorbed and extended; takeoff persistence and Deck pilot geometry remain valid).  
**Commercial SoT:** `docs/architecture/QUOTR_COST_FIRST_COMMERCIAL_MODEL.md`  
**Rate SoT:** `docs/architecture/QUOTR_RATE_AUTHORITY_AND_PROVENANCE_MODEL.md`  
**PC consumption:** `docs/audits/PROJECT_CONDITIONS_SINGLE_AUTHORITY_AUDIT.md`  
**Coverage:** `docs/audits/SUPPORTED_WORK_AREA_COVERAGE_AUDIT.md`

**Hard stop:** Do not create a second pricing engine. Requirements feed **quantities**; money comes from existing cost-first resolvers + commercial engine.

---

## 1. Goal

Estimates must eventually explain **what is required**, not only a priced line:

- Deck: decking boards, joists, bearers, posts, concrete, fixings, face boards, …  
- Deck labour: demolition 5 h, substructure 14 h, decking 13 h, fascia 4 h, …

Same objects later support takeoff UI, procurement, supplier mapping, subcontract RFQs, and analytics — **without** duplicating commercial authority.

---

## 2. Smallest model: `EstimateRequirement`

Do **not** invent a parallel estimate graph. Add one internal union consumed by calculators.

```ts
type RequirementKind =
  | "material"
  | "labour"
  | "plant"
  | "subcontract"
  | "waste";

type EstimateRequirementBase = {
  requirementId: string; // deterministic: workAreaId + kind + componentKey [+ variantKey]
  kind: RequirementKind;
  workAreaId: string;
  workAreaType: string;
  componentKey: string; // e.g. "deck.face_boards", "deck.labour.decking"
  description: string;
  confidence: "high" | "medium" | "low";
  assumptions: RequirementAssumption[]; // { key, text, source } — not string[]
  provenance: RequirementProvenance;
  priced: boolean; // true ⇒ commercial participant AND required cost fields non-null
};

type RequirementProvenance = {
  calculatorSource: string; // "deck.face_boards"
  factKeys: string[];
  constraintKeys: string[];
  generatedAt?: string; // set if cached on estimate
};
```

Typed variants:

| Kind | Type | Maps from today |
| --- | --- | --- |
| `material` | `MaterialRequirement` | `materialBuildUp` (`priced: false`) + material line items |
| `labour` | `LabourRequirement` | `labourHours` on a single lumped labour line |
| `plant` | `PlantRequirement` | Rare allowances (scaffold, excavator) — **defer emit** |
| `subcontract` | `SubcontractRequirement` | Bathroom plumbing/electrical allowances |
| `waste` | `WasteRequirement` | Skip/disposal/carting allowances |

**CalculatorResult** has optional `requirements?: readonly EstimateRequirement[]`. Line items remain the **money projection**. Requirements are the **quantity authority** once emitted. A line may later reference one or more `requirementId`s.

**REQ-1:** collection, validation, physical aggregation. Production calculators omit the field. See `docs/architecture/QUOTR_REQUIREMENT_AGGREGATION_CONTRACT.md`.

**Persistence:** derive on generate (same as takeoff architecture option B). Optional JSON cache on estimate; invalidate on regenerate. Do **not** make editable requirement rows the commercial SoT.

---

## 3. MaterialRequirement (canonical vs derived)

### 3.1 Contract

Align with existing proposed fields; make **canonical vs derived** explicit.

```ts
type MaterialRequirement = EstimateRequirementBase & {
  kind: "material";
  materialKey: string | null; // canonical catalogue / item_key
  category: string; // FRAMING | DECKING | SHEET | …
  specification?: string;
  /** Canonical */
  baseQuantity: number;
  baseUnit: string; // lm | m2 | m3 | ea | sheet | L | pack
  wasteFactor: number; // fraction, e.g. 0.10
  /** Derived: baseQuantity × (1 + wasteFactor) [+ conversion] */
  purchaseQuantity: number;
  purchaseUnit: string;
  conversion?: { from: string; to: string; factor: number };
  /** Money — resolved, not invented */
  rateSource: RequirementRateSource; // company | project_override | supplier | benchmark | hardcoded_legacy | missing
  // Conversion is MaterialRequirement.conversion — not a separate source.
  unitCost: number | null; // cost-first
  totalCost: number | null; // purchaseQuantity × unitCost
};
```

| Field | Canonical or derived |
| --- | --- |
| workAreaId, componentKey, materialKey, description | Canonical |
| baseQuantity, baseUnit | Canonical (calculator) |
| wasteFactor | Canonical (org wastage by category, else explicit) |
| purchaseQuantity, purchaseUnit | **Derived** (unless pack rounding later) |
| conversion | Canonical when units differ; else omit |
| unitCost, rateSource | Resolved at generate (not stored as SoT) |
| totalCost | **Derived** |
| priced | Canonical policy flag |
| confidence, assumptions, provenance | Canonical metadata |

**Deferred:** UUID catalogue PK, pack sizes, supplier SKU, user qty override with Fact write-back.

### 3.2 Rate authority (do not duplicate)

```
materialKey
  → company rate (exact item_key)
  → optional category fallback (future)
  → Quotr benchmark cost
  → missing (honest; no silent $)
```

Use / adopt `resolveMaterialRate` (`lib/estimate/resolve-material-rate.ts`). Live calculators today mostly call `resolveRate` and leave specific lm/sheet keys **unconsumed**. `resolveMaterialRate` is **verify-script only**.

Sell: **never** stored on the requirement. Commercial engine derives sell from **cost × org margin** (cost-first). Takeoff shows cost quantities; quote shows sell lines.

### 3.3 Migration from `materialBuildUp`

Today: helpers set **`priced: false`** (`lib/estimate/material-buildup-meta.ts`). Display footnotes only.

Rule: when a component is ready, emit `MaterialRequirement` with `priced: true` and **retire the parallel m² package for that component**. Until then, keep package money and emit `priced: false` takeoff rows labelled **allowance / display only**.

---

## 4. LabourRequirement

### 4.1 Contract

```ts
type LabourRequirement = EstimateRequirementBase & {
  kind: "labour";
  trade: string; // carpenter | labourer | painter | …
  /** Canonical — hours before project productivity adjustments */
  baseHours: number;
  productivityBasis: {
    key: string | null; // productivity table key
    hoursPerUnit: number;
    unit: string;
    quantity: number;
  };
  /** Provenance/calculation reference — does not lock OD-PC-01 composition */
  adjustmentRef: {
    factors: readonly { key: string; value: number }[];
  };
  /** Derived at rollup: baseHours × projectFactor × qualityFactor */
  adjustedHours: number;
  rateKey: string; // labour.carpenter.hour
  hourlyCost: number | null;
  totalCost: number | null; // adjustedHours × hourlyCost
  rateProvenance: RequirementRateSource;
};
```

### 4.2 Single-consumption (mandatory)

Project Conditions (access, carry, slope, …) may adjust **productivity**.

**Forbidden:** bake `site_access` into each task’s `baseHours` **and** multiply `adjustedHours` by the same factor again.

**Required:**

1. Calculators compute **unadjusted** task hours from quantity × productivity.  
2. `getLabourAdjustmentFactor` / combined access helper runs **once** per WA (or once per estimate if WA override absent).  
3. Rollup: `adjustedHours = baseHours × factor`.  
4. Haulage **allowance $** is a `WasteRequirement` or `material` carting line — **not** a second labour multiplier.

**Prerequisite:** fix DC-01 (demolition) and DC-02 (external stairs) **before** emitting LabourRequirement from those calculators. Deck/Fence/Pergola already use the combined helper.

### 4.3 Current labour architecture (as-is)

- Hours: `qty × productivityHoursPerUnit × adjustmentFactor × qualityFactor` (`lib/estimate/line-items.ts`).  
- Productivity table: `lib/estimate/productivity.ts`. Unused keys exist (`deck.balustrade_hours_per_lm`, `bathroom.labour_hours_per_m2`).  
- Labour $: `resolveLabourRate` — `labour.carpenter.hour` → `labour.general.hour` → **hardcoded 60/90**.  
- Typical output: **one labour line per WA**, not a task breakdown. Deck face labour is a **money lump 35/55 per lm**, not hours.

Target Deck breakdown (pilot): demolition, setout, piles/posts, bearers, joists, decking, face/fascia, stairs, balustrade, waste/cleanup — each a `LabourRequirement` with `componentKey`.

**REQ-3.1 current emission:** one shadow `LabourRequirement` for the existing **Deck labour** lump (`componentKey: deck.labour`). Does not invent the target task split. **DECK-3** owns that split. Face labour lump is not emitted.

---

## 5. Other kinds (minimal)

**Plant/equipment:** emit later when a calculator has a real qty (excavator hours, scaffold). Until then, keep allowance lines.

**Subcontract:** `SubcontractRequirement` = scope description + allowance or quoted cost. Future RFQ adopts **cost** into this object; GM still derives sell. Do not build RFQ tables in this contract.

**Waste/disposal:** skip, carting, spoil — distinct from labour productivity.

---

## 6. Calculator → line item mapping

```
Facts + Constraints + Scope
  → calculator
  → EstimateRequirement[]     // quantity authority
  → line items (money)        // projection; may aggregate requirements
  → commercial engine totals
  → takeoff / labour UI (projection of requirements)
```

A labour line “Deck labour 32 h” may **sum** several `LabourRequirement`s for display until UI shows the breakdown.

---

## 7. Deck pilot — readiness and Facts

### 7.1 Materials desired vs current

| Desired | Current |
| --- | --- |
| Decking boards | Priced **m²** package; lm build-up **priced:false** if area + `board_width_mm` |
| Joists / bearers / posts / piles / concrete | **No** — `deck.substructure.m2` package |
| Fixings | `deck.fixings.m2` package |
| Fascia / face boards | lm × **hardcoded** `DECK_BENCHMARKS.faceBoardLm`; labour **35/55**; **no waste** |
| Stairs / balustrade | Money allowances (if no `external_stairs` WA) |
| Demo / waste | Removal labour only; **no** disposal line |

### 7.2 Labour desired vs current

| Desired | Current |
| --- | --- |
| Demolition | Yes — 0.35 hrs/m² |
| Setout / piles / bearers / joists / decking / face / stairs / balustrade / cleanup as hour lines | **No** — one deck labour 1.2 hrs/m² + 0.25 elevated + face lump $ |

### 7.3 Facts that already exist

| Fact | Role |
| --- | --- |
| `deck.length_m`, `deck.width_m` | Geometry |
| `deck.area_m2` | Override / default path (default **20 m²** if all missing) |
| `deck.height_m`, `deck.level` | Elevation; elevated labour +0.25 hrs/m² if height ≥ 0.3 m |
| `deck.board_width_mm`, `deck.board_material` | Surface lm helper + rate key |
| `deck.vertical_face_boards_required` | Include face |
| `deck.vertical_face_board_length_lm` | **Irregular perimeter override** |
| `deck.access_type` | Product stairs (not site access) |
| `deck.balustrade_required`, `deck.handrail_required` | Allowances |
| `deck.substructure_*`, pile facts | Package / replacement allowance |
| `deck.existing_deck_removal` | Demo labour |

**No** irregular polygon geometry. **No** face-edge selection. **No** face height/width/material distinct from decking.

### 7.4 Face boards — recommended Facts (do not implement yet)

Owner language: “How many sides of the deck will have face boards?”  
Quantity: **applicable edge lengths × face height ÷ effective board coverage width**.

**Ambiguity:** “3 sides” does not say **which** sides. Front/rear ≈ `width_m`; left/right ≈ `length_m`. Count-only forces `n × (perimeter / 4)` — weaker.

**Recommended (Owner decision OD-FACE-01):**

| Fact | Required | Default |
| --- | --- | --- |
| `deck.face_boards.sides` multi-select `front\|rear\|left\|right` | When face boards = yes | None — must answer or use irregular lm |
| **Fallback UX:** `deck.face_board_side_count` 1–4 | Only if orientation unknown | Then `count × (2L+2W)/4` and **lower confidence** |
| `deck.face_board_height_m` | Optional | `deck.height_m` |
| `deck.face_board_width_mm` | Optional | `deck.board_width_mm` or 140 |
| `deck.face_board_material` | Optional | `deck.board_material` |
| Keep `deck.vertical_face_board_length_lm` | Irregular override | Wins over edge math |

```
edge_length = Σ selected edges (front/rear → width; left/right → length)
face_lm_before_waste = (edge_length × face_height_m) / (board_width_mm / 1000)
face_lm = face_lm_before_waste × (1 + waste)
```

Stop hardcoded `faceBoardLm` and labour 35/55. Price via `deck.material.*.lm` (already in specific catalogue, **unconsumed** for money) + carpenter hours × `resolveLabourRate`.

Orientation: document Front = house-facing or user-labelled; consistency matters more than GIS.

### 7.5 Pilot v1 vs v2

**v1 (first implementation after contract + PC cleanup):** priced face boards + priced surface lm (or keep surface m² with honest label) + labour breakdown **even if some tasks remain productivity lumps**.

**v2:** joist/bearer/post catalogue keys + concrete m³.

Do not block v1 on full framing catalogue.

---

## 8. Materials Catalogue V2 — taxonomy only

**Do not populate arbitrary rates.** Contractors set cost rates; Quotr supplies keys + optional benchmarks later.

### 8.1 Current catalogue (evidence)

Specific keys (`lib/rates/specific-material-catalogue.ts`), all `calculatorSupport: "used_now"` but **mostly unpriced in live calculators:**

- Decking lm: treated_pine, hardwood, kwila, composite  
- Sheets: plasterboard standard/fyreline/aqualine/braceline, plywood, ceiling.tile.m2  
- `retaining_wall.backfill.m3` (calculator prices `backfill.face_m2` instead)  
- Flooring m2 general/vinyl/carpet  
- `paint.litre`, `painting.material.m2`

**Framing timber sizes: none.** Deck framing is `$/m²`.

Package `scope.*` keys: `calculatorSupport: "planned"` — not primary pricing.

### 8.2 Proposed taxonomy (keys, not prices)

Naming: `{domain}.{component}.{variant}.{unit}`  
Quotr canonical. Supplier SKUs map **onto** these keys (see §9).

**FRAMING:** SG8 sizes × treatment H1.2 / H3.2 / H4 / H5 where relevant — e.g. `timber.sg8.90x45.h1.2.lm`, `timber.sg8.140x45.h3.2.lm`, `timber.sg8.190x45.h3.2.lm`, `timber.sg8.90x90.h5.lm` (posts). Exact size list Owner-approved later; **do not invent a merchant full list now**.

**DECK:** reuse lm decking keys; add `deck.joist.{size}.lm`, `deck.bearer.{size}.lm`, `deck.post.{size}.ea`, `concrete.m3`, `deck.fixings.pack` or keep m² fixings until pack math exists, `deck.balustrade.lm`, face boards → same as decking lm + `componentKey`.

**BATHROOM:** aqualine/sheet keys already; add waterproofing.m2, tile.m2 (generic), adhesive/grout allowances, trim.lm. Fixtures stay allowances.

**COMMERCIAL / FITOUT:** timber vs `steel.stud.lm` / `steel.track.lm`; existing sheet keys; insulation.m2; door.ea; trim.lm; flooring type keys **already exist unused**.

**RETAINING:** posts/poles/sleepers.lm, concrete.m3, drainage.lm (exists), aggregate.m3 (`backfill.m3` exists), geotextile.m2, fixings.

**FENCE:** posts.ea, rails.lm, palings.lm, concrete.m3, fixings, gate.ea (allowance exists).

**PERGOLA:** posts, beams, rafters, battens, roofing.m2 (typed keys exist), fixings.

**KITCHEN:** remain **allowance** keys (cabinetry, benchtop) until joinery SKU design. Do not fake lineal kitchen takeoff.

**CLADDING / ROOFING:** no WA — **do not add keys until WA exists** (avoid orphan catalogue).

### 8.3 Catalogue honesty

`calculatorSupport: "used_now"` on unconsumed lm/sheet keys is **misleading**. When Catalogue V2 ships, mark unused keys `"planned"` until a calculator prices them, or flip `priced: true` in the same batch.

---

## 9. Supplier pricing (architecture only — no APIs)

```
Quotr materialKey (canonical)
  → supplier_id + branch/account
  → supplier_sku
  → unit + conversion → purchaseUnit
  → price_ex_gst
  → as_at timestamp
  → provenance (api | import | manual)
```

**Quotr domain model stays canonical.** Supplier catalogues are **mappings**, not Work Areas or requirement kinds.

**Prerequisites:** stable `materialKey`s; unit conversion table; org account-per-supplier; price cache TTL; never write supplier price as sell.

**Unknowns:** API access (PlaceMakers, CARTERS, ITM, Mitre 10, Bunnings); auth; branch vs national; pack vs lm; whether first integration is CSV import vs API.

**First integration** only after Catalogue V2 keys exist for Deck (and maybe sheets). Prefer **manual/CSV mapping** before API.

Out of architecture foundation scope: live API clients.

---

## 10. What this document does **not** authorise

- Implementing types in `lib/estimate` in the audit batch  
- Changing calculators or question banks  
- Populating merchant-complete timber lists  
- Supplier APIs  
- Editable takeoff as money SoT  
- Company DNA rate mutation from requirements  

**Next implementation:** REQ-4A is complete locally. Next: Owner review, then **REQ-4B** (Deck `decking.surface` only). Do not start REQ-4B here. Empty `requirements[]` remains valid for other calculators.
