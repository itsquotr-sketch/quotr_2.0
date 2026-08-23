# Deck Structural Material Identity

**Status:** CANONICAL for DECK-1C-A — **OWNER VALIDATED**. CAT-IDENTITY-01 R1 implementation in this branch.  
**Date:** 2026-08-18  
**HEAD at planning:** `46b186202f727998c8578c3a14039ba9f9ba645c`  
**Physical model:** `docs/architecture/DECK_STRUCTURAL_MATERIAL_MODEL.md` (quantities frozen)  
**Company/rate contract:** `docs/architecture/QUOTR_COMPANY_MATERIALS_AND_RATES_CONTRACT.md`  
**Owner gate:** `docs/runbooks/DECK_1C_A_OWNER_IDENTITY_GATE.md`  
**Mode:** Identity lock. No prices. Common lists are UX convenience, not a whitelist.

Physical component ≠ material. `deck.joists` and `deck.rim_framing` may consume the **same** stock identity and remain separate commercial components.

---

## 1. Component vs material

| Layer | Answers |
| --- | --- |
| `componentKey` | Which part of the job? |
| Material identity | What physical product/specification? |
| Rate | What does it cost in a unit? |

Do **not** embed component name in canonical physical material identity.

Future Materials view may aggregate purchase quantity for the same identity (joists 42.32 + rim 10.92 = **53.24 lm**). Component authority stays separate. Do not merge `deck.joists` and `deck.rim_framing` commercially because the stock is the same.

---

## 2. Fact-count reconciliation

DECK-1B **implemented 13** new Scope Details keys, not 14.

Exact keys in `lib/scopes/templates/deck.ts`:

1. `deck.board_direction`
2. `deck.joist_direction`
3. `deck.joist_section`
4. `deck.joist_centres_mm`
5. `deck.framing_treatment`
6. `deck.bearer_section`
7. `deck.bearer_row_count`
8. `deck.support_type`
9. `deck.supports_per_bearer`
10. `deck.support_section`
11. `deck.footing_length_mm`
12. `deck.footing_width_mm`
13. `deck.footing_depth_mm`

**Discrepancy source:** DECK-1B completion text counted “14 new optional questions (priorities 71–83)”. Inclusive 71–83 is **13** keys (off-by-one). DECK-1A also proposed keys that were **not** implemented (`deck.bearer_centres_m`, `deck.support_spacing_m`, `deck.blocking_rows`, metre footing keys). Do **not** invent a 14th field.

---

## 3. Identity completeness

Use these states in design (do not add production enums in this batch):

| State | Meaning | Rate |
| --- | --- | --- |
| **COMPLETE_ENOUGH_FOR_PHYSICAL_MODEL** | Enough to emit quantity | May still be unpriced |
| **COMPLETE_ENOUGH_FOR_EXACT_RATE** | Identity + unit match a rate row exactly | May price |
| **PARTIAL** | Some attributes known, others unknown | Conservative: pricing required |
| **CUSTOM_UNSTRUCTURED** | Free description; parseable fields optional | Manual project rate allowed |

Unknown grade/treatment **must not** be upgraded to SG8 / H3.2 to obtain a rate.

---

## 4. Structural timber identity dimensions

Family: `timber`  
Product family: `structural_framing`  
Section: normalized `140x45`  
Grade: optional (e.g. SG8) — **not** assumed  
Treatment: optional normalized (H1.2 / H3.2 / H4 / H5 / custom / unknown)  
Processing / moisture state: optional (`kd` \| `green`) — **not** assumed. Unknown must not become KD. Known KD is incompatible with known green.  
Species/product: optional  
Unit for rate: `lm` (framing)  
Custom description: always retained when user-entered

Bearers use the **same** generic structural timber identity. Do not create a Deck-only timber family.

### Partial vs fuller

| Example | Physical qty | Exact auto rate |
| --- | --- | --- |
| 140×45, treatment unknown, grade unknown | Yes | No |
| 140×45 H3.2, grade unknown | Yes | Only if a rate exists for that **same** incomplete identity — not by filling SG8 |
| 140×45 SG8 H3.2 | Yes | Only if processing also matches the rate row (KD ≠ green ≠ unknown) |
| 140×45 SG8 H3.2 KD | Yes | Yes, if exact company/Quotr/project rate exists |

---

## 5. Section normalization

Canonical section: **larger nominal millimetre first**, separator `x`, no spaces, no unit suffix.

| Raw | Normalized section | Valid? | Original retained? | Notes |
| --- | --- | --- | --- | --- |
| `140x45` | `140x45` | Yes | If that was the input | Already canonical |
| `140 x 45` | `140x45` | Yes | Yes | Format only |
| `140×45` | `140x45` | Yes | Yes | Unicode multiply |
| `45x140` | `140x45` | Yes | Yes | **Same stock identity** — installation orientation is component geometry, not merchant stock |
| `140 x 45 mm` | `140x45` | Yes | Yes | Strip unit |
| `200x50 rough sawn H3.2 custom pine` | `200x50` | Yes (partial parse) | **Always** | Treatment `H3.2` if parsed; remainder stays in original description |
| `240x45 LVL` | `240x45` | Yes | Yes | Product family **`structural_lvl`**, not species and not generic `structural_framing` |
| `Big deck timber` | (none) | Custom unstructured | Yes | Valid physical custom; no exact auto rate |
| `150x50` vs `140x45` | different | Yes each | — | **Not** the same identity |

Do not silently drop the user’s original description.

---

## 6. Grade

**Audit:** there is **no** `deck.joist_grade` fact. Canonical identity includes grade **only when explicitly known**. Unknown grade must not become SG8. Known SG8 vs unknown grade is **partial**, not exact.

**Recommendation:** grade is **not** a compulsory everyday Scope Details question. Sources: selected Quotr common product, saved company material, later supplier product, optional advanced field, or explicit user spec.

If grade is unknown: do not assume SG8. A rate that requires SG8 is **incompatible** with unknown-grade identity.

---

## 7. Treatment

Treatment participates in identity where commercially meaningful.

Normalize known NZ hazard classes when parseable: `H1.2`, `H3.2`, `H4`, `H5` (case-insensitive, optional space). Custom / unknown remain possible.

DECK-1B fact `deck.framing_treatment` is free text, optional, shared across joists/rim/bearers/supports. Do not force an enum in Scope Details until exact matching needs it; identity layer may normalize known tokens.

**Do not** price H4 from H3.2.

---

## 7A. Processing / moisture state (DECK-1C-B2)

B1 proved KD vs green/wet is commercially material at the same section/grade/treatment. CAT-IDENTITY therefore carries:

| State | Meaning | Identity key |
| --- | --- | --- |
| **KNOWN `kd`** | Kiln-dried | `.kd` appended |
| **KNOWN `green`** | Green / wet | `.green` appended |
| **UNKNOWN** | No evidence | omitted |

No everyday Scope Details question was added. Tokens may be parsed from existing free-text (`KD`, `kiln dried`, `green`, `wet`). Unknown processing must **not** receive a KD benchmark. Known green must **not** receive a KD benchmark.

---

## 8. Treatment is not a physical emission gate (Owner approved)

Physical timber quantity does **not** depend on treatment. **Section** is the minimum structured spec to emit a timber MaterialRequirement.

**Locked for CAT-IDENTITY-01:**

- Identity module: section known, treatment unknown → identity records treatment unknown. Exact SG8/H3.2/KD rates do not bind.
- Calculator estimating selector: omitted treatment on a **selector-compatible** framing section (`90x45` / `140x45` / `190x45`) uses the disclosed Estimating Basics identity (SG8 H3.2 KD) so Owner material change can price. This is not identity-module invention.
- Explicit incomplete treatment (e.g. `H3.2` with no grade/KD) stays incomplete and unpriced.
- Custom sections (e.g. `200x50`, LVL) stay unpriced without an exact rate.
- Section unknown → do **not** fabricate a timber MaterialRequirement identity. Internal quantity math may still run.
- Remove the DECK-1B `framing_treatment` all-or-nothing gate.

Formulas stay frozen. Only the emission gate changes.

---

## 9. Canonical identity table (DECK-1B children)

Physical quantities remain DECK-REF-01. Live keys no longer embed assumed SG8 or rate unit. Debug key order: `family.productFamily.section[.species][.grade][.treatment|custom.slug][.kd|.green]`. Unknown attributes are omitted, never fabricated. The debug key is **not** a persistent catalogue row ID.

LVL is **`productFamily = structural_lvl`**, not a species of generic framing timber. Generic 240×45 `structural_framing` is incompatible with 240×45 LVL.

Identity comparison is **not** rate eligibility. `exact` does not auto-price.

| componentKey | Material family | Product family | Section (fixture) | Grade | Treatment (fixture) | Unit | Custom description | Canonical material identity (target) | Required facts for qty | Optional facts | Completeness today | Rate status |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `deck.joists` | timber | structural_framing | 140x45 | unknown (not asked) | H3.2 if fact set | lm | yes | timber / structural_framing / 140x45 / treatment? / grade? | L, W, joist section; centres default 450 | direction, treatment, grade | Physical: yes. Exact rate: only if treatment+grade match a rate | missing unless exact company key exists |
| `deck.rim_framing` | timber | structural_framing | **same as joists** | unknown | same framing treatment | lm | yes | **same stock as joists when spec identical** | same as joists | same | same | same |
| `deck.bearers` | timber | structural_framing | 190x45 | unknown | framing treatment | lm | yes | timber / structural_framing / 190x45 / … | bearer section + row count + L/W | treatment, grade | Physical when bearer facts present | missing |
| `deck.supports` | timber **or** proprietary | post / pile / other | 90x90 fixture | unknown | framing treatment if timber | **ea** | yes | **product EA identity**, not framing lm | support type + section + count inputs | treatment | Physical EA only | EA exact rate or pricing required — **never** timber $/lm on 8 EA |
| `deck.concrete` | concrete | (generic; not `footing` frozen as family) | n/a | n/a | n/a | m3 | yes | concrete / mix? / m3 | footing L×W×D + support count | mix/strength | Physical volume yes; mix unknown | missing; no silent generic $/m3 |

Live keys omit unknown grade/treatment. Do not freeze `concrete.footing` as universal material identity. Identity exactness does not grant a rate.

---

## 10. Joist + rim aggregation

DECK-REF-01 if **exact same** timber identity:

| Component | Purchase |
| --- | ---: |
| Joists | 42.32 lm |
| Rim | 10.92 lm |
| **Combined demand** | **53.24 lm** |

Useful for Materials view / RFQ / procurement later. Commercial component identities remain `deck.joists` and `deck.rim_framing`.

---

## 11. Supports — physical count vs rate basis

DECK-1B correctly emits **8 EA**. Post/pile length is not safely known. **Do not** change that physical model.

Compatible commercial options:

| Option | Allowed? |
| --- | --- |
| A. Company exact EA rate for specified post/pile product | Yes |
| B. Quotr exact EA benchmark for a standard product (later, sourced) | Yes, after DECK-1C-B / Owner |
| C. Supplier EA later | Yes (future) |
| D. Future LM-derived cost **once actual length is known** | Later only; not now |
| E. Project manual EA rate | Yes |
| F. Pricing required | Default when no exact EA product |

Do **not** force timber `$/lm` onto 8 EA. Do **not** invent post lengths.

Support identity may differ from framing lm: product type (post / pile / other) + section if timber + treatment if known + original description. Quantity remains EA.

---

## 12. Concrete identity and pricing

Separate `componentKey: deck.concrete` from material family `concrete`.

Do **not** freeze `concrete.footing.*` as universal material identity. The same concrete material should later serve retaining, slabs, foundations.

Identity dimensions:

- family: concrete
- mix/strength: unknown / specified (optional)
- unit: m3
- delivery/procurement: later, not rate identity now

DECK-REF-01: **0.324 m³**, mix unspecified.

**Recommendation:** keep physical requirement. Auto-price only with exact compatible rate. Do **not** assign a generic concrete benchmark in DECK-1C-B unless Owner later approves a **disclosed** generic estimating `$/m³` and its scope. Default: **pricing required** when mix unknown.

Procurement frozen: `purchaseQuantity = 0.324` m³ continuous. No bag count, truck minimum, or small-load premium.

---

## 13. First curated common range (UX convenience only — not a whitelist)

These bands are **material-selection suggestions**. They are **not** validation categories.

Do **not** write: if section not in [90×45, 140×45, 190×45] → invalid.

| Band | Example options | Role |
| --- | --- | --- |
| **CORE COMMON** | 90×45, 140×45, 190×45 lm; 90×90 post EA | Short everyday picker |
| **OPTIONAL** | 240×45, 290×45; 100×100, 125×125 posts | Extra convenience |
| **CUSTOM** | 200×50, 240×45 LVL, proprietary, free text | First-class; fully estimatable physically |

`200x50` is valid even though it is not in CORE COMMON. No prices in this lock. Grade is not a compulsory Scope Details question.

---

## 14. DECK-REF-01 catalogue matrix

| Child | Qty | Identity completeness | Quotr common candidate | Company compatible | Project custom | Exact rate now? | Rate missing? | DECK-1C-B work |
| --- | ---: | --- | --- | --- | --- | --- | --- | --- |
| Joists + rim (same spec) | 53.24 lm combined | Section + treatment fixture; **grade unknown** | 140×45 H3.2 structural timber (common row; do not imply SG8 unless curated as such) | Yes if company saved exact identity+lm | Yes | **No** — no framing keys in live catalogue; live key wrongly includes sg8 | Yes | Define identity rows; then research **sourced** $/lm if Owner wants Quotr benchmark |
| Bearers | 10.92 lm | 190×45 + treatment; grade unknown | 190×45 H3.2 structural timber | Yes | Yes | No | Yes | Same |
| Supports | 8 EA | type+section fixture; length unknown | Optional 90×90 post **EA** product — only if a real EA product is curated | Yes (EA) | Yes | No | Yes | EA product research; **no** lm conversion |
| Concrete | 0.324 m³ | mix unknown | Generic concrete m³ **only if Owner later approves unknown-mix benchmark** | Yes | Yes | No | Yes | Prefer mix question or pricing-required; no silent $/m³ |

---

## 15. Edit boundary

| Change | Physical or commercial? | Assistant / Scope Details | Pricing | Requires regeneration? | Project-only? | Save to company? |
| --- | --- | --- | --- | --- | --- | --- |
| Joist section 140×45 → 190×45 | Physical | Primary | Offer update facts + regenerate | **Yes** | Spec may be project custom | After explicit save |
| Treatment H3.2 → H4 | Physical (identity) | Primary | Offer regenerate | **Yes** (identity); quantity may be unchanged | Yes | Explicit |
| Joist centres 450 → 400 | Physical (quantity) | Primary | Should not be the home for this | **Yes** | n/a | n/a |
| Supplier-equivalent same section/treatment | Commercial substitution | No rewrite required | Primary | No, if identity unchanged | Yes | Optional map later |
| Unit cost $18.75/lm | Commercial | No | Primary | No | Yes (override) or update company | Explicit |
| Markup / margin | Commercial | No | Primary | No | Company GM / project commercial rules | Existing rates settings |
| Custom description only | Physical display / identity parse | Yes | Yes | Regenerate if parsed identity changes | Yes | Explicit |
| Support product (still EA) | Physical identity | Yes | Pricing if cost only | Regenerate if product/spec facts change | Yes | Explicit EA rate |

---

## 16. Procurement boundary (frozen)

`purchaseQuantity` is continuous estimating demand:

- timber: 42.32 lm, not stock lengths
- concrete: 0.324 m³, not bags
- supports: 8 EA, not invented LM

DECK-1C does not introduce stock-length optimisation.

---

## 17. Known vs unknown vs custom (locked)

Treatment (and the same pattern for un-normalizable species/grade/product text):

| State | Meaning | Example |
| --- | --- | --- |
| **KNOWN** | Normalized to a standard value | `h3.2` |
| **UNKNOWN** | No evidence | treatment omitted from the identity key |
| **CUSTOM** | User-provided value Quotr does not normalize | `CCA special` — original string retained in `treatmentCustom` |

CUSTOM is not UNKNOWN. CUSTOM is not equivalent to any known class. Different custom strings do not merge. Custom must not fuzzy-match H3.2 / H4 / another custom.

Unknown attributes are omitted from the debug key. They are never fabricated (no default SG8).

When grade/species/treatment/processing **are** known, they **must** participate in the identity/key so they cannot collide with unknown or another known value.

---

## 18. Species / product family

LVL is **`productFamily = structural_lvl`**, not `species = LVL`. Generic mill-sawn framing stays `structural_framing`. Same section (e.g. 240×45) with different product families is **incompatible**.

`species` remains available for genuine timber species when known (e.g. radiata). Do not force LVL into species merely because the type has that field.

---

## 19. Original description

`originalDescription` is historical/display/audit evidence. It is **serialized** on snapshots so a historical requirement remains understandable without a live catalogue.

It does **not** drive normal exact match when structured fields (family, productFamily, section, grade, treatment state/value, processing, species) are demonstrably the same.

Harmless wording (`"140x45 H3.2"` vs `"140 x 45 treated framing"` **with the same structured H3.2**) is not a mismatch.

If the only commercially relevant information cannot be normalized (custom treatment/product/grade text), matching stays conservative: custom vs known = incompatible; different custom strings = incompatible.

---

## 20. Identity comparison ≠ rate eligibility (locked)

`compareMaterialIdentities()` answers: are these specifications **exact / partial / incompatible**?

The rate resolver answers: may this rate commercially price this requirement?

Exact identity is **not** sufficient by itself for every future rate source. Each source (company exact, project exact, Quotr benchmark, supplier) needs its own eligibility policy. DECK-1C-B builds on this. CAT-IDENTITY-01 does not auto-price from identity match.
