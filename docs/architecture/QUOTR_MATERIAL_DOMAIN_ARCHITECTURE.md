# Quotr Material Domain Architecture

**Status:** CANONICAL  
**Date:** 2026-08-17  
**HEAD:** `a4de0f875b3497f11d4bcd0379865a811ca4bf1c`  
**Mode:** PHASE 0 frozen. Does not populate the catalogue or add rates. **CAT-IDENTITY-01** blocks canonical Catalogue V2 seeding. REQ-2.1 uses current compatibility keys `deck.material.*.lm` only. **DECK-1A** defines structural model contract (`docs/architecture/DECK_STRUCTURAL_MATERIAL_MODEL.md`); proposed keys `timber.sg8.*`, `deck.joists`, etc. are **not live** until DECK-1C.  
**Absorbs:** `docs/architecture/QUOTR_MATERIAL_TAKEOFF_ARCHITECTURE.md` (SUPPORTING)  
**Rate evidence:** `docs/audits/FOUNDATION_R2R1_MATERIAL_RATE_AUTHORITY_AUDIT.md`, `docs/audits/QUOTR_MATERIAL_RATE_CONSUMPTION_MATRIX.md`  
**Engine:** `docs/architecture/QUOTR_ESTIMATING_ENGINE_ARCHITECTURE.md`

The material catalogue must **not** merely be a list of editable rates. It represents **construction materials**. Supplier catalogues map onto it. They must not become Quotr’s domain model.

---

## 1. Domain purpose

A canonical material is a construction product Quotr can:

- take off (base qty + waste + purchase qty);
- price (unit cost resolution);
- explain (Materials UI);
- later map to a supplier SKU;
- later learn as a contractor preference.

Naming: `{domain}.{component}.{variant}.{unit}`  
Example: `timber.sg8.90x45.h3.2.lm`, `deck.material.hardwood.lm`.

Do **not** invent the full merchant list in this lock. Owner provides catalogue input later (Section 8).

---

## 2. Canonical material record (future)

| Field | Role |
| --- | --- |
| canonical key (`materialKey`) | Stable Quotr identity |
| category | FRAMING, DECKING, SHEET, … |
| subcategory | e.g. structural timber, wet-area lining |
| material family | SG8, GIB, treated pine, kwila, … |
| dimensions / profile | 90×45, 140 mm board, 10 mm sheet |
| treatment | H1.2 / H3.2 / H4 / H5 / none |
| species / type | pine, hardwood, kwila, composite, steel |
| estimating unit | lm, m2, m3, ea, sheet, L, pack |
| purchase unit | may differ (pack, sheet) |
| conversions | explicit factors only |
| default waste | fraction; org may override |
| benchmark cost | optional Quotr cost |
| benchmark region | NZ default unless stated |
| source | quotr / owner / import (catalogue row origin — not requirement rateSource) |
| effective date | for benchmark / imported price |
| confidence | high / medium / low |
| supplier mappings | separate table; not the key itself |
| `calculatorSupport` | `used_now` \| `planned` — must be honest |

**Honesty rule:** do not mark `used_now` on keys live calculators ignore. FOUNDATION-R2-R1 corrected Deck decking lm; remaining unused specific keys stay `planned` until wired.

**CAT-IDENTITY-01 (blocks Catalogue V2 seeding):** current compatibility keys such as `deck.material.hardwood.lm` may remain for Rates. Before canonical CAT-V2 rows:

- **MATERIAL IDENTITY** is independent of **RATE UNIT**
- Example: `materialKey: timber.decking.hardwood.140` with rates as `materialKey + unit + cost + provenance`
- Supplier SKU is a third mapping
- Do not refactor live Deck keys in this batch

**`purchaseQuantity`** on MaterialRequirement is the continuous **estimating** quantity after waste/conversion. Future procurement (`orderQuantity` / `packQuantity` / `stockLengthPlan`) must not redefine it.

---

## 3. Planned category coverage (taxonomy only)

Initial categories, **not** SKU lists:

| Category | Includes (indicative) |
| --- | --- |
| **FRAMING** | SG8 timber; H1.2 / H3.2 / H4 / H5; common structural dimensions |
| **DECKING** | treated pine, hardwood, kwila, composite; profiles/sizes |
| **SHEET / LININGS** | GIB Standard, Aqualine, Fyreline, plywood, fibre cement, relevant commercial linings |
| **CONCRETE / FIXINGS** | m³, posts/piles concrete, generic fixings until pack math exists |
| **BATHROOM** | wet linings, waterproofing, generic tile, adhesive/grout allowances |
| **COMMERCIAL** | steel stud/track, sheets, insulation, doors, trim, flooring type keys |
| **RETAINING** | posts, sleepers, concrete, drainage, aggregate, geotextile |
| **FENCE** | posts, rails, palings/panels, concrete, gates |
| **PERGOLA** | posts, beams, rafters, battens, cover |
| **KITCHEN** | remain allowance keys until joinery SKU design |
| **future CLADDING** | do not add keys until the WA exists |
| **future ROOFING** | do not add keys until the WA exists |

Do not add cladding/roofing keys before those Work Areas exist (avoid orphan catalogue).

---

## 4. Material rate authority (locked)

Reconciles cost-first + FOUNDATION-R2-R1 + R2-R1-R1.

```
1. Project-specific override (where applicable)
2. Company exact canonical cost (exact item_key + unit)
3. Supplier / account-specific cost (future; org account)
4. Company compatible rate via explicit valid conversion
5. Company calibrated / historical cost where approved (not silent)
6. Quotr exact benchmark (same unit / same material identity)
7. Quotr calibrated package fallback
8. Explicit pricing required
```

### Company outranks Quotr

Company $160/m² converted to $/lm is still source **company** plus explicit conversion metadata — not a separate `company_converted` money authority.

For the same physical material, contractor pricing beats Quotr benchmark even if units differ, **provided** conversion is explicit and deterministic.

Deck decking with board width known:

1. Company exact `$/lm`
2. Company matching `$/m²` converted: `cost_lm = cost_m² × (width_mm / 1000)`
3. Quotr exact `$/lm`
4. Matching `$/m²` area package (net area × `$/m²`)
5. Pricing required

Board width unknown: never invent lm. Company then Quotr matching m² package.

### Conversion rules

| Allowed | Forbidden |
| --- | --- |
| Same material identity + documented coverage (hardwood m² → hardwood lm via board width) | Treating `$23/m²` as `$23/lm` |
| Kwila m² identity = documented alias `deck.material.hardwood.m2` (no kwila m² row) | Treated-pine m² pricing hardwood |
| Waste once via purchase qty | Double waste (convert and also add waste on package area) |
| | Unrelated keys: `deck.substructure.m2`, `deck.fixings.m2`, `scope.deck.m2` |
| | **Quotr** `$/m²` → `$/lm` (independent calibration; converting fights published `$/lm`) |

`$/m²` semantics for `deck.material.{material}.m2` = **B**: historical material package for the **same boards**, applied to net deck area — not a whole-deck framing package.

### Benchmark paired sell legacy

COMMERCIAL-P0 / CF-D5: Quotr paired `{cost, sell}` remains **legacy_paired_rate**. Do not stack project GM on top of an already-paired sell. Cost-only company rows re-derive sell from company GM.

Do not rewrite persisted company rows to “fix” suspected unit mistakes. **RATE-QUALITY-01** (backlog) may warn; never auto-correct.

### Future supplier prices

Insert at step 3: org + supplier + account + SKU + timestamped cost. Still mapped to canonical `materialKey`. Never write supplier price as sell.

---

## 5. Supplier pricing architecture (future)

```
Quotr canonical material
  → supplier
  → supplier SKU
  → branch / account
  → supplier unit
  → conversion
  → current price (ex GST)
  → timestamp
  → provenance (api | import | manual)
```

Potential suppliers: PlaceMakers, CARTERS, ITM, Mitre 10, Bunnings, specialists.

**Do not assume API access exists.**

Sequence:

1. Canonical catalogue first
2. CSV / manual price-list import
3. Supplier mapping
4. Supplier API where commercially and technically available

Unknowns: auth, branch vs national, pack vs lm, first merchant. First integration is **CSV/manual** after Deck keys are live — not APIs now.

---

## 6. Materials / takeoff UI (not implementation)

### Recommendation

| Horizon | Placement |
| --- | --- |
| **MVP** | **A. Sibling section/tab to Breakdown** on Quick Estimate: Overview · Breakdown · **Materials** · Assumptions |
| **Next** | Labour as a further sibling once task hours exist |
| **Later** | **C. Procurement workspace** (orders, supplier quotes) — not MVP |

**Not recommended for MVP:** B. nested only under Breakdown (buries takeoff) or C as the first home (too late, too heavy).

Materials rows should show:

- Work Area
- Material
- base quantity
- waste
- purchase quantity
- unit
- unit cost
- rate source
- total cost
- confidence / assumption where material

Display-only (`priced: false`) rows must be labelled **not used for this price**.

This is a projection of MaterialRequirements. Editing qty in UI is **not** commercial SoT unless a future override writes back to Facts.

---

## 7. Labour transparency UI (product, not implementation)

Example:

```
Deck
  demolition   5.2 h
  setout       2.0 h
  piles        6.5 h
  bearers      4.8 h
  joists       6.2 h
  decking     12.5 h
  fascia       3.0 h
  cleanup      2.5 h
```

Show: hours, cost, rate source, project adjustment where relevant.  
Do not expose `adjustmentRef`, productivity table keys, or resolver traces.

MVP: labour hours may remain a Breakdown expansion until DECK-5. Architecture target is the list above.

---

## 8. Owner material-input template

**Do not populate in this task.** Owner later fills a spreadsheet / form using contractor language — not internal keys.

Requested columns:

| Column | Owner-facing prompt |
| --- | --- |
| Category | Framing / Decking / Sheet / Concrete / Bathroom / … |
| Material name | What you call it (e.g. “90×45 H3.2 SG8”, “140 kwila”) |
| Dimensions / profile | Size or thickness |
| Treatment / species / system | H3.2, hardwood, Aqualine, … |
| Preferred unit | How you usually buy/price it (lm, m², each, pack) |
| Common supplier terminology | PlaceMakers / CARTERS / ITM wording if known |
| Commonly priced by your crews? | Yes / sometimes / rarely |
| Typical waste if known | e.g. 10% decking |
| Notes | Anything estimators always assume |

Quotr staff map these rows to `materialKey` later. The Owner must not need to know internal keys.

Framing and Deck taxonomy may be interleaved with DECK member takeoff. Bathroom/commercial/retaining lists follow those Work Area batches. Cladding/roofing lists wait for those WAs.

---

## 9. Current catalogue evidence (as-is)

Specific keys exist in `lib/rates/specific-material-catalogue.ts`. Live money consumption is still narrow: Deck decking lm (R2-R1) is the honest `used_now` path. Sheets, backfill m³, flooring m², paint L are largely unconsumed for money. **Zero framing sizes.** Package `scope.*` keys are `planned`, not primary pricing.

`resolveMaterialRate` is now used by Deck decking; it must remain the material resolver. Do not revive work-area first-match.

---

## 10. Non-goals of this lock

Inserting catalogue rows · supplier APIs · takeoff UI · rewriting Owner `$23/m²` · RATE-QUALITY-01 implementation.
