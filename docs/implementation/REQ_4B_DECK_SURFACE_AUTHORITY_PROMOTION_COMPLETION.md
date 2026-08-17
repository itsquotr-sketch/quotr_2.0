# REQ-4B Deck Surface Authority Promotion — Completion

**Status:** COMPLETE / REMOTE VALIDATED  
**Date:** 2026-08-18  
**Branch:** `hardening/stage-2a-security`  
**Commit:** `f99dbece0cdca9acccf66314b11a08ae4a97941f`  
**Verify local:** `npx tsx scripts/verify-req-4b-deck-surface-authority-promotion.ts` (61/0)  
**Verify remote:** `npx tsx scripts/verify-req-4b-remote-preview-authority-proof.ts` (28/0)

First controlled commercial authority promotion in Quotr. **Only** Deck `decking.surface` moved from **SHADOW** → **REQUIREMENT_AUTHORITATIVE**. Deck `deck.labour` remains **SHADOW**. No migration 037. Remote migrations remain **001–036** on `lxvnylhsbvudzzupxeqr`. **No Production application deploy.**

---

## What landed

- Registry promotion: `decking.surface` = **REQUIREMENT_AUTHORITATIVE** (SEMANTIC_REIMPLEMENTATION)
- Central composer: `lib/estimate/component-commercial-selection.ts`
- Requirement → line adapter: `lib/estimate/requirement-commercial-line.ts`
- Generation active source on estimate result + snapshot `commercialSources[]`
- **LEGACY_FALLBACK_CONTRACT** activated (generation-level only)
- One-source commercial invariant enforced (`assertNoDuplicateActiveComponents`)
- `generationRequiresRequirementSnapshot()` = **true**
- Remote disposable org proof: **REQ-4B-PROOF** (cascade-deleted after validation)

## Remote proof summary (2026-08-18)

| Check | Result |
| --- | --- |
| Benchmark cost $2,786.30 / sell $4,306.10 | PASS |
| Company lm $2,343.03 | PASS |
| `commercialSources` → REQUIREMENT | PASS |
| `componentAuthorities` → REQUIREMENT_AUTHORITATIVE | PASS |
| Width unknown → LEGACY_FALLBACK | PASS |
| Atomic rollback (missing snapshot) | PASS |
| Pricing one `decking.surface` item | PASS |
| `deck.labour` SHADOW | PASS |

Unpriced remote case: **not exercised remotely** (would require unsafe shared company rate changes). Local verifier remains authoritative for unpriced fallback.

Deck 1 golden $48,340: **local regression PASS** (canonical fixture).

## Commercial parity (semantic fixtures)

| Fixture | Cost | Sell | Active source |
| --- | ---: | ---: | --- |
| Quotr $22/lm · 126.65 lm | $2,786.30 | $4,306.10 | REQUIREMENT |
| Company $18.50/lm | $2,343.03 | legacy parity | REQUIREMENT |
| Company $160/m² → $22.40/lm | $2,836.96 | legacy parity | REQUIREMENT |
| Width unknown | package | package | LEGACY_FALLBACK |
| Unpriced lm (local) | legacy package | legacy package | LEGACY_FALLBACK |

## REQ-4 programme

**REQ-4 = COMPLETE / COMPONENT AUTHORITY MIGRATION VALIDATED**

Requirement foundation implementation: **COMPLETE**. Next stage: **DECK-1** (READY / NOT STARTED).
