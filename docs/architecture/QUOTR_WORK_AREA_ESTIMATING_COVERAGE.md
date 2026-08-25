# Quotr Work Area Estimating Coverage

**Status:** CANONICAL — ESTIMATOR-SAFETY-0 (trust / commercial integrity hardening)  
**Date:** 2026-08-20  
**Related:** [QUOTR_SUPPORTED_WORK_AREA_CONTRACT.md](./QUOTR_SUPPORTED_WORK_AREA_CONTRACT.md), [QUOTR_COMPANY_MATERIALS_AND_RATES_CONTRACT.md](./QUOTR_COMPANY_MATERIALS_AND_RATES_CONTRACT.md), [QUOTR_ESTIMATING_ENGINE_ARCHITECTURE.md](./QUOTR_ESTIMATING_ENGINE_ARCHITECTURE.md)

This document is the canonical Work Area estimating coverage map for the 14 product creatable types.

It does **not** implement new calculators or rates. Claims below are **code-verified** against `lib/estimate/calculators/*`, Job Plan / Refine registries, and FE-0 assistant wiring.

---

## How to read this document

Every coverage claim is one of:

| Marker | Meaning |
| --- | --- |
| **CURRENT IMPLEMENTATION** | What the code does today |
| **KNOWN DEFECT / RISK** | Present behaviour that is unsafe, misleading, or commercially incomplete |
| **TARGET ARCHITECTURE** | Intended future shape — **not** current behaviour |
| **FUTURE CAPABILITY** | Optional later work; not required for first expansion |

Do not write target or future behaviour in present tense.

---

## 1. Product principle (locked)

Quotr must **ASK** only information worth interrupting the builder for, **ASSUME** where safe and disclose, **REFINE** for additional useful inputs, and expose **ADVANCED** only where the current estimator **consumes** the data.

Never appear confident while missing material-pricing-sensitive facts that are neither asked nor disclosed.

---

## 2. Work Area estimating contract (conceptual)

**CURRENT IMPLEMENTATION:** existing metadata already covers parts of this. Do not create a parallel TypeScript contract yet.

| Concept | Existing home |
| --- | --- |
| Product / display band | `lib/work-areas/support-contract.ts` — **not** estimator maturity |
| Scope catalogue | `lib/scopes/catalogue.ts`, scope templates |
| Job Plan projection | `lib/assistant/job-plan/adapters/*` |
| Clarify / Refine candidates | `lib/assistant/clarify/*`, `lib/assistant/refine/*` |
| Physical model + requirements | `lib/estimate/calculators/*`, `lib/estimate/requirement-*` |
| Material identity vs rate | `QUOTR_COMPANY_MATERIALS_AND_RATES_CONTRACT.md` |
| Commercial lines | `lib/estimate/calculate-estimate.ts`, component authority |

**TARGET ARCHITECTURE** (documentation only — not implemented as a type):

```
WorkAreaEstimatingContract {
  workAreaType
  scopeCatalogue
  factCatalogue
  questionPolicy          ASK_NOW | ASSUME | REFINE | ADVANCED | DERIVED
  refinementPolicy        only consumed facts
  materialRequirementCapabilities
  labourCapabilities
  allowanceCapabilities
  pricingFallbacks
  confidenceDrivers
}
```

---

## 3. Estimator expansion pipeline (locked)

**TARGET ARCHITECTURE:**

```
SUPPORTED SCOPE
  → CANONICAL FACTS
  → PHYSICAL MODEL
  → MATERIAL / LABOUR / OTHER REQUIREMENTS
  → RATE RESOLUTION
  → COMMERCIAL LINES
  → BUILDER REVIEW
```

Do not jump from scope directly to an arbitrary rate line.

**CURRENT IMPLEMENTATION:** several calculators still emit package / allowance money before a full physical model (masonry retaining-wall package, kitchen appliance lump sums, most fitout m² packages). Supported Timber and Concrete Sleeper retaining walls use detailed component money.

---

## 4. Requirement taxonomy (canonical)

These labels describe **what the calculator emits as priced commercial quantity**, not what a human estimator would conceptually take off.

| Label | Meaning |
| --- | --- |
| **DETAILED_REQUIREMENT** | Calculator emits a priced quantity for a named physical product/family (identity + unit), then rate-resolves it |
| **SHADOW_REQUIREMENT** | Physical quantity/spec is computed or disclosed, but **does not own money** (or money stays on a package line) |
| **PACKAGE_ALLOWANCE** | One commercial line (m² / lm / ea / lump) owns money for a whole family; subcomponents are not separately priced |
| **NOT_MODELLED** | No quantity and no priced line for that family |
| **PRICING_REQUIRED** | Identity/quantity may exist; no trusted rate — must not invent price |

Apply the **same** label to identical calculator behaviour. Do not upgrade a package line because the domain conceptually has posts, tiles, or linings.

---

## 5. Coverage score legend

Estimator maturity (this document) is independent of product display band (§12).

| Score | Meaning |
| --- | --- |
| **MATURE / CONDITIONAL** | Reference wiring exists; some commercial lines remain allowances; geometry/labour conditions apply |
| **PARTIAL** | Calculator + some interview wiring; mixed package and resolved lines; not a full physical model |
| **MINIMAL** | Package/allowance-heavy; interview thin or generic |
| **MINIMAL / ACTIVE RISK** | Can emit a complete-looking price from silent defaults — commercially unsafe |
| **NOT_READY** | No calculator |
| **UNVERIFIED** | Independent audit / this reconciliation did not inspect that axis in source |

---

## 6. All Work Areas — reconciled maturity matrix

| Work Area | Display band | Scope | Facts/Q | Materials | Labour | Commercial | Confidence | Overall |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| deck | trial_supported | MATURE / CONDITIONAL | MATURE / CONDITIONAL | hybrid DETAILED + PACKAGE + SHADOW | PARTIAL | MATURE / CONDITIONAL | PARTIAL | **MATURE / CONDITIONAL** |
| bathroom | trial_supported | PARTIAL | PARTIAL | PACKAGE_ALLOWANCE (mixed resolve) | PARTIAL (per-trade exists) | PARTIAL | PARTIAL | **PARTIAL** — labour ahead of material |
| retaining_wall | developing | PARTIAL | SAFETY HARDENED / timber 1F + sleeper 2A | Timber + Concrete Sleeper DETAILED; masonry package **still MINIMAL** | PARTIAL (timber + sleeper task labour) | Timber + Sleeper DETAILED / masonry MINIMAL | PARTIAL | **SAFETY HARDENED / TIMBER 1F / SLEEPER 2A LOCAL** |
| kitchen | developing | MINIMAL | MINIMAL | PACKAGE + **RATE AUTHORITY FIXED** | MINIMAL (no shared access factor) | MINIMAL | MINIMAL | **MINIMAL** — **KITCHEN-RATE-AUTHORITY-01 FIXED** |
| fence | developing | MINIMAL | MINIMAL | PACKAGE_ALLOWANCE | PARTIAL (slope flag) | MINIMAL | MINIMAL | **MINIMAL** |
| pergola | developing | MINIMAL | MINIMAL | PACKAGE_ALLOWANCE | PARTIAL | MINIMAL | MINIMAL | **MINIMAL** — not ahead of fence |
| external_stairs | component | PARTIAL | PARTIAL | PACKAGE_ALLOWANCE + some resolveRate | PARTIAL | PARTIAL | PARTIAL | **PARTIAL** — calculator ahead of display band |
| demolition | component | MINIMAL | MINIMAL | PACKAGE_ALLOWANCE | PARTIAL | MINIMAL | MINIMAL | **MINIMAL** — relatively honest |
| painting | component | PARTIAL | PARTIAL | PACKAGE + paint-litre SHADOW | UNVERIFIED | PARTIAL | PARTIAL | **PARTIAL** — ahead of display band |
| internal_walls | component | MINIMAL | MINIMAL | PACKAGE_ALLOWANCE | UNVERIFIED | MINIMAL | MINIMAL | **MINIMAL** |
| ceilings | component | MINIMAL | MINIMAL | PACKAGE_ALLOWANCE | UNVERIFIED | MINIMAL | MINIMAL | **MINIMAL** — same pattern as internal_walls |
| doors | component | MINIMAL | MINIMAL | PACKAGE_ALLOWANCE | UNVERIFIED | MINIMAL | MINIMAL | **MINIMAL** |
| flooring | component | MINIMAL | MINIMAL | PACKAGE_ALLOWANCE | UNVERIFIED | MINIMAL | MINIMAL | **MINIMAL** |
| plastering | component | MINIMAL | MINIMAL | PACKAGE_ALLOWANCE | UNVERIFIED | MINIMAL | MINIMAL | **MINIMAL** |

---

## 7. Deck — reference for wiring / domain architecture

**CURRENT IMPLEMENTATION**

Deck is the **reference for Assistant wiring and domain architecture**, not proof that every component is detailed.

What is real today:

- Dedicated Job Plan adapter (`lib/assistant/job-plan/adapters/deck.ts`)
- Dedicated Refine adapter (`lib/assistant/refine/adapters/deck.ts`)
- Real **decking surface** quantity model (board lm takeoff exists)
- Real **structural shadow / planning takeoff** model for rectangular decks with new substructure (`lib/estimate/deck-structure.ts`)
- Geometry readiness: `DETAILED_GEOMETRY_AVAILABLE` | `AREA_ONLY` | `IRREGULAR_UNSUPPORTED`
- Calculator: `lib/estimate/calculators/deck.ts`
- Access labour factor applied via `getCombinedLabourAccessFactor`
- Component commercial authority path for decking vs allowance fallback
- **DECK-MATURITY-2A PHYSICAL TAKEOFF FOUNDATION** — layout defaults (450 mm joist centres; 1.8 m bearer/support spacing) are disclosed estimating assumptions, not engineering

Hybrid commercial model (intentional):

- Decking can price as **package allowance** when board width / lm pricing is not confirmed
- Framing/substructure often prices as `deck.substructure.m2` **package**
- Stairs, balustrade, handrail, pile replacement remain **allowances**
- Irregular / insufficient geometry can remain legacy/fallback

**KNOWN DEFECT / RISK**

- None of the silent-complete-price class of retaining wall
- Refine `consumedByCalculator` is now **verified** against the calculator-owned consumed-fact contract (see **CONSUMED-FACT-CONTRACT-01** — FOUNDATION COMPLETE). Adapters still declare ask candidates; compose drops keys the calculator does not consume.

**FUTURE CAPABILITY (deferred)**

- LABOUR-CREW-01
- Non-rectangular structural detail
- Promoting structural children to commercial money (**DECK-MATURITY-2B**)

**Do not copy universally**

- Height / access / steps coupling
- Deck structural material identity contracts
- Fascia level-1 check remapping

---

## 7A. Deck Maturity 2A — PHYSICAL TAKEOFF FOUNDATION

**Status:** COMPLETE / COMMITTED / PREVIEW (2A-R1 orientation correction Owner-approved)  
**Verifier:** `scripts/verify-deck-maturity-2a.ts`  
**Contract:** `lib/estimate/deck-information-contract.ts`

| Axis | 2A / 2A-R1 rule |
| --- | --- |
| Geometry storage | `deck.length_m` / `deck.width_m` are **plan dimensions**, often first-written × second-written. They are **not** structural orientation. |
| Derived framing orientation | When board/joist direction are both unknown: joists span the **shorter** rectangle axis; bearers run perpendicular (along the longer axis). Near-square tie (`|L−W| ≤ 0.05 m`): historical joists-along-width default. |
| Explicit orientation | `deck.joist_direction` wins. Else explicit `deck.board_direction` forces joists perpendicular to boards. No Clarify question for joist direction. |
| Boards | Aesthetic/material. Defaulted boards follow perpendicular-to-joists when orientation is derived. Do not let stored “length” own framing. |
| New substructure | Activates planning takeoff. Commercial money stays `deck.substructure.m2`. |
| Joists / rim | Count and lm derived when L×W exist. Identity optional. |
| Bearers / supports | Explicit layout facts win. If **both** missing, estimate at **1.8 m** spacing — **UNSOURCED estimating default**, not a compliance rule. Partial spec still omits the missing child. Conservative support layout: existing connection is not assumed to provide structural support. |
| Concrete | Only with footing L×W×D and support count. Never invented. |
| Quantity confidence | Geometry-validated ≠ assumption-dependent planning quantity ≠ commercial promotion ready. |
| Commercial | No joist / bearer / rim / pile / concrete dollars. |

Promotion-readiness labels (2B input, **do not promote**): `GEOMETRY_VALIDATED` / `PLANNING_QUANTITY` / `ASSUMPTION_DEPENDENT_QUANTITY` / `IDENTITY_VALIDATED` / `RATE_AVAILABLE` / `COMMERCIAL_PROMOTION_READY`.

Residual allowance (intentional, not counted): fixings, connectors, DPC, minor blocking, consumables, delivery/sundries.

**Not in 2A:** structural material commercial promotion, new rates, LABOUR-CREW-01, Retaining Wall maturity.

---

## 7B. Deck Maturity 2B / 2B-R1 — SCOPE-COMPONENT COMMERCIAL ESTIMATING

**Status:** 2B architecture COMPLETE LOCAL. **2B-R1 COMPLETE LOCAL / OWNER COMMERCIAL REVIEW PENDING** (do not commit until Owner reviews the new Deck commercial result).  
**Verifier:** `scripts/verify-deck-maturity-2b.ts`

| Intent | 2B-R1 authority |
| --- | --- |
| Decking boards | Unchanged `decking.surface` REQUIREMENT_AUTHORITATIVE |
| Decking + framing + pile labour | DETAILED when starter/company productivities exist for decking 0.55 h/m², substructure 0.52 h/m², and posts 0.20 h/ea. Old 1.2 lump is fallback only. Elevated 0.25 h/m² remains a separate extra |
| Structural materials | DETAILED when joists, bearers, rim, and piles all have quantity, identity, trusted rate, and piles have procurement quantity. Else PACKAGE_FALLBACK on `deck.substructure.m2`. No package + detail |
| Piles | Default 125×125 H5 house pile $23.50/lm EX GST. Physical required length ≠ purchase lm. Stock lengths 0.60–3.60 m. 100×100 H5 is selectable without binding the 125 rate |
| Fascia | Physical height coverage. Labour 0.45 h/lm replaces $35/lm labour allowance when hours are trusted. Material $22/lm allowance remains until fascia identity/rate is complete |
| Steps | Starter 4.0 h/m² tread (low-confidence). Stair lump remains money until step material and labour are both complete. Does not block structural promotion |
| Demolition | Existing `deck.demolition_hours_per_m2` 0.35 unchanged |
| Balustrade | Unchanged lump. Not matured |
| Fixings | Residual `deck.fixings.m2` $25/$40 **RESIDUAL_STARTER_BENCHMARK**. Builder label: Fixings, connectors & sundries. Covers screws/clips, connectors, DPC, blocking, consumables. Not timber/boards/concrete/delivery. |
| Access/carry | Applied once to each labour line (equivalent to once on the sum). Not per-component then again on an aggregate |
| Promotion rule | Never sum package + detailed children. Missing/zero productivity uses lump — no silent zero labour |

Estimating material assumptions are **not** NZS 3604 or structural certification.

**Not in 2B-R1:** Retaining Wall, Company DNA calibration, balustrade engineering, golden restamp.

---

## 7C. Deck Maturity 2C — FINAL SCOPE OWNERSHIP / PRODUCTIVITY UX

**Status:** COMPLETE / COMMITTED / PREVIEW  
**Verifier:** `scripts/verify-deck-maturity-2c.ts`

Does not rebuild 2A/2B architecture.

| Contract | 2C rule |
| --- | --- |
| Labour model | Quantity × productivity hours = TIME. Hours × labour $/hr = MONEY. Separate. |
| Normal handling | Included in each scope productivity. No separate handling line. |
| Abnormal access/carry | Project Conditions, applied once. |
| Productivity Rates | Dedicated Labour productivity section. Hours only — no $. Persistence via existing company rates. |
| Pile/post replacement | Only when existing supports may be reused. New substructure owns new piles — no question, no allowance, stale replacement ignored. |
| Material identity | Builder Review shows resolved identity under Joists / Bearers / Rim / Piles / Decking. |
| Decking label | Builder-facing **Decking** (not Decking materials). |
| Pile presentation | Identity + count + purchase length each + purchased lm. Required length remains secondary. |
| Pile labour | Hours/ea includes set-out, hole excavation/prep, positioning. No separate digging line. |
| Concrete | Optional YES/NO/NOT_SURE when supports active. Default 2.5 × 20kg bags/hole, round up. Own hours/hole (NEEDS_OWNER_BENCHMARK if no company hours). No invented $ rate. Residual is not concrete money. |
| Steps | Only brief/Job Plan include, or canonical `Stair set` / `has_stairs`. Height and logistics `access_type` "Single step or step-down" do not auto-include. Detailed Step decking + framing + installation promote only when `deck.steps_included` is explicit and the chain is complete; otherwise stair lump. XOR, never both. |
| Planning takeoff | No duplicate of authoritative commercial lines. |

**Not in 2C:** new geometry, NZS, supplier API, Company DNA calibration, balustrade, freight, Retaining Wall, Bathroom, PERF-01, Production.

---

## 7D. Deck Maturity 2D — FINAL MATERIAL SELECTION + RATE AUTHORITY

**Status:** COMPLETE LOCAL / OWNER FINAL MATERIAL-RATE REVIEW PENDING  
**Verifier:** `scripts/verify-deck-maturity-2d.ts`

Does not rebuild Deck geometry or change starter productivities.

| Contract | 2D rule |
| --- | --- |
| Layers | Physical quantity ≠ material identity ≠ material rate. |
| Detailed authority | Component-level: DETAILED_PRICED / PRICING_REQUIRED / NOT_APPLICABLE. |
| Package lifecycle | `PACKAGE_FALLBACK_FOR_INSUFFICIENT_PHYSICAL_MODEL` only. Not a rate-missing fallback. |
| Missing rate | Trusted quantity remains. Needs a trusted price. Never silent $0. Never whole-package reversion. |
| Rates sections | `rate_type=material` → Materials. `rate_type=productivity` → Labour productivity. `rate_type=labour` → Core labour $/hr. One section per row. |
| Concrete productivity | Company `h/hole` persists (`rate_type=productivity`, unit `hole`). No Quotr hours benchmark. |
| Selectors | Compatible family only (framing sections / H5 piles). No SED retaining pole. |
| Units | Exact unit required. `h/hole` is not `h/ea`. `$/lm` is not `$/ea`. |

**Not in 2D:** new geometry, new productivity benchmarks, fascia/steps maturity, balustrade, delivery, Company DNA, Retaining Wall, PERF-01, Production.

---

## 8. Retaining Wall — SAFETY HARDENED / TIMBER 1F / SLEEPER 2A LOCAL

**CURRENT IMPLEMENTATION (ESTIMATOR-SAFETY-0)** — hard-minimum and unsupported-material safety remain. Supported Timber and Concrete Sleeper use detailed component authority. Masonry commercial package remains **still MINIMAL**.

**RETAINING WALL MATURITY 1A — PHYSICAL MODEL FOUNDATION (COMPLETE LOCAL / OWNER FINAL PHYSICAL APPROVAL PENDING)**

1A-R1 calibrates the approved 1A architecture: timber default embedment **0.50 × H(x)**, discrete sleeper purchase EA (bay × courses), and backfill locked as **in-place / geometric volume**. **1A-R2** corrects timber pile layout: **1.2 m is target/max estimating spacing**, not a fixed grid. Bays are generated evenly (`ceil(L / target)` then `actual = L / bays`) so the last bay is not a short remainder. Actual spacing may be smaller than the target. This is not structural compliance. Concrete sleeper posts remain sleeper-length bay geometry. Commercial package money is unchanged. Do **not** promote 1B.

| Layer | 1A-R1 status |
| --- | --- |
| Information contract | `lib/estimate/retaining-wall-information-contract.ts` |
| Physical model | `lib/estimate/retaining-wall-physical.ts` plus timber/sleeper/masonry modules |
| Calculator | Existing package money preserved; unpriced `requirements` attached when real geometry exists |
| Job Plan | Core wall + Check excavation/drainage/backfill; waterproofing only for masonry |
| Refine adapter | Registered — type-specific consumed facts only |
| Builder Review | Planning takeoff rows; money unchanged |
| Verifier | `scripts/verify-retaining-wall-maturity-1a.ts` |

Do not treat 1A planning quantities as priced lines. *(Historical 1A gate: 1B–1D followed.)*

### 8.0A 1B promotion-readiness matrix (do not promote)

Classifications: **PHYSICAL_QUANTITY_READY** / **IDENTITY_READY** / **RATE_READY** / **PRODUCTIVITY_READY** / **COMMERCIAL_PROMOTION_READY**.

| System | Component | Physical | Identity | Rate | Productivity | Commercial promotion |
| --- | --- | --- | --- | --- | --- | --- |
| Timber | Face boards | PHYSICAL_QUANTITY_READY | IDENTITY_READY | not ready (no trusted $/lm) | slot only | not ready |
| Timber | H5 SED piles | PHYSICAL_QUANTITY_READY | IDENTITY_READY | not ready | slot only | not ready |
| Timber | Novacoil | PHYSICAL_QUANTITY_READY (net lm) | IDENTITY_READY | not ready as child | slot only | not ready |
| Timber | Drainage aggregate | PHYSICAL_QUANTITY_READY (in-place m³) | IDENTITY_READY | catalogue m³ unused; package is face m² | slot only | not ready |
| Timber | Fixings / residual | not ready (package residual) | residual | package rate only | not ready | not ready |
| Timber | Concrete (if applicable) | not modelled for timber piles | — | — | — | not ready |
| Sleeper | Sleepers | PHYSICAL_QUANTITY_READY (discrete EA) | IDENTITY_READY | not ready | slot only | not ready |
| Sleeper | Steel posts | PHYSICAL_QUANTITY_READY | IDENTITY_READY | not ready | slot only | not ready |
| Sleeper | Hole concrete | PHYSICAL_QUANTITY_READY (cylinder m³; bags need yield) | IDENTITY_READY | not ready | slot only | not ready |
| Sleeper | Novacoil | PHYSICAL_QUANTITY_READY | IDENTITY_READY | not ready as child | slot only | not ready |
| Sleeper | Drainage aggregate | PHYSICAL_QUANTITY_READY (in-place m³) | IDENTITY_READY | not ready as child | slot only | not ready |
| Masonry | Blocks | PHYSICAL_QUANTITY_READY (net; purchase round/waste later) | IDENTITY_READY | not ready | slot only | not ready |
| Masonry | Footing concrete | PHYSICAL_QUANTITY_READY | IDENTITY_READY | not ready | slot only | not ready |
| Masonry | Sub-base | PHYSICAL_QUANTITY_READY | IDENTITY_READY | not ready | slot only | not ready |
| Masonry | Rebar | **not ready** unless design facts exist; unknown must not become silent zero | identity slot only | not ready | slot only | not ready |
| Masonry | Core fill | PHYSICAL_QUANTITY_READY (m³) | IDENTITY_READY | not ready | slot only | not ready |
| Masonry | Waterproofing | PHYSICAL_QUANTITY_READY (masonry-only starter) | IDENTITY_READY | not ready | slot only | not ready |
| Masonry | Novacoil | PHYSICAL_QUANTITY_READY | IDENTITY_READY | not ready as child | slot only | not ready |
| Masonry | Drainage aggregate | PHYSICAL_QUANTITY_READY (in-place m³) | IDENTITY_READY | not ready as child | slot only | not ready |

**1D supersedes timber rows above.** Supported Timber children are commercially priced. **2A supersedes sleeper rows above.** Masonry remains not commercially promoted. Package **$7,345** is retired for detailed-ready Timber and Concrete Sleeper.

**RETAINING WALL MATURITY 1C — OWNER PREVIEW CORRECTIONS (COMPLETE LOCAL / OWNER PRE-CALIBRATION REVIEW PENDING)**

1C does not redesign Quotr. Preview corrections remain; 1D later promoted detailed Timber money. Verifier: `scripts/verify-retaining-wall-maturity-1c.ts`.

| 1C correction | Contract |
| --- | --- |
| Pile spacing | No hidden 1.0 m default. Invented `retaining_wall.post_spacing_m` is dropped unless the brief has explicit centres/spacing. Approved target/max = 1.2 m → 15 m wall = 13 bays / 14 piles. |
| Access / carry | Canonical Project Conditions `site_access` and `material_carry_distance`. Brief “Moderate access, around 30m distance” persists. Duplicate Clarify carry question suppressed via consumed-fact lookup, not text hiding. |
| Edit Scope | Existing Job Plan editor surfaces timber geometry, boards, drainage/backfill/excavation, and the same Project Condition access/carry values. Writes mark estimate stale. |
| Net vs purchase | Existing 10% waste only. Novacoil 15 lm net / 16.5 lm purchased. Face boards 110 lm net / 121 lm purchased. |
| Labour presentation | Hours equation shows base hours then the applicable Project Condition modifier. Package fallback may still combine access+carry. Detailed timber: excavation uses site access (not inward carry); pile / face / drainage / backfill use site access + inward material carry. Spoil/export is not `material_carry_distance`. |
| Detailed labour slots | Excavation h/m³, timber piles h/ea, face boards h/m², backfill h/m³ — productivity slots only. Missing productivity is not $0. Package labour XOR detailed labour. |
| Excavation | “Requires excavation” is scope, not volume. Bulk m³ is not invented from backfill. Pile-hole work stays inside pile installation when detailed. |

Sleeper/Masonry physical models are unchanged. Deck 2D is unchanged.

**RETAINING WALL MATURITY 1D — TIMBER DETAILED COMPONENT PRICING (COMPLETE / OWNER APPROVED)**

Verifier: `scripts/verify-retaining-wall-maturity-1d.ts`.

Supported Timber money is component-level: physical quantity → identity → procurement quantity → rate → cost; labour is physical work quantity → productivity → base hours → per-intent Project Condition modifier → adjusted hours → labour cost rate → cost; sell is cost → target GM. Legacy face-m² package is `LEGACY_FALLBACK_ONLY`. Pile purchase is stock-length EA rounded up (1.8 / 2.4 / 2.7 / 3.0 / 3.6 m H5 SED 150–175). Unknown excavation is a labelled 0.6 h/face-m² **EXCAVATION ALLOWANCE**, not invented m³. `post_spacing_m` is consumed for timber pile layout and 1D stock procurement.

**RETAINING WALL MATURITY 1E — FINAL TIMBER COMMERCIAL + UX POLISH (COMPLETE / OWNER VALIDATED)**

Verifier: `scripts/verify-retaining-wall-maturity-1e.ts`.

Self-performed measured bulk excavation is owned by excavation labour + applicable plant. The physical `retaining_wall.excavation.bulk` row is a driver, not a generic $/m³ Pricing Required. Subcontracted excavation XOR suppresses self-perform labour and excavation plant hours. Spoil/disposal is a separate intent (`retaining_wall.disposal_included`), never inferred from material carry. Plant days = `ceil((pile machine hours + measured excavation machine hours + setup hours) / 7 productive h/day)`, minimum 1 when machine-assisted. Machine occupancy is separate from carpenter attendance. Builder Review shows procurement summaries, rate-variance context when company/project differs >25% from a comparable Quotr identity/unit, and human copy instead of internal tokens.

Do **not** start Sleeper or Masonry from 1E.

**RETAINING WALL MATURITY 1F — FINAL TIMBER CLOSURE (COMPLETE LOCAL / OWNER APPROVED IN PRINCIPLE)**

Verifier: `scripts/verify-retaining-wall-maturity-1f.ts`.

Spoil removal is asked only when excavation (or other spoil-generating scope) exists: “Will excavated spoil need to be removed from site?” All / Some / None uses measured excavation m³ without re-entry. MVP commercial identity is all-in `retaining_wall.spoil.removal.all_in.m3` (cartage + tip). `retaining_wall.spoil.disposal.m3` remains leftover tip-fee-only. No invented Quotr $/m³. Builder Review uses a three-level hierarchy, grouped H5 poles, collapsed Takeoff details, and compact labour/plant/material rows. Do not reopen geometry, pile math, productivity, plant machine-hours, package/detail XOR, Pricing, or Quote.

**RETAINING WALL MATURITY 1F-R1 — FINAL SPOIL RATE SEMANTIC LOCK**

MVP prices spoil as **measured / in-situ excavation m³ × all-in removal $/m³**. All-in = normal cartage + normal tip, calibrated to that measured basis. No bulking. Hierarchy: project all-in exact → company all-in exact → future Quotr all-in benchmark → Pricing Required. Leftover `retaining_wall.spoil.disposal.m3` (tip/disposal fee only) must not resolve all-in and must not close the gap. Future architecture may split in-situ vs loose spoil vs truck/load vs tip vs haulage — not built in this phase. Excavation labour + plant price excavation; all-in spoil prices removal/disposal only.

Do **not** start Sleeper, Masonry, another Work Area, or Production from 1F / 1F-R1. *(Historical 1F gate. 2A later promoted Concrete Sleeper.)*

**RETAINING WALL MATURITY 2A — CONCRETE SLEEPER DETAILED COMMERCIAL (COMPLETE / COMMITTED / OWNER APPROVED)**

Verifier: `scripts/verify-retaining-wall-maturity-2a.ts`.

Adapts mature Timber 1D/1F architecture. Does not invent a second estimating model. Shared geometry (length × average height; linear H(x) on slope). Discrete sleeper EA; residual clips **NOT_APPLICABLE**. Default disclosed sleeper class **2000 × 200 mm**. Post length = local H(x) + embedment; default embedment **0.70 × H(x)** (preliminary estimating assumption only). Post-hole concrete is cylindrical `πr²h` × hole count. Bags = `ceil(m³ / 0.01)` using 20 kg premix yield. No invented sleeper waste factor.

**RETAINING WALL MATURITY 2A-R1 — PROCUREMENT + DESIGN-ASSUMPTION CORRECTION (COMPLETE / COMMITTED / OWNER APPROVED)**

`retaining_wall.sleeper_length_m` is **PHYSICAL_PURCHASED_UNIT_LENGTH**, not a continuously resized bay. Layout is **full standard bays + one residual/end bay** (15 m / 2.0 m → 7 × 2.0 m + 1.0 m residual). Cut/end sleepers still purchase a full standard unit. Post spacing/embedment are estimating assumptions; one Improve Estimate item: “Confirm sleeper system / post spacing and embedment.” Does not block Quick Estimate and does not regress to package. Starter sleeper $36/EA and post $58/lm are **low-confidence Quotr starters**, not trusted market prices. Premix starter **$11.50/bag** (medium, ~$11–12 retail band). Productivities unchanged.

**RETAINING WALL MATURITY 2A-R4 — SYSTEM-FACT ISOLATION (COMPLETE LOCAL / OWNER FINAL SLEEPER DEFECT REVIEW PENDING)**

Timber pile centres stay on `retaining_wall.post_spacing_m`. Sleeper post centres use **`retaining_wall.sleeper_post_spacing_m` only**. Timber pile embedment stays on `pile_embedment_m`; Sleeper embedment stays on `sleeper_post_embedment_m`. Wall-type switch preserves shared geometry/access/excavation/drainage/spoil and does **not** silently reuse the other system’s spacing/embedment. Explicit sleeper spacing shorter than purchased sleeper length surfaces **module mismatch** attention (does not block Quick Estimate).

Do **not** start Masonry, Bathroom, or another Work Area from 2A / 2A-R1 / 2A-R4.

**CURRENT IMPLEMENTATION (ESTIMATOR-SAFETY-0)**

| Layer | Status |
| --- | --- |
| Calculator | `lib/estimate/calculators/retaining-wall.ts` — detailed Timber or Concrete Sleeper when coverage is complete; package fallback for masonry/incomplete timber |
| Job Plan adapter | **Minimum** — `lib/assistant/job-plan/adapters/retaining-wall.ts` (core card + length/height/material chips). Not mature. |
| Refine adapter | Registered in 1A (`lib/assistant/refine/adapters/retaining-wall.ts`) — type-specific consumed facts only. Masonry commercial package still MINIMAL. |
| Clarify policy | **HARD_MINIMUM** for length, height (or high+low), material via existing Clarify/readiness |

Core estimate readiness:

| Missing fact | Normal commercial path |
| --- | --- |
| `retaining_wall.length_m` | **HARD_MINIMUM** — estimate blocked |
| `retaining_wall.height_m` (and no high/low) | **HARD_MINIMUM** — estimate blocked |
| `retaining_wall.material` missing / Not sure | **HARD_MINIMUM** — estimate blocked |
| `retaining_wall.material` explicit unsupported (e.g. Gabion) | **HARD_MINIMUM / UNSUPPORTED_EXPLICIT** — estimate blocked |
| All three known **and commercially supported** material | Estimate may proceed with current calculator |

Answered is **not** the same as priceable.

Internal calculator defaults **10 m** / **1.5 m** remain for legacy compatibility only. They must **not** masquerade as user-known geometry on the normal Retaining Wall commercial path. Readiness blocks zero-input complete price.

### 8.0 Supported commercial material set (code truth)

A material is commercially supported only if the calculator can emit a legitimate material line/rate path:

| User tokens (canonical, not fuzzy) | Rate path | Family |
| --- | --- | --- |
| `timber` (e.g. Timber, treated timber) | `retaining_wall.material.timber.face_m2` | timber |
| `concrete` or `block` (e.g. Concrete, Block, concrete block) | `retaining_wall.material.concrete.face_m2` | concrete |

No `wood` / `hardwood` / gabion substring matching. Template options: Timber / Concrete / Block / Not sure.

**UNSUPPORTED_EXPLICIT** (named material with no rate path, e.g. Gabion):

- Clarify/readiness **blocker** with: `"Quotr doesn't currently have a trusted price model for this retaining wall material."`
- Change material via existing select, or Edit Job
- **No** Estimate now
- **No** silent timber substitute
- **No** $0 material line
- **No** labour-only complete-looking estimate

**FUTURE CONTRACT (not built):** **RW-UNSUPPORTED-MATERIAL-PRICING-01** — once Work Area/material-level `PRICING_REQUIRED` is supported safely: preserve physical material identity, emit pricing-required material requirement, other trusted components may continue, Builder Review shows Needs pricing. Current safest behaviour is blocking.

This closes the former **ACTIVE ESTIMATING RISK** (silent complete-price) and the unsupported-material labour-only gap. Estimator maturity remains **MINIMAL**. Do not promote.

### 8.1 Fact contract (code-verified)

| Fact | Asked in Job Plan / Clarify? | Consumed by calculator? | Class now |
| --- | --- | --- | --- |
| `retaining_wall.length_m` | HARD_MINIMUM Clarify | Yes (face m²; default 10 only if calculator invoked without readiness) | **HARD_MINIMUM** |
| `retaining_wall.height_m` | HARD_MINIMUM Clarify | Yes (or default 1.5 only if calculator invoked without readiness) | **HARD_MINIMUM** |
| `height_high_m` / `height_low_m` | Not asked as interview; satisfies height hard minimum when both present | Yes — average height derive | **REFINE** (target) |
| `retaining_wall.material` | HARD_MINIMUM Clarify; UNSUPPORTED_EXPLICIT blocks | Yes — timber/concrete families only; missing / Not sure / unsupported block Estimate Ready | **HARD_MINIMUM** |
| `retaining_wall.fixing_type` | No | Yes — face-fixed labour ×1.15 | **REFINE** (target) |
| `retaining_wall.excavation_required` | No | Yes — extra hours/face m² | **REFINE** (target) |
| `retaining_wall.drainage_required` | No | Yes — drain lm / novacoil | **REFINE** (target) |
| `retaining_wall.drain_connection_required` | No | Yes | **REFINE** (target) |
| carting / disposal | Partial via PC / facts | Yes | **REFINE** (target) |
| `retaining_wall.is_raking` | No | Indirect via high/low height | **REFINE** (target) |
| `retaining_wall.post_spacing_m` | Template / Refine — **not** Job Plan Clarify | Yes — **Timber only** pile layout and 1D stock procurement. Default 1.2 m when omitted. Must not drive Sleeper. | **REFINE** (consumed) |
| `retaining_wall.sleeper_post_spacing_m` | Refine / Edit Scope | Yes — **Sleeper only** post centres / bay module. Default = purchased sleeper length. | **REFINE** (consumed) |
| engineering/consent | Template | Exclusion text only | INFORMATIONAL / ADVANCED (target, if consumed) |
| existing wall removal | — | No | **NOT_CURRENTLY_CONSUMED** |
| ground conditions | — | No | **NOT_CURRENTLY_CONSUMED** |

### 8.2 Backfill — DISCLOSURE FIXED (quantity still face m²)

**CURRENT IMPLEMENTATION**

When `backfill_included` and `backfill_depth_m` are present, the calculator:

1. Computes `volume` via `calculateBackfillVolume`
2. Pushes assumption: `"Backfill dimensions recorded for reference; current allowance is not volume priced."`
3. Attaches a volume build-up as **shadow metadata**
4. Prices the line as **quantity = `faceArea`**, unit **`face m²`**, item key `retaining_wall.backfill.face_m2`

The computed m³ **does not drive the priced quantity**. That remains true. The former `"Backfill volume calculated: X m³"` wording is removed so the narrative cannot imply a commercial volume takeoff.

No backfill formula or rate path was changed. **TARGET ARCHITECTURE:** priced backfill quantity = computed volume (Owner approval required).

---

## 9. Question coverage (current vs target)

Classification keys: **HARD_MINIMUM**, **ASK_NOW**, **ASSUME_IF_SKIPPED**, **REFINE**, **ADVANCED**, **DERIVED_NEVER_ASK**, **NOT_CURRENTLY_CONSUMED**.

### deck (CURRENT IMPLEMENTATION)

Job Plan + Refine adapters exist. HARD_MINIMUM Clarify is dimensions/area. ASK_NOW covers Job Plan checks (removal, fascia, steps when relevant). Board material and height are Refine if unknown. Joist section / centres are physically consumed but **not** Refine-interviewed (`DECK_NOT_CONSUMED_REFINE_KEYS`) — Quotr derives/assumes layout. See §7A and `DECK_INFORMATION_CONTRACT`.

### retaining_wall (CURRENT IMPLEMENTATION)

Minimum Job Plan adapter. HARD_MINIMUM Clarify asks length, height, material before estimate. Secondary facts remain assumed. No Refine adapter. See §8.

### bathroom (CURRENT IMPLEMENTATION)

Job Plan + Refine adapters exist. Room size / wet-area facts partially asked. Finish still quality-driven.

### kitchen, fence, pergola (CURRENT IMPLEMENTATION)

Generic Job Plan. No Refine adapter. Dimension facts live in templates, not ASK_NOW interview.

### external_stairs (CURRENT IMPLEMENTATION)

Generic Job Plan. Calculator consumes riser count, width, ground condition, handrail/balustrade flags. **TARGET:** dedicated adapter is relatively cheap because the calculator is already ahead of the band.

### painting (CURRENT IMPLEMENTATION)

Job Plan + Refine adapters exist. Paint litres are SHADOW on a m² material line.

### demolition / remaining fitout (CURRENT IMPLEMENTATION)

Generic Job Plan. Area/count templates. Quality ASSUME.

---

## 10. Material capability matrix (corrected)

Labels = **priced emission**, not conceptual takeoff.

| Work Area | What the calculator actually prices | Taxonomy |
| --- | --- | --- |
| deck | Decking (lm takeoff or m² package); substructure m² package; stair/balustrade/handrail **allowances**; structural takeoff may be SHADOW | hybrid DETAILED + PACKAGE_ALLOWANCE + SHADOW |
| retaining_wall | Supported Timber: boards / H5 SED stock EA / novacoil / drainage aggregate m³ / fixings residual / task labour / plant days. Concrete Sleeper: sleeper EA / steel posts lm-or-EA / bagged post-hole concrete / novacoil / aggregate / task labour / plant days. Masonry: face-m² package fallback | Timber + Sleeper DETAILED + masonry PACKAGE_ALLOWANCE |
| bathroom | Waterproofing / tiling / fixtures / lining as **benchmark or resolved package lines**, not separate product identities | PACKAGE_ALLOWANCE |
| kitchen | Cabinetry + benchtop + appliances / install / splashback / rangehood via `resolveRate`; remaining flooring / plumbing / electrical / package still hardcoded | PACKAGE_ALLOWANCE + remaining hardcoded related lines |
| fence | Timber/metal **per lm package** — not posts / rails / panels | PACKAGE_ALLOWANCE |
| pergola | Frame + roof package rates | PACKAGE_ALLOWANCE |
| external_stairs | Material per riser + landing m² + handrail/balustrade lm packages | PACKAGE_ALLOWANCE |
| demolition | Wall lm / floor m² / ceiling m² / fixture ea packages | PACKAGE_ALLOWANCE |
| internal_walls | m² package + skirting/insulation/stopping/painting add-ons | PACKAGE_ALLOWANCE |
| ceilings | m² package + battens/insulation/stopping/painting add-ons — **same pattern as internal_walls** | PACKAGE_ALLOWANCE |
| doors | ea package + architrave/paint add-ons | PACKAGE_ALLOWANCE |
| flooring | m² package + prep/underlay/skirting add-ons | PACKAGE_ALLOWANCE |
| painting | m² labour/material; paint litres SHADOW | PACKAGE_ALLOWANCE + SHADOW |
| plastering | m² package | PACKAGE_ALLOWANCE |

Do not describe bathroom waterproofing/tiles/fixtures/linings, fence posts/rails/panels, or ceiling grid/tiles/plaster as DETAILED_REQUIREMENT unless the calculator emits separately priced identities.

---

## 11. Labour capability matrix (corrected)

| Work Area | CURRENT IMPLEMENTATION | Access / site | Notes |
| --- | --- | --- | --- |
| deck | Productivity hours + access factor | `getCombinedLabourAccessFactor` | LABOUR-CREW-01 deferred |
| retaining_wall | Timber + Sleeper: task labour (excavation / posts or piles / face or sleepers / drainage / backfill) + per-intent access. Masonry still package hours/face m² | Access + carry per intent; excavation excludes inward carry | Volume labour uses in-place backfill m³ when detailed |
| bathroom | **Per-trade breakdown exists** (demo, carpentry/prep, fixture install, lining, coordination) | Access factor yes | Labour more mature than material |
| kitchen | Package hours / lump labour | **Does not call `getCombinedLabourAccessFactor`** | Prior coverage claim was wrong |
| fence | Hours per lm | Access factor yes; **`fence.slope_condition` steep/slope multiplies labour** | Terrain/slope is **partial**, not absent |
| pergola | Hours per m² | Access factor yes | Not materially ahead of fence |
| external_stairs | Hours with ground/width factors | Access factor yes | Comparatively mature |
| demolition | Hours by element | Access + carting | Hazardous material **FUTURE** |
| painting / internal_walls / ceilings / doors / flooring / plastering | Package hours in `fitout.ts` | **UNVERIFIED** — `fitout.ts` does not call `getCombinedLabourAccessFactor` | Do not mark PASS |

---

## 12. Capability band ≠ estimator maturity

**CURRENT IMPLEMENTATION:** `trial_supported` / `developing` / `component` in `lib/work-areas/support-contract.ts` is a **PRODUCT / DISPLAY BAND** (Add Work Area badges, customer copy). It does **not** gate calculator selection, interview adapters, or commercial authority.

Evidence: `external_stairs` and `painting` are `component` but calculator/adapters are ahead of several `developing` types.

**Do not use display band as the primary engineering-expansion ordering signal.**

**TARGET ARCHITECTURE:** later simplification or explicit dual fields (`displayBand` vs `estimatorMaturity`). **Do not delete the band in this task.**

---

## 13. Kitchen — KITCHEN-RATE-AUTHORITY-01 FIXED

**CURRENT IMPLEMENTATION (ESTIMATOR-SAFETY-0)**

| Line | Rate path |
| --- | --- |
| Cabinetry | `resolveRate` + `KITCHEN_BENCHMARKS.cabinetry` fallback |
| Benchtop | `resolveRate` + fallback |
| Appliances | `resolveRate` + `kitchen.appliances.allowance` + benchmark fallback |
| Appliance install | `resolveRate` + `kitchen.appliance_install.allowance` + benchmark fallback |
| Splashback | `resolveRate` + `kitchen.splashback.allowance` + benchmark fallback |
| Rangehood | `resolveRate` + `kitchen.rangehood.allowance` + benchmark fallback |
| Flooring / plumbing / electrical / materials package | Still hardcoded — classified below; **not** migrated in R1 |

Named-component safety applies: blank-key generic kitchen rates cannot steal these lines. Wrong unit does not bind. Unrelated `kitchen.cabinetry.allowance` does not steal.

Estimator maturity remains **MINIMAL**. No new rates were seeded. Lookup keys follow the existing kitchen `*.allowance` contract used by cabinetry/benchtop.

**KITCHEN-RATE-AUTHORITY-01** is **FIXED** for the four confirmed bypass lines.

### 13.1 Remaining hardcoded Kitchen lines (ESTIMATOR-SAFETY-0-R1 audit)

No new keys/rates in this batch. Only a line with an existing canonical named key, defined unit/type, and proven exact resolver compatibility would be migrated. None of the remaining lines meet that bar.

| Line | Description | itemKey | type / unit | Benchmark | Canonical kitchen key? | Other WA identity? | resolveRate today? | Class |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Flooring | Lump = area × flooring benchmark | none | allowance lump (priced from m² × $/m²) | `KITCHEN_BENCHMARKS.flooring` | No `kitchen.flooring.allowance` | `flooring.material.m2` is **flooring WA**, not Kitchen | No | **C NEEDS_RATE_IDENTITY_BEFORE_RESOLVER** |
| Plumbing | Major / minor / default lumps | none | allowance lump | `plumbing` / `plumbingMajor` / `plumbingMinor` | No `kitchen.plumbing.allowance` | `bathroom.plumbing.allowance` is **bathroom WA** | No | **C NEEDS_RATE_IDENTITY_BEFORE_RESOLVER** |
| Electrical | Major / minor / default lumps | none | allowance lump | `electrical` / `electricalMajor` / `electricalMinor` | No `kitchen.electrical.allowance` | Bathroom electrical is a different WA | No | **C NEEDS_RATE_IDENTITY_BEFORE_RESOLVER** |
| Materials package | Area × `materialsPerM2` with `minimumPackage` floor when no component finishes | none | materials lump | `materialsPerM2` + `minimumPackage` | No kitchen package allowance key | `scope.kitchen.m2` is starter-catalogue planned, not this lump | No | **B PACKAGE_BENCHMARK_ONLY_BY_CURRENT_CONTRACT** |

**R1 Kitchen change:** none beyond the four already-routed named allowances. Remaining lines deferred to Kitchen maturity.

---

## 14. consumedByCalculator — CONSUMED-FACT-CONTRACT-01 FOUNDATION COMPLETE

**CURRENT IMPLEMENTATION:** Calculators export typed consumed-fact lists. `lib/estimate/consumed-facts.ts` is the registry. Compose Refine keeps a candidate only when the fact (or Project Condition) is in that contract.

Deck / Bathroom / Painting Refine adapters still list **when to ask**. They no longer independently invent commercial consumption.

**NEW ADAPTER GATE:** No new Work Area-specific Refine adapter may be considered mature unless its refinement facts are backed by the calculator-consumed-fact contract. Prerequisite for Retaining Wall full maturity, Bathroom material maturity, External Stairs adapter, and future WA expansion.

Verifier: `scripts/verify-estimator-safety-0.ts` — false consumed keys fail.

---

## 15. Attention fallthrough — ATTENTION-SEMANTICS-01

**CURRENT IMPLEMENTATION:** `classifyAttentionSemanticBucket` handles known `attentionKind` values then `return "ACTIONABLE_REFINEMENT"`.

**KNOWN DEFECT / RISK:** an unknown future `attentionKind` becomes a false-positive “improve estimate” item.

Backlog: **ATTENTION-SEMANTICS-01** — default unknown → CHECK or INFORMATIONAL, or exhaustive compile-time handling. Not expanded in FE-0-R1.

---

## 16. Legacy / runtime disposition (reconciled)

| System | Disposition | Notes |
| --- | --- | --- |
| Job Plan | **KEEP** | Canonical |
| Clarify | **KEEP** | Canonical |
| Refine | **KEEP** | Canonical |
| Project Conditions | **KEEP** | Canonical |
| Attention navigation resolver | **KEEP** | `lib/assistant/mode/attention.ts` |
| Scope Discovery **suggestion data path** | **KEEP (data)** | May still feed suggestions |
| Scope Discovery **dedicated review UI** | **REMOVE LATER / DEAD UI** | Orphaned as a primary surface |
| Scope Details / QuestionBlock | **REMOVE LATER / DEAD UI** | Removed from Edit Job in FE-0; may remain in planning legacy |
| ScopeSummaryBlock diagnostics | **REMOVE LATER / DEAD UI** | Planning Scope Review only |
| Old generic “N items need attention” | **REMOVE LATER / DEAD UI** | Replaced by semantic labels |
| Breakdown-first Estimate Ready | **REMOVE LATER / DEAD UI** | Builder Review is primary |
| Monolithic `commercial_fitout` WA | **BLOCKING_REMOVAL** | Parent use-case only |

Do **not** mass-delete in this task.

---

## 17. MUST-FIX before estimator expansion

| ID | Item | Status |
| --- | --- | --- |
| A | Retaining Wall zero/low-input complete-price (10 m / 1.5 m / timber fallback) | **CLOSED** in ESTIMATOR-SAFETY-0 (readiness HARD_MINIMUM). Internal defaults remain legacy-only. Unsupported named material **CLOSED** in R1 (blocks; no labour-only). |
| B | Retaining Wall misleading backfill-volume disclosure vs face m² price | **CLOSED** (wording). Quantity still face m² — not a pricing-model change. |
| C | Kitchen resolver bypass — **KITCHEN-RATE-AUTHORITY-01** | **FIXED** for appliances / install / splashback / rangehood. Flooring/plumbing/electrical = **C**; package = **B**. Not migrated in R1. |
| D | **CONSUMED-FACT-CONTRACT-01** before adapter replication | **FOUNDATION COMPLETE** |
| E | Material capability taxonomy consistency (this document now defines labels) | Planning honesty |
| F | Capability-band ≠ estimator maturity (this document; later code simplification) | Expansion ordering |

---

## 18. Can wait (deferred)

Unless business priorities change:

- Deck non-rectangular structural detail
- Fence full terrain model (steep flag already partial)
- Pergola roof detail
- External stairs balustrade compliance detail
- Demolition hazardous-material model
- Company Material UX
- **RW-UNSUPPORTED-MATERIAL-PRICING-01** — pricing-required path for known unsupported RW material (currently blocked)
- LABOUR-CREW-01
- Fitout detailed material decomposition
- ATTENTION-SEMANTICS-01 (unless a one-line exhaustiveness fix is cheap later)

---

## 19. Expansion order (after UX-PREMIUM + safety blockers)

Display band is **not** the order.

| Order | Work Area | Why |
| --- | --- | --- |
| 1 | **retaining_wall** | Timber 1F + Sleeper 2A detailed; masonry commercial **NOT STARTED** |
| 2 | **bathroom** | Job Plan + Refine already exist; **per-trade labour** exists; material maturity can make a second reference WA |
| 3 | **external_stairs** | Calculator already ahead of `component` band; dedicated Assistant adapter is relatively cheap |

Then reassess:

| Candidate | Gate |
| --- | --- |
| Fence | After RW interview patterns; slope already partial |
| Pergola | Same package class as fence — not automatically next |
| Kitchen | Remaining hardcoded flooring/plumbing/electrical/package lines; still MINIMAL |

Fitout batch later, after labour verification (`getCombinedLabourAccessFactor` gap in `fitout.ts`).

---

## 20. Company Material / Rate — future programme

Existing contract: `QUOTR_COMPANY_MATERIALS_AND_RATES_CONTRACT.md`.

**CURRENT IMPLEMENTATION:** Deck structural identity path is furthest. Company create / save-to-company UX is not built.

**FUTURE CAPABILITY:** Change material → Common / Company / project custom → PRICING_REQUIRED if no rate → optional Save to Company.

**Permanent rule:** MATERIAL = physical identity; RATE = commercial evidence.

---

## 21. Performance baseline (PERF-01)

**CURRENT IMPLEMENTATION (FE-0 marks):**

- `work_area_remove_complete`
- `canonical_write_stale_projection`

Primary remaining delay: full `router.refresh()` RSC reload after canonical writes.

**FUTURE CAPABILITY:** partial revalidation, debounced fact writes, lazy Builder Review slices. No optimisation in this batch.

---

## 22. FE-0 functional hardening (implemented — code, not docs)

| Item | CURRENT IMPLEMENTATION |
| --- | --- |
| Remove WA | Confirmation dialog, inline error, optimistic exclusion, stale bridge |
| Refine | All actionable candidates visible; no More detail gate |
| Stale | `bridgeEstimateStaleAfterCanonicalWrite` on canonical write success |
| Attention | Semantic labels; informational excluded |
| Edit Job | Work Areas / Site & Project Conditions / Additional Details; Advanced optional |

---

## 23. Independent audit reconciliation

This R1 pass accepts the read-only audit unless code inspection disproved a claim. Inspection **confirmed at FE-0**, then **ESTIMATOR-SAFETY-0 closed**:

- RW 10 m / 1.5 m defaults remain internally; normal path no longer accepts zero-input complete price
- Timber backfill is in-place m³ × 1.25 purchase assumption; sleeper/masonry backfill remains package
- `post_spacing_m` consumed for timber pile layout and 1D stock procurement (not Clarify/Job Plan)
- Kitchen appliances/install/splashback/rangehood now resolveRate
- Kitchen has no shared access factor (unchanged)
- Fence slope condition is partial
- Bathroom per-trade labour exists
- Deck/Bathroom/Painting Refine keys verified against calculator-owned consumed-fact contract
- Display bands do not gate calculators
- Attention unknown-kind fallthrough (ATTENTION-SEMANTICS-01 unchanged)

---

## 24. Next actions

1. UX-PREMIUM-01: **COMPLETE / OWNER VALIDATED**.
2. DECK-MATURITY-2A / 2A-R1: **COMPLETE / COMMITTED / PREVIEW**.
3. DECK-MATURITY-2B: **COMPLETE / COMMITTED**.
4. DECK-MATURITY-2C: **COMPLETE / COMMITTED / PREVIEW**.
5. DECK-MATURITY-2D: **COMPLETE LOCAL / OWNER FINAL MATERIAL-RATE REVIEW PENDING**.
6. RETAINING-WALL-MATURITY-1D / 1F (Timber detailed): **COMPLETE / OWNER APPROVED**.
7. RETAINING-WALL-MATURITY-2A / 2A-R1 (Concrete Sleeper detailed): **COMPLETE / COMMITTED / OWNER APPROVED**. 2A-R4 system-fact isolation: **COMPLETE LOCAL / OWNER FINAL SLEEPER DEFECT REVIEW PENDING**. Masonry commercial maturity: **NOT STARTED**.
8. Do **not** start Masonry, Bathroom expansion, External Stairs adapter, Company Material UX, LABOUR-CREW-01, PERF-01, or Production.
