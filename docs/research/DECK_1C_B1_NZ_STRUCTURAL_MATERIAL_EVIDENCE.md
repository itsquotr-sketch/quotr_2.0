# DECK-1C-B1 — NZ Structural Material Evidence

**Status:** COMPLETE / OWNER VALIDATED  
**Research date:** 2026-08-18  
**HEAD at research:** `be0bd2ae5189a2701093334e97af1718b2e729e3`  
**CAT-IDENTITY-01:** `e8e9ca298e9f8b48ef4e543d9e32168234a8d3c0`  
**Identity contract:** `docs/architecture/DECK_STRUCTURAL_MATERIAL_IDENTITY.md`  
**Comparison:** `docs/research/DECK_1C_B1_BENCHMARK_SOURCE_COMPARISON.md`  
**Owner gate:** `docs/runbooks/DECK_1C_B1_OWNER_RATE_GATE.md`

This file is the **Owner-validated evidence pack**. It does **not** implement rates. SKUs are source metadata only, never canonical material IDs.

Owner locked (see gate): first B2 benchmarks are **90×45 / 140×45 / 190×45 SG8 H3.2 KD** `structural_framing` **lm**, Bunnings public list, **ex-GST = incl ÷ 1.15**, no merchant averaging. Common ≠ structural default. KD vs green is **price-relevant identity evidence**. Supports and unknown-mix concrete stay pricing-required.

GST arithmetic uses New Zealand GST **15%**: ex-GST = GST-inclusive ÷ 1.15. Where a source does not state GST, the GST basis is **unknown**.

---

## 1. Purpose and method

Path used for every row:

SOURCE PRODUCT → RAW SPEC → NORMALIZED `MaterialIdentity` → SELLING UNIT → POSSIBLE QUOTR UNIT → CONVERSION IF DETERMINISTIC

Did **not** search for a desired H3.2/SG8 answer and force products into it. Started from current NZ manufacturer ranges and public merchant listings. Missing attributes stay unknown.

### Source quality actually used

| Rank | Used? | Sources |
| --- | --- | --- |
| 1 Manufacturer official | Yes (availability, sizes, treatments — **no public mill list prices**) | [Pine Products Structural](https://www.pineproducts.co.nz/Products/Structural/), [Waipapa Pine H3.2 MG SG8 BPIR PDF](https://www.fwp.co.nz/wp-content/uploads/2023/11/Building-Products-Information-Waipapa-Pine-H3.2-MG-SG8-Framing-Timber.pdf), WBS Henderson BPIR 150×50 (140×45) H3.2 KD MG SG8 |
| 2 Major merchant product pages | Yes | Bunnings NZ, ITM Stratford |
| 3 Official technical PDFs | Yes | Firth Certified Concrete delivery/FAQ, Waipapa BPIR |
| 4 Other NZ catalogues | Limited, labelled | Warehouse Building Supplies Helensville (Auckland), One Stop Deck Shop, Mitre 10 category, PlaceMakers (no public price) |

**Not relied on:** forums, overseas prices, AI summaries, anonymous lists, search snippets as sole price evidence.

**Rejected as unverified:** Kiwi Timber “Firth 20 MPa $/m³” listing — search snippet existed; **live fetch returned 404 on 2026-08-18**. Not used as a price.

### What this pack is not

- Not a building-code determination of which treatment a given deck requires (DECK-STRUCT-01 unchanged).
- Not a Quotr estimate. No Deck 1 money restamp.
- Not supplier integration. Public retail ≠ company cost.

---

## 2. Call size vs dressed size (identity)

NZ trade often **calls** 150×50 / 100×50 / 200×50 while **machine-gauged / dressed** stock is **140×45 / 90×45 / 190×45**.

Manufacturer/BPIR evidence:

- Waipapa Pine H3.2 MG SG8 is machine-gauged in **70×45, 90×45, 140×45, 190×45, 240×45, 290×45** ([BPIR PDF](https://www.fwp.co.nz/wp-content/uploads/2023/11/Building-Products-Information-Waipapa-Pine-H3.2-MG-SG8-Framing-Timber.pdf), accessed 2026-08-18).
- WBS Henderson BPIR product name: **“150x50 (140x45) H3.2 CCA KD MG SG8 Pine Structural Timber”**.
- Pine Products lists dressed sizes **70×45 … 290×45** H3.2 KD PG SG8, lengths 3.6 / 4.2 / 4.5 / 4.8 / 5.4 / 6.0 m ([Structural](https://www.pineproducts.co.nz/Products/Structural/), accessed 2026-08-18).

**Quotr canonical section remains dressed millimetres** (`140x45`), per CAT-IDENTITY. Mitre 10 “150 x 50” Radiata SG8 H3.2 is **not** a different section from 140×45 dressed — it is the call size of the same family. Do not treat 150×50 and 140×45 as incompatible **if** the source states both. Do **not** map unsourced 150×50 rough-sawn to 140×45.

---

## 3. Identity mapping rules used here

| Raw source says | Mapped |
| --- | --- |
| 140×45 / 140 x 45mm | `section = 140x45` |
| 150×50 (140×45) | `section = 140x45` (both stated) |
| SG8 / MSG8 | `grade = sg8` |
| “framing timber” with no grade | `grade = unknown` — **no SG8 inferred** |
| H3.2 / CCA H3.2 | `treatment = h3.2`, `treatmentKind = known` |
| H1.2 / Boron H1.2 | `treatment = h1.2` |
| H4 / H5 | `h4` / `h5` |
| Radiata / Radiata Pine | `species = radiata_pine` when the source names it |
| LVL11 / laminated veneer | `productFamily = structural_lvl` — **not** `structural_framing` |
| Kiln dried vs green/wet | **Not a CAT-IDENTITY field today.** Recorded in `originalDescription` / notes. **Do not collapse KD and green into one benchmark** — public $/lm differs. |

Wet/KD is commercially material (Bunnings 140×45 H3.2 SG8: KD **$15.70/lm** vs green **$11.26/lm** incl GST). Owner must decide whether B2 adds a seasoning attribute or keeps separate Common rows via description.

---

## 4. What NZ products actually look like (availability)

### 4.1 Ordinary structural framing (`structural_framing`)

Public merchant listings consistently sell **Radiata, SG8, machine-gauged**, in **H1.2 (interior boron)** and **H3.2 (exterior CCA)**, **kiln-dried and green/wet**.

Core sections **present in manufacturer range and Bunnings/ITM**: 90×45, 140×45, 190×45.

Also commonly listed: 70×45, 240×45, 290×45 (Bunnings + Waipapa). 100×50 / 200×50 appear as **call sizes** on Mitre 10 (often without public length/price).

### 4.2 LVL / engineered (`structural_lvl`)

Bunnings engineered range includes **IBuilt 240×45 LVL11 H3.1** at **$56.73/lm** (second displayed **$47.28/lm**) vs **240×45 SG8 H3.2 KD sawn framing $26.58/lm**. Same dressed section, **incompatible identities**.

### 4.3 Posts / piles

- Structural **90×90 SG8 H5** is commonly sold **per linear metre** or as **long pieces** (4.8 m / 6.0 m), not as a short EA deck post.
- **Fence-style posts** (100×100 H4 sawn 2.4 m, round 100–119 mm 2.4 m) **are** sold **each**.
- Manufacturer posts: Pine Products **88×88 H4 KD** in 1.8 / 2.4 / 3.0 / 3.6 m — **no public mill price**.
- Engineered posts (Prolam / IBuilt GL8 H5) sold each **and** per lm — different product family.

---

## 5. Canonical evidence table

Research date for all rows: **2026-08-18** unless noted.

**GST-incl → ex-GST** uses ÷ 1.15. **Normalized Quotr unit** for framing is **lm** (continuous estimating). Piece ÷ length is shown, never hidden.

| ID | Mapped identity key | Raw product | Source | URL | Product code | Region | Grade | Treatment | Stock length | Raw unit | Raw price (NZD) | GST | Public vs account | Normalized unit | Converted candidate (incl / ex GST) | Quality | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| T01 | `timber.structural_framing.140x45.radiata_pine.sg8.h3.2` | 140 x 45mm SG8 H3.2 KD Treated Radiata Timber Framing | Bunnings NZ | https://www.bunnings.co.nz/140-x-45mm-sg8-h3-2-kd-treated-radiata-timber-framing-4-8m_p0616335 | I/N 0616335 | NZ website list; store availability | sg8 | h3.2 | 4.8 m | piece | 75.35 | Incl ([online terms](https://www.bunnings.co.nz/terms-conditions/online-shopping) §3b) | Public retail | lm | 15.70 / 13.65 | **STRONG** (retail) | Site also prints $15.70/lm. KD. |
| T02 | same as T01 | same family, 5.4 m | Bunnings NZ | https://www.bunnings.co.nz/140-x-45mm-sg8-h3-2-kd-treated-radiata-timber-framing-5-4m_p0616400 | I/N 0616400 | NZ website list | sg8 | h3.2 | 5.4 m | piece | 84.77 | Incl | Public retail | lm | 15.70 / 13.65 | STRONG | Same $/lm as T01. |
| T03 | same as T01 | same family, 6.0 m | Bunnings NZ | https://www.bunnings.co.nz/140-x-45mm-sg8-h3-2-kd-treated-radiata-timber-framing-6m_p0616343 | I/N 0616343 | NZ website list | sg8 | h3.2 | 6.0 m | piece | 94.19 | Incl | Public retail | lm | 15.70 / 13.65 | STRONG | Same $/lm. |
| T04 | `timber.structural_framing.140x45.radiata_pine.sg8.h3.2` | 140 x 45mm SG8 H3.2 Treated **Green** Radiata | Bunnings NZ | https://www.bunnings.co.nz/140-x-45mm-sg8-h3-2-treated-green-radiata-timber-framing-6m_p0616262 | I/N 0616262 | NZ website list | sg8 | h3.2 | 6.0 m | piece | 67.53 | Incl | Public retail | lm | 11.26 / 9.79 | STRONG as **green**, not KD | Do **not** blend with T01–T03. |
| T05 | `timber.structural_framing.140x45.radiata_pine.sg8.h1.2` | 140 x 45mm SG8 **H1.2** KD Radiata | Bunnings NZ | https://www.bunnings.co.nz/140-x-45mm-sg8-h1-2-kd-treated-radiata-timber-framing-6m_p0616348 | I/N 0616348 | NZ website list | sg8 | h1.2 | 6.0 m | piece | 83.08 | Incl | Public retail | lm | 13.85 / 12.04 | STRONG as **interior H1.2** | 4.8 m I/N 0616436 is $66.46 = same $/lm. Not a deck-exterior identity. |
| T06 | `timber.structural_framing.140x45.sg8.h3.2` | 140 x 45 H3.2 KD SG8 Gauged | ITM Stratford | https://www.itmstratford.co.nz/product/140-x-45-h3-2-kd-sg8-gauged-4-8m/ | SKU 15050H3KDG148 | **Taranaki / Stratford**; ships Taranaki-wide | sg8 | h3.2 | 4.8 m | piece (Length) | 58.09 | **Incl** (page) | Public list; Priority Card $52.47; **trade login** | lm | 12.10 / 10.52 | **WEAK nationally** (branch) | Species Radiata implied by mill practice, not restated on title. |
| T07 | same as T06 | same, 6.0 m | ITM Stratford | https://www.itmstratford.co.nz/product/140-x-45-h3-2-kd-sg8-gauged-6-0m/ | SKU 15050H3KDG16 | Stratford / Taranaki | sg8 | h3.2 | 6.0 m | piece | 72.62 | Incl | Public list; Priority $65.60 | lm | 12.10 / 10.52 | WEAK nationally | Same $/lm as T06. |
| T08 | `timber.structural_framing.140x45.sg8.h3.2` | FRAMING H3.2 MSG8 PG 150x50(140x45)x4.8MTR, **green** | Warehouse Building Supplies | https://www.warehousebuildingsupplies.co.nz/shop/113284-framing-h32-msg8-pg-150x50140x45x48mtr-30893 | (page SKU 30893) | **Helensville / Auckland**; “only trade store in Auckland”; page also says RETAIL pricelist | sg8 | h3.2 | 4.8 m | piece | 38.16 | Incl (page) | Public web + trade store | lm | **7.95 / 6.91** | WEAK (Auckland trade-oriented, wet) | Banner claims $7.95/m inc GST. |
| T09 | `timber.structural_framing.140x45.sg8.h3.2` | Framing 140x45mm H3.2 SG8 KD | One Stop Deck Shop | https://www.onestopdeckshop.co.nz/shop/framing-140x45mm-h3-2-sg8-kd/ | — | NZ specialist web | sg8 | h3.2 | unknown (“lengths subject to availability”) | lm | 10.63 | **Unknown** (not stated) | Public web | lm | 10.63 unknown GST | **NO / WEAK** | Cannot GST-normalize. |
| T10 | `timber.structural_framing.90x45.radiata_pine.sg8.h3.2` | 90 x 45mm SG8 H3.2 **KD** Radiata | Bunnings NZ | https://www.bunnings.co.nz/90-x-45mm-sg8-h3-2-kd-treated-radiata-timber-framing-4-8m_p0616579 | I/N 0616579 | NZ website list | sg8 | h3.2 | 4.8 m | piece | 44.66 | Incl | Public retail | lm | 9.30 / 8.09 | STRONG (retail, KD) | |
| T11 | `timber.structural_framing.90x45.radiata_pine.sg8.h3.2` | 90 x 45mm SG8 H3.2 **Green** Radiata | Bunnings NZ | https://www.bunnings.co.nz/90-x-45mm-sg8-h3-2-treated-green-radiata-timber-framing-4-8m_p0616338 | I/N 0616338 | NZ website list | sg8 | h3.2 | 4.8 m | piece | 49.72 | Incl | Public retail | lm | 10.36 / 9.01 | STRONG as green | 5.4 m I/N 0616340 $55.94; 6.0 m I/N 0616288 $62.16 — same $/lm. |
| T12 | `timber.structural_framing.90x45.sg8.h3.2` | 90 x 45 H3.2 KD SG8 Gauged | ITM Stratford | https://www.itmstratford.co.nz/product/90-x-45-h3-2-kd-sg8-gauged-4-8m/ | SKU 10050H3KDG148 | Stratford / Taranaki | sg8 | h3.2 | 4.8 m | piece | 38.93 | Incl | Public list | lm | 8.11 / 7.05 | WEAK nationally | 6.0 m SKU 10050H3KDG16 $48.67 = same $/lm. |
| T13 | same family, wet | 90 x 45 H3.2 Wet Gauged SG8 | ITM Stratford | https://www.itmstratford.co.nz/product/90-x-45-h3-2-wet-gauged-sg8-4-8m/ | SKU 10050H3G148 | Stratford / Taranaki | sg8 | h3.2 | 4.8 m | piece | 36.89 | Incl | Public list | lm | 7.69 / 6.68 | WEAK nationally | 6.0 m $46.12. |
| T14 | `timber.structural_framing.190x45.radiata_pine.sg8.h3.2` | 190 x 45mm SG8 H3.2 **KD** Radiata | Bunnings NZ | https://www.bunnings.co.nz/190-x-45mm-sg8-h3-2-kd-treated-radiata-timber-framing-6m_p0616565 | I/N 0616565 | NZ website list | sg8 | h3.2 | 6.0 m | piece | 125.09 | Incl | Public retail | lm | 20.85 / 18.13 | STRONG (retail, KD) | 5.4 m I/N 0616595 $112.58 = same $/lm. |
| T15 | same section, green | 190 x 45mm SG8 H3.2 **Green** | Bunnings NZ | https://www.bunnings.co.nz/190-x-45mm-sg8-h3-2-treated-green-radiata-timber-framing-6m_p0616628 | I/N 0616628 | NZ website list | sg8 | h3.2 | 6.0 m | piece | 102.95 | Incl | Public retail | lm | 17.16 / 14.92 | STRONG as green | 4.8 m I/N 0616614 $82.36 = same $/lm. |
| T16 | `timber.structural_framing.190x45.sg8.h3.2` | 190 x 45 H3.2 KD SG8 | ITM Stratford | https://www.itmstratford.co.nz/product/190-x-45-h3-2-kd-sg8-6-0m/ | SKU 20050H3KDG16 | Stratford / Taranaki | sg8 | h3.2 | 6.0 m | piece | 97.32 | Incl | Public list | lm | 16.22 / 14.10 | WEAK nationally | |
| T17 | same, wet | 190 x 45 H3.2 Wet Gauged SG8 | ITM Stratford | https://www.itmstratford.co.nz/product/190-x-45-h3-2-wet-gauged-sg8-6-0m/ | SKU 20050H3G16 | Stratford / Taranaki | sg8 | h3.2 | 6.0 m | piece | 92.22 | Incl | Public list | lm | 15.37 / 13.37 | WEAK nationally | 4.8 m SKU 20050H3G148 $73.77 = same $/lm. |
| T18 | `timber.structural_framing.70x45.radiata_pine.sg8.h1.2` | 70 x 45mm SG8 H1.2 KD Radiata | Bunnings NZ | https://www.bunnings.co.nz/70-x-45mm-sg8-h1-2-kd-treated-radiata-timber-framing-6m_p0616437 | I/N 0616437 | NZ website list | sg8 | h1.2 | 6.0 m | piece | 39.08 | Incl | Public retail | lm | 6.51 / 5.66 | SECONDARY (interior) | |
| T19 | `timber.structural_framing.240x45.radiata_pine.sg8.h3.2` | 240 x 45mm SG8 H3.2 KD Radiata | Bunnings NZ | https://www.bunnings.co.nz/240-x-45mm-sg8-h3-2-kd-treated-radiata-timber-framing-6m_p0616626 | I/N 0616626 | NZ website list | sg8 | h3.2 | 6.0 m | piece | 159.51 | Incl | Public retail | lm | 26.58 / 23.11 | SECONDARY | 4.8 m I/N 0616712 $127.60 = same $/lm. |
| T20 | `timber.structural_lvl.240x45` (LVL11 H3.1) | IBuilt 240 x 45mm LVL11 H3.1 Laminated Veneer Lumber | Bunnings NZ | https://www.bunnings.co.nz/products/building-hardware/timber/framing-timber/engineered-timber | (category listing; special order) | NZ website list | **lvl11** (engineered grade, not SG8) | **h3.1** | sold per lm (increments not captured on category card) | lm | 56.73 (also 47.28 displayed) | Incl (site terms) | Public retail / dual display unexplained | lm | 56.73 / 49.33 (or 47.28 / 41.11) | WEAK until SKU page + dual-price explained | **Incompatible** with T19. |
| S01 | `timber.post.90x90.radiata_pine.sg8.h5` | 90 x 90mm Rad SG8 H5 Wet Gauged Treated Pine | Bunnings NZ | https://www.bunnings.co.nz/90-x-90mm-rad-sg8-h5-wet-gauged-treated-pine-per-linear-metre_p0276373 | I/N 0276373 | NZ website list | sg8 | h5 | mix of lengths **minimum 2.4 m** | **lm** | 26.20 | Incl | Public retail; in-store only | lm | 26.20 / 22.78 | **NO EA benchmark** | Explicitly **not** a single EA product. Do not price 8 EA from this. |
| S02 | `timber.post.90x90.sg8.h5` | 90 x 90 H5 Gauged SG8 4.8 m | ITM Stratford | https://www.itmstratford.co.nz/product/90-x-90-h5-gauged-sg8-4-8m/ | SKU 100100H5G148 | Stratford / Taranaki | sg8 | h5 | 4.8 m | piece | 127.51 | Incl | Public list | lm *or* EA-at-4.8m | 26.56 / 23.10 per lm | WEAK for Deck EA | 6.0 m SKU 100100H5G16 $159.39 = same $/lm. Length unknown on DECK-REF-01. |
| S03 | `timber.post.100x100` H4 sawn (grade unknown) | Posts 100 x 100 H4 Sawn 2.4 m | ITM Stratford | https://www.itmstratford.co.nz/product/posts-100-x-100-h4-sawn-2-4m/ | SKU 10010024P | Stratford / Taranaki | unknown | h4 | 2.4 m | **Each** | 26.24 | Incl | Public list | ea | 26.24 incl / 22.82 ex per EA | WEAK / different identity | **Genuine EA**, but **not** 90×90 SG8. Fence-style. |
| S04 | `timber.pile` round 100–119 mm | Posts No2 Round 100-119mm 2.4 m | ITM Stratford | https://www.itmstratford.co.nz/product/posts-no2-round-100-119mm-2-4m/ | SKU PR224 | Stratford / Taranaki | unknown | unknown on title | 2.4 m | **Each** | 23.48 | Incl | Public list | ea | 23.48 / 20.42 | WEAK | Not 90×90. |
| S05 | `structural_lvl` / glulam post 88×88 H5 | Prolam 88 x 88mm x 2.4m Visual PL8 H5 KD Post | Bunnings NZ | https://www.bunnings.co.nz/products/building-hardware/timber/framing-timber/engineered-timber | (category) | NZ website list | PL8 (engineered) | h5 | 2.4 m | piece | 99.50 | Incl | Public retail | ea | 99.50 / 86.52; site also $41.46/lm | WEAK / different family | EA **is** possible for **this** product only. |
| C01 | `concrete` mix **20 MPa** (if used) | Firth Certified Concrete — **no public $/m³** | Firth | https://www.firth.co.nz/concrete/decorative-concrete/coloured-concrete (FAQ); surcharge https://www.firth.co.nz/temporary-fuel-surcharge | — | Nationwide plants; **local quote** | mix unknown on public list | n/a | n/a | m3 quote | **none published** | unknown | Quote-only / DIY estimator behind plant | m3 | — | **NO BENCHMARK** | Small-load threshold **3 m³**. Fuel surcharge **$6.00/m³** Certified Concrete from 2026-08-10. |
| C02 | bagged post-hole concrete 20 MPa (Cemix) | Cemix 20kg Fastcrete | Bunnings NZ | https://www.bunnings.co.nz/cemix-20kg-fastcrete_p0241402 | I/N 0241402 | NZ website list | 20 MPa @ 28 days (page) | n/a | 20 kg bag | bag | 12.73 | Incl | Public retail | bag | **Do not convert to 0.324 m³** | NO for footing m³ | Page: non-structural / fence posts; 2 bags per post recommendation. |
| C03 | bagged 30 MPa post-hole | Cemix 20kg Super Strength Fastcrete | Bunnings NZ | https://www.bunnings.co.nz/cemix-20kg-super-strength-fastcrete_p0341405 | I/N 0341405 | NZ website list | 30 MPa @ 28 days | n/a | 20 kg bag | bag | 16.75 | Incl | Public retail | bag | Do not convert | NO for 0.324 m³ | |
| M01 | Mitre 10 Radiata SG8 H3.2 Dry “150 x 50” | Category: Radiata SG8 H3 KD 70x45 & 140x45 | Mitre 10 NZ | https://www.mitre10.co.nz/shop/building-hardware/timber/structural-framing/structural-framing/radiata-sg8-h3-kd-70x45mm-140x45mm/c/RC61070 | SKUs e.g. 610705, 2056362 | **Store-selected**; many “contact store” | sg8 | h3.2 | often **unstated** on priced SKUs | each | e.g. $103 / $82.26 (SKU 2056362 / 2056359) | presumed incl; **not proven on fetch** | Public + store | unknown without length | **NO BENCHMARK** | Incomplete identity (length missing on priced cards). |
| M02 | PlaceMakers SG8 H3.2 150×50 (140×45) | PlaceMakers framing hub | PlaceMakers | https://www.placemakers.co.nz/online/projects/framing-timber | — | Branch / trade portal | sg8 (hub copy) | h3.2 | stocked incl 140×45 (hub copy) | — | **not published** | — | Trade / quote | — | **NO BENCHMARK** | “Check your Trade Price”. |

PlaceMakers and Carters: **no usable public unit prices** found on 2026-08-18.

---

## 6. Treatment combinations actually found

| Treatment | Context on sourced products | Deck relevance |
| --- | --- | --- |
| **H3.2 CCA** | Dominant outdoor framing SKU at Bunnings and ITM; Waipapa/Pine Products H3.2 MG SG8 | Matches DECK-REF-01 *fixture* treatment **if** the user selected it — not a silent default |
| **H1.2 boron KD** | Interior framing, same sections (70×45, 90×45, 140×45, 190×45, 240×45) | Real product; **incompatible** with H3.2 identity |
| **H3.1** | LVL11 IBuilt (engineered) | LVL family, not sawn framing |
| **H4** | Pine Products 88×88 posts; ITM 100×100 sawn posts | In-ground posts — not joist identity |
| **H5** | 90×90 SG8 gauged posts (Bunnings lm, ITM long lengths); engineered H5 posts | Supports, not joists |

**Do not assume** Deck structural timber is universally H3.2. Catalogue evidence shows H1.2 and H3.2 both common. Code-appropriate treatment remains a **project spec** (DECK-STRUCT-01).

---

## 7. Grade combinations actually found

Almost every **priced public framing SKU** in this pack states **SG8** (or MSG8). Manufacturer ranges are SG8.

**No sourced public SKU** in this pack was “140×45 H3.2, grade unspecified.”

Implication:

- Quotr **Common product records** can honestly carry **explicit SG8** when they represent these SKUs.
- A requirement with **grade unknown** must **not** auto-match an SG8 benchmark (CAT-IDENTITY: partial, not exact).
- **Owner D3:** unknown-grade jobs do **not** receive the SG8 H3.2 KD benchmark.

---

## 8. Stock lengths and selling units

| Source | Typical lengths observed | Selling unit |
| --- | --- | --- |
| Pine Products mill | 3.6, 4.2, 4.5, 4.8, 5.4, 6.0 m (KD PG) | pack / mill — no public $ |
| Bunnings framing | 4.8, 5.4, 6.0 m dominant on web; 3.6 m not confirmed on fetched pages | **piece** + printed **$/lm** |
| ITM Stratford | 4.8 m and 6.0 m on fetched SKUs | **piece (Length)** |
| Bunnings 90×90 H5 | mixed lengths, **min 2.4 m** | **$/lm** |
| Fence posts ITM | 2.4 m | **Each** |

DECK-1B remains **continuous lm**. No stock optimisation in B1/B2 from this pack.

---

## 9. Proposed first Quotr Common range (UX only — not defaults)

Classification **does not** restrict custom materials. **Common ≠ default spec.**

| Section | Grade | Treatment | Product family | Seasoning | UX class | Availability | Public benchmark |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 90×45 | sg8 | h3.2 | structural_framing | KD | **CORE COMMON** | Mill + Bunnings + ITM | Strong retail (Bunnings); branch ITM |
| 140×45 | sg8 | h3.2 | structural_framing | KD | **CORE COMMON** | Same | Strong retail |
| 190×45 | sg8 | h3.2 | structural_framing | KD | **CORE COMMON** | Same | Strong retail |
| 90×45 / 140×45 / 190×45 | sg8 | h3.2 | structural_framing | **green/wet** | **SECONDARY** | Same merchants | Strong but **different rate** |
| 90×45 / 140×45 / 190×45 | sg8 | **h1.2** | structural_framing | KD | **SECONDARY** (interior) | Bunnings | Strong; **not** deck-exterior default |
| 70×45 | sg8 | h1.2 or h3.2 | structural_framing | KD | SECONDARY | Mill + Bunnings | Optional |
| 240×45 | sg8 | h3.2 | structural_framing | KD | SECONDARY | Mill + Bunnings | Optional |
| 290×45 | sg8 | h3.2 | structural_framing | KD | SECONDARY | Mill + Bunnings category | Optional |
| 240×45 | LVL11 | h3.1 | **structural_lvl** | — | **CUSTOM / ADVANCED** | Bunnings special order | Weak SKU-page gap |
| 200×50 / custom | — | — | as specified | — | **CUSTOM** | Valid without Common membership | Pricing-required unless company rate |
| 90×90 post | sg8 | h5 | post | wet gauged | Common **picker** only | Yes | **Pricing-required** until length/product chosen |
| 100×100 H4 2.4 m | unknown | h4 | post | sawn | CUSTOM / fence-like | ITM EA | Different identity |
| Concrete unknown mix | — | — | concrete | — | n/a | Physical yes | **Pricing-required** |

---

## 10. DECK-REF-01 rate coverage (research only — not estimate money)

Quantities frozen: joists 42.32 lm + rim 10.92 lm = **53.24 lm**; bearers **10.92 lm**; supports **8 EA**; concrete **0.324 m³**. Legacy `deck.substructure` remains money authority.

| Child | If user spec were… | Candidate coverage | Would identity match? |
| --- | --- | --- | --- |
| Joists + rim 53.24 lm | 140×45, treatment unknown, grade unknown | Physical yes; **no** exact Common SKU | Partial vs T01. **Not rate-eligible** from SG8 H3.2 KD |
| Joists + rim | 140×45 H3.2, grade unknown | Still **partial** vs T01 | **Owner D3:** no SG8 benchmark |
| Joists + rim | 140×45 H3.2 SG8 KD | T01–T03 Bunnings **$13.65 ex-GST/lm** is the **nominated B2 source**; ITM T06 **$10.52 ex** Taranaki is comparison only | Exact vs Bunnings identity. B1 does not attach the rate. |
| Bearers 10.92 lm | 190×45 H3.2 SG8 KD | T14 **$18.13 ex/lm** Bunnings; T16 **$14.10 ex** ITM | Same caveats |
| Supports 8 EA | 90×90 Post, length unknown | S01 is **lm**; S02 is 4.8 m piece | **No** defensible EA rate without length/product |
| Concrete 0.324 m³ | mix unknown | C01 quote-only; 0.324 ≪ 3 m³ small-load | **Pricing-required** |

Do **not** multiply 53.24 × $13.65 into a Deck sell total. Structural children stay SHADOW.

---

## 11. Existing repo benchmark audit (no code change)

| Constant | Location | What it is | For structural children? |
| --- | --- | --- | --- |
| `DECK_BENCHMARKS.framing` $120 / $180 **per m²** | `lib/estimate/benchmark-rates.ts` | Anonymous package **deck.substructure.m2** | **Ignore / do not reuse** as joist lm. Keep as **legacy package** money until DECK-1R. |
| `DECK_BENCHMARKS.treatedPineLm` $14 / $22 | same | **Decking board** lm, not SG framing | **Ignore** for joists |
| `DECK_BENCHMARKS.postReplacementEach` $180 / $280 | same | Replacement **allowance**, not a post SKU | **Ignore** for 8 EA material |
| `DECK_BENCHMARKS.substructureReplacementAllowance` | same | Existing-deck condition allowance | Unrelated to new-build takeoff |
| `PERGOLA_BENCHMARKS.footingsEach` $220 / $340 | same | Anonymous footing allowance | **Do not** map to `deck.concrete` 0.324 m³ |
| `RETAINING_WALL_BENCHMARKS.backfillPerM3` $95 / $145 | same | Backfill, not structural mix | Ignore |
| `RATES_LAST_REVIEWED` `2026-06-26`, `RATES_REGION` `NZ` | same file | Placeholder review stamp | Stale relative to this B1 date; **not** structural-timber sourced |
| Docs `$18.75/lm` examples | company contract / identity docs | **Illustrative**, not a live rate | Ignore |
| Historic `timber.sg8.*` keys | docs / old tests | Defective identity (assumed SG8 + unit) | **Deprecated as identity**; CAT-IDENTITY superseded |

**Recommendation:** retain legacy m² package for commercial freeze; **do not** seed structural child rates from these constants in B2.

---

## 12. Company / project precedence (unchanged)

Even if B2 later attaches a Quotr benchmark:

1. Project override  
2. Company exact (identity + unit)  
3. Quotr benchmark (fallback)  
4. Pricing required  

Public PlaceMakers/Bunnings/ITM prices are **not** company cost.

---

## 13. Commercial safety (confirmed, no code change)

| Component | Authority |
| --- | --- |
| `deck.substructure` | Legacy money |
| `deck.joists` / `rim_framing` / `bearers` / `supports` / `concrete` | SHADOW |
| `decking.surface` | REQUIREMENT_AUTHORITATIVE |
| `deck.labour` | SHADOW |

Production Scope Discovery remains **disabled**. No migration. No materials table.

---

## 14. Gaps

- PlaceMakers / Carters public unit prices: **absent**.
- Mitre 10: store-gated, lengths often missing.
- Bunnings LVL: category price only; dual $/lm unexplained.
- Wet/KD not in CAT-IDENTITY schema.
- Ready-mix **$/m³** not on Firth public pages.
- 3.6 m piece prices not captured on Bunnings fetches (mill lists 3.6 m).
- Bunnings “select store” — website showed a national list price in fetches; **availability is store-specific**. Do not treat as a guaranteed Auckland-or-nationwide delivered cost.
