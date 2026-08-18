# DECK-1C-B1 Owner Rate Gate

**Status:** COMPLETE / OWNER VALIDATED  
**Date:** 2026-08-18  
**Evidence:** `docs/research/DECK_1C_B1_NZ_STRUCTURAL_MATERIAL_EVIDENCE.md`  
**Comparison:** `docs/research/DECK_1C_B1_BENCHMARK_SOURCE_COMPARISON.md`  
**Identity:** CAT-IDENTITY-01 COMPLETE / TECHNICALLY VALIDATED  

Owner reviewed B1 research and approved the decisions below. These lock B2 scope. They do **not** implement prices.

---

## Locked decisions

### D1 — First Quotr Common + benchmark-supported timber identities

**APPROVED** exact CORE:

| Section | Grade | Treatment | Processing | Product family | Rate unit |
| --- | --- | --- | --- | --- | --- |
| 90×45 | SG8 | H3.2 | KD | `structural_framing` | lm |
| 140×45 | SG8 | H3.2 | KD | `structural_framing` | lm |
| 190×45 | SG8 | H3.2 | KD | `structural_framing` | lm |

These are **Quotr Common** and **benchmark-supported exact identities**.

They are **not** structural-design defaults. Quotr must not auto-select them merely because they exist (DECK-STRUCT-01).

### D2 — Common ≠ structural default

**APPROVED.** A Common / benchmark-supported identity is UX convenience and a rate fallback candidate. It does not become the job specification unless the user (or an explicit spec source) selects it.

### D3 — Unknown grade / treatment / processing does not receive the SG8 H3.2 KD benchmark

**APPROVED.** Known benchmark SG8 + H3.2 + KD must not price:

- grade unknown
- treatment unknown
- processing unknown
- green / wet
- H1.2 / H4 / custom treatment
- different grade
- LVL
- different section

No automatic enrichment merely to unlock a rate.

**KD/green is price-relevant identity evidence.** Same section/grade/treatment can have materially different public $/lm depending on kiln-dried vs green/wet. Known KD must not collide with known green. Unknown processing must not silently become KD.

### D4 — First benchmark source

**APPROVED: A.** First B2 authority is **Bunnings NZ public retail/list** evidence from B1.

Reason: exact product identity, current public NZ evidence, grade/treatment/KD explicit, deterministic lm conversion.

This is a **Quotr benchmark**, not a company rate, not a supplier account rate.

### D5 — No multi-merchant averaging

**APPROVED.** Do not average Bunnings, ITM Stratford, Helensville/WBS, or others. ITM remains comparison evidence only. First benchmark records preserve the nominated Bunnings source.

### D6 — GST convention

**APPROVED.** Quotr benchmark cost basis is **ex-GST**.

For Bunnings public incl-GST evidence:

`normalizedCostExGst = publicPriceInclGst / 1.15`

Preserve raw incl-GST evidence. Do not mix GST basis.

### D7 — Supports stay pricing-required

**APPROVED: B.** `deck.supports` 8 EA remains `priced=false` unless a project/company exact EA rate exists. No Quotr support benchmark in B2. Do not convert to lm. Do not invent post length.

### D8 — Concrete stays pricing-required

**APPROVED: C.** `deck.concrete` 0.324 m³ mix unknown remains `priced=false`. No generic unknown-mix $/m³ benchmark in B2. Do not bag-convert. Small-load/minimum/delivery plus unknown mix make a material-only rate misleading.

### D9 — Freshness

**APPROVED.** Reverify at B2 attach; **quarterly** review; **90-day** staleness warning. No scraping/automation.

### D10 — First B2 implementation set

**APPROVED.** B2 first implementation set = the **three exact KD timber identities** in D1 only.

- No supports EA rate
- No concrete m³ rate
- No materials table / no migration
- Structural children remain SHADOW
- Do not restamp Deck 1 $48,340

---

## Secondary / catalogue-only (not B2 rates)

Keep as research/catalogue candidates only:

- green H3.2
- H1.2
- 70×45 / 240×45 / 290×45
- other posts
- LVL
- 200×50
- proprietary products

Custom material support remains valid.

---

## Checklist (Owner closed)

- [x] D1 Common list — 90/140/190×45 SG8 H3.2 KD
- [x] D2 Common ≠ default
- [x] D3 unknown grade/treatment/processing does not benchmark; KD/green distinct
- [x] D4 Bunnings public list
- [x] D5 no multi-merchant averaging
- [x] D6 ex-GST
- [x] D7 supports pricing-required
- [x] D8 concrete pricing-required
- [x] D9 quarterly / 90-day
- [x] D10 B2 set = three exact KD timber identities only
