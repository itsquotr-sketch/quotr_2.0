# REQ-4B Owner Commercial Gate

**Status:** OWNER REVIEW REQUIRED  
**Date:** 2026-08-18  
**Batch:** REQ-4B — first live component authority promotion  
**Verify locally:** `npx tsx scripts/verify-req-4b-deck-surface-authority-promotion.ts`

Do **not** commit/push/deploy from this gate. Review **same commercial result, different authority**.

---

## Promotion scope

| Component | Before | After |
| --- | --- | --- |
| `decking.surface` | SHADOW | **REQUIREMENT_AUTHORITATIVE** |
| `deck.labour` | SHADOW | SHADOW (unchanged) |
| All other components | LEGACY_AUTHORITATIVE | unchanged |

---

## A. Company $18.50/lm (126.65 lm purchase)

| | Before (legacy line) | After (requirement active) |
| --- | ---: | ---: |
| Quantity | 126.65 lm | 126.65 lm |
| Cost | $2,343.03 | $2,343.03 |
| Sell | unchanged paired/margin behaviour | unchanged |
| Active source | legacy calculator | **REQUIREMENT** |
| Requirement candidate | $2,343.03 | $2,343.03 |
| Legacy candidate | $2,343.03 (reconciliation only) | suppressed from money |

---

## B. Company $160/m² converted ($22.40/lm)

| | Before | After |
| --- | ---: | ---: |
| Quantity | 126.65 lm | 126.65 lm |
| Cost | $2,836.96 | $2,836.96 |
| Conversion | company m² → lm | preserved in snapshot requirement |
| Waste | once (10%) | once |
| Active source | legacy | **REQUIREMENT** |
| Benchmark override | none | none |

---

## C. Quotr benchmark $22/lm

| | Before | After |
| --- | ---: | ---: |
| Cost | $2,786.30 | $2,786.30 |
| Sell | paired benchmark series | same sell semantics |
| Active source | legacy | **REQUIREMENT** |
| Deck 1 golden sell | $48,340 | $48,340 |

---

## D. Width unknown / fallback

| | Behaviour |
| --- | --- |
| Requirement | absent (honest — no fake lm) |
| Active source | **LEGACY_FALLBACK** |
| Commercial line | Decking materials **package** (m²) |
| Policy registry | still REQUIREMENT_AUTHORITATIVE |

---

## E. Missing rate (unpriced requirement)

| | Behaviour |
| --- | --- |
| Requirement | physical lm known, `priced=false`, `totalCost=null` |
| Active source | **LEGACY_FALLBACK** (`unpriced_requirement`) |
| Commercial line | legacy package path (not requirement-derived $0) |
| Double count | none |

---

## F. Project margin override

| | Behaviour |
| --- | --- |
| Requirement cost | unchanged when margin changes |
| Sell | derived downstream via existing margin engine |
| Cost-first | preserved |

---

## Owner checklist

- [ ] Same cost/sell on A/B/C semantic fixtures
- [ ] No double-count on promoted surface
- [ ] Fallback D/E safe (no silent requirement $0 line)
- [ ] Deck 1 golden $48,340 unchanged
- [ ] `deck.labour` still line-money authority
- [ ] Pricing/Quote paths unchanged (estimate lines only)
- [ ] Snapshot shows authority + active source + requirement evidence
- [ ] Local atomic persist + rollback proof acceptable
- [ ] Approve commit/push/deploy separately (not in REQ-4B batch)

---

## Exact next action after approval

1. Owner approves commercial gate  
2. Commit with proposed message below  
3. Push + remote Preview validation (remote still SHADOW until deploy)  
4. Assess closing REQ-4; plan **DECK-1** (do not start in same batch)

**Proposed commit message:**  
`Promote Deck surface to requirement-authoritative commercial money (REQ-4B).`
