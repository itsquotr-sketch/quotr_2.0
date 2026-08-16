# FOUNDATION-R2-R1 — Owner Preview

**Status:** Owner Preview Pending — do not auto-mark PASS  
**Local completion:** `docs/implementation/FOUNDATION_R2R1_MATERIAL_RATE_AUTHORITY_COMPLETION.md`  
**Precedence (included in this gate):** `docs/implementation/FOUNDATION_R2R1R1_CONTRACTOR_RATE_PRECEDENCE_COMPLETION.md`  
**Prerequisite:** FOUNDATION-R2 Complete Local (question work). This is a commercial remediation on top of R2.

Stable Preview (after this batch is pushed):  
`https://quotr-2-0-git-hardening-stage-2a-security-quotr1.vercel.app`

Focus: **Deck decking money must follow the lm takeoff when board width is known, and matching contractor rates must outrank Quotr `$/lm`.**

Do not start REQ-1 from this runbook.

Use one hardwood Deck: **16.12 m²**, **140 mm** boards, **10% waste**. Physical takeoff must stay **126.65 lm** (115.14 + 11.51).

---

## TEST A — company $18.50/lm

Set company hardwood **$/lm = $18.50** (All materials). Leave or keep an m² row; it must not add a second money line.

| # | Check | Pass? |
| --- | --- | --- |
| A1 | Quantity **126.65 lm** | |
| A2 | Unit cost **$18.50/lm** | |
| A3 | Rate source **Your company rate** | |
| A4 | Recommended cost **$2,343.03** | |
| A5 | Recommended sell **$2,929.41** at 20% GM (unit sell rounded to $23.13/lm first) | |
| A6 | One Decking materials line only — no m² money line for the same boards | |

---

## TEST B — company $160/m², no company lm

Remove company `$/lm`. Set company hardwood **$/m² = $160** (Work types).

| # | Check | Pass? |
| --- | --- | --- |
| B1 | Quantity still **126.65 lm** | |
| B2 | Unit cost **$22.40/lm** (`$160 × 0.14`) | |
| B3 | Company wins over Quotr $22/lm | |
| B4 | Rate source **Your company rate** plus **$160/m² converted using 140mm board coverage** | |
| B5 | Recommended cost **$2,836.96** · sell **$3,546.20** | |
| B6 | No second m² money line | |

Do not rewrite the persisted m² row.

---

## TEST C — no company Decking rate

Clear company hardwood lm and m².

| # | Check | Pass? |
| --- | --- | --- |
| C1 | Quantity **126.65 lm** | |
| C2 | Quotr **$22 / $34** per lm | |
| C3 | Cost **$2,786.30** · sell **$4,306.10** | |
| C4 | Rate source **Quotr benchmark** (legacy paired; not 20% GM stacked on $34) | |

---

## TEST D — board width unknown

Leave board width unanswered.

| # | Check | Pass? |
| --- | --- | --- |
| D1 | No fake 126.65 lm priced quantity | |
| D2 | Line is **Decking materials package** in m² | |
| D3 | Honest matching m² package (company if set, else Quotr m²) | |
| D4 | Breakdown does not claim a physical board takeoff generated the price | |

---

## TEST E — benchmarks disabled, no company rate

Disable benchmark rates. No company lm or matching m².

| # | Check | Pass? |
| --- | --- | --- |
| E1 | Rate source **Pricing required** (or equivalent explicit fallback) | |
| E2 | No silent Quotr $22/lm | |

---

## Rates UI (light)

| # | Check | Pass? |
| --- | --- | --- |
| R1 | All materials: hardwood **boards**, cost per **linear metre**, **$/lm**, Used now | |
| R2 | Work types: hardwood **per m² of deck area**, fallback — not equivalent to $/lm | |
| R3 | Sheet / backfill m³ / paint litre rows remain **Planned** | |

---

## Regression (light)

| # | Check | Pass? |
| --- | --- | --- |
| G1 | Project Conditions still appear once; Generate still blocked until required PC resolved | |
| G2 | Bathroom / Fence still generate; no absurd new double-uplift | |
| G3 | Deck labour still generates; hours × $/hr remains the labour money | |
| G4 | Framing / fixings / fascia remain separate components | |

Owner records PASS/FAIL. Do not start REQ-1, requirement emission, or Deck Takeoff until authorised.
