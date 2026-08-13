# Material Pricing / Takeoff — Current-State Audit

**Status:** Complete — Audit / Specification only (2026-08-13)  
**Checkpoint:** Post Stage 3.2.2-R5 / before Stage 3.2.3  
**Scope:** Document materials architecture for takeoff design. **No catalogue rows, UI, or calculator changes in this pass.**

**Companions:**
- Takeoff architecture: `docs/architecture/QUOTR_MATERIAL_TAKEOFF_ARCHITECTURE.md`
- Cost-first commercial: `docs/architecture/QUOTR_COST_FIRST_COMMERCIAL_MODEL.md`
- Commercial authority audit: `docs/audits/COMMERCIAL_MARGIN_RATE_AUTHORITY_AUDIT.md`
- Plan: `docs/plans/POST_3_2_2_COMMERCIAL_MATERIALS_PLAN.md`

---

## 1. Executive verdict

Quotr has **partial takeoff math** (board lm, sheets, paint litres) and a **specific-material rates catalogue**, but **cost authority remains mostly m² packages and lump allowances**. Material build-ups are almost always `priced: false` (display metadata). `resolveMaterialRate` / `resolveBuildUpMaterialPricing` exist but are **not used by live calculators**.

**No dedicated takeoff / BOM table.** Takeoff detail lives in estimate line `notes` metadata (`materialBuildUp` / `materialBuildUps`).

---

## 2. Schema / models

| Layer | Path | Stores |
| --- | --- | --- |
| Org rates | `public.rates` (`002_assistant_schema.sql`) | `rate_type` labour/material/subcontractor/scope/package/allowance; `item_key`, `unit`, `cost_rate`, `sell_rate` |
| Rate ranges | `004_rate_ranges_and_soft_setup.sql` | low/high — unused by resolvers |
| Wastage | `021_company_material_wastage.sql` | default + category overrides |
| Estimate lines | `estimate_line_items` | category + money totals; **not** structured takeoff rows |
| Pricing lines | `011_pricing_documents.sql` | item_type incl. material |
| Calibration | `033_calibration_responses.sql` | observational materials_cost — not live authority |

---

## 3. User rates vs benchmarks

**Live path (`resolveRate`)** — `lib/estimate/rates.ts`:
1. Exact company `rates` row (`item_key` + `rate_type`)
2. Same-type work-area fallback
3. Caller benchmark if `allow_benchmark_rates`
4. Sell from company sell or margin derivation

**Latent path (`resolveMaterialRate`)** — `lib/estimate/resolve-material-rate.ts`:
company_specific → company_category → work_area → company_scope → benchmark_specific → missing

**Sources:**
- Benchmarks: `lib/estimate/benchmark-rates.ts`
- Component catalogue: `lib/rates/catalogue.ts`
- Specific takeoff catalogue: `lib/rates/specific-material-catalogue.ts` (lm / sheet / L)

**Critical gap:** `resolveBuildUpMaterialPricing` exercised in `scripts/verify-material-rates.ts` only — not deck/bathroom/fitout calculators.

---

## 4. Categories

| Mechanism | Keys | Live pricing? |
| --- | --- | --- |
| `MATERIAL_CATEGORY_KEYS` | decking, sheet, retaining, flooring, painting | **Defined only** — no calculator consumers |
| Specific catalogue groups | Decking / Sheet / Retaining / Flooring / Painting | Rates UI + verify |
| Wastage categories | default, decking, sheet_material, flooring, paint, timber_framing | Where calculators call `resolveMaterialWastage` |

**Extensibility:** Categories are string-key based and can expand (FRAMING, FIXINGS, CONCRETE, WATERPROOFING, FINISHES, etc.) without schema rewrite — **if** calculators resolve by canonical `item_key` rather than hardcoded benchmarks.

---

## 5. Build-ups vs priced qty

Helpers: `lib/estimate/material-buildups.ts`, `material-buildup-meta.ts`.

**All `create*BuildUp` helpers set `priced: false`.** So:
- Line **cost** usually = area × $/m² or lump
- Build-up lm/sheets/litres = **explanation only** (except where the line quantity itself is already takeoff units, e.g. face boards lm, skirting lm)

Quality: `getQualityFactor` scales labour qty / material qty / allowance totals — does not swap SKUs.

---

## 6. Estimate → Pricing → Quote

1. Calculators emit lines with qty/rates or lump recommended totals + optional build-up notes.
2. Pricing adapter: quantity_rate when qty + unit rates exist; else **lump_sum snapshot**.
3. Quote copies pricing `total_sell`; GST once.

**Implication:** even computed build-up lm rarely becomes the billed Pricing quantity unless the estimate line itself was qty×rate on takeoff units.

---

## 7. Matrix (Deck / Bathroom / Commercial Fitout)

| MATERIAL/CATEGORY | CURRENT RATE SOURCE | UNIT | CALCULATOR(S) | QTY DERIVED? | COST DERIVED? | HARDCODED? | USER OVERRIDE? | TAKEOFF CAPABLE? | GAP |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Decking boards (surface) | `resolveRate` → deck material m² / benchmarks | m² bill; lm in build-up | `deck.ts` | Partial | m²×rate; **lm not priced** | Benchmark fallback | Yes (keys) | Medium | Build-up `priced:false`; lm catalogue unused |
| Framing / substructure | `resolveRate` → `deck.substructure.m2` | m² | `deck.ts` | Area only | m²×rate | Benchmark | Yes | Low | No member sizes/spacings |
| Fixings | `resolveRate` → `deck.fixings.m2` | m² | `deck.ts` | Area | m²×rate | Benchmark | Yes | Low | Allowance-style |
| Vertical face / fascia | **Direct** `DECK_BENCHMARKS.faceBoardLm` | lm | `deck.ts` | fact lm or `2L+2W` or `0.5×area` | lm×rate | **Yes — bypasses resolveRate** | **No item_key** | Medium→High if edges added | No F/R/L/R; no height/board/spec; no wastage |
| Face board labour | literals 35/55 × lm | allowance | `deck.ts` | From face lm | Lump from literals | **Yes** | No | Low | Ignores org labour rates |
| Stairs / balustrade / etc. | Benchmark allowances | each / lump | `deck.ts` | Boolean + counts | Lump | Mostly | Partial | Low | Assemblies |
| Bathroom waterproofing | Benchmark | allowance | `bathroom.ts` | Area basis | Lump/min | Benchmark | Weak | Low–Med | Trade allowance |
| Bathroom tiling | `resolveRate` tiling m² | m² | `bathroom.ts` | Areas | Yes + minimum | Benchmark | Yes | Medium | Not tile SKU |
| Bathroom fixtures / services | Benchmarks | lump | `bathroom.ts` | Counts / booleans | Lump | Benchmark | Partial | Low | Packages |
| Wall lining GIB | Benchmark $/m² | allowance | `bathroom.ts` | Area; sheets display | m²×benchmark | Benchmark | No sheet key live | Medium | Sheets `priced:false` |
| Bathroom materials package | $/m² + minimum | lump | `bathroom.ts` | Area fallback | Lump | Benchmark | No | Low | Anti-takeoff fallback |
| Internal wall materials | `FITOUT_BENCHMARKS` hardcoded | m² | `fitout.ts` | L×H×sides | m²×rate | **Hardcoded** | No | Medium | Sheets display-only |
| Skirting | Hardcoded skirtingLm | lm | fitout | Yes | Yes | Hardcoded | No | Medium | Rate not company-resolvable |
| Flooring materials | Hardcoded package $/m² | m² | `calculateFlooring` | Area | Package | Hardcoded | Catalogue unused | Medium | `flooring.type` not consumed for rate |
| Paint materials | `resolveRate` painting m² | m² bill; L display | fitout painting | Area×coats→L display | m²×rate | Benchmark | m² yes; L unused | Medium | Litres `priced:false` |
| Plasterboard catalogue | Specific $/sheet | each | *(verify only)* | Helpers exist | **Not wired** | Catalogue | Would be | High (latent) | Infra ahead of adoption |

---

## 8. Deck face / fascia facts

| Fact / input | Present? | Used for face boards? |
| --- | --- | --- |
| `deck.length_m` / `deck.width_m` | Yes | Perimeter fallback `2L+2W` |
| `deck.height_m` | Yes | Labour/elevated; **not** face height |
| `deck.board_width_mm` | Yes | **Surface** decking lm only |
| `deck.board_material` | Yes | Surface rate only |
| `deck.vertical_face_boards_required` | Yes | Gate |
| `deck.vertical_face_board_length_lm` | Yes (conditional) | Overrides perimeter |
| Face/fascia height | **Missing** | — |
| Fascia board width | **Missing** | — |
| Fascia material / spec | **Missing** | Generic `faceBoardLm` |
| Exposed edges F/R/L/R | **Missing** | Full perimeter or user total lm |

Calculator (`deck.ts` ~570–607): if required → `faceLm` → materials from benchmark + labour 35/55 — **no wastage, no board width, no height → no face cladding m²**.

---

## 9. Hard-coded vs rate-driven (summary)

| Pattern | Examples |
| --- | --- |
| Rate-driven (`resolveRate`) | Deck surface materials, substructure, fixings; bathroom tiling; painting m² |
| Benchmark-hardcoded (bypass resolve) | Deck face boards; many fitout materials; door prep literals |
| Display-only takeoff | Decking lm, sheets, paint litres (`priced: false`) |
| Latent rate infra | `specific-material-catalogue`, `resolveMaterialRate`, `resolveBuildUpMaterialPricing` |

---

## 10. Architecture gaps (priority)

1. Build-ups never priced — takeoff qty ≠ commercial qty for most materials.
2. Dual rate stacks unused on live paths.
3. `MATERIAL_CATEGORY_KEYS` orphaned.
4. Hardcoded cost/sell pairs (face labour; fitout doors/prep).
5. Fascia facts insufficient for edge-based takeoff.
6. Flooring / plasterboard type often don’t select matching specific rates.
7. Timber framing wastage underused on deck framing.
8. No BOM persistence — money lines only.
9. Lump-heavy bathroom/fitout — poor itemised takeoff fit.
10. Quality factor scales money/qty; does not swap specs.

---

## 11. Key file paths

| Role | Path |
| --- | --- |
| Deck calculator | `lib/estimate/calculators/deck.ts` |
| Bathroom | `lib/estimate/calculators/bathroom.ts` |
| Fitout | `lib/estimate/calculators/fitout.ts` |
| Benchmarks | `lib/estimate/benchmark-rates.ts` |
| Material rate keys | `lib/estimate/material-rate-keys.ts` |
| Resolve material rate | `lib/estimate/resolve-material-rate.ts` |
| Build-up pricing (unused live) | `lib/estimate/material-rate-pricing.ts` |
| Build-ups | `lib/estimate/material-buildups.ts` |
| Wastage | `lib/settings/material-wastage.ts` |
| Specific catalogue | `lib/rates/specific-material-catalogue.ts` |
| Deck questions | `lib/scopes/templates/deck.ts` |
| Estimate→Pricing | `lib/pricing/estimate-to-pricing-adapter.ts` |
| Prior hardcodes audit | `docs/audits/STAGE_1_CURRENT_STATE_AUDIT.md` §8 |
