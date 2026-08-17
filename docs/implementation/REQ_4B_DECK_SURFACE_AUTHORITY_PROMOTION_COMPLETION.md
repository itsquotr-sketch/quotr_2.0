# REQ-4B Deck Surface Authority Promotion — Completion

**Status:** COMPLETE LOCAL / OWNER COMMERCIAL REVIEW PENDING  
**Date:** 2026-08-18  
**Branch:** `hardening/stage-2a-security`  
**Verify:** `npx tsx scripts/verify-req-4b-deck-surface-authority-promotion.ts`

First controlled commercial authority promotion in Quotr. **Only** Deck `decking.surface` moved from **SHADOW** → **REQUIREMENT_AUTHORITATIVE**. Deck `deck.labour` remains **SHADOW**. No migration 037. No remote apply. No commit/push in this batch.

---

## What landed

- Registry promotion: `decking.surface` = **REQUIREMENT_AUTHORITATIVE** (SEMANTIC_REIMPLEMENTATION)
- Central composer: `lib/estimate/component-commercial-selection.ts`
- Requirement → line adapter: `lib/estimate/requirement-commercial-line.ts`
- Generation active source on estimate result + optional snapshot `commercialSources[]`
- **LEGACY_FALLBACK_CONTRACT** activated (generation-level only; policy stays requirement-authoritative)
- Legacy Deck surface calculator path retained for reconciliation/fallback
- `generationRequiresRequirementSnapshot()` = **true** after promotion
- Owner commercial gate runbook: `docs/runbooks/REQ_4B_OWNER_COMMERCIAL_GATE.md`

## What did not land

- No `deck.labour` promotion
- No other Deck components promoted
- No other Work Area promotion
- No DECK-1/2/3
- No Materials/Labour UI
- No formula/rate/margin changes
- No Pricing/Quote pipeline redesign
- No migration 037
- No remote deploy / Production SD enable

## Commercial parity (semantic fixtures)

| Fixture | Before (legacy) | After (requirement active) | Active source |
| --- | ---: | ---: | --- |
| Quotr $22/lm · 126.65 lm | $2,786.30 | $2,786.30 | REQUIREMENT |
| Company $18.50/lm | $2,343.03 | $2,343.03 | REQUIREMENT |
| Company $160/m² → $22.40/lm | $2,836.96 | $2,836.96 | REQUIREMENT |
| Width unknown | package line | package line | LEGACY_FALLBACK |
| Unpriced lm (no rates) | legacy package | legacy package | LEGACY_FALLBACK |

Deck 1 whole-estimate sell golden: **$48,340** unchanged.

## Architecture notes

- **Policy ≠ generation source:** registry stays REQUIREMENT_AUTHORITATIVE while a generation may use LEGACY_FALLBACK.
- **No double count:** requirement replaces legacy money; legacy candidates kept on `legacyCommercialCandidates` for shadow reconciliation.
- **Pricing/Quote:** still consume estimate lines only.
- **Snapshot:** `commercialSources[]` records active source + costs per promoted component.

## REQ-4 close assessment

After Owner commercial validation, REQ-4 framework is proven with one successful component migration. Recommend closing REQ-4 (not promoting labour merely to finish). Next stage: **DECK-1** (not started).
