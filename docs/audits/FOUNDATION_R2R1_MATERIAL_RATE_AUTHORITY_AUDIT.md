# FOUNDATION-R2-R1 — Material rate authority audit

**Status:** Complete Local / Owner Preview Pending  
**Date:** 2026-08-16  
**Does not start:** REQ-1, MaterialRequirement emission, Materials Catalogue V2, Deck takeoff/face boards, Production  

**Companions:**
- Consumption matrix: `docs/audits/QUOTR_MATERIAL_RATE_CONSUMPTION_MATRIX.md`
- Completion: `docs/implementation/FOUNDATION_R2R1_MATERIAL_RATE_AUTHORITY_COMPLETION.md`
- R2-R1-R1 precedence: `docs/implementation/FOUNDATION_R2R1R1_CONTRACTOR_RATE_PRECEDENCE_COMPLETION.md`
- Owner Preview: `docs/runbooks/FOUNDATION_R2R1_OWNER_PREVIEW.md`

FOUNDATION-R2 question work remains valid. This batch is an Owner-discovered commercial remediation after R2 Preview. Do not mark R2 Owner PASS from this document.

**FOUNDATION-R2-R1-R1 (2026-08-16):** contractor matching `$/m²` now outranks Quotr `$/lm` when board coverage conversion is deterministic. See §3 and the R2-R1-R1 completion note. The Owner `$23/m²` row was **not** rewritten.

---

## 1. Deck root cause (Owner Preview)

Estimate showed:

- Deck area 16.12 m²
- Physical takeoff ≈ 126.65 lm hardwood including 10% waste
- Board width 140 mm
- Priced **Decking materials package**: 16.12 m² × ~$23 cost / ~$25 sell ≈ $403 sell

**Root cause:** `calculateDeckingBoardLm` already computed purchase lm and attached it as `materialBuildUp` with `priced: false`. Money still used `resolveRate` on `deck.material.hardwood.m2` × deck area. Specific catalogue `$/lm` keys (`deck.material.hardwood.lm` etc.) were labelled **Used now** in Rates but no live calculator called `resolveMaterialRate` / `resolveBuildUpMaterialPricing`.

126.65 exists because:

```
baseLm     = round2(16.12 / 0.14) = 115.14
wastageLm  = round2(115.14 × 0.10) = 11.51
totalLm    = round2(115.14 + 11.51) = 126.65
```

Not `16.12 / 0.14 × 1.10` rounded once (that is 126.66).

**Classification:** CURRENT COMMERCIAL DEFECT — unused-rate + unit mismatch (display lm vs priced m²). Fixed for Deck decking in this batch.

---

## 2. Unit consistency invariant

For a quantity-priced material line:

**priced quantity unit must match rate unit**, or an explicit documented conversion must exist.

Valid: `126.65 lm × $18.50/lm` · `16.12 m² × $145/m²`  
Invalid: `126.65 lm × $145/m²` · `16.12 m² × $18.50/lm`

Display-only physical takeoff may sit on an allowance line only if the UI says the **price is an allowance**. Breakdown heading is now:

- `priced: true` → **Material quantities**
- `priced: false` → **Physical takeoff (not used for this price)**

---

## 3. Rate source hierarchy (R2-R1-R1)

**Lock:** contractor / company pricing outranks Quotr benchmark where the company rate maps to the same physical material and unit conversion is explicit and deterministic. `$23/m²` is never treated as `$23/lm`.

Deck decking (`resolveDeckingBoardPricing`):

1. Company exact canonical `$/lm` for that material (`hardwood` / `kwila` / `composite` / `treated pine`).
2. Company exact matching `$/m²` for the **same** material, converted with known board coverage:
   `equivalent_cost_per_lm = cost_per_m² × (board_width_mm / 1000)`.
3. Quotr exact canonical `$/lm` benchmark.
4. Matching `$/m²` as an **area package** (net deck area × `$/m²`) when lm cannot be used.
5. Missing pricing / explicit allowance when benchmarks are disabled and no company rate exists.

**Not converted:**

- Unrelated material identity (treated-pine m² must not price hardwood).
- Category / scope / generic deck package (`deck.substructure.m2`, `deck.fixings.m2`, `scope.deck.m2`).
- Quotr `$/m²` → `$/lm`. Repository Quotr m² and lm series are independently calibrated (hardwood m² $230 vs lm $22; $22 / 0.14 ≈ $157/m², not $230). Converting Quotr m² would fight the more specific Quotr `$/lm`.

**Kwila m² identity:** there is no `deck.material.kwila.m2` row. `MATERIAL_RATE_KEYS.deckingKwilaM2` aliases to `deck.material.hardwood.m2`. That alias is the documented kwila m² identity, not a generic override.

Generic `resolveMaterialRate` still requires unit match. `resolveBuildUpMaterialPricing` remains lm-then-package for non-Deck callers.

Removed (R2-R1): first-match “any material rate for this work area” inside `resolveMaterialRate`.

Cost-first remains: quantity × unit cost → total cost → GM → sell. Converted cost-only company m² re-derives sell from GM. COMMERCIAL-P0 legacy paired sell still applies to benchmark pairs and to converted paired company rows.

---

## 4. Deck pricing before / after

| | Before | After (board width known) | After (width unknown) |
| --- | --- | --- | --- |
| Physical qty | 126.65 lm (display) | 126.65 lm | none |
| Pricing qty | 16.12 m² | 126.65 lm | 16.12 m² |
| Rate | `deck.material.hardwood.m2` | company `$/lm`, or converted company `$/m²`, or Quotr `$/lm` | m² package |
| Line label | Decking materials package | Decking materials | Decking materials package |
| Build-up `priced` | false | true | n/a |

Owner 16.12 m² hardwood, empty company rates, 20% GM, standard quality:

| | Cost | Sell (legacy paired benchmark) |
| --- | --- | --- |
| Before (Quotr m² $230/$340) | 16.12 × 230 = $3,707.60 | 16.12 × 340 = $5,480.80 |
| After (Quotr lm $22/$34) | 126.65 × 22 = $2,786.30 | 126.65 × 34 = $4,306.10 |

Owner’s live Preview (~$23/m², ~$403 sell) was a **company m² rate**, not the Quotr $230/m² benchmark. That persisted row was **not** rewritten. With board width known, R2-R1-R1 converts a matching company m² using 140 mm coverage (`$23 × 0.14 = $3.22/lm`) rather than ignoring it for a Quotr `$/lm`. If `$23` was meant as `$/lm` typed into the m² field, enter a company `$/lm` under All materials (that still wins as step 1). See Owner row identity in the R2-R1-R1 completion note.

Outdoor calibration Deck 1 (70 m² hardwood, 140 mm, 10% waste → 550 lm): sell **$53,440 → $48,340** (−$5,100 = 70×$340 − 550×$34). Explicit correctness fix. Fence/Pergola/RW goldens unchanged.

---

## 5. Deck remaining simplifications (not added)

| Topic | Current treatment | Later |
| --- | --- | --- |
| Board gap / face vs nominal width | Nominal `board_width_mm` as coverage width. 126.65 lm is estimate-level takeoff, not fabrication accuracy. | DECK-1 |
| Effective cover vs nominal | Not modelled (gaps ignored) | DECK-1 |
| Orientation | Ignored | DECK-1 |
| Board length / offcuts | Not modelled | DECK-1 |
| Irregular geometry | Area fact or L×W rectangle | DECK-1 |
| Wastage | Company `decking` % (fixture 10%) | keep |
| Substructure | m² package `deck.substructure.m2` | DECK-1 joist/bearer |
| Fascia | Hardcoded `$22/35` lm + labour 35/55 | DECK-2; do not reuse surface decking.lm (would double-count) |
| Fixings / concrete | m² package / not asked | Catalogue V2 / DECK-1 |

---

## 6. Material-bearing calculator audit (summary)

Legend: **correct** · **allowance but honest** · **mismatch** (fixed or remaining) · **hardcoded** · **unused-rate** · **future**

| WA | Line | Physical | Phys unit | Pricing qty | Price unit | Rate key | Rate unit | Source | Specific available? | Consumed? | Status |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Deck | Decking | takeoff lm | lm | **lm** (was m²) | lm | `deck.material.*.lm` | lm | resolveMaterialRate | Yes | **Yes (R2-R1)** | **correct** |
| Deck | Framing | — | — | area | m² | `deck.substructure.m2` | m² | resolveRate | m² package only | Yes | allowance honest |
| Deck | Fixings | — | — | area | m² | `deck.fixings.m2` | m² | resolveRate | No SKU | Yes | allowance honest |
| Deck | Fascia | face lm | lm | face lm | lm | none | lm | **hardcoded** faceBoardLm | decking.lm exists but **must not** share | No | hardcoded / future DECK-2 |
| Deck | Face labour | — | — | lump | allow | none | — | hardcoded 35/55 | labour.hour | No | hardcoded |
| Deck | Stairs/balustrade/piles | — | — | lump | allow | benchmarks | — | allowance | — | — | allowance honest |
| Bathroom | Waterproofing | area optional | m² | lump or area | allow/m² | bathroom WP | — | allowance | extent unused | Partial | allowance honest |
| Bathroom | Tiling | tile areas | m² | tile m² | m² | `bathroom.tiling.m2` | m² | resolveRate | No SKU | Yes | allowance/package |
| Bathroom | Linings | sheet count display | each | lining m² | m² | hardcoded lining | m² | benchmark | sheet.* **unused** | No | unused-rate / future |
| Bathroom | Fixtures/services/UFH | — | — | lump | allow | allowances | — | resolveRate/bench | — | Partial | allowance honest |
| Retaining | Face material | face m² | m² | face m² | m² | timber/concrete face_m2 | m² | resolveRate | No sleeper lm | Yes | allowance honest |
| Retaining | Drainage | novacoil lm | lm | lm | lm | `retaining_wall.drainage.lm` | lm | resolveRate | Yes | Yes | **correct** |
| Retaining | Backfill | volume m³ | m³ | face m² | m² | `…backfill.face_m2` | m² | resolveRate | `…backfill.m3` unused | **No m³** | unused-rate / mismatch display |
| Retaining | Disposal | — | — | lump/lm | — | disposal | — | resolveRate | — | Yes | allowance honest |
| Fence | Materials | length | lm | length | lm | `fence.material.*.lm` | lm | resolveRate | posts/palings unused | Fence-lm package | allowance honest |
| Fence | Gate/finish | — | — | lump | allow | gate/finish | — | resolveRate | gate_width unused | Partial | allowance honest |
| Pergola | Frame | area | m² | area | m² | frame package | m² | resolvePergolaFrameRate | posts/beams unused | Package | allowance honest |
| Pergola | Roof/footings/gutters | — | — | m² / lump / lm | — | pergola keys | — | resolveRate | height unused | Partial | allowance honest |
| Kitchen | Cabinetry/benchtop | — | — | lump | allow | kitchen allowances | — | resolveRate | island/lm unused | Package | allowance honest |
| Demolition | Disposal/waste/skip | area/items | mixed | m² / lump | mixed | demolition.* | matching | resolveRate | — | Yes | mostly correct |
| Ext. stairs | Structure | risers | riser | risers | riser | `external_stairs.material.riser` | riser | resolveRate | — | Yes | package |
| Ext. stairs | Handrail | lm | lm | lump | allow | handrail.lm | lm | resolveRate as allowance | — | Partial | allowance |
| Int. walls | Materials | sheet count display | each | wall m² | m² | hardcoded FITOUT m² | m² | hardcoded | sheet.* unused | No | unused-rate |
| Int. walls | Insulation/skirting | area / lm | m²/lm | same | same | hardcoded | matching | hardcoded | — | hardcoded | hardcoded |
| Ceilings | Materials | sheet display | each | area | m² | hardcoded | m² | hardcoded | ceiling.tile unused | No | unused-rate |
| Doors | Leaf/frame/hw | count | each | count/lump | each | hardcoded/allow | — | hardcoded | — | hardcoded | hardcoded |
| Flooring | Finish | area+waste display | m² | area | m² | hardcoded flooringPerM2 | m² | hardcoded | flooring.*.m2 unused | No | unused-rate |
| Painting | Paint | litres display | L | area | m² | `painting.material.m2` | m² | resolveRate | paint.litre unused | m² yes / L no | unused-rate display |
| Plastering | Compounds | — | — | area | m² | hardcoded | m² | hardcoded | — | hardcoded | hardcoded |

**DUP-DECK-01 (Critical):** same boards priced m² while showing lm — **fixed**.  
**DUP-DECK-FACE-01:** fascia hardcoded vs surface decking.lm — different components; do not merge keys.  
**DUP-RW-01 (High unused-rate, not double-add):** backfill m³ displayed, face m² priced. Deferred (not Deck).  
**DUP-SHEET-01 / DUP-PAINT-01 / DUP-FLOOR-01:** same pattern. Deferred. No Critical/High **double-add** of two money lines for one physical material after Deck fix.

---

## 7. Labour unit audit

**PASS (commercial engine).** Labour money is `labourHours × $/hr` via `requireEstimateLabourMoney`. Deck labour still **displays** area as quantity with a separate Labour hours field and $/hr rate. That is presentation noise, not double pricing. Do not start REQ-3.

---

## 8. Breakdown truthfulness

| Line class | Can explain qty / rate / unit / source / cost / sell? |
| --- | --- |
| Deck decking (lm path) | **Yes** after R2-R1 |
| Deck decking (no width) | Honest package; no fake lm |
| Other `priced: false` build-ups | Heading now says takeoff is not the price |
| Hardcoded fascia / fitout packages | Rate source “Benchmark allowance”; no item_key on fascia |
| Lump allowances | Cost/sell visible; quantity 1 allow |

---

## 9. Material pricing maturity (separate from WA maturity)

| WA | Class |
| --- | --- |
| Deck decking (with board width) | **A** quantity-driven + specific-rate ready |
| Deck substructure/fixings | **C** allowance-first |
| Deck fascia | **D** hardcoded |
| Bathroom / Kitchen / Pergola | **C** |
| Retaining face + drainage | **B** / drainage **A**; backfill **C** with display mismatch |
| Fence | **B** (lm package, not post/paling takeoff) |
| Demolition disposal | **B** |
| External stairs | **C** |
| Commercial components | **C** / **D** hardcoded + unused specific rates |
| Most specific catalogue (sheets, m³ backfill, paint L) | **E** / future until wired |

---

## 10. REQ-1 gate

REQ-1 may begin **after Owner R2-R1 + R2-R1-R1 Preview PASS**, not before:

- Deck decking qty/rate units are understood and reconciled.
- Contractor vs Quotr precedence is implemented for Deck (`resolveDeckingBoardPricing`).
- No remaining Critical/High **double-add**.
- Requirement outputs must carry honest `priced` flags so they do not disagree with estimate money.
- Other WAs remain allowance-first; do not emit universal MaterialRequirement.

Do **not** start REQ-1 in this batch. Technical readiness of the listed gates is recorded in `FOUNDATION_R2R1R1_CONTRACTOR_RATE_PRECEDENCE_COMPLETION.md`.
