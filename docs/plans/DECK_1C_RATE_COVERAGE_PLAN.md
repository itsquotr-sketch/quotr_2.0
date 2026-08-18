# DECK-1C Rate Coverage Plan

**Status:** PLANNING — DECK-1C IN PROGRESS / DECK-1C-A **OWNER VALIDATED** / **DECK-1C-B1 COMPLETE / OWNER VALIDATED** / DECK-1C-B2 NOT STARTED  
**Date:** 2026-08-18  
**HEAD:** `be0bd2ae5189a2701093334e97af1718b2e729e3`  
**Identity contract:** `docs/architecture/DECK_STRUCTURAL_MATERIAL_IDENTITY.md`  
**Company contract:** `docs/architecture/QUOTR_COMPANY_MATERIALS_AND_RATES_CONTRACT.md`  
**B1 evidence:** `docs/research/DECK_1C_B1_NZ_STRUCTURAL_MATERIAL_EVIDENCE.md`  
**B1 comparison:** `docs/research/DECK_1C_B1_BENCHMARK_SOURCE_COMPARISON.md`  
**Owner gate:** `docs/runbooks/DECK_1C_B1_OWNER_RATE_GATE.md`

DECK-1C-B1 is **evidence only** and is now **Owner validated** (`docs/runbooks/DECK_1C_B1_OWNER_RATE_GATE.md`). No prices attached in this B1 commit.

---

## 1. Batches

| Batch | Name | Status |
| --- | --- | --- |
| **DECK-1C-A** | Material identity + company/project/Quotr scope + rate-matching contract | COMPLETE / OWNER VALIDATED |
| **DECK-1C-A-R1** | CAT-IDENTITY-01 implementation (types, normalize, known/unknown/custom, treatment emission gate). No prices. | COMPLETE / TECHNICALLY VALIDATED |
| **DECK-1C-B1** | NZ public source research + Owner evidence pack | COMPLETE / OWNER VALIDATED |
| **DECK-1C-B2** | Attach Owner-approved sourced benchmarks only | NOT STARTED |
| **DECK-1C-C** (optional later) | Save-for-future + company materials table (migration) | After identity + if Owner wants persistence before Materials UI |
| **DECK-1D** | Shadow reconciliation vs legacy package | After 1C pricing evidence exists (unpriced children still honest) |
| **DECK-1R** | Authority promotion | Owner gate — not now |

---

## 2. DECK-1C-B1 outcome (research done; not executed as rates)

B1 found current NZ public products. Headline:

- Framing SKUs are typically **Radiata SG8**, **H3.2 or H1.2**, **KD or green**, dressed **90×45 / 140×45 / 190×45** (call size 100×50 / 150×50 / 200×50).
- Bunnings publishes **GST-inclusive** piece + $/lm; $/lm **stable across 4.8–6.0 m** within one identity.
- ITM Stratford is cheaper and **Taranaki-specific**. Do not average with Bunnings.
- Supports **90×90 H5** are sold **lm / long pieces**, not a length-free EA. Fence 2.4 m posts **are** EA but **different identity**.
- Firth has **no public unknown-mix $/m³**; small-load threshold **3 m³** vs DECK-REF-01 **0.324 m³**.

B2 may attach only the three approved Bunnings KD identities after a **separate** implementation batch. Structural children remain SHADOW.

Legacy `deck.substructure.m2` package remains money authority. Do **not** restamp Deck $48,340.

### Benchmark provenance requirements (unchanged; B2 uses B1 fields)

| Field | Required |
| --- | --- |
| Merchant / list name | Yes |
| Captured date | Yes |
| Region (NZ default) | Yes |
| Ex-GST unit cost | Yes (DECK-1C-B2 only, after Owner) |
| Unit | Yes (lm / ea / m3) |
| Product text as sold | Yes (retain original) |
| Mapped identity hash | Yes |
| Confidence | Yes |
| Effective / expiry | Preferred |

No guessed market values. No reuse of anonymous `DECK_BENCHMARKS.framing` $120/m² as joist lm.

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
- Median Bunnings + ITM into a fake national rate

---

## 4. Readiness

| Gate | Ready? |
| --- | --- |
| DECK-1C-B1 evidence | **Yes** — Owner validated |
| DECK-1C-B2 price attach | **No** — not started in this commit |
| Company materials DB | **No** — contract only |
| Structural promotion | **No** |

