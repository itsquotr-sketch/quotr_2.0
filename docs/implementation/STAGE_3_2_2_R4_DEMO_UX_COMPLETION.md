# Stage 3.2.2-R4 — Demo UX Completion

**Status:** Complete Local (superseded for demo polish by R5; hierarchy retained)  
**Date:** 2026-08-13  
**Branch:** `hardening/stage-2a-security`  
**Baseline:** Stage 3.2.2-R3 (`07785dd` / `6c24031`)

---

## Audit findings

### What Estimate Review previously exposed (pre-R3)

`ScopeSummaryBlock` + `buildEstimateReviewWorkAreaSummary` / `buildEstimateReviewSummaryModel` showed:

- Work area description / measurements
- Included scope + details confirmed
- Assumptions count
- Project conditions / site constraints preview
- Outstanding items + readiness

### What R3 changed

Compressed completed-state Estimate Review to:

- Clear: “Estimate review ✓ Clear / No outstanding items”
- Actionable: attention list + Review CTAs

This fixed hierarchy (QE primary) but removed the glanceable “what Quotr understood” context.

### What was useful vs redundant

| Useful | Redundant if restored naively |
| --- | --- |
| WA / included scope inventory | Full Ready card competing with QE |
| Key scope titles | Full Included/Not required editors |
| Conditions + assumptions counts | Nesting clear Review inside Project Setup |
| Outstanding attention (kept in R3) | Commercial sell/cost/margin in Review |

### R4 restore (concise only)

Presentation helper `buildEstimateReviewCompactOverview` feeds `EstimateReviewSummaryStrip` from already-loaded Assistant state:

- Work area headline (single name or “N work areas”)
- Scope inventory line
- Truncated key scope titles (+N)
- Truncated project condition chips (+N)
- Assumptions count
- Attention list when actionable

Canonical sources only: `workAreaLists`, `composedScopeState.summaryLists.included`, scope-review facts, `constraintChips`, assumptions, `buildQuickEstimateAttentionItems`.

---

## Owner findings addressed

1. **Richer Estimate Review** — clear + actionable overview without commercial metrics  
2. **Project Setup stays collapsed** — R3 hierarchy preserved  
3. **Mobile Site Notes** — progressive disclosure (`+ Add site notes`)  
4. **Ready-to-generate** — one-shot mobile expand + `scrollIntoView({ block: "nearest" })`  
5. **Mobile stepper spacing** — progress → grid gap increased (`mt-3`, `space-y-3` mobile)

---

## Boundaries

No commercial formula changes · no Fact/Constraint authority changes · no Scope Discovery behaviour changes · no migrations · no Company DNA · no 3.2.3 · PERF-FUTURE-01 remains Planned.

---

## Status map

| Item | Status |
| --- | --- |
| **3.2.2-R4** | **Complete Local / Owner Demo Preview Pending** |
| 3.2.2 overall | In Owner Preview |
| 3.2.3 | Not Started |
| Production SD | Disabled |
| Company DNA | Not Started |
| PERF-FUTURE-01 | Planned |

## Verification

```bash
npx tsx scripts/verify-stage-3-2-2-r4-demo-ux-completion.ts
```

Owner retest: `docs/runbooks/STAGE_3_2_2_R4_OWNER_DEMO_RETEST.md`
