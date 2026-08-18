# DECK-1D-A — Legacy Substructure Decomposition

**Status:** COMPLETE / OWNER CALIBRATION MODEL VALIDATED (audit evidence; Owner D1–D9 in gate)  
**Date:** 2026-08-18  
**HEAD:** `b432dfbdd4dee296bbde7b8cf7a5f9551068b952`  
**Mode:** Audit only. No production behaviour change. No new prices.  
**Calibration contract:** `docs/architecture/DECK_STRUCTURAL_CALIBRATION_CONTRACT.md`  
**Plan:** `docs/plans/DECK_1D_CALIBRATION_PLAN.md`  
**Owner gate:** `docs/runbooks/DECK_1D_A_OWNER_CALIBRATION_GATE.md`

Inclusion classes used below:

| Class | Meaning |
| --- | --- |
| **EXPLICITLY INCLUDED** | Code, catalogue, or named line proves the item is inside this money source |
| **EXPLICITLY SEPARATE** | A different live money line / requirement owns it |
| **LIKELY BUNDLED** | Planning/docs treat it as inside the package, but code does not enumerate SKUs |
| **UNKNOWN** | No reliable evidence either way |

Do not treat LIKELY BUNDLED as a quantity model.

---

## 1. Legacy `deck.substructure.m2` — code facts

**Source of truth:** `lib/estimate/calculators/deck.ts` + `lib/estimate/benchmark-rates.ts` + `lib/rates/catalogue.ts`.

| Field | Evidence |
| --- | --- |
| Item key | `deck.substructure.m2` |
| Line label | `Framing/substructure` |
| Catalogue label | `Deck substructure / framing` |
| Catalogue description | **None** (no SKU/member list) |
| Category | `materials` |
| Unit | m² (`m2` in resolver) |
| Quantity | `effectiveArea` (fact area, else L×W, else assumed 20 m²) |
| Inclusion gate | `deck.substructure_included` defaults **true** |
| Fallback cost | `DECK_BENCHMARKS.framing.cost` = **$120 / m²** |
| Fallback sell | `DECK_BENCHMARKS.framing.sell` = **$180 / m²** |
| Formula | `round2(effectiveArea × qualityFactor) × costRate` / same × sellRate |
| Quality (`standard`) | factor **1.0** — so standard jobs = area × 120 / 180 |
| Access / Project Conditions | **Do not** change this line’s quantity or rate |
| Elevation / height | **Do not** change this line (labour hours do) |
| `componentKey` on the line | **None** |
| Commercial authority | Unregistered legacy line = live **LEGACY money** for framing package |

Resolver: `resolveRate({ rateType: "material", itemKey: "deck.substructure.m2", workAreaType: "deck" })`. Company exact `item_key` outranks fallback. A **work-area-type=deck** material rate with a *different* item key can still steal this line via `resolveRate` work-area fallback — calibration fixtures must not set `work_area_type: "deck"` on unrelated material rows.

There is **no code list** of joists, bearers, posts, concrete, connectors, waste, or labour inside this package. Economically it is an **area-normalised materials package**.

---

## 2. Inclusion classification for `deck.substructure.m2`

| Candidate | Class | Evidence |
| --- | --- | --- |
| Joists / rim / bearers (new construction) | **LIKELY BUNDLED** | DECK-1A audit + physical model: not separately represented; package labelled framing/substructure. Code does not name members. |
| Supports / posts / piles (new construction) | **LIKELY BUNDLED** | Same. No new-construction post line. |
| Footings / concrete (new construction) | **LIKELY BUNDLED** | Same. No concrete line. |
| Blocking / nogs / trimmers / double joists | **LIKELY BUNDLED** | Same. Not emitted in detailed model. |
| Structural connectors (hangers, brackets, bolts) | **UNKNOWN** vs fixings line | Could sit in $120 package, $25 fixings package, or both. Neither catalogue describes SKUs. |
| Framing timber waste / stock-length waste | **LIKELY BUNDLED** | Package has no waste factor; detailed model applies framing waste % to timber lm only. |
| Delivery / cartage / plant | **UNKNOWN** | Not modelled on this line. |
| Small-load concrete economics | **UNKNOWN** | Not modelled. If concrete is in the bundle, small-load is implicit and unquantified. |
| Structural labour | **UNKNOWN** (see §5) | Line category is **materials**. Separate Deck labour line exists. Contractor mental models may still fold framing labour into “substructure”. |
| Decking boards | **EXPLICITLY SEPARATE** | `decking.surface` REQUIREMENT_AUTHORITATIVE |
| Deck labour lump | **EXPLICITLY SEPARATE** | Always-emitted “Deck labour” line + SHADOW `deck.labour` |
| Fixings and consumables | **EXPLICITLY SEPARATE** | Always-emitted `deck.fixings.m2` (even if substructure excluded) |
| Existing-deck demolition | **EXPLICITLY SEPARATE** | “Existing deck removal” labour |
| Pile/post **replacement** | **EXPLICITLY SEPARATE** | Allowance when `deck.pile_or_post_replacement_required` |
| Substructure **replacement** (existing) | **EXPLICITLY SEPARATE** | Allowance when condition is partial/full |
| Stairs / balustrade / handrail | **EXPLICITLY SEPARATE** | Flat allowances |
| Face / fascia boards | **EXPLICITLY SEPARATE** | DECK-2 lines |
| Engineering / consent | **EXPLICITLY SEPARATE** | Exclusion/assumption text only — no money |

**Conclusion:** `$120/m²` is a **generic materials package**, not a takeoff. Comparing it to priced joists+rim+bearers alone is **not** a like-for-like materials variance.

**Provenance note:** The repository provides **current system semantics** (the live estimator stores/uses `$120/m²` as a benchmarked recommended cost), but it does **not** prove the original economic composition of the historical `$120/m²` package. If original net material composition (labour/P&G/overhead/contingency) cannot be established from code/docs, treat this as **LEGACY COMMERCIAL ESTIMATING PACKAGE — COST PROVENANCE UNKNOWN** and keep comparisons **directional** (NOT meaningful variance on net-material basis).

---

## 3. All related legacy Deck structural money

| Legacy line | Trigger | Basis | Fallback cost | Fallback sell | componentKey | Authority | Overlap with detailed model |
| --- | --- | --- | ---: | ---: | --- | --- | --- |
| Framing/substructure | `substructure_included` ≠ false | area × `$/m²` | 120 | 180 | none | LEGACY money | Intended parent of joists/rim/bearers/supports/concrete/blocking |
| Fixings and consumables | **always** | area × `$/m²` | 25 | 40 | none | LEGACY money | Surface screws **and/or** structural connectors — **UNKNOWN split** |
| Deck labour | **always** | area × 1.2 h/m² (+0.25 if elevated) × labour $/h | 60/h | 90/h | `deck.labour` | Line owns money; requirement **SHADOW** | Combined generic Deck labour — not structural-only |
| Existing deck removal | demolition fact true | area × 0.35 h/m² × labour $/h | same labour | same | none | LEGACY | Not in detailed structural children |
| Pile/post replacement | replacement required | count × 180/ea **or** lump 1200/1800 | 180 ea / 1200 lump | 280 ea / 1800 lump | none | LEGACY allowance | **Double-count risk** vs new `deck.supports` on rebuild jobs |
| Substructure replacement allowance | condition partial/full and no pile line | lump | 650 partial / 1200 full | 1000 / 1800 | none | LEGACY allowance | **Double-count risk** vs new framing package on same job |
| Stair / step / multi-side allowances | access_type / has_stairs | lump | 350 / 1000 / 1800 | 550 / 1500 / 2600 | none | LEGACY | Adjacent, not DECK-1 structure |
| Balustrade / handrail | flags | lump | 900 / 400 | 1400 / 650 | none | LEGACY | Adjacent |
| Vertical face boards + labour | face boards required | lm × 22/35 + labour 35/55 | hardcoded | hardcoded | none | LEGACY (DECK-2) | Not DECK-1 |

Shadow children (`deck.joists` … `deck.concrete`) emit MaterialRequirements. They are **unregistered** in the authority registry, so `getComponentCommercialAuthority` returns default `LEGACY_AUTHORITATIVE`, but they have **no matching legacy `componentKey` lines**. Operationally they are **SHADOW diagnostics** — they do not enter estimate totals.

---

## 4. Double-count risks

| Risk | When | Current mitigation | Calibration note |
| --- | --- | --- | --- |
| Children + `deck.substructure.m2` | If children were promoted while package still money | Children do not contribute money today | Promotion must retire or fallback the package |
| Structural connectors + `deck.fixings.m2` | If a structural-fixings child is added without shrinking fixings | No structural-fixings child | Keep fixings legacy until split is explicit |
| Calibration comparing $120 package to timber-only | Always, if misread as “savings” | This audit | Label **incomplete / unexplained variance** |
| Labour inside $120 **and** Deck labour line | Unknown economically | Code charges labour separately | Materials-only vs all-in comparison must be stated |
| Pile replacement + new supports | Rebuild / existing-deck jobs | Separate triggers | REAL-JOB fixtures must flag both |
| Work-area material fallback | Disposable/company rates with `work_area_type: deck` | Exact item_key preferred | B2 Preview proved this can change framing **and** fixings |

---

## 5. Labour coverage (actual formula)

**Line:** “Deck labour” (`componentKey: deck.labour`).  
**Requirement:** SHADOW; same hours and `resolveLabourRate` object.  
**Docs:** REQ-3.1 — *lumped “Deck labour” line only. Does not emit demolition, fascia/face labour, stairs, or balustrade.*

Formula (`deck.ts`):

```
hoursPerM2 = 1.2
if elevated (level contains "elevated" OR height_m > 0.3): hoursPerM2 += 0.25
hours = shapeLabourHours(effectiveArea, hoursPerM2, labourAccessFactor, qualityFactor)
cost  = hours × labour cost $/h   (fallback $60 / $90)
```

**What it represents:** combined **generic Deck carpenter labour** for the work area — not surface-only, not framing-only, not a task split.

**What it is not:** DECK-3 task-level (setout / piles / bearers / joists / decking / cleanup).

Access/carry/occupied-site factors adjust **labour hours**, not the substructure m² package.

---

## 6. Fixings coverage

Live line: **Fixings and consumables** / `deck.fixings.m2` / $25 cost / $40 sell / always on / area × quality.

Catalogue does **not** say “decking screws only” or “all fixings including hangers”.

DECK-1 physical model **defers** `deck.fixings.structural` and `deck.fixings.surface`. DECK-1B verifier asserts structural fixings are **not emitted**.

**Classification:** EXPLICITLY SEPARATE from `deck.substructure.m2`. Split between surface vs structural = **UNKNOWN**.

**Promotion implication:** `deck.fixings.m2` can remain legacy temporarily **if** structural children promotion does not also invent a second fixings money source.

---

## 7. Supports / concrete / blocking (detailed model)

### Supports (`deck.supports`)

| | |
| --- | --- |
| Physically modelled? | **Yes** — EA count = bearer rows × supports per bearer |
| Quantity trustworthy? | Count **yes**; product length **no** |
| Identity? | Type + section + treatment; processing unused |
| Rate coverage? | **None** in Quotr benchmarks. B1: 90×90 H5 sold **lm / long pieces**, not length-free EA |
| Current authority? | SHADOW diagnostic; `priced=false` |
| DECK-1 scope? | Yes (emit) |
| Promotion blocker? | **Yes** — required + unpriced is **ECONOMIC_GAP**, not an exclusion. Later: rate, allowance, legacy fallback, or blocking pricing-required |

DECK-RATE-REF-01: **8 EA**, unpriced.

### Concrete (`deck.concrete`)

| | |
| --- | --- |
| Physically modelled? | **Yes** — supportCount × footing L×W×D |
| Quantity trustworthy? | Volume math **yes**; mix **unknown**; waste **0%** disclosed |
| Identity? | Family `concrete`; mix not frozen |
| Rate coverage? | **None**. B1: Firth **no public unknown-mix $/m³**; small-load threshold **3 m³** vs fixture **0.324 m³** |
| Current authority? | SHADOW diagnostic; `priced=false` |
| Promotion blocker? | **Yes** — required + unpriced is **ECONOMIC_GAP**, not an exclusion. Later: allowance, company rate, mix+small-load, or legacy fallback |

### Blocking / nogs / trimmers

**Not emitted.** Reserved `deck.blocking`. Trimmers / double joists **non-MVP**. Commercial materiality: **unknown $**, likely material on elevated/opening jobs, secondary vs supports+concrete+connectors on SIMPLE fixtures.

---

## 8. Detailed coverage matrix

| Row | Physically modelled? | Qty trustworthy? | Material identity? | Rate coverage? | Labour coverage? | Commercial authority | DECK-1 scope? | Promotion blocker? | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Joists | Yes | Yes (rect. L×W + spec) | Yes when section+grade+treatment+processing known | Exact company/project **or** Quotr KD lm benchmark | No (in Deck labour lump) | SHADOW | Yes | Rate incomplete if identity partial | 90/140/190 SG8 H3.2 KD only |
| Rim / boundary | Yes | Yes (2 × end span) | Same stock as joists | Same as joists | No | SHADOW | Yes | Same | Outer parallel joists already in joist count |
| Bearers | Yes | Yes if row count known | Yes when identity complete | Same exact-match rules | No | SHADOW | Yes | Same | |
| Supports / posts | Yes (EA) | Count yes; length no | Partial (no length) | **Pricing required** | No | SHADOW | Yes | **Yes** | Do not apply framing $/lm to EA |
| Footings / concrete | Yes (m³) | Volume yes; mix no | Mix unknown | **Pricing required** | No | SHADOW | Yes | **Yes** | 0% extra waste |
| Structural fixings | **No** | — | — | Legacy `$/m²` only, unsplit | No | LEGACY `deck.fixings.m2` | Deferred | If dropped without replacement | UNKNOWN vs surface screws |
| Blocking / nogs | **No** | — | — | None | No | Implicit in package | Deferred | Optional if allowance/defer recorded | |
| Trimmers / openings | **No** | — | — | None | No | Implicit in package | Out (non-MVP) | Optional defer | |
| Double joists | **No** | — | — | None | No | Implicit | Out | Optional defer | |
| Bracing | **No** | — | — | None | No | UNKNOWN | Out | Not required for MVP if documented | No structural-design rules |
| Surface fixings | **No** (detailed) | Area only | Generic package | `deck.fixings.m2` | No | LEGACY | Defer | Keep legacy | |
| Structural timber waste | Yes on timber children | Framing waste % | n/a | In purchase lm | No | SHADOW | Yes | — | Package has no explicit waste |
| Labour | Yes (lump hours) | Area productivity only | carpenter $/h | Always priced (60/90 fallback) | **Lump Deck labour** | Line money / SHADOW req | DECK-3 for split | Separate Owner decision | Not framing-only |
| Plant | **No** | — | — | None | — | None | Out | Optional defer | |
| Delivery / cartage | **No** | — | — | None | — | UNKNOWN in packages | Out | Optional defer | |
| Small-load concrete | **No** | — | — | None | — | UNKNOWN | Future if mix priced | **Yes** if concrete promoted on small decks | 0.324 ≪ 3 m³ |
| Procurement / stock lengths | **No** | Purchase lm is waste-on-run, not SKU lengths | — | None | — | Out of DECK-1 | Later | Optional | B1 lengths 3.6–6.0 m |

Do **not** add components solely because they appear in this list.

**Coverage percentages (careful):**

| Metric | DECK-RATE-REF-01 | Do not claim |
| --- | --- | --- |
| PHYSICAL COMPONENT COVERAGE | 5 of 5 DECK-1B children **emitted** | Not “complete structure” |
| PRICED COMPONENT COVERAGE | 3 of 5 emitted children priced | Not 60% of cost |
| ECONOMIC COVERAGE | **Unknown** until missing buckets valued | Do not use 924.71 / 1934.40 as % complete |

---

## 9. DECK-RATE-REF-01 current comparison (standard quality)

Geometry: 5.20 × 3.10 = **16.12 m²**. Height 0.4 m → **elevated labour**. Substructure included. Framing spec `H3.2 SG8 KD`. Joists/rim 140×45; bearers 190×45; supports 90×90 post 8 EA; footings 300×300×450.

### LEGACY (estimate money)

| Line | Qty | Rate | Cost |
| --- | ---: | ---: | ---: |
| Framing/substructure | 16.12 m² | 120 / m² | **1,934.40** |
| Fixings and consumables | 16.12 m² | 25 / m² | **403.00** |
| Deck labour | 16.12 m² × 1.45 h/m² | 60 / h | **1,402.20** |
| Decking materials | separate surface | — | **not structural** |
| Stairs / demo / piles / face | not triggered | — | **0** |

**Legacy substructure package cost = 16.12 × 120 = $1,934.40.**  
**Other relevant structural-related legacy lines = fixings $403.00.** Labour is relevant but **not** inside the package.

### DETAILED (shadow; not estimate money)

| Child | Qty | Status | Cost |
| --- | --- | --- | ---: |
| Joists | 42.32 lm @ 13.65 | priced / benchmark | 577.67 |
| Rim | 10.92 lm @ 13.65 | priced / benchmark | 149.06 |
| Bearers | 10.92 lm @ 18.13 | priced / benchmark | 197.98 |
| **PARTIAL PRICED STRUCTURAL CHILD COST** | | | **924.71** |
| Supports | 8 EA | unpriced | — (not 0) |
| Concrete | 0.324 m³ | unpriced | — (not 0) |
| Structural connectors | not modelled | missing | — |
| Blocking / trimmers | not modelled | missing | — |

### Why $1,934.40 − $924.71 is **not** savings

Difference **$1,009.69** is **incomplete / unexplained variance**. Missing-value buckets still include supports, concrete, structural connectors (if not already in $25 fixings), blocking, waste/stock, small-load, possibly labour-ish package content. Economic coverage unknown.

Parity class: **INTENTIONAL_MODEL_IMPROVEMENT**. Status: **PARTIAL_COVERAGE** / existing recon `COVERAGE_PARTIAL`.

---

## 10. Future rate requirements identified (not attached now)

Audit **does** identify these as **future** Owner-gated needs — **do not add prices in DECK-1D-A**:

1. Support product **with length** (B1: 90×90 H5 typically **lm**).
2. Concrete mix strategy **or** explicit allowance / small-load rule.
3. Structural connector treatment (keep legacy fixings vs new allowance vs SKU).

No additional timber section benchmarks required for calibration planning.
