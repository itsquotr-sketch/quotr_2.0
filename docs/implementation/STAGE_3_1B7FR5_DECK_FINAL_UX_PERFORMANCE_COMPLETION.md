# Stage 3.1B.7F-R5 — Deck Final UX & Performance Completion

**Status:** Complete — Local (Owner Preview retest Pending)  
**Date:** 2026-08-10  
**Branch:** `hardening/stage-2a-security`  
**Verify:** `scripts/verify-stage-3-1b7fr5-deck-final-ux-performance.ts`  
**Retest:** `docs/runbooks/STAGE_3_1B7FR5_DECK_FINAL_RETEST.md`

---

## Root causes

### Work Area latency (DECK-R5-01)
`confirmWorkAreas` **awaited** full Scope Discovery (provider + source collection) before returning, so Confirm showed “Saving…” for the entire discovery duration. Secondary tax: dashboard+project revalidate and stage-keyed shell remount after refresh.

Analyse Job remains dominated by Anthropic extract + serial fact/constraint writes + RSC remount (documented; not redesigned).

### Estimate latency (DECK-R5-02)
No AI. Perceived delay mainly from post-persist `router.refresh()` + stage remount to `estimate_ready`. Generation already acknowledged immediately. Project-only revalidate retained/confirmed on estimate path.

### False clarification (DECK-R5-05)
`needsDetailCount` was fed into `outstandingClarificationCount`, producing “1 open clarification” and Review→Scope Review even when Scope Details was the real surface (or already resolved). Unmapped frozen pending reasons could also stick as NEEDS_DETAIL.

### Review scroll (DECK-R5-06)
`scrollIntoView({ block: "start" })` against often-collapsed Scope Details (completed card lacked `questionsCardRef`).

---

## Fixes shipped

1. **WA confirm** — return after persist; ScopeDiscoveryReviewBlock UI auto-run owns discovery; project-only revalidate; “Saving Work Areas…” copy.
2. **QE attention** — `outstandingClarificationCount: 0` from needs-detail; named `pendingScopeDetailTitles` → Scope Details attention; unmapped pending no longer sticky NEEDS_DETAIL.
3. **Review** — force-expand Scope Details; `block: "nearest"`; ref on completed card.
4. **Scope Details disclosure** — all groups with unresolved required questions expand by default; category badges show “N question(s) remaining” / “✓ Complete”.
5. **Constraint fallback** — intro + existing static taxonomy when none known; no fabricated values.

---

## Performance notes (honest)

| Path | Dominant source | R5 change |
| --- | --- | --- |
| Analyse Job | Provider | Documented; batching remount left for later |
| Confirm Work Areas | Was blocked on discovery provider | Unblocked — discovery is next stage pending |
| Scope Discovery | Provider | Unchanged; progress banner on Scope Review |
| Quick Estimate | Client refresh/remount + DB persist | Immediate Generating ack; project-only revalidate |

Do not invent SLOs. Capture Owner Preview timings in performance results during retest.

---

## Boundaries

- No migration 034  
- No commercial formula changes  
- No Stage 3.2 / Company DNA  
- Production Scope Discovery remains Disabled  
- Automatic Scope Review after WA confirm preserved (UI-owned)
