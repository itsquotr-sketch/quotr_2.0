# Quotr Scope Details Question Contract

**Classification:** CANONICAL — Scope Details questions. Product/engine: `docs/architecture/QUOTR_PRODUCT_ARCHITECTURE.md`, `docs/architecture/QUOTR_ESTIMATING_ENGINE_ARCHITECTURE.md`.  
**Status:** FOUNDATION-R2 Complete Local / Owner Preview Pending (2026-08-16)  
**Audit:** `docs/audits/FOUNDATION_R2_SCOPE_DETAILS_QUESTION_AUDIT.md`  
**Gaps:** `docs/audits/FOUNDATION_R2_CALCULATOR_INPUT_GAP_MATRIX.md`  
**Code:** `lib/scopes/templates/`, `lib/scopes/conditional-rules.ts`, `lib/scopes/questions.ts`

This is the Work-Area **input** contract. It does not authorise requirement emission, Deck takeoff, materials catalogue expansion, or calculator rewrites.

---

## 1. Purpose

Every Scope Details question must answer at least one of:

| Code | Driver |
| --- | --- |
| A | SCOPE (in/out) |
| B | QUANTITY |
| C | MATERIAL selection or quantity |
| D | LABOUR |
| E | PLANT / subcontract |
| F | RISK / assumptions |
| G | PRICE |
| H | Customer-facing QUOTE disclosure |

If none apply, the question should not exist.

**E-class keys (Owner approved 2026-08-16):** high-value inputs may be collected before a calculator consumes them. They remain **optional** (except bathroom waterproofing yes/no, which is required and **is** consumed). Unconsumed answers must not change current price, confidence, or quote as if they were priced. Do not add helper copy claiming the estimate uses them.

Do not turn Quotr into a long questionnaire. Prefer parent booleans + gated children. Prefer derivation over asking twice.

---

## 2. Authority split (locked)

### Project Conditions own (once per job)

Site access, carry/logistics, floor level / vertical project logistics, occupied site, working-hour restrictions, parking/loading, general waste/bin access, general services isolation, project-wide hazmat, protection/dust, client-supplied **project-wide** items, by-others **project-wide** trades, consent/engineering where truly project-wide, site slope where a general site condition.

### Scope Details own (per Work Area)

Physical dimensions, construction system, materials/specification, quantities/counts, existing condition, removal/retention, local geometry, local inclusions, Work-Area-specific interfaces, local compliance only where genuinely specific.

Do **not** reintroduce Project Conditions under Scope Details. Allowed local exceptions (named differently):

| Key | Why it is local |
| --- | --- |
| `deck.access_type` | Stairs / step-down from the deck, not site access |
| `deck.height_m` / `deck.level` | Deck structure height, not building floor level |
| `ceilings.access` | Working height / equipment for that ceiling |
| `fence.slope_condition` | Fence-line ground, not general site slope |
| `fence.services_risk` | Fence-line underground services |
| `external_stairs.ground_condition` | Footing at the stair |
| `demolition.skip_bin_included` | Skip as a **scope inclusion** for this demolition WA, not project `waste_bin_access` |
| `*.engineering_or_consent_status` | WA-optional; project consent remains Project Conditions when job-wide |

`commercial_fitout` is an ISD/job-class parent only. It is **not** a calculator Work Area and has no Scope Details template.

---

## 3. Required / assumable / optional

| Class | Rule |
| --- | --- |
| **Required** | Calculator cannot produce a commercially defensible estimate without the answer or an approved deterministic default. |
| **Assumable** | A defensible benchmark/default exists and must be disclosed when used. FOUNDATION-R2 does **not** build the future assumptions engine. |
| **Optional** | Useful but not materially necessary for the current calculator. |

Do not mark every question required. Do not silently use assumptions for material commercial drivers without disclosure.

Template `required: true` is the current product flag. Assumable behaviour for Project Conditions remains in `lib/project-conditions/applicability.ts`. Scope Details assumable defaults stay in calculators (existing `recordDefaultedNumber` / assumption metadata) until a later assumptions engine.

---

## 4. Conditional architecture

Use `shouldHideConditionalQuestion` in `lib/scopes/conditional-rules.ts`. Keep parent graphs shallow.

Examples locked in R2:

- Balustrade not required / height ≤ 1 m → no balustrade follow-ups (existing explicit-negative behaviour preserved)
- Fascia = No / unanswered → no face-board length
- Waterproofing ≠ Yes → no waterproofing extent
- Tiling ≠ Yes → no tile areas / extent / wall height
- Gate ≠ Yes → no gate count / width
- Island ≠ Yes → no island length
- Benchtop ≠ Yes → no benchtop material
- Cabinetry ≠ Yes → no cabinetry lm
- Excavation ≠ Yes → no spoil disposal
- Demolition scope must include walls/floor/ceilings before those quantity questions
- Deck L×W known → do not ask area
- Deck height known → do not ask `deck.level`
- `deck.pergola_included` remains **always hidden** (pergola is its own WA)

Do not create arbitrary deep parent graphs.

---

## 5. Question order

Natural estimator sequence:

1. Dimensions / quantity  
2. Existing condition / demolition  
3. Construction system  
4. Materials / specification  
5. Inclusions / components  
6. Finishes  
7. Compliance / local interfaces  
8. Optional detail  

Incomplete sections stay open while users answer (R6-R3 disclosure). Progressive disclosure remains UI; question generation still includes currently applicable unanswered templates.

---

## 6. Wording

Contractor-native, short, no developer jargon.

Prefer “How many doors are included?” over “Please identify the quantity of door elements.”

Helper text only where it materially helps. Option **values** that existing tests/calculators depend on (e.g. deck `good_existing` / `none` / `unknown`) must not be renamed for copy polish — labels come from `lib/scopes/fact-labels.ts`.

---

## 7. AI / Fact suppression

If Analyse Job already extracted a reliable Fact, do not ask it again (`isQuestionAnswered` + known-value suppression).

User-confirmed Facts are not overwritten by AI ingest. Do not add AI calls in this contract.

Aliases in `FACT_KEY_ALIASES` map brief language onto canonical keys (e.g. `kitchen.has_island` → `kitchen.island_included`).

---

## 8. Calculator mapping (per retained question)

Every retained or added question maps to one or more of:

| Code | Meaning |
| --- | --- |
| A | Current calculator input |
| B | Future MaterialRequirement input |
| C | Future LabourRequirement input |
| D | Future scope / quote disclosure |
| E | Currently unconsumed; required for later maturation |

Do not add large numbers of questions no current or planned calculator can use. Unconsumed high-value keys must be marked **E** explicitly. Presence of a question does **not** mean calculator accuracy improved.

---

## 9. Future keys reserved, not implemented

| Topic | Status |
| --- | --- |
| Deck F/R/L/R face-board selection | Reserved for DECK-2 / OD-FACE-01 — do not implement in R2 |
| Deck irregular polygon / takeoff | DECK-1 |
| Joist/bearer size takeoff | REQ-1+ / Deck transparent estimator |
| Requirement emission | REQ-1 |

---

## 10. Maturity honesty

R2 does **not** promote Work Area bands.

| Band | Types |
| --- | --- |
| Trial-supported | deck, bathroom |
| Developing | retaining_wall, fence, pergola, kitchen |
| Component | demolition, external_stairs, internal_walls, ceilings, doors, flooring, painting, plastering |

Promotion requires: complete Scope Details **and** calculator consumption of required drivers **and** commercial verification **and** controlled assumptions.
