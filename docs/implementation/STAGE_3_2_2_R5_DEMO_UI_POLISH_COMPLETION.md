# Stage 3.2.2-R5 — Demo UI Polish Completion

**Status:** Complete Local / Owner Demo Preview Pending  
**Date:** 2026-08-13  
**Branch:** `hardening/stage-2a-security`  
**Baseline:** Stage 3.2.2-R4 (`f177446`)

---

## Changes

### 1. Estimate Review open/close
- **Root cause:** `forceExpanded={… || estimateReviewDetailsOpen}` made collapse impossible; strip only set open=true.
- **Fix:** Toggle existing `estimateReviewDetailsOpen`; `forceExpanded` only for stale; `CollapsibleStageCard.onExpandedChange` syncs close.

### 2. Estimate Review visual
Clear state: light orange tint + warm border/ring. Actionable: stronger amber. Compact footprint retained.

### 3. Mobile Site Notes
Removed nested bordered surfaces on mobile (`data-site-notes-nesting="responsive"`). Persistence unchanged.

### 4. Scope Review copy
Customer-facing subtitle/batchIntro/providerPartialFailure rewritten. No deterministic/structured/contextual jargon in normal UI.

### 5. Project Conditions density
Secondary actions → compact ghost row (`Use assumption`); question padding tightened; semantics unchanged.

### 6. Mobile Quick Estimate
Primary metrics + Prepare final pricing unchanged. Four secondary disclosures wrapped in mobile **Estimate details** (default collapsed). Desktop keeps four. Margin Edit integrated beside Margin metric (`presentation="inline"`).

---

## Boundaries

No commercial formula / Fact / Constraint / SD / migration / 3.2.3 / DNA / PERF-FUTURE-01 work.

## Status map

| Item | Status |
| --- | --- |
| **3.2.2-R5** | **Complete Local / Owner Demo Preview Pending** |
| 3.2.2 overall | In Owner Preview |
| 3.2.3 | Not Started |
| Production SD | Disabled |
| Company DNA | Not Started |
| PERF-FUTURE-01 | Planned |

## Verification

```bash
npx tsx scripts/verify-stage-3-2-2-r5-demo-ui-polish.ts
```

Owner retest: `docs/runbooks/STAGE_3_2_2_R5_OWNER_DEMO_RETEST.md`
