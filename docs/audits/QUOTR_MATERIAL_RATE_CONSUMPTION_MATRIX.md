# Quotr material rate consumption matrix

**Classification:** SUPPORTING. **CANONICAL:** `docs/architecture/QUOTR_MATERIAL_DOMAIN_ARCHITECTURE.md`.  
**Status:** FOUNDATION-R2-R1-R1 (2026-08-16)  
**Drives:** Materials Catalogue V2 (not started)  
**Rule:** Do not ask a contractor to maintain a rate that live estimating silently ignores. `calculatorSupport`: `used_now` | `planned`.

Resolver paths:

- `resolveRate` — live calculators (most packages)
- `resolveDeckingBoardPricing` — Deck decking (R2-R1-R1 contractor precedence + conversion)
- `resolveMaterialRate` / `resolveBuildUpMaterialPricing` — generic build-up helper (unit match; lm then package)
- Direct hardcoded `FITOUT_BENCHMARKS` / `DECK_BENCHMARKS.faceBoardLm` — bypass

---

## Specific takeoff catalogue (`lib/rates/specific-material-catalogue.ts`)

| Rate key | Category | Unit | Rates UI | Company | Benchmark | Live consumer | Fallback consumer | Legacy? | Planned |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `deck.material.treated_pine.lm` | Decking | lm | Yes | Yes | treatedPineLm | **Deck** `calculateDeck` | — | No | — |
| `deck.material.hardwood.lm` | Decking | lm | Yes | Yes | hardwoodLm | **Deck** | — | No | — |
| `deck.material.kwila.lm` | Decking | lm | Yes | Yes | kwilaLm | **Deck** | — | No | — |
| `deck.material.composite.lm` | Decking | lm | Yes | Yes | compositeLm | **Deck** | — | No | — |
| `sheet.plasterboard.standard.each` | Sheet | each | Yes | Yes | plasterboardSheet | **None** | — | No | Fitout lining |
| `sheet.plasterboard.fyreline.each` | Sheet | each | Yes | Yes | fyrelineSheet | None | — | No | Fitout |
| `sheet.plasterboard.aqualine.each` | Sheet | each | Yes | Yes | aqualineSheet | None | — | No | Bathroom/fitout |
| `sheet.plasterboard.braceline.each` | Sheet | each | Yes | Yes | bracelineSheet | None | — | No | Fitout |
| `sheet.plywood.each` | Sheet | each | Yes | Yes | plywoodSheet | None | — | No | Fitout |
| `ceiling.tile.m2` | Sheet | m2 | Yes | Yes | ceilingTilePerM2 | None | — | No | Ceilings |
| `retaining_wall.backfill.m3` | Retaining | m3 | Yes | Yes | backfillPerM3 | None | volume display only | No | RW takeoff |
| `flooring.material.m2` | Flooring | m2 | Yes | Yes | flooringPerM2 | None (hardcoded package) | — | Near-legacy | Wire resolveRate |
| `flooring.vinyl.m2` | Flooring | m2 | Yes | Yes | vinylPerM2 | None | — | No | Flooring type |
| `flooring.carpet.m2` | Flooring | m2 | Yes | Yes | carpetPerM2 | None | — | No | Flooring type |
| `paint.litre` | Painting | l | Yes | Yes | paintPerLitre | None | litres display only | No | Paint takeoff |
| `painting.material.m2` | Painting | m2 | Yes | Yes | paintingPerM2 | **Painting** `resolveRate` | — | No | — |

Classification: **A** actively consumed · **B** some calculators · **C** future/unused · **D** legacy

Decking lm = **A**. Painting m² = **A**. All other specific rows = **C** (Rates UI **Planned**).

---

## Component material catalogue (selected live keys)

| Rate key | Unit | UI | Live consumer | Class |
| --- | --- | --- | --- | --- |
| `deck.material.treated_pine.m2` | m2 | Yes | Deck: convert to lm when matching company rate + width known; else area package | A |
| `deck.material.hardwood.m2` | m2 | Yes | Deck convert/package (kwila aliases here) | A |
| `deck.material.composite.m2` | m2 | Yes | Deck convert/package | A |
| `deck.substructure.m2` | m2 | Yes | Deck framing | A |
| `deck.fixings.m2` | m2 | Yes | Deck fixings | A |
| `labour.carpenter.hour` | hour | Yes | Most calculators via `resolveLabourRate` | A |
| `fence.material.timber.lm` / `metal.lm` | lm | Yes | Fence materials package | A |
| `retaining_wall.material.timber.face_m2` | m2 | Yes | RW face | A |
| `retaining_wall.drainage.lm` | lm | Yes | Novacoil line | A |
| `retaining_wall.backfill.face_m2` | m2 | Yes | RW backfill **package** | A |
| `bathroom.tiling.m2` | m2 | Yes | Bathroom tiling | A |
| `kitchen.cabinetry.allowance` | allowance | Yes | Kitchen | A |
| `demolition.waste.m2` | m2 | Yes | Demo waste | A |
| `scope.deck.m2` | m2 | Scope (planned) | Not live money | C / D |
| `MATERIAL_CATEGORY_KEYS.decking` | — | No row | Defined only | C |

---

## Hardcoded (no catalogue item_key)

| Location | Amount | Class |
| --- | --- | --- |
| Deck fascia `DECK_BENCHMARKS.faceBoardLm` | $22/35 lm | D |
| Deck face labour | $35/55 × lm | D |
| Fitout `calculateAreaBasedFitout` materials | FITOUT m² pairs | D |
| Many bathroom fixture map literals | benchmark pairs | D |

---

## Consumer graph (Deck decking after R2-R1-R1)

```
deck.board_material + deck.board_width_mm + area
  → calculateDeckingBoardLm
  → resolveDeckingBoardPricing
       → company exact matching $/lm
       → else company matching $/m² × coverage width (waste once via purchase lm)
       → else Quotr exact $/lm
       → else matching m² area package (no fake lm if width unknown)
  → estimate line "Decking materials" (lm) or "Decking materials package" (m²)
```

`resolveBuildUpMaterialPricing` is **not** yet called from bathroom/fitout/retaining backfill. Those still attach display-only build-ups.

### Deck material matrix

| Material | Company lm | Company m² | Quotr lm | Quotr m² | Same boards? | Convert company m²? | Order |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Treated pine | `deck.material.treated_pine.lm` | `deck.material.treated_pine.m2` | $14/$22 | $160/$240 | Yes (not framing/fixings) | Yes if width known | company lm → company m² conv → Quotr lm → m² package |
| Hardwood | `deck.material.hardwood.lm` | `deck.material.hardwood.m2` | $22/$34 | $230/$340 | Yes | Yes if width known | same |
| Kwila | `deck.material.kwila.lm` | **alias** `deck.material.hardwood.m2` (no kwila m² row) | $28/$42 | $280/$400 package bench | Yes via hardwood m² alias | Yes (alias only) | same; pine/composite m² must not win |
| Composite | `deck.material.composite.lm` | `deck.material.composite.m2` | $24/$36 | $260/$380 | Yes | Yes if width known | same |

Quotr m² is **not** converted to lm (independently calibrated). `deck.substructure.m2` / `deck.fixings.m2` are other components — never converted onto decking lm.
