# Supported Work Area Coverage Audit

**Classification:** HISTORICAL inventory. **CANONICAL product view:** `docs/product/QUOTR_SUPPORTED_WORK_AREAS.md`. Code contract remains `docs/architecture/QUOTR_SUPPORTED_WORK_AREA_CONTRACT.md`.  
**Status:** Audit complete (2026-08-15). **Product contract implemented in FOUNDATION-R1** — `docs/architecture/QUOTR_SUPPORTED_WORK_AREA_CONTRACT.md`. Project Conditions applicability for each product WA is in FOUNDATION-R1-R1 (`lib/project-conditions/applicability.ts`). **FOUNDATION-R2** did not promote any Work Area band — `docs/audits/FOUNDATION_R2_SCOPE_DETAILS_QUESTION_AUDIT.md`.  
**HEAD (audit baseline):** `f168fe0ec8a857fffa79888435ca90b9e8a1db25` (`hardening/stage-2a-security`)  
**Mode:** Historical inventory. Customer labels now Trial-supported / Developing / Component / Not supported yet (never “Estimate-ready”, never A–E in UI).  
**Companion:** `docs/audits/POST_TRIAL_MASTER_ARCHITECTURE_AUDIT.md`  
**Pipeline:** `docs/plans/POST_TRIAL_MASTER_DEVELOPMENT_PIPELINE.md`

**Stale prior matrix:** `docs/WORK_AREA_COVERAGE_MATRIX.md` (Phase 6I) claims internal walls / ceilings / doors / flooring / painting have **no** questions or calculators. Code now has templates + `lib/estimate/calculators/fitout.ts`. **This audit supersedes that matrix.**

---

## 1. Authority for “what Quotr recognises”

| Layer | File | What it actually is |
| --- | --- | --- |
| **Product Work Areas (creatable / estimateable)** | `lib/scopes/catalogue.ts` `SCOPE_CATALOGUE` | **14 types.** `isSupportedWorkAreaType` uses this list. |
| **Question templates** | `lib/scopes/registry.ts` + `lib/scopes/templates/` | Same 14. |
| **Estimate dispatcher** | `lib/estimate/calculate-estimate.ts` `CALCULATORS` | Same 14. Unknown type → `"No calculator available"`. **No generic calculator.** |
| **ISD high-level set** | `lib/scope-discovery/classification.ts` `HIGH_LEVEL_WORK_AREA_TYPES` | 14 **plus** `commercial_fitout`. |
| **ISD relationship packs** | `lib/scope-discovery/catalogue/relationships/` | **Deck, Bathroom, Commercial-fitout only.** |
| **Question aliases** | `lib/scopes/registry.ts` | `partitions→internal_walls`, `linings\|wall_linings→plastering`, `strip_out\|soft_strip→demolition`. |
| **ISD aliases** | `lib/scope-discovery/catalogue/normalisation.ts` | Includes `fitout\|commercial_fit_out→commercial_fitout` and component synonyms. |

**UI honesty gap:** every product catalogue row sets `estimateSupport: "calculator"` and `getEstimateSupportLabel` returns **"Estimate-ready"**. That label is **misleading** for allowance-first / package calculators and for types that are commercially immature.

---

## 2. Maturity scale (this programme)

| Grade | Meaning |
| --- | --- |
| **A** | Production-capable / commercially defensible Quick Estimate (explainable scope, labour hours, major material quantities, pricing with cost-first rates). |
| **B** | Trial-capable with known assumptions (package/allowance-first; owner-reviewed; must not claim takeoff accuracy). |
| **C** | Recognised and calculated, but materially incomplete (missing takeoff, labour breakdown, or commercial consumption is unsafe). |
| **D** | Placeholder / generic / **misleading if presented as equally supported**. |
| **E** | Legacy / dead / catalogue-only with no product WA path. |

**No Work Area is A today.** Deck/Bathroom/Fitout trial success is **B**, not A.

---

## 3. Product Work Area inventory (14)

Legend: Rec=recognised as product WA · AI=LLM/enrich can suggest · Canon=canonical type · Facts=template facts · ISD pack=dedicated relationship pack · Det fallback=deterministic ISD suggestions · Qs=Scope Details · Calc=dedicated module · Generic=generic calculator · Labour/Mat=build-up (not necessarily priced takeoff) · Co rates=resolveRate/resolveLabourRate · Bench=Quotr benchmarks · Gold=product estimate goldens · Use today=customer-claimable.

### 3.1 `deck` — Deck — **B** (pilot-highest; not takeoff-mature)

| # | Question | Answer |
| --- | --- | --- |
| 1 Recognised | **Yes** — `SCOPE_CATALOGUE` |
| 2 AI suggest | **Yes** — `inferDeck` + prompt |
| 3 Canonical key | `deck` |
| 4 Facts | Yes — `lib/scopes/templates/deck.ts` |
| 5 Scope Discovery | **Yes** — `relationships/deck.ts` |
| 6 Deterministic fallback | Yes (deck relationship evaluator) |
| 7 Scope Details | Yes (20 questions) |
| 8 Dedicated calculator | `lib/estimate/calculators/deck.ts` |
| 9 Generic calculator | No |
| 10 Labour build-up | Partial — **one** “Deck labour” hrs/m² + face lump 35/55; no component hours |
| 11 Material build-up | Partial — m² packages; lm display `priced:false`; face lm **hardcoded** |
| 12 Company rates | Yes (`deck.material.*.m2`, substructure, fixings) |
| 13 Benchmarks | `DECK_BENCHMARKS` |
| 14 Goldens/tests | Yes (calibration, commercial realism, many verify scripts) |
| 15 Confidence maturity | Medium — defaults area **20 m²**; missing×5 confidence |
| 16 Customer use today | **Yes as trial Quick Estimate** with assumptions disclosed |
| 17 Gaps before claim A | Face-edge takeoff; priced lm; framing members; labour breakdown; remove `deck.access` duplicate; stop 35/55 |

### 3.2 `bathroom` — Bathroom renovation — **B**

| # | Answer |
| --- | --- |
| Recognised / AI / canon | Yes / Yes (`inferBathroom`) / `bathroom` |
| Facts / ISD / fallback | Yes / **Yes** `relationships/bathroom.ts` / Yes |
| Scope Details | Yes (20 questions) |
| Calculator | `lib/estimate/calculators/bathroom.ts` |
| Labour / materials | Fixed-hour trade lines + **allowance-first** fixtures/waterproofing/plumbing/electrical; tiling `bathroom.tiling.m2` |
| Rates | Company tiling/fixtures + many **direct `BATHROOM_BENCHMARKS`** |
| Goldens | Yes (`verify-commercial-realism`, internal calibration, 3.1B bathroom commercial detail) |
| Customer use | **Yes as trial** (Owner E2E PASS) |
| Gaps to A | MaterialRequirement for linings/tiles/waterproofing; labour hours not productivity-table; access path bypasses R1 combined helper; WA `bathroom.access` duplicate |

### 3.3 `kitchen` — Kitchen renovation — **C** (commercially usable package, not takeoff)

| # | Answer |
| --- | --- |
| Recognised / AI / canon | Yes / Yes / `kitchen` |
| ISD pack | **No** dedicated relationship pack |
| Calculator | `lib/estimate/calculators/kitchen.ts` |
| Labour | Package 16 hrs/m² **or** lump hours; **no project-condition labour factor** |
| Materials | Cabinetry/benchtop `resolveRate`; appliances/splashback/flooring/services **benchmark lumps**; fallback **$1500/2300 m²** + **$20k/30k** min |
| Customer use | Trial-capable as **allowance package** only — do not claim joinery takeoff |
| Gaps | Access question unused commercially; no MaterialRequirement; services are allowances |

### 3.4 `retaining_wall` — Retaining wall — **C+** (closest external after Deck)

| # | Answer |
| --- | --- |
| Recognised / AI / canon | Yes / Yes / `retaining_wall` |
| ISD pack | **No** |
| Calculator | `lib/estimate/calculators/retaining-wall.ts` |
| Labour | 2.0 hrs/face m² + excavation/drainage; `getLabourAdjustmentFactor` |
| Materials | Face m² timber/concrete; drainage lm; backfill priced as **face m²** (`retaining_wall.backfill.m3` catalogue **unused**) |
| Dual-ask | `retaining_wall.access`, `retaining_wall.carting_distance_m` |
| Customer use | Trial-capable for timber/concrete face walls with drainage/backfill assumptions |
| Gaps | Posts/poles/sleepers takeoff; consume `backfill.m3`; PC carting/access single-authority; ISD pack |

### 3.5 `fence` — Fence — **C**

| # | Answer |
| --- | --- |
| Calculator | `lib/estimate/calculators/fence.ts` — lm × height factor |
| Labour | 0.6 hrs/lm × combined access × slope; gate 2h; demo 0.25 hrs/lm |
| Materials | `fence.material.timber.lm` / `.metal.lm`; composite falls through |
| Default | **18 m** if length missing |
| Gaps | Posts/rails/palings takeoff; `fence.access` duplicate; ISD pack |

### 3.6 `pergola` — Pergola — **C**

| # | Answer |
| --- | --- |
| Calculator | `lib/estimate/calculators/pergola.ts` |
| Roofing | **Fact/calculator add-on**, not a Work Area (`pergola.roofing_*`) |
| Materials | Frame + typed roof rates (`resolvePergolaRoofRate`); footings/gutters/finish allowances |
| Default area | **15 m²** (or deck area) |
| Catalogue | `defaultEnabled: true` (coverage matrix “often disabled” is stale) |
| Gaps | Member takeoff; `pergola.access` duplicate; building roofing ≠ pergola covering |

### 3.7 `external_stairs` — External Stairs — **C** (HIGH commercial risk)

| # | Answer |
| --- | --- |
| Calculator | `lib/estimate/calculators/external-stairs.ts` |
| Labour | 1.5 hrs/riser × **project labourAdjustment × WA `accessFactor`** — **stacked** (DC-02) |
| Materials | Per-riser + derived handrail/balustrade lm |
| ISD | Candidate under deck as catalogue `stairs`, not a parent pack |
| Customer use | Usable only after access double-consumption is fixed |
| Gaps | DC-02; `external_stairs.access` duplicate; no internal stairs WA |

### 3.8 `demolition` — Demolition / strip-out — **C** (HIGH commercial risk)

| # | Answer |
| --- | --- |
| Aliases | Questions: `soft_strip\|strip_out→demolition`. ISD: `soft_strip→strip_out` |
| Detection | `inferDemolitionAndRemoval`; may be **dropped** if bathroom/kitchen/fence also present (`demolition-rules.ts`) |
| Calculator | `lib/estimate/calculators/demolition.ts` — allowance matrix |
| Dual-consume | Project `site_access` labour **+** WA `demolition.access` quantity factor **+** optional carting allowance (DC-01) |
| Floor/hazmat/services/hours | Asked in WA; project constraints persist but **calculators read WA Facts** |
| Customer use | Trial-capable as strip-out **allowance** if access stacking is disclosed; not A |
| Gaps | Single-authority PC; stop dual-ask; don’t treat as full commercial soft-strip takeoff |

### 3.9 Fitout family (commercial interior components) — **B as a set / C individually**

These **are** the commercially used “commercial fitout” product, not `commercial_fitout`.

| Type | UI label | Calculator | Qs | Access Q | Notes |
| --- | --- | --- | --- | --- | --- |
| `internal_walls` | Internal walls | `fitout.ts` `calculateInternalWalls` | 13 | **Yes — unused commercially** | Aliases `partitions`. Hardcoded `FITOUT_BENCHMARKS.internalWallsPerM2`. Sheets `priced:false`. |
| `ceilings` | Ceilings | `calculateCeilings` | 12 | `ceilings.access` = **height semantics** (keep as WA) | Enrich does **not** auto-add ceilings. |
| `doors` | Doors | `calculateDoors` | 10 | No | Heavy hardcoded door/frame/hardware $ |
| `flooring` | Flooring | `calculateFlooring` | 14 | **Yes — unused** | Enrich does **not** auto-add flooring WA. Type-specific catalogue keys unused for live rate. |
| `painting` | Painting | `calculatePainting` | 12 | No | `painting.material.m2` via `resolveRate`; litres `priced:false`. Surfaces option includes “Exterior cladding” **text only**. |
| `plastering` | Plastering | `calculatePlastering` | **5** | No | Hardcoded $/m². **No** `LEGACY_SCOPE_STARTER_RATES` entry. ISD as `linings`. |

Owner Fitout E2E **PASS** (3.1B closure) using this multi-WA set.

**Gaps to A:** priced sheet/paint takeoff; steel stud vs timber keys; fire/seismic/joinery; do not collapse into one `commercial_fitout` $/m².

### 3.10 Catalogue labels vs capability

All 14 rows claim `estimateSupport: "calculator"`. Kitchen/fence/pergola/demolition historically described as “rough” in the stale matrix; **code still uses dedicated calculators**, but commercially they remain **allowance/package**.

---

## 4. Recognised but NOT product Work Areas

### 4.1 `commercial_fitout` — **E as product WA / B as ISD parent**

| Field | Evidence |
| --- | --- |
| Canonical key | `commercial_fitout` |
| Aliases | `fitout`, `commercial_fit_out` |
| In `SCOPE_CATALOGUE` | **No** |
| In `HIGH_LEVEL_WORK_AREA_TYPES` | **Yes** |
| `isSupportedWorkAreaType` | **No** — cannot be created as project WA via decisions |
| Calculator / Facts / Scope Details | **None** |
| ISD | Full pack `relationships/commercial-fitout.ts` |
| Trial meaning | User confirms **component WAs** (demolition, walls, ceilings, doors, flooring, painting, plastering) |

**Do not add `commercial_fitout` to `SCOPE_CATALOGUE` as a single priced Work Area.** See §6.

### 4.2 ISD scope items (never top-level WAs)

From `SCOPE_ITEM_TYPES`: `waste_removal`, `substructure`, `piles_posts`, `bearers`, `joists`, `bracing`, `framing`, `decking`, `fascia`, `stairs`, `balustrade`, `handrail`, `coatings`, `trims`, `drainage`, `access_logistics`, `scaffold_access`, `plumbing`, `electrical`, `waterproofing`, `tiling`, `linings`, `fixtures`, `fit_off`, `ventilation`, `partitions`, `joinery`, `fire_stopping`, `seismic`, `services_coordination`, `protection`, `make_good`, `strip_out`, `excavation`.

These are **scope/component keys**, future Material/LabourRequirement `componentKey`s — not Work Areas.

### 4.3 Requested types that do **not** exist as WAs

| Requested | What exists |
| --- | --- |
| Cladding | Painting surface option text only. **No WA, no calculator.** |
| Roofing (building) | `pergola.roofing_*` facts/calculator only. **No roofing WA.** |
| Windows | Absent |
| Landscaping / earthworks / drainage (as WA) | Drainage is retaining fact + ISD item |
| Plumbing / electrical (as WA) | Bathroom/kitchen facts + ISD items + subcontractor allowances |
| Carpentry | Not a WA; labour is carpenter hour rate |
| Concrete | Material option on retaining/pergola footings |
| Internal stairs | Absent (`external_stairs` / ISD `stairs` only) |
| Renovation / extension | Catalogue **category** `"Renovation"` only |
| Other / custom | **No WA type.** Quote fallback `buildGenericDraft`. Unknown estimate type → missing calculator |

---

## 5. Master maturity matrix

| Type | Rec | AI | Canon | Facts | ISD pack | Det. fallback | Scope Qs | Dedicated calc | Generic | Labour | Materials | Co rates | Bench | Goldens | Grade | Customer today | Main gaps |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `deck` | Y | Y | Y | Y | Y | Y | Y | Y | N | Partial | Partial | Y | Y | Y | **B** | Trial QE | Takeoff + labour breakdown + PC access |
| `bathroom` | Y | Y | Y | Y | Y | Y | Y | Y | N | Partial | Allowance | Partial | Y | Y | **B** | Trial QE | Takeoff; access path; services allowances |
| Fitout set (6) | Y | Mixed | Y | Y | Via `commercial_fitout` parent | Y | Y | Shared `fitout.ts` | N | Partial | Allowance + display | Mixed | Y | Partial | **B** set | Trial multi-WA | Priced sheets; no parent WA |
| `kitchen` | Y | Y | Y | Y | N | N | Y | Y | N | Package | Allowance | Partial | Y | Y | **C** | Allowance only | Joinery takeoff; unused access |
| `retaining_wall` | Y | Y | Y | Y | N | N | Y | Y | N | Y hrs/m² | Face m² | Y | Y | Partial | **C** | Trial w/ assumptions | Member takeoff; carting dual |
| `fence` | Y | Y | Y | Y | N | N | Y | Y | N | Y hrs/lm | lm package | Y | Y | Partial | **C** | Trial w/ assumptions | Posts/palings; access Q |
| `pergola` | Y | Y | Y | Y | N | N | Y | Y | N | Y hrs/m² | Frame+roof pkg | Y | Y | Partial | **C** | Trial w/ assumptions | Members; access Q |
| `external_stairs` | Y | Y | Y | Y | Under deck | Partial | Y | Y | N | Stacked | Riser pkg | Y | Y | Partial | **C** | After DC-02 fix | Access stack |
| `demolition` | Y | Y* | Y | Y | Candidate | Partial | Y | Y | N | Stacked | Allowance | Y | Y | Partial | **C** | After DC-01 fix | Access/floor/hazmat dual |
| `commercial_fitout` | ISD only | Suggestable in ISD | ISD | N | Y | Y | N | N | N | N | N | N | N | Fixture only | **E/D** | **Do not claim as WA** | Parent package architecture |
| Cladding | N | N | N | N | N | N | N | N | N | N | N | N | N | N | **D** if shown | Hide | Build WA+calc later |
| Roofing | N | N | N | Pergola only | N | N | N | N | N | N | N | N | N | N | **D** if shown | Hide | Distinct from pergola roof |
| Windows / landscaping / earthworks / plumbing / electrical / carpentry / renovation / extension / other | N | N | N | Facts/items only | Some items | N | N | N | N | N | N | N | N | N | **D/E** | Hide | Do not invent |

\*Demolition AI may be suppressed when bathroom/kitchen/fence present.

---

## 6. Recommended supported catalogue (product honesty)

### Principle

**Supported Work Area** = Quotr will claim a commercially useful Quick Estimate (scope + labour hours + major materials + cost-first pricing) for that type.

**Recognised** ≠ **Supported**. ISD may still suggest components.

### Tier 1 — launch claim (after FOUNDATION + Deck/Bathroom/Fitout takeoff work)

| Claim label | Canonical type(s) | Architecture |
| --- | --- | --- |
| Deck | `deck` | Single WA. Pilot for MaterialRequirement + LabourRequirement. |
| Bathroom | `bathroom` | Single WA. Trade packages remain until SKU takeoff; still Tier 1 commercially. |
| Commercial interior | **Not** `commercial_fitout` as one calculator | **Parent job package** (ISD / project classification) **delegating to component WAs:** `demolition` (soft strip), `internal_walls`, `ceilings`, `doors`, `flooring`, `painting`, `plastering` (+ later joinery/services as allowances or WAs). |

**Commercial fitout is too broad as a single Work Area.** Evidence: no calculator, no facts, trial succeeded as **multi-WA**, relationship pack already models components. Keep parent for discovery; price components.

### Tier 2 — next (after Deck pilot proves requirements model)

| Type | Why next | Work to reach “commercially useful QE” |
| --- | --- | --- |
| `retaining_wall` | Strong dimensional facts; drainage lm already real-ish | Posts/sleepers/concrete takeoff; `backfill.m3`; PC carting single-consume; ISD pack |
| `fence` | Simple lm geometry | Posts/rails/palings/gates; drop WA access ask |
| `pergola` | Close to deck; roof typed rates exist | Members + footings qty; drop WA access |
| `kitchen` | High commercial value, allowance-heavy | Cabinetry/benchtop allowances with honesty labels; don’t fake SKU joinery |
| Cladding | **Does not exist** | New type + calculator + wrap/batten/flashing keys — **greenfield** |
| Roofing | **Does not exist** as building roof | New type; do **not** overload `pergola.roofing_*` |

### Tier 3 / future

- `external_stairs` (after DC-02) — keep as component often nested under Deck
- Internal stairs — absent; don’t claim
- Windows, landscaping, earthworks, drainage-as-WA, plumbing-as-WA, electrical-as-WA, carpentry-as-WA, extension
- Fire stopping / seismic as Facts or assemblies (Stage 3.3), not WAs

### Hide / label unsupported now

| Item | UI treatment |
| --- | --- |
| Cladding, roofing (building), windows, landscaping, earthworks, plumbing, electrical, carpentry, renovation, extension, other/custom | **Do not offer as equal catalogue rows** |
| `commercial_fitout` | ISD parent / job class only — **never** “Estimate-ready” WA |
| All 14 product types until A | Change `estimateSupport` to reflect **calculator vs rough_allowance**; stop blanket “Estimate-ready” |
| Kitchen / demolition / plastering | Prefer `rough_allowance` until takeoff |

### Owner decisions required

1. Confirm commercial interior = **parent + components**, not one `commercial_fitout` calculator.  
2. Confirm Tier 1 claim waits for Deck requirements pilot **or** remains “trial-supported B” with explicit disclaimer.  
3. Confirm cladding/roofing stay **hidden** until greenfield stages (recommended).  
4. Face-board UX: **which edges (F/R/L/R)** vs **how many sides** (see architecture doc).

---

## 7. Scope Details quality (target areas)

Project-condition questions to **remove/move** are listed in `docs/audits/PROJECT_CONDITIONS_SINGLE_AUTHORITY_AUDIT.md`. Below is remaining **job-specific** quality.

### 7.1 Deck

**Keep (commercially meaningful):** length, width, height, board material, board width, existing removal, access_type (product stairs), face boards required, irregular face lm, balustrade, handrail, substructure included, pile replace + count, substructure condition, engineering/consent, pergola included (or suppress if pergola WA exists).

**Remove/move:** `deck.access` → Project Conditions.

**Challenge / derive:** `deck.area_m2` if L×W known; `deck.level` if `height_m` known (elevated vs ground).

**Missing for A:** `deck.face_boards.sides` (or count — Owner decision), `deck.face_board_height_m`, `deck.face_board_width_mm`, `deck.face_board_material`; joist/bearer/post sizes later.

**Conditional:** pile count only if replacement yes; face lm only if irregular; pergola Q if no pergola WA.

### 7.2 Bathroom

**Keep:** area, renovation type, finish, demolition included, fixtures client-supplied + which fixtures, waterproofing, tiling + extent/shower, ventilation, lining, floor prep, UFH, plumbing/electrical **level**.

**Remove/move:** `bathroom.access`.

**Challenge:** floor **and** wall tiling areas **and** tile_extent **and** wall_tile_height — overlapping; prefer extent + height, derive areas from room area when possible.

**Missing for A:** wet-area board type, tile size (optional), waterproofing system — only if they change rate keys.

### 7.3 Commercial (component WAs)

**Keep per component:** quantities (length/height/area/count), framing type, lining type/sides, ceiling type, door count/type, flooring type/prep, painting surfaces/coats.

**Remove/move:** `internal_walls.access`, `flooring.access` (unused commercially). **Keep** `ceilings.access` as height/access for that trade.

**Missing:** fire rating, acoustic, steel vs timber already asked on walls; joinery as allowance; services coordination as project or allowance — don’t questionnaire.

**Dead:** access Qs that calculators ignore.

### 7.4 Retaining wall

**Keep:** length, raking + heights, fixing type, material, drainage, drain connection, backfill included + L/H/D, excavation, disposal, consent.

**Remove/move:** `retaining_wall.access`, `retaining_wall.carting_distance_m` (project carry; WA metres only as override).

**Missing for A:** post/sleeper size, post centres, concrete spec — when catalogue exists.

### 7.5 Fence

**Keep:** length, height, material, demolition, gate + count, slope_condition (line-local), disposal, boundary, services_risk (line-local, not project hazmat), finish.

**Remove/move:** `fence.access`.

**Missing:** post centres, paling type — later catalogue.

### 7.6 Pergola

**Keep:** L/W/area, material, attached, roofing included/type, footings, gutters, tie-in, consent, finish.

**Remove/move:** `pergola.access`.

**Missing:** post count/size — later.

### 7.7 Kitchen

**Keep:** area, renovation type, finish, demolition, cabinetry/benchtop/appliances + client-supplied, splashback, rangehood, flooring in kitchen, plumbing/electrical level.

**Remove/move:** `kitchen.access` (unused in calculator).

**Challenge:** finish_level vs project quality — don’t double-ask if quality already set.

### 7.8 Cladding / Roofing

**No questions exist.** Do not add banks until WA + calculator exist.

---

## 8. Calculator maturity (target areas)

| WA | Qty model | Labour | Materials | Demo/waste | Subs | Rate path | Hardcoded $ | Grade |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Deck | L×W or area; default 20 m² | hrs/m² + face 35/55 | m² packages; lm display | Removal labour only | Stairs/balustrade/piles lumps | `resolveRate` + benchmarks | Face 35/55; `faceBoardLm` | **C+** takeoff / **B** package |
| Bathroom | Floor m² | Fixed hours + minima | Allowances + tiling m² | In-house demo hours | Plumbing/electrical/fan | Mixed resolveRate + direct bench | Package min $18k/25k | **B** package |
| Fitout 6 | Area/lm/count; walls default 20 | Productivity or none (doors) | Hardcoded FITOUT_BENCHMARKS; sheets priced:false | Removal rates | Stopping/paint allowances | Painting resolveRate; others often bypass | Doors 60/90, 120/180, 80/120 | **C** |
| Kitchen | Area | Package or lumps; **no PC factor** | Allowances | Demo hours | Services lumps | Cabinetry/benchtop resolveRate | $1500/2300 m²; $20k/30k min | **C** |
| Retaining | Face m² | hrs/face m² + PC factor | Face m² + drainage lm | Disposal allowance | Drain connect $1800/2800 | Mixed | Drain connect; carting bench | **C+** |
| Fence | lm; default 18 | hrs/lm × access×slope | lm package | Disposal allowance | Gate allowance | resolveRate | — | **C** |
| Pergola | m²; default 15 | hrs/m² × attach | Frame+roof | — | Footings/gutters | Pergola resolvers | — | **C** |
| Roofing / Cladding | **Absent** | — | — | — | — | — | — | **D** |
| Commercial parent | **Absent** | — | — | — | — | — | — | **E** |

Shared: cost/sell via commercial engine; default margin 20%; ranges × 0.9 / 1.15; labour fallback **60/90**; `calculatorSupport: "planned"` on all `scope.*` package keys and `labour.labourer.hour` / `labour.apprentice.hour`.

---

## 9. Verification of this audit

No code changes. Authority files: `lib/scopes/catalogue.ts`, `lib/estimate/calculate-estimate.ts`, `lib/scopes/templates/*`, `lib/estimate/calculators/*`, `lib/scope-discovery/classification.ts`.
