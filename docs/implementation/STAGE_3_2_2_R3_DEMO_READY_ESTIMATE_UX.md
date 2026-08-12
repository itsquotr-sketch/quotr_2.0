# Stage 3.2.2-R3 — Demo-Ready Final Estimate UX

**Status:** Complete Local (superseded for final-state UX by R4; hierarchy retained)  
**Date:** 2026-08-13  
**Branch:** `hardening/stage-2a-security`  
**Baseline:** Stage 3.2.2-R2 (`b6fb90e`)

---

## Objective

Targeted final-state UX / mobile / demo-readiness pass before first prospective trial demos. Preserve all functionality via progressive disclosure. Do **not** begin Stage 3.2.3.

---

## Completed-state UX audit

| Area | Before (R2) | After (R3) |
| --- | --- | --- |
| Hierarchy | Setup disclosure competed with QE | QE primary → Estimate Review → Project Setup |
| Empty Estimate Review | Could still appear as Ready card in expand | Compact **Estimate review ✓ Clear** strip only |
| Actionable review | Mixed with setup cards | Dedicated strip above setup + Review CTAs |
| Mobile QE | Collapsed to sell · confidence | Always shows sell/range/cost/margin/confidence + Prepare final pricing |
| Labour-rate tip | Full banner above Assistant | Compact **Improve future estimates** below Assistant after estimate |

---

## Changes

### Estimate Review summary

`EstimateReviewSummaryStrip` — reuses `buildQuickEstimateAttentionItems` + `attentionShowsReviewButton`. No second review authority.

### Project Setup

Collapsed default; **View setup** expand; does not nest clear Estimate Review.

### Labour-rate guidance

`SetupGuidanceBanner` compact mode when `hasEstimate`; rendered after Assistant on project page.

### CTA discipline

Prepare final pricing remains the primary orange action; View quote / Open final pricing outline.

### Boundaries

No commercial formula changes · no migrations · R2 margin path preserved · R1 access single-consume preserved · Production SD disabled · DNA not started · PERF-FUTURE-01 Planned (no extra DB/fetch added — presentation from loaded state).

---

## Status map

| Item | Status |
| --- | --- |
| **3.2.2-R3** | **Complete Local / Owner Demo Preview Pending** |
| 3.2.2 overall | In Owner Preview |
| 3.2.3 | Not Started |
| Production SD | Disabled |
| Company DNA | Not Started |
| PERF-FUTURE-01 | Planned |

## Verification

```bash
npx tsx scripts/verify-stage-3-2-2-r3-demo-ready-estimate-ux.ts
```

Owner demo retest: `docs/runbooks/STAGE_3_2_2_R3_OWNER_DEMO_READINESS_RETEST.md`
