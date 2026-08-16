# Quotr Material Takeoff Architecture

**Status:** Proposed architecture (not implemented) — 2026-08-13  
**Post-trial (2026-08-15):** MaterialRequirement + LabourRequirement absorbed/extended by `docs/architecture/QUOTR_ESTIMATE_REQUIREMENTS_ARCHITECTURE.md` (**not implemented**). **FOUNDATION-R2-R1 (2026-08-16):** Deck **surface decking** now prices the same lm takeoff used for display when board width is known. **FOUNDATION-R2-R1-R1:** contractor `$/m²` may convert onto that lm takeoff using nominal board width; waste is already in purchase lm (do not apply twice). Face-board geometry in §7 remains deferred (OD-FACE-01). Do not treat these batches as Catalogue V2 or requirement emission.  
**Prerequisite audit:** `docs/audits/MATERIAL_PRICING_TAKEOFF_CURRENT_STATE_AUDIT.md`  
**Commercial model:** `docs/architecture/QUOTR_COST_FIRST_COMMERCIAL_MODEL.md`  
**Plan:** `docs/plans/POST_3_2_2_COMMERCIAL_MATERIALS_PLAN.md`  
**Programme:** `docs/plans/POST_TRIAL_MASTER_DEVELOPMENT_PIPELINE.md`

**Hard stop:** Do not invent a large catalogue or build UI in this pass. Takeoff must share calculator authority with pricing — never an AI shopping list.

---

## 1. Goal

Every generated estimate should eventually be able to show a **MATERIAL TAKEOFF** of major materials required for the work.

```
Project information
  → Facts / Constraints / Scope
  → calculator quantities
  → material quantities
  → material cost rates
  → material cost
  → labour + other costs
  → estimate cost
  → margin
  → recommended sell
```

**Same material quantity** feeds takeoff display **and** material cost.

---

## 2. Authority model

| Layer | Owns |
| --- | --- |
| Facts / Constraints / Scope | What work exists |
| Domain calculators | Deterministic quantities + which material keys |
| Rate resolution | Unit **cost** (cost-first) + provenance |
| Commercial engine | Money from qty × cost; sell from margin |
| Takeoff view | Projection of calculator material requirements |
| Pricing / Quote | Consume estimate money authority (not a separate BOM invent) |

**Rate resolution:** `lib/estimate/rates.ts` / `resolve-material-rate.ts` consume the same cost-first sell classification (`sellAuthority`). MaterialRequirement must use **costRate** as money input and never invent a second pricing engine.

---

## 3. Persistence recommendation

| Option | Pros | Cons |
| --- | --- | --- |
| **A. Persist takeoff rows** | Fast reopen; audit trail | Drift vs regenerate; dual SoT risk |
| **B. Derive on read from calculator outputs** | Single SoT | Recompute cost; need stable contract |
| **C. Hybrid / cache** | Cache for UI; regenerate invalidates | Complexity |

**Recommendation: B with optional C cache**

- **Canonical:** derive takeoff from calculator `MaterialRequirement` outputs at generate time.
- **Optional cache:** store JSON snapshot on estimate (or line metadata) for display performance; **invalidate on regenerate** (same as estimate stale rules).
- Do **not** make editable takeoff rows the commercial SoT unless a future “user override quantity” product is designed with write-back into Facts/calculator inputs.

---

## 4. Minimum robust contract — `MaterialRequirement`

Prefer minimal fields that support pricing + takeoff without premature SKU explosion.

```ts
type MaterialRequirement = {
  /** Stable catalogue / rate key when known */
  materialKey: string | null;
  /** Coarse category for grouping (FRAMING, DECKING, …) */
  category: string;
  /** Human label for takeoff / line |
  description: string;
  /** Optional spec string (e.g. "140mm kwila", "Aqualine 10mm") */
  specification?: string;
  /** Quantity before waste */
  quantityBeforeWaste: number;
  /** Waste factor as fraction (0.1 = 10%) or percent — pick one convention in impl */
  wasteFactor: number;
  /** Quantity after waste (priced qty) */
  quantityAfterWaste: number;
  unit: string; // lm | m2 | m3 | ea | sheet | L | pack | …
  /** Resolved unit cost (cost-first) */
  unitCost: number | null;
  rateSource: "company" | "benchmark" | "hardcoded_legacy" | "missing";
  estimatedCost: number | null; // qtyAfterWaste × unitCost when known
  workAreaId: string | null;
  scopeItemKey?: string | null;
  calculatorSource: string; // e.g. "deck.face_boards"
  confidence?: "high" | "medium" | "low";
  /** When true, this requirement drives estimate material money */
  priced: boolean;
};
```

**Deferred (post-MVP):** `material_id` UUID catalogue PK, pack sizes, supplier SKUs, alternate specs, user-edited qty overrides.

**Migration from today:** flip build-ups from `priced: false` footnotes to `priced: true` requirements where ready; retire parallel m² package for that component when takeoff is authoritative.

---

## 5. Recalculation reconciliation

| Event | Takeoff | Estimate money |
| --- | --- | --- |
| Fact / constraint / scope change | Stale with estimate | Regenerate |
| Margin change | Quantities unchanged | Re-derive sell from cost; takeoff qty/cost unchanged |
| Company rate change | Re-resolve unitCost on regenerate | Same |
| User edits Pricing line | Does **not** silently rewrite takeoff SoT | Pricing override provenance (existing) |

---

## 6. Catalogue expansion architecture

### 6.1 Categories (extensible string taxonomy)

Initial target groups (not inventing SKUs now):

- FRAMING (timber sizes/types)
- DECKING
- SHEET MATERIALS
- LININGS
- FIXINGS
- CONCRETE
- WATERPROOFING
- FLOORING
- FINISHES
- (+ existing: retaining, painting, etc.)

### 6.2 Calculator → catalogue contract

Calculators must reference **canonical `materialKey` / item_key**, not literals.

```
user company rate (exact key)
  → user category fallback (optional)
  → Quotr benchmark cost for key
  → missing (honest; don’t invent money silently)
```

Align with / adopt `resolveMaterialRate` precedence; retire live `resolveRate` work-area cross-bind for materials where unsafe.

### 6.3 Units

Support: `lm`, `m2`, `m3`, `ea`, `sheet`, `L`, `pack` — unit must match rate row unit; converters only with explicit factors.

### 6.4 Specification variants

Prefer: base key + `specification` / variant suffix (`deck.material.kwila.140.lm`) rather than free-text-only pricing.

### 6.5 Waste

Use org wastage settings (`021_…`) by category; always expose before/after waste on takeoff.

### 6.6 Framing sizes

Catalogue later adds size/type rows; calculator selects key from Facts (`member_size`, `species`) — **do not hardcode $/m² framing forever**.

---

## 7. Deck takeoff pilot (recommended first vertical)

### Why Deck
- Strong dimensional facts (L×W)
- Existing board lm helper
- Clear Owner need: face/fascia boards
- Smaller than bathroom trade packages

### Pilot scope
1. Surface decking: price from lm×board cost (or keep m² until lm rates adopted — Owner pick)
2. Face/fascia: edge-based lm with waste → takeoff + priced line
3. Fixings/framing: may remain m² package in pilot v1 with takeoff “allowance” label

### Face-board calculation (proposed)

Preferred UX: which exposed edges need face boards — **Front / Rear / Left / Right** (not “how many sides”).

Orientation convention (document in calculator):

- Front / Rear length ≈ `deck.width_m`
- Left / Right length ≈ `deck.length_m`

```
face_board_edge_length = Σ(selected edge lengths)
board_courses = ceil(face_height / effective_board_width)   // or area/lm method
face_board_lm_before_waste = face_board_edge_length × board_courses
face_board_lm = face_board_lm_before_waste × (1 + waste)
```

Simpler MVP variant (if courses complex):  
`face_area = edge_length × face_height` → `lm = face_area / board_width_m × (1+waste)`.

### Minimum new Deck questions / Facts

Ask only what cannot be derived:

| Fact | Why | Default / derive |
| --- | --- | --- |
| `deck.face_boards.sides` (multi: F/R/L/R) | Ambiguous “1 side” | Required when face boards yes |
| `deck.face_board_height_m` | Coverage height | Default → `deck.height_m` when unknown |
| `deck.face_board_width_mm` | Courses / lm | Default → `deck.board_width_mm` or 140 |
| `deck.face_board_material` | Rate key | Default → match `deck.board_material` |

**Keep** `deck.vertical_face_board_length_lm` as irregular override.  
**Replace** sole reliance on full-perimeter when sides selected.  
**Stop** hardcoding `faceBoardLm` + labour 35/55 — resolve rates + labour via cost-first.

Optional later: full height vs fascia strip only.

### Current surface-decking approximation (R2-R1 / R2-R1-R1)

Do **not** treat 126.65 lm as fabrication-level takeoff. Current formula:

```
baseLm    = round2(area_m² / (board_width_mm / 1000))
wastageLm = round2(baseLm × waste%)
purchaseLm = round2(baseLm + wastageLm)
```

Nominal board width is used as coverage width. **DECK-1 refinements (not in this batch):**

- effective cover width vs nominal
- gaps
- orientation
- board length / offcut effects
- irregular geometry beyond area or L×W

Waste is applied once in `purchaseLm`. Company `$/m²` conversion uses `cost_m² × coverage_width_m` against that purchase lm — do not also inflate area.

### Wire both
1. Deck material pricing (priced requirement)
2. Material Takeoff projection

---

## 8. Bathroom / Fitout sequencing

| Domain | Takeoff readiness | Note |
| --- | --- | --- |
| Deck | Highest | Pilot |
| Fitout sheets / paint / flooring | Medium | Flip `priced` + wire specific catalogue |
| Bathroom | Lower for MVP | Trade packages dominate; takeoff as “trade allowances” until SKU design |

---

## 9. Non-goals

- AI-invented shopping lists disconnected from calculators
- Large catalogue authoring in this architecture pass
- Company DNA material learning
- Editing takeoff as silent commercial authority without Fact write-back
