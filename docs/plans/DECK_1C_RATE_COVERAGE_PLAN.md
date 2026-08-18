# DECK-1C Rate Coverage Plan

**Status:** PLANNING — DECK-1C IN PROGRESS / DECK-1C-A **OWNER VALIDATED** / DECK-1C-B NOT STARTED  
**Date:** 2026-08-18  
**HEAD:** `46b186202f727998c8578c3a14039ba9f9ba645c`  
**Identity contract:** `docs/architecture/DECK_STRUCTURAL_MATERIAL_IDENTITY.md`  
**Company contract:** `docs/architecture/QUOTR_COMPANY_MATERIALS_AND_RATES_CONTRACT.md`

DECK-1C-B is **not started**. No prices in this file.

---

## 1. Batches

| Batch | Name | Status |
| --- | --- | --- |
| **DECK-1C-A** | Material identity + company/project/Quotr scope + rate-matching contract | COMPLETE / OWNER VALIDATED |
| **DECK-1C-A-R1** | CAT-IDENTITY-01 implementation (types, normalize, known/unknown/custom, treatment emission gate). No prices. | COMPLETE / TECHNICALLY VALIDATED |
| **DECK-1C-B** | Sourced NZ benchmark research + attach prices to **approved** common identities | NOT STARTED |
| **DECK-1C-C** (optional later) | Save-for-future + company materials table (migration) | After identity + if Owner wants persistence before Materials UI |
| **DECK-1D** | Shadow reconciliation vs legacy package | After 1C pricing evidence exists (unpriced children still honest) |
| **DECK-1R** | Authority promotion | Owner gate — not now |

---

## 2. DECK-1C-B research plan (do not execute now)

After Owner approves identity:

1. Curate CORE COMMON rows (90×45, 140×45, 190×45 structural timber lm; 90×90 post EA) **without** inventing SG8 if the sourced product is not specified as SG8.
2. Source **current NZ merchant list prices** (CSV/manual; no scraping in-agent as silent SoT). Record merchant, date, region, ex-GST, unit, product description.
3. Map each source row to canonical identity (section, treatment, grade if stated, unit).
4. If source is SG8 H3.2 140×45, the Quotr common identity **includes** those attributes — it does not price unknown-grade requirements.
5. Supports: research **EA product** prices only. No length invention.
6. Concrete: research only if Owner approved unknown-mix generic `$/m³` **or** a specified mix identity. Default recommendation: skip generic concrete benchmark.
7. Provenance fields on every benchmark: source, date, region, confidence, `calculatorSupport`.
8. Attach as Quotr exact benchmark **after** CAT-IDENTITY-01 keys exist. Company rates still outrank.
9. Do **not** restamp Deck $48,340. Structural children remain SHADOW.

### Benchmark provenance requirements

| Field | Required |
| --- | --- |
| Merchant / list name | Yes |
| Captured date | Yes |
| Region (NZ default) | Yes |
| Ex-GST unit cost | Yes (DECK-1C-B only) |
| Unit | Yes (lm / ea / m3) |
| Product text as sold | Yes (retain original) |
| Mapped identity hash | Yes |
| Confidence | Yes |
| Effective / expiry | Preferred |

No guessed market values.

---

## 3. What DECK-1C-B must not do

- Fuzzy-price nearby sections or treatments
- Use `deck.substructure.m2` as structural child unit cost
- Promote SHADOW → REQUIREMENT_AUTHORITATIVE
- Enable Production SD
- Deploy Production
- Auto-save contractor customs into global catalogue
- Invent post LM
- Convert 0.324 m³ to bags

---

## 4. Readiness

| Gate | Ready? |
| --- | --- |
| DECK-1C-B price research | **No** — CAT-IDENTITY-01 landed; B1 is research/handoff only until Owner reviews evidence |
| Company materials DB | **No** — contract only |
| Structural promotion | **No** |
