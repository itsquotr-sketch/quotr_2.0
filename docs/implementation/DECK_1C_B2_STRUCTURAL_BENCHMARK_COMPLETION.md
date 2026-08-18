# DECK-1C-B2 — Structural Timber Benchmark Completion

**Status:** COMPLETE / TECHNICALLY VALIDATED  
**Preview commit:** `bfbde275688349d3ad7302fb7d105e7c38e9bdbf`  
**Date:** 2026-08-18  
**Branch:** `hardening/stage-2a-security`  
**B1 evidence commit:** `8deecb1e4fed87d7f962bbf5d9779436a0f43f56`  
**Verify local:** `npx tsx scripts/verify-deck-1c-b2-structural-benchmarks.ts` (72/0)  
**Verify Preview:** `npx tsx scripts/verify-deck-1c-b2-remote-preview-structural-benchmarks.ts` (37/0)

Attaches Owner-approved **Quotr sourced public-list benchmark** fallbacks (ex-GST $/lm) to three exact CAT-IDENTITY timber rows. These are **Quotr benchmark fallbacks** — not market averages, trade rates, contractor rates, supplier/account prices, structural defaults, or guarantees of current merchant price.

Structural children stay SHADOW. Supports and unknown-mix concrete stay pricing-required. No materials table. No migration.

---

## Semantic locks

| Lock | Detail |
| --- | --- |
| Wording | Prefer “Quotr sourced public-list benchmark” or “Quotr benchmark” |
| Identity | Exact match on section + grade + treatment + processing (`kd`) |
| Processing | Optional `processing` / `processingKind`; only on timber where parsed; unknown omitted |
| Precision | Raw Bunnings incl-GST piece ÷ stock length ÷ 1.15; resolve cost via existing `round2` |
| Provenance | `rateEvidence` on requirement + snapshot; historical cost independent of live benchmark refresh |
| Partial aggregate | Labelled **PARTIAL PRICED STRUCTURAL CHILD COST** — not substructure / total structural / complete detailed cost |
| Supports / concrete | `priced=false`; not zero-cost; excluded from complete substructure cost |

Debug identity keys are a **deterministic representation of known attributes**. They are **not** persistent catalogue row IDs.

---

## Approved Quotr benchmark fallbacks

Recalculated from B1 raw GST-incl piece prices ÷ stock length ÷ 1.15, then `round2`.

| Identity | Evidence | Raw | Conversion | Ex-GST $/lm |
| --- | --- | --- | --- | ---: |
| 90×45 SG8 H3.2 KD | Bunnings I/N 0616579 T10 | $44.66 / 4.8 m incl | `(44.66 / 4.8) / 1.15` | **8.09** |
| 140×45 SG8 H3.2 KD | Bunnings I/N 0616335 T01 | $75.35 / 4.8 m incl | `(75.35 / 4.8) / 1.15` | **13.65** |
| 190×45 SG8 H3.2 KD | Bunnings I/N 0616565 T14 | $125.09 / 6.0 m incl | `(125.09 / 6.0) / 1.15` | **18.13** |

Source: Bunnings NZ public retail/list, researched **2026-08-18**. Not averaged with ITM or other merchants.

---

## Matching rules

Exact identity + `lm` only. No auto-enrichment. No section-only, unknown-grade, unknown-treatment, unknown-processing, green→KD, H1.2/H4→H3.2, LVL→framing, 200×50.

Hierarchy: project override → company exact → Quotr exact benchmark → pricing required.

---

## DECK-RATE-REF-01 (shadow diagnostics)

Same 5.20 × 3.10 geometry as DECK-REF-01. Framing spec `H3.2 SG8 KD`.

| Child | Qty | Rate | Cost | priced |
| --- | ---: | ---: | ---: | --- |
| Joists | 42.32 lm | 13.65 | 577.67 | true / benchmark |
| Rim | 10.92 lm | 13.65 | 149.06 | true / benchmark |
| Joist+rim stock | **53.24 lm** | 13.65 | **726.73** PARTIAL PRICED STRUCTURAL CHILD COST | separate components |
| Bearers | 10.92 lm | 18.13 | 197.98 | true / benchmark |
| Supports | 8 EA | — | — | false |
| Concrete | 0.324 m³ | — | — | false |

**Partial priced structural child total (joists + rim + bearers):** **924.71** — still incomplete vs legacy package (supports, concrete, fixings, labour bundling, etc.).

DECK-REF-01 (`H3.2` only, no grade/KD) remains unpriced.

---

## Commercial safety

- `deck.substructure` legacy money authority
- Structural children SHADOW
- `decking.surface` REQUIREMENT_AUTHORITATIVE
- `deck.labour` SHADOW
- Goldens unchanged: Deck 1 $48,340 / Fence 2 $8,782 / Pergola 1 $15,374 / RW 2 $7,345

---

## Freshness

Quarterly review. 90-day stale warning from `verifiedAt` (`2026-08-18`). No scrape automation.

---

## Next

DECK-1D structural calibration handoff — `docs/plans/DECK_1D_STRUCTURAL_CALIBRATION_HANDOFF.md`. Do not promote structural children or start DECK-1D implementation without Owner gate.
