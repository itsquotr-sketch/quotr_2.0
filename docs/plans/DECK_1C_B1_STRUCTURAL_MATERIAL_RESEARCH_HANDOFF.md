# DECK-1C-B1 — NZ Structural Material Coverage + Source Research Handoff

**Status:** COMPLETE / OWNER VALIDATED — research evidence returned; Owner D1–D10 locked; no prices implemented in this batch  
**Date:** 2026-08-18  
**Depends on:** CAT-IDENTITY-01 (`e8e9ca298e9f8b48ef4e543d9e32168234a8d3c0`)  
**Identity contract:** `docs/architecture/DECK_STRUCTURAL_MATERIAL_IDENTITY.md`  
**Rate coverage plan:** `docs/plans/DECK_1C_RATE_COVERAGE_PLAN.md`

This file is a **research brief**. It does **not** contain prices, SKUs-as-IDs, or implementation. DECK-1C-B1 must **return evidence for Owner review before any catalogue seeding or rate attach**.

Do **not** invent treatments, grades, or mix classes. Record what NZ public manufacturer/merchant sources actually sell.

---

## 1. Purpose

Produce sourced evidence that maps **real NZ products** onto CAT-IDENTITY `MaterialIdentity` rows for the first Deck structural coverage set.

Output of B1: an evidence pack (source, date, region, GST, unit, product text, mapped identity).  
Not in B1: attaching Quotr benchmarks, materials DB, migration, structural promotion, Production.

---

## 2. Exact material identities needing evidence

Identity comparison is **exact / partial / incompatible**. Rate eligibility is a **later** resolver decision. B1 evidence must map to identity first.

Unknown attributes must stay unknown. If a source does not state grade, do not write SG8. If it does state grade, the identity **must include** that grade.

### 2.1 Structural timber (linear metre)

Family: `timber`  
Product family: `structural_framing` (generic mill-sawn SG framing)  
Unit for a later rate row: `lm` (not part of material identity)  
Grade: **only if the sourced product states it**

First-pass **section** candidates (UX common range — not a whitelist):

| Section | Typical Deck use | Identity skeleton (unknown grade/treatment omitted) |
| --- | --- | --- |
| `90x45` | light framing / possible joists | `timber.structural_framing.90x45` |
| `140x45` | DECK-REF-01 joists + rim | `timber.structural_framing.140x45` |
| `190x45` | DECK-REF-01 bearers | `timber.structural_framing.190x45` |

**Treatments to record from evidence, not assumption.** Do not default H3.2 because Deck fixtures used H3.2. For each section, capture which hazard classes are **actually listed** as outdoor/structural products (H3.2, H4, H1.2, other). If a merchant lists 140×45 H3.2 SG8, the mapped identity is:

`timber` / `structural_framing` / `140x45` / `sg8` / `h3.2`

If the listing is 140×45 H3.2 with **no grade**, mapped identity is:

`timber` / `structural_framing` / `140x45` / `h3.2`  
(grade unknown — must not be filled)

Optional later (not first B1 blocking set unless sources are abundant): `240x45` generic framing vs `240x45` **LVL** (`productFamily = structural_lvl`, species not used).

### 2.2 Supports (each)

Physical model: **EA**. No invented post length. No lm conversion.

Need evidence for **standard support/post/pile products sold per EA** (or per piece) that a builder would actually buy for a low deck.

Candidates to **assess** (not freeze until sourced):

| Candidate | Identity notes |
| --- | --- |
| 90×90 treated post sold EA | `timber` / `post` / `90x90` / treatment if stated |
| H5 / H4 pile sold EA | `timber` / `pile` / section if stated / treatment if stated |
| Proprietary steel/post product sold EA | custom / product family as sold; retain original description |

If merchants only sell posts as **linear metre of a stated length**, record that honestly. Do **not** invent a default length to force an EA rate. Owner then decides whether Quotr stays EA + pricing-required or later adds a length fact.

DECK-REF-01 fixture: 90×90 Post, 8 EA, treatment inherited from framing fact when present.

### 2.3 Concrete (cubic metre)

DECK-REF-01: **0.324 m³**, mix **unknown**, family `concrete`, `priced=false`. Component remains `deck.concrete`. Identity must **not** freeze `footing` as the material family.

B1 must answer, with sources:

1. Is a **generic estimating $/m³** (mix unspecified) defensible as a disclosed Quotr benchmark?  
2. Or must mix/strength (e.g. 20 MPa / 25 MPa / specified footing mix) be part of identity before any benchmark?

Default recommendation until Owner says otherwise: **do not** attach a silent generic concrete benchmark. Unknown mix stays pricing-required.

If sources only publish specified-mix prices, map those to identities that **include mix** (store mix on `grade` or a documented mix field — current CAT-IDENTITY uses `grade` for mix/spec on concrete). Unknown-mix requirements must **not** exact-match a specified-mix rate.

---

## 3. Research contract (mandatory fields)

Every evidence row:

| Field | Rule |
| --- | --- |
| Source | Current **NZ public** listing. Prefer **primary manufacturer or merchant**. |
| Source date | Capture date (ISO). Stale/anonymous historical constants are invalid. |
| NZ region / branch | Record if the price or availability is branch-specific. |
| GST | State whether the published figure is incl. or excl. GST. Quotr cost authority is **ex-GST**. |
| Rate type | Retail/public list vs account/trade. Do not treat account rates as public list. |
| Price unit | As sold (`lm`, `ea`, `m3`, pack, length). Record conversion **if any** and do not hide it. |
| Product / SKU / description | Retain original sold text. **SKU is mapping, never canonical material ID.** |
| Normalized `MaterialIdentity` | Exact structured map: family, productFamily, section, grade?, treatment known/unknown/custom, species?, originalDescription. |
| Conversion | Only if the sold unit ≠ estimating unit. Document factor. No silent lm↔ea. |
| Fabrication | **Forbidden.** No guessed market values. No old anonymous Quotr constants. |

Do **not** fuzzy-match nearby sections or treatments to fill a hole.

Do **not** use supplier SKU as `serializeMaterialIdentityKey`.

---

## 4. Identity mapping rules for researchers

1. Known attributes on the source **must** appear on the mapped identity.  
2. Missing attributes stay unknown.  
3. Custom/proprietary wording stays CUSTOM; it does not become H3.2.  
4. LVL ≠ generic structural pine even if 240×45 matches.  
5. Exact identity ≠ automatic rate eligibility. B1 returns evidence; Owner/DECK-1C-B2 decides attach policy per source class (Quotr public benchmark vs company-only).  
6. Joist + rim may later share one timber identity when exact; they remain separate components commercially.

---

## 5. Explicit non-actions

- No prices in this handoff (none recorded here).  
- No materials table / no migration.  
- No structural SHADOW → REQUIREMENT_AUTHORITATIVE.  
- No Production deploy / Production SD.  
- No restamp of Deck 1 $48,340.

---

## 6. Return format for Owner review

A table (or spreadsheet) with one row per sourced product:

`source | date | region | GST | public-vs-account | sold unit | original product text | SKU (mapping only) | mapped identity key | structured fields | conversion notes | gaps`

Plus a short recommendation:

- Which of 90×45 / 140×45 / 190×45 have **complete-enough** public identities for a later Quotr exact benchmark.  
- Whether supports have a genuine EA product.  
- Whether generic concrete $/m³ is defensible.

Owner reviews **before** implementation.
