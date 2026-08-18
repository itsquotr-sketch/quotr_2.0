# DECK-1C-B1 — Benchmark Source Comparison

**Status:** COMPLETE / OWNER VALIDATED  
**Research date:** 2026-08-18  
**Evidence pack:** `docs/research/DECK_1C_B1_NZ_STRUCTURAL_MATERIAL_EVIDENCE.md`  
**Owner gate:** `docs/runbooks/DECK_1C_B1_OWNER_RATE_GATE.md`

No automatic average. No implementation in this artifact. GST-normalized rates use **÷ 1.15** only when the source states GST-inclusive.

**Owner locked source strategy:** first Quotr benchmark authority = **Bunnings NZ public retail/list** (T01–T03, T10, T14). ITM/WBS remain comparison only. Do not average merchants. KD vs green must stay distinct identities.

---

## 1. 140×45 SG8 H3.2 — multi-source

| Source | Spec as sold | Seasoning | Region | Date | Raw | GST | Incl $/lm | Ex $/lm | Notes |
| --- | --- | --- | --- | --- | --- | --- | ---: | ---: | --- |
| Bunnings NZ T01–T03 | 140×45 SG8 H3.2 Radiata | **KD** | NZ website list | 2026-08-18 | piece + printed $/lm | Incl | **15.70** | **13.65** | Same $/lm at 4.8 / 5.4 / 6.0 m |
| Bunnings NZ T04 | 140×45 SG8 H3.2 Radiata | **Green** | NZ website list | 2026-08-18 | piece | Incl | **11.26** | **9.79** | Different product from KD |
| ITM Stratford T06–T07 | 140×45 H3.2 KD SG8 gauged | KD | **Taranaki** | 2026-08-18 | piece | Incl | **12.10** | **10.52** | Same $/lm 4.8 vs 6.0; Priority Card lower |
| Warehouse Building Supplies T08 | MSG8 PG 150×50 (140×45) 4.8 m | **Green** | **Helensville / Auckland trade store** | 2026-08-18 | piece $38.16 | Incl | **7.95** | **6.91** | Not comparable to Bunnings KD |
| One Stop Deck Shop T09 | 140×45 H3.2 SG8 KD | KD | NZ web | 2026-08-18 | $/lm 10.63 | **Unknown** | n/a | n/a | Cannot GST-compare |
| PlaceMakers | 140×45 H3.2 SG8 (hub) | KD/wet stocked | Trade portal | 2026-08-18 | unpublished | — | — | — | Quote-only |
| Mitre 10 | SG8 H3.2 “150×50” category | Dry | Store | 2026-08-18 | each, length often missing | unproven | — | — | Incomplete |

**Spread (KD, GST-ex, comparable identity):** Bunnings retail **$13.65/lm** vs ITM Stratford **$10.52/lm** (~**30%** Bunnings above ITM). This is **retail DIY vs independent Taranaki merchant**, not a national index.

**Do not average** $13.65 and $10.52 into a Quotr “market” rate.

Green vs KD at Bunnings: **$9.79 vs $13.65 ex-GST/lm** (~39% KD premium). Collapsing them would be commercially false.

---

## 2. 90×45 SG8 H3.2

| Source | Seasoning | Incl $/lm | Ex $/lm |
| --- | ---: | ---: | ---: |
| Bunnings KD T10 | KD | 9.30 | 8.09 |
| Bunnings green T11 | Green | 10.36 | 9.01 |
| ITM KD T12 | KD | 8.11 | 7.05 |
| ITM wet T13 | Wet | 7.69 | 6.68 |

Note: at Bunnings, **90×45 green ($10.36) is above KD ($9.30)** on 2026-08-18 pages — opposite of the 140×45 pattern. Record as observed; do not invent a reason.

Length consistency: Bunnings green 4.8 / 5.4 / 6.0 m share **$10.36/lm**. ITM KD 4.8 / 6.0 share **$8.11/lm**.

---

## 3. 190×45 SG8 H3.2

| Source | Seasoning | Incl $/lm | Ex $/lm |
| --- | ---: | ---: | ---: |
| Bunnings KD T14 | KD | 20.85 | 18.13 |
| Bunnings green T15 | Green | 17.16 | 14.92 |
| ITM KD T16 | KD | 16.22 | 14.10 |
| ITM wet T17 | Wet | 15.37 | 13.37 |

KD Bunnings vs ITM: **$18.13 vs $14.10 ex** (~29%).

---

## 4. Multi-length variation (same SKU family)

For Bunnings KD 140×45, 190×45, 240×45 and ITM KD/wet pairs fetched, **effective $/lm did not change** across 4.8 / 5.4 / 6.0 m (within 1 cent of printed $/lm).

**Implication:** a **single generic $/lm** is defensible **within one merchant + one identity + one seasoning**, for the lengths observed. It is **not** evidence that 3.6 m mill lengths match (not priced here).

Do not introduce procurement rounding from this.

---

## 5. LVL vs sawn 240×45

| Product | Identity | Incl $/lm |
| --- | --- | ---: |
| Bunnings 240×45 SG8 H3.2 KD | `structural_framing` | 26.58 |
| Bunnings IBuilt 240×45 LVL11 H3.1 | `structural_lvl` | 56.73 (also 47.28 displayed) |

**Incompatible.** No fuzzy pricing.

---

## 6. Supports

| Product | Unit | Can price 8 EA? |
| --- | --- | --- |
| 90×90 SG8 H5 Bunnings | **lm**, min 2.4 m mixed | **No** without length |
| 90×90 SG8 H5 ITM 4.8 / 6.0 m | piece | Only if job uses that length |
| 100×100 H4 sawn 2.4 m ITM | **EA** | Yes for **that** identity only |
| Round pile 2.4 m ITM | **EA** | Yes for **that** identity only |
| Prolam 88×88 2.4 m H5 | EA | Yes for **that** engineered product |

---

## 7. Concrete

| Source | Public $/m³ unknown-mix? | Specified mix? | Small load |
| --- | --- | --- | --- |
| Firth Certified | **No** (quote / DIY estimator) | Mix chosen at plant | **Fee below 3 m³**; DECK-REF-01 is **0.324 m³** |
| Firth fuel surcharge | $6.00 / m³ from 2026-08-10, nationwide Certified | Separate invoice line | Not a material identity |
| Bunnings bagged Cemix | Bag $, not m³ | 20 or 30 MPa post-hole | N/A — **do not bag-convert 0.324 m³** |

---

## 8. Benchmark-source strategy tradeoffs (no implementation)

| Strategy | Meaning | Tradeoff |
| --- | --- | --- |
| **A. One nominated public merchant** | e.g. Bunnings NZ website list, GST-ex, KD H3.2 SG8 | Transparent, repeatable, **DIY retail** (typically above trade). Honest as “public retail fallback”. |
| **B. Median of verified public sources** | Blend Bunnings + ITM (+ others) | **Falsifies geography and channel**. ITM is Taranaki; WBS is Auckland trade. **Not recommended.** |
| **C. Conservative upper public price** | Use highest verified (here Bunnings KD) | Safer for not underpricing; still not contractor cost. |
| **D. Source-specific records** | Store Bunnings vs ITM vs company separately | Best provenance. Quotr Common fallback still needs **one** nominated row if B2 attaches a single benchmark. |
| **E. No benchmark where weak** | Supports EA, concrete unknown mix, Mitre 10, PlaceMakers | Matches evidence. |

**Recommendation:** **A + E**. Nominate **Bunnings NZ GST-inclusive list ÷ 1.15** as the *Quotr public-retail fallback* for **exact** `structural_framing` + SG8 + H3.2 + **KD** identities only. Keep **source-specific provenance (D)** on the row. Do **not** median with ITM. **E** for supports-without-length, concrete unknown mix, green-vs-KD collapse, unknown grade.

Quotr benchmark ≠ supplier integration.

---

## 9. GST convention recommendation

Quotr cost authority is **ex-GST** (existing cost-first contract).

If B2 uses Bunnings/ITM public pages: store **sourcePrice incl GST**, **GST basis = inclusive**, **normalizedRate = sourcePrice / 1.15**.

Do not mix ITM incl with a GST-unknown specialist ($10.63) in one table of “ex-GST rates”.

---

## 10. Geographic recommendation

| Source | Treat as |
| --- | --- |
| Bunnings.co.nz displayed list | **NZ-wide published retail list**, store **availability** local; not a delivered Auckland job cost |
| ITM Stratford | **Taranaki branch** |
| Warehouse Building Supplies | **Auckland / Helensville**, trade-store retail list |
| Firth | **Plant/region quote** + nationwide surcharge rules |

Do **not** publish ITM Stratford as an undisclosed nationwide truth.

---

## 11. Freshness

Public timber SKU prices moved between category-card snippets and product pages in the same session (e.g. Bunnings 140×45 green category vs product). **Prices are volatile.**

Recommended policy (not automated):

- **Reverify before B2 attach**, and **at least quarterly** thereafter for any attached public-retail fallback.
- Store `researchedAt` + `lastVerifiedAt`.
- Staleness warning at **90 days**; do not silently refresh Production rates.

---

## 12. Proposed provenance fields (aligns with rate provenance + B1 contract)

| Field | Maps to |
| --- | --- |
| `canonicalMaterialIdentity` | CAT-IDENTITY key + structured columns |
| `sourceName` | Bunnings NZ / ITM Stratford / … |
| `sourceType` | manufacturer / merchant_public / merchant_trade / quote_only |
| `sourceURL` | Product URL |
| `sourceProductCode` | SKU / I/N — **mapping only** |
| `sourceProductDescription` | Raw title |
| `sourceRegion` / `sourceBranch` | NZ-wide list vs Stratford vs Helensville |
| `sourcePrice` / `sourceUnit` | As sold |
| `gstBasis` | inclusive / exclusive / unknown |
| `channel` | retail_public / account / unknown |
| `stockLengthM` | if piece |
| `conversionFormula` | e.g. `piece / 4.8` |
| `normalizedRateUnit` | lm / ea / m3 |
| `normalizedRateExGst` | number or null |
| `researchedAt` / `lastVerifiedAt` | ISO dates |
| `confidence` | strong / weak / none |
| `calculatorSupport` | `planned` until B2 actually prices the child |
| `notes` | KD vs green, dual price, etc. |

Existing presentation authority `BENCHMARK` (`docs/architecture/QUOTR_RATE_AUTHORITY_AND_PROVENANCE_MODEL.md`) remains the UI label. Do not call a Bunnings fallback “Your company rate”.
