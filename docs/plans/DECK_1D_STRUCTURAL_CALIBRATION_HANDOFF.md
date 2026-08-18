# DECK-1D — Structural Calibration Handoff

**Status:** SUPERSEDED AS ACTIVE PLANNING DOC — DECK-1D-A **COMPLETE / OWNER CALIBRATION MODEL VALIDATED**  
**Date:** 2026-08-18  
**Active plan:** `docs/plans/DECK_1D_CALIBRATION_PLAN.md`  
**Audit:** `docs/audits/DECK_1D_LEGACY_SUBSTRUCTURE_DECOMPOSITION.md`  
**Contract:** `docs/architecture/DECK_STRUCTURAL_CALIBRATION_CONTRACT.md`  
**Owner gate:** `docs/runbooks/DECK_1D_A_OWNER_CALIBRATION_GATE.md`  
**Predecessor:** DECK-1C-B2 COMPLETE / TECHNICALLY VALIDATED  
**Upstream plans:** `docs/plans/DECK_1C_RATE_COVERAGE_PLAN.md`  
**Physical model:** `docs/architecture/DECK_STRUCTURAL_MATERIAL_MODEL.md`  
**Identity contract:** `docs/architecture/DECK_STRUCTURAL_MATERIAL_IDENTITY.md`  
**B2 completion:** `docs/implementation/DECK_1C_B2_STRUCTURAL_BENCHMARK_COMPLETION.md`

---

## Purpose

DECK-1D is the **calibration and comparison** phase between the legacy `deck.substructure.m2` package and the new shadow structural children. It answers: what does the legacy package economically include, what do detailed children cover today, what is still missing, and what evidence is needed before `deck.substructure` could ever move off legacy authority.

**This document does not recommend promotion.** Having Quotr sourced public-list benchmark fallbacks for joists, rim, and bearers is necessary diagnostic progress — it is **not** sufficient to promote structural children to commercial authority.

**Out of scope for this handoff:** new formulas, code changes, rate attachment, migration, Production SD, or authority promotion.

DECK-1D-A completed the audit/contract. This handoff remains historical context. Do not treat §A “implicitly cover” lists as EXPLICITLY INCLUDED — see the decomposition audit’s evidence classes.

---

## Current state snapshot (post DECK-1C-B2)

| Layer | Authority | Notes |
| --- | --- | --- |
| `deck.substructure.m2` → **Framing/substructure** line | **LEGACY MONEY AUTHORITY** | `DECK_BENCHMARKS.framing` fallback **$120/m² cost** ($180/m² sell) via `resolveRate` |
| `deck.fixings.m2` → **Fixings and consumables** line | **LEGACY MONEY AUTHORITY** | `DECK_BENCHMARKS.fixings` fallback **$25/m² cost** ($40/m² sell) |
| `deck.labour` | **SHADOW** requirement + separate labour line item | 1.2 hrs/m² base (+ 0.25 elevated); not structurally decomposed |
| `decking.surface` | **REQUIREMENT_AUTHORITATIVE** | Unchanged by DECK-1 |
| Structural children (`deck.joists`, `deck.rim_framing`, `deck.bearers`, `deck.supports`, `deck.concrete`) | **SHADOW** | Physical quantities emitted; partial pricing only |

### Quotr sourced public-list benchmark fallbacks (DECK-1C-B2)

Three exact **90×45 / 140×45 / 190×45 SG8 H3.2 KD** identities at ex-GST $/lm:

| Section | Ex-GST $/lm | Source |
| ---: | ---: | --- |
| 90×45 | 8.09 | Bunnings NZ T10 (0616579) |
| 140×45 | 13.65 | Bunnings NZ T01 (0616335) |
| 190×45 | 18.13 | Bunnings NZ T14 (0616565) |

Resolution hierarchy: project override → company exact → Quotr exact benchmark → pricing required. No fuzzy identity. **`DECK_BENCHMARKS.framing` is never used as a child unit cost.**

### DECK-RATE-REF-01 diagnostic (5.20 × 3.10 m = 16.12 m²)

Synthetic fixture with full structural spec (`H3.2 SG8 KD`). Same geometry as DECK-REF-01 but with grade/KD on framing facts so B2 benchmarks resolve.

| Child | Purchase qty | Rate | Cost | Priced? |
| --- | ---: | ---: | ---: | --- |
| Joists | 42.32 lm | 13.65 | 577.67 | yes |
| Rim | 10.92 lm | 13.65 | 149.06 | yes |
| Bearers | 10.92 lm | 18.13 | 197.98 | yes |
| Supports | 8 EA | — | — | **no** |
| Concrete | 0.324 m³ | — | — | **no** |

**Partial priced structural child total (joists + rim + bearers): $924.71** — labelled **PARTIAL PRICED STRUCTURAL CHILD COST** in reconciliation; shadow diagnostic only, does not enter estimate money.

**Legacy package on same area:** Framing/substructure at $120/m² × 16.12 m² = **$1,934.40 cost** (commercial line item authority).

Reconciliation status: `COVERAGE_PARTIAL` — `unpriced_structural_children`, `priced_child_aggregate_is_not_complete_substructure_cost`.

---

## A. What legacy `deck.substructure.m2` includes economically

The legacy **Framing/substructure** line is a **single area-based materials package** (`itemKey: deck.substructure.m2`, unit m²). It is calibrated as a bundled allowance, not a takeoff sum.

Economically, the $120/m² cost benchmark is understood to **implicitly cover** (non-exhaustive, bundled):

- Primary joist framing (lm stock, all joists in grid including outer parallel members)
- End rim / boundary framing (conceptually bundled, not separately line-itemed)
- Bearer lines (when elevated / post-supported layouts apply)
- Posts / piles / support members (count and section not priced separately)
- Footing concrete volumes typical of residential decks (mix, delivery, small-load economics not separated)
- Blocking, nogs, trimmers at openings (where applicable — no separate quantity in legacy model)
- Structural connectors and framing fixings (joist hangers, post brackets, bolts, nails — bundled, not itemised)
- Framing waste and cut-off allowance (not disclosed as a separate factor)
- Layout uncertainty buffer (spacing defaults, unspecified bearer rows, unspecified post lengths)
- **Possibly** a portion of substructure-related labour effort that contractors mentally fold into the “framing package” — **not explicitly separated** from the standalone **Deck labour** line

It does **not** include:

- Decking board material (`decking.surface` — separate authoritative line)
- Surface fixings (`deck.fixings.m2` — separate legacy line at $25/m²)
- Standalone **Deck labour** (separate m² productivity line)
- Stairs, balustrade, handrail, face boards, demolition, pile replacement allowances (separate lines/allowances)
- Engineering, consent, or compliance costs

The legacy package is **area-normalised**: a 16.12 m² deck and a 70 m² area-only golden deck both multiply the same $/m² rate. Physical spec differences (joist section, bearer count, elevation) do not change the legacy line quantity — only area (or assumed area).

---

## B. Which detailed physical child costs are currently priced

Shadow structural children with **priced = true** when facts + exact identity + unit match a rate:

| componentKey | Emitted when | Priced today when |
| --- | --- | --- |
| `deck.joists` | `deck.joist_section` parses + framing treatment sufficient for identity | Exact **structural_framing** identity + **lm** rate (company or Quotr benchmark) |
| `deck.rim_framing` | Same joist section/treatment as joists | Same stock identity as joists; separate commercial component |
| `deck.bearers` | `deck.bearer_section` + `deck.bearer_row_count` present | Exact framing identity for bearer section + **lm** rate |

**Currently priceable identities (Quotr benchmark):** 90×45, 140×45, 190×45 — each **SG8 H3.2 KD** only.

**DECK-RATE-REF-01 proves:** joists (140×45), rim (140×45), bearers (190×45) all resolve to Bunnings-sourced benchmarks. Joist + rim stock totals **53.24 lm** at 13.65 = $726.73 for the 140×45 portion alone (components remain separate commercially).

---

## C. Unpriced children (emitted but no rate)

| componentKey | Emitted when | Why unpriced today |
| --- | --- | --- |
| `deck.supports` | `support_type`, `support_section`, `supports_per_bearer`, `bearer_row_count` | No approved Quotr benchmark for **90×90 post EA** identity; B1 found posts sold **lm / long pieces**, not length-free EA; no company rate assumed |
| `deck.concrete` | All three footing mm facts + support count > 0 | No public unknown-mix **$/m³** benchmark; Firth small-load threshold **3 m³** vs fixture **0.324 m³**; pricing required, not zero-cost |

Unpriced children are **`priced=false`, not $0**. They are excluded from `pricedChildCostTotal` and block `AGGREGATE_READY` reconciliation status.

---

## D. Structural costs missing entirely from DECK-1

Components **not emitted** in DECK-1B/1C (reserved or deferred):

| Reserved key | Status | Legacy absorption |
| --- | --- | --- |
| `deck.blocking` | **NOT EMITTED** — deferred | Bundled in `deck.substructure.m2` |
| `deck.fixings.structural` | **NOT EMITTED** — deferred | Partially in `deck.substructure.m2`; surface fixings in `deck.fixings.m2` |
| Double joists at openings | **Non-MVP** | Legacy buffer |
| Trimmers / headers at openings | **Non-MVP** | Legacy buffer |
| Post embedment / above-ground length split | **No model** | Legacy buffer |
| Bearer-on-footing (no posts) layout variant | Facts exist (`support_type`) but no alternate quantity path | Legacy buffer |
| L-shaped / non-rectangular cut optimisation | **Out of scope** | Legacy buffer |
| Structural steel brackets catalog | **Out of scope** | Legacy buffer |
| Small-load / cartage / pump hire for concrete | **Out of scope** | Legacy buffer |

Missing **facts** (proposed, not implemented) that would enable future children: `deck.blocking_rows`, `deck.bearer_centres_m`, `deck.support_spacing_m`, post height / embedment facts.

---

## E. Labour — separate vs bundled

| Labour surface | Authority | Relationship to substructure |
| --- | --- | --- |
| **Deck labour** line item | Commercial line (calculator output) | m² × productivity (1.2 base + 0.25 elevated) × labour rate; **covers whole deck install** including framing, decking, and general constraints |
| `deck.labour` requirement | **SHADOW** | Mirrors labour line; not decomposed into framing vs decking vs footings |
| Substructure-specific labour | **None** | No `deck.substructure.labour` child; legacy framing package may implicitly include some framing labour in contractor mental models but Quotr **does not** allocate it |

**Calibration implication:** comparing partial priced timber children ($924.71) to legacy framing ($1,934.40) is **not** a materials-only comparison unless labour double-count is explicitly ruled out. Legacy $120/m² may embed labour-ish allowance; detailed model has **full deck labour separate**. DECK-1D must document comparison **basis** (materials-only vs all-in) per fixture — never assume parity.

---

## F. Fixings / connectors missing from detailed model

| Fixings class | Legacy home | Detailed model |
| --- | --- | --- |
| Decking screws/clips | `deck.fixings.m2` ($25/m²) | **Not decomposed** — remains legacy line |
| Joist hangers, framing nails, bolts, post brackets, hurricane ties | Implicit in `deck.substructure.m2` | **`deck.fixings.structural` not emitted** |
| Adhesive / temporary bracing consumables | Likely bundled in both legacy lines | Not modelled |

**DECK-RATE-REF-01:** fixings line would add $25/m² × 16.12 = **$403.00** cost — **orthogonal** to partial structural child aggregate. Summing priced timber + legacy fixings still omits structural connectors inside the framing package.

---

## G. Blocking / nogs / trimmers / openings

- **`deck.blocking`:** reserved, **not emitted**. Model doc proposes row-based lm formula; `deck.blocking_rows` fact **proposed, not implemented**.
- **Trimmers / double joists at openings:** explicitly **non-MVP** in physical model.
- **Legacy package:** assumes these costs exist somewhere in the $120/m² bundle without quantity disclosure.

**Calibration gap:** elevated and medium decks with openings will show **detailed timber under-count vs legacy** even if all emitted children were priced — unless blocking/opening rules are added or legacy variance is documented as intentional buffer.

---

## H. Support / post length / product uncertainty

| Issue | Current behaviour | Calibration need |
| --- | --- | --- |
| **EA vs lm** | Supports priced as **EA** (`purchaseUnit: ea`) | B1: 90×90 H5 sold as **lm / 4.8 m pieces**, not arbitrary-length EA |
| **Post length** | No `deck.height_m` → post length conversion; no embedment fact | Physical count known (8 EA on REF-01); **stock length and purchase unit unknown** |
| **Identity** | `buildSupportMaterialIdentity` from type + section + treatment | Exact rate needs **complete support identity** + approved unit (lm vs EA-at-length) |
| **Fence post confusion** | 2.4 m fence posts are EA but **different product family** | Must not reuse fence rates for deck supports |

DECK-1D should treat support pricing as **Owner evidence gate** (B3 or later), not calibration fudge.

---

## I. Concrete procurement / small-load

| Factor | Detail |
| --- | --- |
| Fixture volume | DECK-RATE-REF-01: **0.324 m³** (8 footings × 0.0405 m³) |
| Public pricing | Firth: **no unknown-mix public $/m³**; DIY estimator requires mix selection |
| Small-load economics | Firth fee structure references **3 m³ minimum** — fixture is **~11× below** threshold |
| Model waste | **0%** concrete waste in DECK-1B (explicit assumption) |
| Legacy | Concrete cost **bundled** in $120/m²; no separate small-load line |

**Calibration implication:** even with a generic $/m³ benchmark, **procurement reality** (bags, mini-load, cartage) may dominate on small decks. DECK-1D should compare **directional** legacy inclusion vs detailed gap, not force unit-rate parity on 0.324 m³.

---

## J. Compare detailed vs legacy without exact parity

**Parity class (locked):** `INTENTIONAL_MODEL_IMPROVEMENT` — detailed shadow model is **not expected** to equal legacy $/m² on early fixtures.

### Comparison rules (DECK-1D)

1. **Never** promote or restamp goldens based on partial child totals alone.
2. Label all shadow sums **PARTIAL PRICED STRUCTURAL CHILD COST** — not substructure cost, not total structural cost.
3. Compare **categories**, not single scalars:
   - Legacy framing $/m² × area
   - Partial priced timber children (joists + rim + bearers)
   - Unpriced children (supports, concrete) — quantity only
   - Legacy fixings $/m² (separate line — do not merge silently)
   - Deck labour $ (separate — document double-count risk)
4. Record **variance direction** (detailed higher / lower / incomparable) and **hypothesised reasons** (missing blocking, small-load concrete, bundled fixings, labour allocation, waste differences).
5. **DECK-REF-01** (treatment only, no SG8/KD) stays **unpriced** — proves identity strictness; do not conflate with DECK-RATE-REF-01.
6. Accept **incomparable** as a valid outcome for PARTIAL-SPEC and REAL-JOB fixtures.

### DECK-RATE-REF-01 illustrative gap (not a target)

| Bucket | Cost (approx.) |
| --- | ---: |
| Legacy framing package | 1,934.40 |
| Partial priced timber children | 924.71 |
| Legacy fixings (separate line) | 403.00 |
| Supports / concrete / structural fixings / blocking | unpriced |
| Deck labour | separate (not in either column) |

Partial timber ≈ **48%** of legacy framing $ on this fixture — **diagnostic only**; remaining gap expected given unpriced children and bundled legacy items.

---

## K. Real-job / calibration fixtures needed

Extend synthetic DECK-REF / DECK-RATE-REF with fixture classes below. Each fixture needs: **physical facts**, **expected child emission**, **expected pricing coverage**, **known missing components**, and **legacy comparison purpose**.

### Fixture class definitions

#### SIMPLE

| Attribute | Guidance |
| --- | --- |
| **Physical facts** | Rectangular; low height (≤ 0.3 m ground-level); full L×W; joist section + centres + bearer rows + supports + footings specified |
| **Expected coverage** | All 5 structural children **emitted**; joists/rim/bearers **priced** if SG8 H3.2 KD sections match benchmarks |
| **Missing components** | Blocking, structural fixings, opening trimmers — still absent from model |
| **Legacy comparison purpose** | Baseline **materials-only** directional compare on smallest complete-spec geometry; establish variance band before elevation complexity |

**Candidate:** 4.0 × 4.03 m (= 16.12 m²), 0.2–0.4 m height, 140×45 joists, 190×45 bearers, 2 bearer rows.

#### MEDIUM

| Attribute | Guidance |
| --- | --- |
| **Physical facts** | Elevated (0.5–1.0 m); larger footprint (e.g. 7 × 5 m); more bearer rows / supports; full spec |
| **Expected coverage** | Emitted children scale up; timber priced; supports/concrete quantities grow |
| **Missing components** | Same DECK-1 gaps; elevation may trigger consent assumptions (no cost) |
| **Legacy comparison purpose** | Test whether legacy $/m² **under/over-recovers** substructure on mid-size elevated jobs; labour double-count check |

#### ELEVATED

| Attribute | Guidance |
| --- | --- |
| **Physical facts** | Height > 1 m or explicit elevated level; balustrade/consent flags may be set; full structural spec |
| **Expected coverage** | Full emission; timber priced; support count higher |
| **Missing components** | Post **length** uncertainty highest here; blocking more likely on site |
| **Legacy comparison purpose** | Stress-test legacy buffer for height-related structural cost; document incomparability if post length unresolved |

#### PARTIAL-SPEC

| Attribute | Guidance |
| --- | --- |
| **Physical facts** | L×W present but **incomplete** identity (e.g. `140x45 H3.2` without SG8/KD); or missing bearer/support facts |
| **Expected coverage** | Partial emission; **pricing required** for incomplete identities; reconciliation `NOT_COMPARABLE` or partial |
| **Missing components** | Whatever facts are absent — by design |
| **Legacy comparison purpose** | Prove legacy still carries money when detailed model cannot price; **must not** fall back to section-only benchmarks |

**Candidate:** DECK-REF-01 (same geometry as DECK-RATE-REF-01, treatment without full identity).

#### CUSTOM-MATERIAL

| Attribute | Guidance |
| --- | --- |
| **Physical facts** | Non-catalogue section or treatment (hardwood joists, H4, green, LVL, 200×50) |
| **Expected coverage** | Quantities may emit; **pricing required** unless company exact rate exists |
| **Missing components** | Quotr benchmark (by design — only three KD identities approved) |
| **Legacy comparison purpose** | Confirm legacy authority path for non-benchmark specs; no fuzzy benchmark enrichment |

#### REAL-JOB

| Attribute | Guidance |
| --- | --- |
| **Physical facts** | Anonymised completed project: known area, spec, and **contractor actual** substructure spend (materials ± labour split if available) |
| **Expected coverage** | Whatever facts were captured on the job — may be PARTIAL-SPEC |
| **Missing components** | Document real-world items not in model (e.g. engineer-specified hardware, access scaffolding) |
| **Legacy comparison purpose** | Ground legacy $120/m² and partial detailed totals against **reality**; primary input for Owner calibration narrative — not automatic rate derivation |

**Minimum REAL-JOB pack:** geometry, spec, elevation, actual substructure materials cost, note on bundled labour, date/region, exclusion list.

### Existing synthetic fixtures

| ID | Role in DECK-1D |
| --- | --- |
| **DECK-REF-01** | Physical quantity verifier; **unpriced** timber (identity strictness) |
| **DECK-RATE-REF-01** | Rate resolution verifier; partial priced aggregate **$924.71** |
| **GOLDEN-01 (Deck 1)** | 70 m² area-only; legacy **$48,340 sell unchanged** — regression guard only, not structural calibration |

---

## L. Gate before `deck.substructure` can move from legacy authority

Promotion (`deck.substructure` → shadow aggregate or child authority) is **out of scope** and **not recommended** at DECK-1C-B2 exit. Future gate conditions (recommendations only — **not locked**):

### Pricing completeness

- [ ] All **emitted** structural children priced **or** represented without an economic hole: NOT_REQUIRED, ALLOWANCE, LEGACY_FALLBACK, project/company rate, or blocking UNPRICED. Unpriced ≠ excluded.
- [ ] Supports: approved identity + unit (EA-at-length vs lm) + sourced benchmark or company rate
- [ ] Concrete: mix strategy decided (generic $/m³ vs bags vs allowance) + small-load rule for sub-threshold volumes
- [ ] Structural fixings: emitted child or explicit allowance rule — not silently folded into timber

### Model completeness (Owner decisions)

- [ ] Blocking / nogs: emit vs allowance vs legacy buffer — decision recorded
- [ ] Openings / trimmers: MVP rule or documented permanent legacy buffer
- [ ] Post length: fact contract or conservative stock-length assumption with disclosure

### Labour clarity

- [ ] Document whether substructure promotion is **materials-only** authority
- [ ] If materials-only: confirm deck labour line does not double-count framing effort already in legacy mental model
- [ ] If all-in: define labour split or accept combined authority (high risk — needs Owner signoff)

### Calibration evidence

- [ ] Fixture matrix (SIMPLE → REAL-JOB) run with reconciliation records stored
- [ ] Variance explained per fixture (not a single % target)
- [ ] REAL-JOB comparison completed for at least one low and one elevated job
- [ ] Goldens unchanged unless Owner explicitly approves restamp

### Commercial safety

- [ ] `pricingCoverage = all_emitted_children` on representative fixtures
- [ ] Reconciliation status `AGGREGATE_READY` on representative fixtures — still **shadow only** until promotion gate
- [ ] **Owner Preview signoff** on calibration report
- [ ] No auto-promotion from benchmark attach (DECK-1C-B2 lesson)

### Explicit non-gate

**Do NOT promote because joists, rim, and bearers have Quotr benchmarks.** Partial timber pricing is diagnostic progress only.

---

## DECK-1D deliverables (when implementation starts — not now)

| Deliverable | Type |
| --- | --- |
| Calibration fixture registry | Data / scripts |
| Reconciliation report template | Doc |
| Variance narrative per fixture class | Doc |
| Owner calibration review runbook | Doc |
| Optional: B3 support benchmark evidence pack | Research |
| Optional: concrete procurement decision memo | Research |

---

## References

| Artifact | Path |
| --- | --- |
| Deck calculator (legacy lines + shadow emit) | `lib/estimate/calculators/deck.ts` |
| Structural quantities + reconciliation | `lib/estimate/deck-structure.ts` |
| DECK-RATE-REF-01 facts | `lib/estimate/deck-rate-ref-01.ts` |
| Quotr timber benchmarks | `lib/estimate/structural-timber-benchmarks.ts` |
| Legacy benchmark constants | `lib/estimate/benchmark-rates.ts` (`DECK_BENCHMARKS.framing`, `.fixings`) |
| Rate coverage plan | `docs/plans/DECK_1C_RATE_COVERAGE_PLAN.md` |
| B2 completion evidence | `docs/implementation/DECK_1C_B2_STRUCTURAL_BENCHMARK_COMPLETION.md` |

---

## Decision log (handoff)

| Decision | Status |
| --- | --- |
| Structural children remain SHADOW after DECK-1C-B2 | **Locked** |
| Legacy `deck.substructure.m2` remains money authority | **Locked** |
| Partial aggregate label PARTIAL PRICED STRUCTURAL CHILD COST | **Locked** |
| DECK-1D is calibration/compare — not implementation in this handoff | **Locked** |
| Promotion recommendation | **None — explicitly deferred** |
