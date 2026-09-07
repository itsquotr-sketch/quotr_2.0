# Work Area Expansion Triage

**Status:** CANONICAL — WORK-AREA-FACTORY-01 + WA-BATHROOM-01 + **WA-BATHROOM-02 GO**  
**Date:** 2026-09-07  
**HEAD:** `4d11ab3c55b94e3bc11ff3845b39a13d88501314` plus WORK-AREA-FACTORY / Bathroom architecture docs  
**Hosted product (context):** `64bbfb807e714632bde77fca7bd3e11dab654dde`  
**Branch:** `hardening/stage-2a-security`  
**Preview:** Supabase `shhpjsoldmqtkdbgrbtm`, migrations through **054**  
**Production:** DO NOT TOUCH (through 045)  
**Factory standard:** [QUOTR_WORK_AREA_FACTORY.md](./architecture/QUOTR_WORK_AREA_FACTORY.md)  
**Bathroom architecture:** [QUOTR_BATHROOM_ESTIMATING_ARCHITECTURE.md](./architecture/QUOTR_BATHROOM_ESTIMATING_ARCHITECTURE.md)

This file is an audit / triage / factory-design record. WORK-AREA-FACTORY-01 implemented no new Work Area. WA-BATHROOM-01 is architecture only. **WA-BATHROOM-02 implemented Bathroom job-scope + geometry** (see Bathroom architecture §53). Do not start Internal Walls, Variations, or RFQ.

### Owner-approved build order (beta override — locked)

Technical Wave 1 in §17 ranked Pergola → Internal walls → Flooring. **Owner has overridden that sequence.**

1. **Bathroom** (`bathroom`) — next implementation after this audit  
2. **Internal Walls** (`internal_walls`)  
3. **Ceilings** (`ceilings`)  
4. **Doors** (`doors`)

**Pergola is no longer Wave 1 priority.** Do not start Pergola, Internal Walls, Ceilings, Doors, Variations, or RFQ until Bathroom factory phases complete (or owner re-orders again).

Code is authority. Older “14 Work Areas” docs remain historically useful; their **maturity bands are stale**.

Product judgements (frequency, beta value, marketing, weights) are labelled **recommendation**.

---

## 1. Exact current Work Area count

| Layer | Count | What it is |
| --- | --- | --- |
| **Product creatable Work Areas** | **14** | `SCOPE_CATALOGUE` — can be created, calculated, quoted |
| First-run Setup checkboxes | **10** | Subset of the 14. No maturity badge. |
| Add Work Area / Improve Setup | **14** | Full catalogue. Stale capability badges. |
| Analyse allow-list | **14** | `getAnalysisCapableWorkAreaTypes()` = full catalogue |
| ISD high-level set | **15** | 14 + `commercial_fitout` (not creatable) |
| Unsupported recognised labels | **14** | cladding, roofing, windows, landscaping, earthworks, drainage, plumbing, electrical, carpentry, renovation, extension, other, custom, commercial_fitout |
| ISD canonical scope ids | **43** | Mix of WAs + components (fascia, tiling, partitions, …) |
| Company DNA Work Areas | **3** | deck, fence, retaining_wall |
| Calculators that emit `requirements` | **3** | deck, fence, retaining_wall |

**The original 14-area model is still the product catalogue.** Nothing was added or removed from `SCOPE_CATALOGUE`. What changed is **maturity of three types**, plus richer ISD component language that must not be mistaken for extra Work Areas.

`commercial_fitout` is an ISD / job-class parent only. **No calculator. Do not create one.**

---

## 2. Canonical product list (builder-facing name)

| # | Canonical key | Builder-facing name | Category |
| --- | --- | --- | --- |
| 1 | `deck` | Deck | External |
| 2 | `retaining_wall` | Retaining wall | External |
| 3 | `bathroom` | Bathroom renovation | Renovation |
| 4 | `kitchen` | Kitchen renovation | Renovation |
| 5 | `fence` | Fence | External |
| 6 | `pergola` | Pergola | External |
| 7 | `external_stairs` | External Stairs | External |
| 8 | `demolition` | Demolition / strip-out | Preparation |
| 9 | `internal_walls` | Internal walls | Interior fitout |
| 10 | `ceilings` | Ceilings | Interior fitout |
| 11 | `doors` | Doors | Interior fitout |
| 12 | `flooring` | Flooring | Finishes |
| 13 | `painting` | Painting | Finishes |
| 14 | `plastering` | Plastering | Finishes |

---

## 3. UI-visible lists

**First-run “Your work” (10):**  
Deck, Fence, Retaining wall, Bathroom renovation, Kitchen renovation, Pergola, Internal walls, Flooring, Painting, Demolition / strip-out.

Omitted from first-run: External Stairs, Ceilings, Doors, Plastering.

**Add Work Area + Improve Setup:** all 14. Badges from stale `support-contract.ts` (Deck/Bathroom “Trial-supported”; Fence/RW/Pergola/Kitchen “Developing”; rest “Component”). First-run cards have **no** badge.

**Analyse:** may suggest any of the 14. Heuristic enrichers exist for 12 types; **no dedicated `inferFlooring` or `inferCeilings`**. Flooring facts are only patched when a flooring WA is already present. Ceilings ride painting heuristics. The LLM prompt still lists flooring and ceilings facts.

---

## 4. Maturity definition (this programme)

| Score | Stage | Product label |
| --- | --- | --- |
| 0 | Placeholder name only | EXPERIMENTAL |
| 1 | Discovery / AI can recognise | EXPERIMENTAL |
| 2 | Canonical facts | EXPERIMENTAL |
| 3 | High-value questions | PARTIAL |
| 4 | Physical calculator derives meaningful quantities | PARTIAL |
| 5 | Requirements generated (or honest allowance union) | PARTIAL |
| 6 | Rate resolution + cost-first commercial | SUPPORTED |
| 7 | Explainable Builder Review | SUPPORTED |
| 8 | Deterministic fixtures + conditions + polished flow | MATURE |
| 9 | Company DNA where useful | MATURE + personalised |

Deck / Fence / Retaining Wall are **reference mature (8)**, DNA-personalised on labour (**9 on labour axes**). Residual lumps (e.g. deck balustrade) do not drop them below 8.

---

## 5. Duplicates, orphans, UI-only, calculator-only

| Issue | Detail |
| --- | --- |
| Duplicate: pergola | `pergola` WA **and** `deck.pergola_included` |
| Duplicate: stairs | `external_stairs` WA **and** deck steps / `deck.access_type`. Brief prompt already XOR-bounds this. |
| Duplicate: demolition | Standalone WA **and** parent flags (`bathroom.demolition_required`, fence, deck, internal_walls, …) |
| Duplicate: painting | Standalone WA **and** nested flags on internal_walls, ceilings, doors, bathroom |
| Duplicate: flooring | Standalone WA **and** `kitchen.flooring_included` |
| Duplicate: plastering / linings | Product `plastering` vs ISD `linings` / `wall_linings` alias |
| Duplicate: internal walls | Product `internal_walls` vs ISD `partitions` |
| Orphan (unsupported, not creatable) | cladding, roofing, windows, landscaping, earthworks, drainage, plumbing, electrical, carpentry, renovation, extension, other, custom |
| Parent not a WA | `commercial_fitout` |
| UI-misleading | First-run shows Bathroom/Kitchen/Pergola/Internal walls/Flooring/Painting/Demolition as equal to Deck |
| Calculator-only? | **None.** All 14 have templates + calculators. Unknown types only hit “No calculator available”. |
| Adapter gap | Job Plan/Refine dedicated: deck, fence, retaining_wall, bathroom, painting. Others use generic Job Plan and **no** Refine adapter. |
| Consumed-fact contract | Only deck, fence, retaining_wall, bathroom, kitchen, painting |
| Requirement envelope | Only deck, fence, retaining_wall |

Windows is **not** a product Work Area. Doors is internal-door scoped. Cladding is **not** a product Work Area; exterior painting is not cladding.

---

## 6. Full maturity matrix

Legend: Analyse / facts / questions = YES · PARTIAL · NO. Calculator = MATURE · PARTIAL · FALLBACK · NONE. Coverage = MATURE · PARTIAL · N/A · NONE. Quote = generic commercial pipeline unless blocked.

| Work Area | Key | Lvl | Analyse | Facts | Qs | Calc | Mat | Lab | Plant | Sub | Waste | Cond | Rates | Review | Price | Quote | DNA | Tests | Mobile | Effort |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Deck | `deck` | **8** | YES | YES | YES | MATURE | MATURE | MATURE | PARTIAL | N/A | MATURE | MATURE | MATURE | MATURE | WORKS | WORKS | MATURE | YES | YES | — |
| Fence | `fence` | **8** | YES | YES | YES | MATURE | MATURE | MATURE | N/A | N/A | MATURE | MATURE | MATURE | MATURE | WORKS | WORKS | MATURE | YES | YES | — |
| Retaining wall | `retaining_wall` | **8** | YES | YES | YES | MATURE | MATURE | MATURE | MATURE | PARTIAL | MATURE | MATURE | MATURE | MATURE | WORKS | WORKS | MATURE | YES | PARTIAL | — |
| Bathroom | `bathroom` | **5** | YES | YES | YES | FALLBACK | PARTIAL | PARTIAL | N/A | PARTIAL | PARTIAL | PARTIAL | PARTIAL | PARTIAL | WORKS | WORKS | POTENTIAL | PARTIAL | NO | VERY HIGH |
| Kitchen | `kitchen` | **4** | YES | YES | YES | FALLBACK | PARTIAL | PARTIAL | N/A | PARTIAL | PARTIAL | PARTIAL | PARTIAL | GENERIC | WORKS | WORKS | LOW VALUE | PARTIAL | NO | VERY HIGH |
| Pergola | `pergola` | **4** | YES | YES | YES | FALLBACK | PARTIAL | PARTIAL | N/A | N/A | NONE | PARTIAL | PARTIAL | GENERIC | WORKS | WORKS | POTENTIAL | PARTIAL | NO | MEDIUM |
| Painting | `painting` | **5** | YES | YES | YES | PARTIAL | PARTIAL | PARTIAL | N/A | N/A | N/A | PARTIAL | PARTIAL | PARTIAL | WORKS | WORKS | POTENTIAL | PARTIAL | NO | MEDIUM |
| Internal walls | `internal_walls` | **4** | YES | YES | YES | FALLBACK | PARTIAL | PARTIAL | N/A | PARTIAL | PARTIAL | PARTIAL | PARTIAL | GENERIC | WORKS | WORKS | POTENTIAL | PARTIAL | NO | HIGH |
| Flooring | `flooring` | **4** | PARTIAL | YES | YES | FALLBACK | PARTIAL | PARTIAL | N/A | PARTIAL | PARTIAL | PARTIAL | PARTIAL | GENERIC | WORKS | WORKS | POTENTIAL | PARTIAL | NO | MEDIUM |
| Doors | `doors` | **3** | YES | YES | YES | FALLBACK | PARTIAL | NONE | N/A | N/A | PARTIAL | PARTIAL | PARTIAL | GENERIC | WORKS | WORKS | LOW VALUE | PARTIAL | NO | MEDIUM |
| External stairs | `external_stairs` | **4** | YES | YES | YES | PARTIAL | PARTIAL | PARTIAL | N/A | N/A | PARTIAL | PARTIAL | PARTIAL | GENERIC | WORKS | WORKS | LOW VALUE | PARTIAL | NO | HIGH |
| Demolition | `demolition` | **4** | YES | YES | PARTIAL | FALLBACK | NONE | PARTIAL | N/A | PARTIAL | PARTIAL | PARTIAL | PARTIAL | GENERIC | WORKS | WORKS | LOW VALUE | PARTIAL | NO | MEDIUM |
| Ceilings | `ceilings` | **3** | PARTIAL | YES | YES | FALLBACK | PARTIAL | PARTIAL | N/A | PARTIAL | PARTIAL | PARTIAL | PARTIAL | GENERIC | WORKS | WORKS | LOW VALUE | NO | NO | HIGH |
| Plastering | `plastering` | **3** | YES | YES | PARTIAL | FALLBACK | PARTIAL | PARTIAL | N/A | PARTIAL | N/A | PARTIAL | PARTIAL | GENERIC | WORKS | WORKS | LOW VALUE | NO | NO | MEDIUM |
| Cladding | *(unsupported)* | **1** | NO* | NO | NO | NONE | NONE | NONE | NONE | N/A | NONE | NONE | NONE | NONE | NONE | BLOCKED | NONE | NO | NO | VERY HIGH |
| Windows | *(unsupported)* | **1** | NO* | NO | NO | NONE | NONE | NONE | N/A | PARTIAL | NONE | NONE | NONE | NONE | NONE | BLOCKED | NONE | NO | NO | HIGH |
| Roofing | *(unsupported)* | **1** | NO* | NO | NO | NONE | NONE | NONE | N/A | N/A | NONE | NONE | NONE | NONE | NONE | BLOCKED | NONE | NO | NO | VERY HIGH |
| `commercial_fitout` | parent only | **0** | PARTIAL | NO | NO | NONE | — | — | — | — | — | — | — | — | NONE | BLOCKED | NONE | NO | NO | — |

\*Unsupported types may appear in Analyse **warnings**, not as creatable WAs.

**Quote column:** all 14 product types reach quote through the generic commercial pipeline. They are **not blocked**. That is the risk: immature WAs still look commercially complete.

Known architecture issues (all immature product WAs unless noted):

- Silent assumed quantities still price (5 m² bathroom, 10 m² kitchen, 15 m² pergola, 20 m² fitout, 25 m² demolition, 50 m² painting, 3 doors).
- Benchmark `$` fallbacks mean **Pricing Required is rare**.
- No requirement envelope except Deck/Fence/RW.
- Nested painting/flooring/demolition flags can double-count sibling WAs.
- `support-contract` / first-run UI imply equal or “trial” status that does not match Deck/Fence/RW.

---

## 7. Coverage slices (code)

### Analyse
YES: deck, fence, retaining_wall, bathroom, kitchen, pergola, internal_walls, doors, painting, plastering, demolition, external_stairs (heuristics + LLM).  
PARTIAL: flooring, ceilings (LLM + incidental heuristics).  
NO as WA: cladding, windows, roofing (warnings only).

### Facts
YES namespaced keys for all 14. Derived set includes deck/pergola/rw/internal_walls/bathroom/external_stairs areas. Consumed-fact **contracts** only for 6 types.

### Questions
Counts (template keys): deck 35, fence 30, retaining_wall 32, bathroom 22, kitchen 22, external_stairs 15, pergola 14, internal_walls 14, flooring 13, painting 13, ceilings 13, doors 11, demolition 8, plastering 5.

Internal walls has **no door-opening / lintel** questions. That is a gap if alterations are the job.

### Calculators
All 14 registered in `CALCULATORS`. Physical/requirement-mature: deck, fence, retaining_wall. Painting has litres **shadow** (money still m² package). Others: area/count package + optional shadows (sheet count, flooring waste).

### Materials / labour / plant / subcontract / waste
Only the three mature WAs consistently emit identified materials + task labour + (RW) plant. Bathroom/kitchen emit subcontract **allowances**. Fitout materials are m² benchmarks, sometimes with sheet-count metadata that does not own money.

### Conditions
Shared Project Conditions apply by outdoor / interior / reno / consent sets. All product WAs can inherit them. Consumption of access/carry labour factors is strongest on deck/fence/rw/bathroom/pergola/demolition/stairs.

### Rates
Mature: identity-level catalogues (decking, fence timber/modular, RW timber/sleeper/masonry).  
Partial: pergola named m²/frame/roof keys; bathroom tiling/fixtures; kitchen named allowances; painting m²/door/trim; fitout mostly hardcoded `FITOUT_BENCHMARKS`.

### Builder Review
Mature copy/grouping: deck, fence, retaining_wall. Bathroom/painting have Job Plan (and bathroom Refine) but review is still largely generic commercial lines. Others: generic.

### Company DNA
MATURE: deck, fence, retaining_wall (V2 UI). NONE for the other 11. POTENTIAL where independent hours keys exist (pergola m² labour, painting m², internal_walls lining hours). LOW VALUE for lump-allowance WAs (kitchen cabinetry $, door lumps).

### Deterministic tests
YES: deck / fence / rw maturity verifier families.  
PARTIAL: bathroom/kitchen/pergola/fitout isolation and calibration scripts exist but are not WA-maturity closes.  
NO: dedicated ceilings/plastering maturity.

### Mobile
YES for the pre-beta Deck/Fence hosted close path. PARTIAL RW. NO dedicated mobile proof for other WAs.

---

## 8. Generic fallback behaviour (important)

If a user Analyse-selects an immature Work Area today, Quotr:

1. **Creates the WA** (catalogue type).
2. **Asks some questions** (templates exist).
3. **Runs a dedicated calculator** (never “No calculator available” for the 14).
4. **Assumes a quantity if missing** (silent default) and still prices it.
5. **Applies benchmark / hardcoded allowances** (labour m² or lumps).
6. **Passes Pricing** (lines have `$`; Pricing Required rarely triggers).
7. **Drafts a fact-aware quote paragraph**.
8. **Shows generic Job Plan** (“Work Area exists”) except bathroom/painting.
9. **Does not fail.**

It does **not** use a single global generic calculator. It uses **per-WA package fallback that looks specific**.

**Risk classification: HIGH — appears more accurate than it is.**

Commercially unsafe for Bathroom (5 m² + trade lumps + $18k minimum package path), Kitchen ($20k minimum package), Doors (assume 3), Painting (assume 50 m²).

---

## 9. UI exposure recommendation (do not change UI yet)

| Type | First-run | Add / Improve | Recommendation |
| --- | --- | --- | --- |
| `deck` | shown | shown | **KEEP VISIBLE** |
| `fence` | shown | shown | **KEEP VISIBLE** |
| `retaining_wall` | shown | shown | **KEEP VISIBLE** |
| `pergola` | shown, no badge | Developing | **LABEL BETA/COMING** |
| `bathroom` | shown, no badge | Trial-supported (**misleading**) | **LABEL BETA/COMING** |
| `kitchen` | shown | Developing | **LABEL BETA/COMING** |
| `internal_walls` | shown | Component | **LABEL BETA/COMING** |
| `flooring` | shown | Component | **LABEL BETA/COMING** |
| `painting` | shown | Component | **LABEL BETA/COMING** |
| `demolition` | shown | Component | **LABEL BETA/COMING** |
| `doors` | hidden | Component | **HIDE UNTIL SUPPORTED** (or label if Analyse already added it) |
| `ceilings` | hidden | Component | **HIDE UNTIL SUPPORTED** |
| `plastering` | hidden | Component | **HIDE UNTIL SUPPORTED** |
| `external_stairs` | hidden | Component | **HIDE UNTIL SUPPORTED** — usually nested under Deck |
| cladding / windows / roofing | not creatable | not listed | **KEEP HIDDEN** as WAs |

---

## 10. Reuse audit

### Deck primitives (mature)
Posts/piles, hole/footing geometry, bagged concrete, lineal framing (joists/bearers/rim), board coverage + waste, demolition, height/access, fascia/skirting, steps (XOR vs stairs), labour hours × productivity, identity ≠ rate, Planning vs commercial takeoff.

### Fence primitives (mature)
Posts, rails, boards/palings, section layout, gates, linear scope, timber XOR modular, disposal, finish as optional.

### Retaining primitives (mature)
Excavation, concrete, drainage, backfill, system-family XOR, masonry/sleeper concepts, plant (mini excavator), spoil, consent/surcharge.

### Other shared
Sheet-count + wastage (`calculateSheetCount`), flooring area + waste, paint litres (shadow), Project Conditions labour access factor, overlap-group pricing ownership, quote draft switch, generic commercial pipeline.

| Candidate | Reuse |
| --- | --- |
| Pergola | **HIGH** — posts, holes/concrete, beams/rafters ≈ framing, fixings, height/access; roofing is the new family |
| Internal walls | **MEDIUM** — lineal + sheet + demolition + nested paint/stop; not post-hole; openings missing |
| Flooring | **MEDIUM** — area + waste + removal like decking/demo; covering catalogue is new |
| Doors | **MEDIUM** — count + removal + trim; no windows/lintels |
| External stairs | **HIGH** vs deck steps — **do not mature as a fourth headline WA** |
| Painting | **MEDIUM** — litres helper + adapters already exist; collision with nested flags |
| Bathroom | **LOW–MEDIUM** — demo/lining/waste only; waterproof/tile/plumbing/electrical are new |
| Kitchen | **LOW** — PC sums / joinery / appliances |
| Cladding | **LOW** — access/demo/paint only; cavity/wrap/flashings/scaffold are greenfield |
| Windows | **LOW** — not a WA; new openings/lintels would sit with alterations |

---

## 11. Named candidate results

### Pergola / exterior timber structure
**Exists** as `pergola`. Status: PARTIAL (level 4). Package m² labour + frame/roof allowances. Named rate keys already exist. **No post/beam/rafter takeoff.** `deck.pergola_included` is a parallel flag.

**Efficient fourth mature Work Area: YES**, if scoped as timber pergola / simple outdoor frame (not every shade sail / louvre roof). Completes the outdoor carpentry cluster for current beta. Expected phases: WA-0…WA-7 + WA-9; DNA optional. Effort **M**.

### Internal walls / alterations
**Exists** as `internal_walls` (not split into multiple product WAs). ISD `partitions` aliases here. Questions cover length, height, timber/steel/existing, GIB types, sides, fire/acoustic, skirting, demo, stopping, painting, insulation. **No door openings.** Calculator: length×height area, framing labour lm, lining labour m², materials **m² package**, optional sheet shadow, nested stopping/paint allowances. Steel vs timber is **not XOR-priced**.

This is **one Work Area** with nested finish flags — not a demolition + framing + GIB + paint split. That composition is correct if nested flags stay allowances or hand off to sibling WAs.

**Second in owner-approved sequence** (after Bathroom). Effort **HIGH**. Do not require Retaining-level XOR on day one; timber + standard GIB + openings later. Bathroom local nogging stays in Bathroom — full partitions stay here.

### Bathroom / wet area
**Exists** as `bathroom`. Level 5 hybrid: carpentry hours, demolition hours, waterproof/tile **allowances** (area-derived), fixtures lumps, plumbing/electrical **subcontract allowances**, optional lining/floor prep, **silent 5 m²**, **$18k minimum package** if finishes not componentised.

Architecture **can** support this without a monolithic calculator: keep trades as subcontract allowances + in-house carpentry; do not invent a tiling setter takeoff until RFQ exists. **Do not call it MATURE** while quantities are assumed and trades are lumps.

Effort **VERY HIGH** if depth-matched to Deck. Effort **HIGH** if targeted SUPPORTED hybrid. RFQ **HIGH**. Beta/marketing **VERY HIGH**.

**Owner override (WA-BATHROOM-01):** Bathroom is the **first** implementation after this audit. Architecture: [QUOTR_BATHROOM_ESTIMATING_ARCHITECTURE.md](./architecture/QUOTR_BATHROOM_ESTIMATING_ARCHITECTURE.md). Still hybrid SUPPORTED — do not skip quantity authority.

### Kitchen
**Exists** as `kitchen`. Level 4. Component flags → cabinetry/benchtop/appliance/splashback/rangehood **allowances** + plumbing/electrical lumps. No cabinetry lm takeoff despite `kitchen.cabinetry_lm` question. Silent 10 m². **$20k minimum package**. Rate-authority keys exist.

Complexity **VERY HIGH**. RFQ **HIGH**. Wave 2–3. Reuse Bathroom hybrid pattern; do not invent joinery CAD.

### Doors / windows
**Doors exists.** Windows **does not**. Doors: count, type, prehung, supply, architraves, removal, frames, hardware, painting. Calculator: lump × count, **default 3 doors**, architrave 5 lm/door invented.

**Do not merge windows into doors.** New openings / lintels / make-good belong with Internal walls (or a future openings WA). External doors/windows are supplier + opening — HIGH RFQ.

Efficient high-frequency WA: **YES for internal doors as SUPPORTED**, not as a combined joinery WA. Wave 2. Effort **MEDIUM**.

### Flooring
**Exists.** Types in questions (timber/laminate/vinyl/carpet/etc.), prep, removal, underlay, scotia, stairs/landings, supply scope. Calculator: area package + removal path + waste metadata. Analyse recognition **PARTIAL**.

**Quick-win to SUPPORTED** if we stop silent 20 m² and type-XOR the covering family. Full timber-floor takeoff is not required. **Not in the owner-approved sequence** (Bathroom → Internal walls → Ceilings → Doors). Isolation vs Bathroom nested floor finish is required before Flooring matures. Effort **MEDIUM**. Variation **HIGH**.

### Cladding / exterior repair
**Not a product WA.** ISD may mention wrap/flashings as components; painting “external” is not cladding. Greenfield: demolition, cladding family XOR, cavity/battens, wrap, flashings, trims, paint, scaffold.

Breadth **HIGH**. Complexity **VERY HIGH**. Wave 2+ as a **new** catalogue type, not a paint upgrade.

---

## 12. Other strong candidates

| Candidate | Why |
| --- | --- |
| **Painting** | Already has Job Plan + Refine + consumed facts + litres shadow. Isolation vs nested flags is the real work. Good SUPPORTED polish, weaker as a headline fourth WA. |
| **Demolition** | Honest-ish allowances. Useful component. Not a marketing headline. |
| **External stairs** | Partial physical model; usually Deck. Do not spend a Wave 1 slot. |
| **Ceilings** | **Third in owner sequence.** Same package pattern as walls; XOR vs Bathroom nested ceiling lining. |
| **Doors** | **Fourth in owner sequence.** Count model; Internal walls openings leftover. |

Owner-approved next builds are Bathroom → Internal walls → Ceilings → Doors. Pergola / Flooring remain strong later candidates; they are not this sequence.

---

## 13. User-value triage (recommendation, 1–5)

| WA | Freq | Breadth | Multi-trade | Commercial | Beta | Marketing |
| --- | --- | --- | --- | --- | --- | --- |
| Deck / Fence / RW | 5 | 4 | 2 | 5 | 5 | 5 |
| Pergola | 4 | 3 | 2 | 4 | 4 | 5 |
| Internal walls | 5 | 5 | 3 | 5 | 5 | 4 |
| Flooring | 5 | 4 | 2 | 4 | 4 | 4 |
| Doors | 5 | 3 | 2 | 4 | 4 | 4 |
| Bathroom | 5 | 4 | 5 | 5 | 5 | 5 |
| Kitchen | 4 | 3 | 5 | 5 | 4 | 5 |
| Painting | 5 | 3 | 2 | 3 | 3 | 3 |
| Demolition | 4 | 2 | 2 | 3 | 3 | 2 |
| External stairs | 3 | 2 | 1 | 3 | 2 | 3 |
| Ceilings | 3 | 2 | 2 | 3 | 2 | 2 |
| Plastering | 3 | 2 | 3 | 3 | 2 | 2 |
| Cladding (new) | 4 | 5 | 3 | 4 | 3 | 4 |
| Windows (new) | 4 | 3 | 2 | 4 | 3 | 3 |

---

## 14. Development effort triage (recommendation)

| WA | Reuse | Physical | Facts/Q | Systems | Catalogue | Labour | Subbie | Conditions | Tests | DNA | Overall |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Pergola | HIGH | MED | MED | MED | MED | MED | LOW | MED | MED | MED | **MEDIUM** |
| Internal walls | MED | HIGH | HIGH | HIGH | MED | HIGH | MED | MED | HIGH | MED | **HIGH** |
| Flooring | MED | MED | MED | MED | MED | MED | MED | LOW | MED | LOW | **MEDIUM** |
| Doors | MED | LOW | MED | LOW | LOW | LOW | LOW | LOW | MED | LOW | **MEDIUM** |
| Painting | MED | MED | MED | LOW | LOW | MED | LOW | MED | MED | MED | **MEDIUM** |
| Bathroom | LOW | HIGH | HIGH | HIGH | HIGH | HIGH | HIGH | HIGH | HIGH | LOW | **VERY HIGH** |
| Kitchen | LOW | HIGH | HIGH | HIGH | HIGH | MED | HIGH | MED | HIGH | LOW | **VERY HIGH** |
| Cladding | LOW | VERY HIGH | HIGH | VERY HIGH | HIGH | HIGH | MED | HIGH | HIGH | MED | **VERY HIGH** |
| External stairs | HIGH | HIGH | MED | MED | MED | MED | LOW | MED | MED | LOW | **HIGH** |

---

## 15. Variation usefulness / RFQ usefulness (recommendation)

Do **not** design VARIATIONS-V1 or RFQ-V1 here.

| WA | Variation | RFQ |
| --- | --- | --- |
| Internal walls | **HIGH** | MEDIUM |
| Flooring | **HIGH** | MEDIUM |
| Doors | **HIGH** | LOW |
| Painting | MEDIUM | LOW |
| Demolition | **HIGH** | MEDIUM |
| Bathroom | MEDIUM | **HIGH** |
| Kitchen | MEDIUM | **HIGH** |
| Pergola | MEDIUM | LOW |
| External stairs | LOW | LOW |
| Cladding | MEDIUM | MEDIUM |
| Windows | **HIGH** | **HIGH** |
| Deck/Fence/RW | MEDIUM | LOW |

Alterations score high for later variations. Wet areas and windows score high for later RFQ.

---

## 16. Weighted build ranking

Weights used (same as brief; unchanged):

| Weight | Axis | Why |
| --- | --- | --- |
| 30% | User / beta value | Average of frequency, beta, marketing |
| 20% | Existing-code reuse | Factory must not start on greenfield |
| 15% | Breadth gain | New ordinary jobs |
| 15% | Variation usefulness | Later VARIATIONS-V1 |
| 10% | Effort inverse | LOW=5 … VERY HIGH=1 |
| 10% | Strategic / commercial | Average of commercial + multi-trade |

Mature Deck/Fence/RW are **not ranked** (already closed).

| Rank | WA | User | Reuse | Breadth | Var | Effort⁻¹ | Strat | **Total** |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | Internal walls | 28 | 12 | 15 | 15 | 4 | 8 | **82** |
| 2 | Flooring | 26 | 12 | 12 | 15 | 6 | 6 | **77** |
| 3 | Pergola | 26 | 20 | 9 | 9 | 6 | 6 | **76** |
| 4 | Doors | 26 | 12 | 9 | 15 | 6 | 6 | **74** |
| 5 | Bathroom | 30 | 8 | 12 | 9 | 2 | 10 | **71** |
| 6 | Painting | 22 | 12 | 9 | 9 | 6 | 5 | **63** |
| 7 | Demolition | 18 | 12 | 6 | 15 | 6 | 5 | **62** |
| 8 | Cladding (new) | 22 | 4 | 15 | 9 | 2 | 7 | **59** |
| 9 | Kitchen | 24 | 4 | 9 | 9 | 2 | 10 | **58** |
| 10 | External stairs | 16 | 20 | 6 | 3 | 4 | 4 | **53** |
| 11 | Ceilings | 14 | 12 | 6 | 9 | 4 | 4 | **49** |
| 12 | Plastering | 14 | 8 | 6 | 3 | 6 | 6 | **43** |

Bathroom would rank higher if effort were ignored. Effort and RFQ keep it out of Wave 1.

---

## 17. Wave 1 — owner-approved (overrides technical ranking)

Technical ranking in §16 still explains **reuse vs effort**. It is **not** the build order.

| Order | Work Area | Why now | Main risk | Phases | Effort |
| --- | --- | --- | --- | --- | --- |
| **1st build** | **Bathroom** | Owner-approved. Highest beta/marketing wet-area demand. Architecture: [QUOTR_BATHROOM_ESTIMATING_ARCHITECTURE.md](./architecture/QUOTR_BATHROOM_ESTIMATING_ARCHITECTURE.md) | Silent 5 m², $18k package, mixed trade lumps, UI implying Deck-grade. Hybrid SUPPORTED — not Deck-depth on day one | WA-BATHROOM-02…08 (factory WA-0…WA-7 + WA-9; DNA optional) | **VERY HIGH** (SUPPORTED hybrid still **HIGH**) |
| 2 | **Internal walls** | Next after Bathroom. Ordinary-job expansion; partition XOR vs bathroom nogging | Steel XOR, openings, nested paint/stop | Factory WA-0…WA-7 + WA-9 | **HIGH** |
| 3 | **Ceilings** | After Internal walls. Sheet + labour pattern; Bathroom nested ceiling XOR | Double-count bathroom ceilings | Factory WA-0…WA-7 (SUPPORTED OK) | **HIGH** |
| 4 | **Doors** | After Ceilings. Count model; Internal walls openings leftover | Default-3-doors silent quantity; no windows | Factory WA-0…WA-7 (SUPPORTED OK) | **MEDIUM** |

**Pergola is not Wave 1.** Flooring remains a strong later candidate; it is not in this owner sequence.

Do not begin Bathroom **implementation** in WA-BATHROOM-01 (architecture only).

**Exact next implementation: Bathroom (`bathroom`) — WA-BATHROOM-02.**

---

## 18. After owner Wave 1 (Bathroom → Internal walls → Ceilings → Doors)

Previously Wave 2. Re-ranked after the owner sequence:

1. **Pergola** — outdoor cluster; high Deck reuse; **deferred**, not cancelled.  
2. **Flooring** — high frequency; XOR vs Bathroom nested floor finish.  
3. **Painting** — isolate from nested flags (Bathroom / Internal walls / Ceilings / Doors).  
4. **Kitchen** — copy Bathroom hybrid; PC sums stay allowances.  
5. **Cladding** (new catalogue type) **or** skip — only after isolation rules are proven.

Not a headline: External stairs (keep under Deck), Plastering as a separate mature WA, Windows-as-WA, `commercial_fitout` calculator.

---

## 19. Beta override rule

Wave ranking in §16 is the technical/product recommendation.

Actual beta demand can override it. **This override has been exercised (2026-09-07):**

- **Bathroom is first.** Still hybrid SUPPORTED, still factory stages, still no silent 5 m² / $18k package on the mature path.
- **Pergola moved down** (no longer Wave 1).
- Sequence after Bathroom: Internal Walls → Ceilings → Doors.
- Do not skip quantity authority to satisfy demand. Reduce depth instead.

---

## 20. Branching / migrations / production

- Stay on `hardening/stage-2a-security`.
- One mature Work Area batch at a time → verifier → hosted smoke → close → next.
- **Migrations: NONE.** Preview stays through **054**. Production through **045**. No 055.
- **Production: DO NOT TOUCH.**

---

## 21. Files in this programme

| File | Change |
| --- | --- |
| `docs/architecture/QUOTR_WORK_AREA_FACTORY.md` | Factory stages (WORK-AREA-FACTORY-01) |
| `docs/WORK_AREA_EXPANSION_TRIAGE.md` | This triage + **owner-approved sequence** |
| `docs/architecture/QUOTR_BATHROOM_ESTIMATING_ARCHITECTURE.md` | **WA-BATHROOM-01** architecture / gap audit |
| `scripts/lib/work-area-maturity-verifier.ts` | Non-runtime factory helper |
| `docs/architecture/QUOTR_WORK_AREA_ESTIMATING_COVERAGE.md` | Supersession pointer |
| `docs/product/QUOTR_SUPPORTED_WORK_AREAS.md` | Supersession pointer |
| `docs/architecture/QUOTR_SUPPORTED_WORK_AREA_CONTRACT.md` | Stale-band pointer |

No runtime product behaviour change. No calculators, rates, questions, Analyse, visibility, DNA, Variations, RFQ, or migrations.

---

## 22. Verdicts

### WORK-AREA-FACTORY-01

**GO** as an audit / factory-design close.

### WA-BATHROOM-01

**GO** as Bathroom architecture / current-state gap audit.

**NO-GO** to implement Bathroom V2, Internal Walls, Ceilings, Doors, Pergola, Variations, or RFQ in this phase.

**Next implementation, after review: Bathroom — WA-BATHROOM-03** (physical substrates / linings / framing). Do not start until WA-BATHROOM-02 is reviewed.
