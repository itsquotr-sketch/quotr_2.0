# Stage 3.2.2-R2 — Assistant UX Consolidation & Margin Responsiveness

**Status:** Complete Local / Owner Preview Pending  
**Date:** 2026-08-12  
**Branch:** `hardening/stage-2a-security`  
**Baseline:** Stage 3.2.2-R1 (`0f8344d`) after successful Owner Deck R1 Preview retest  

---

## Objective

Contained presentation/responsiveness remediation after Owner Deck R1 findings. Preserve Facts, Constraints, Scope Discovery, Builder Interview, and commercial authority. Do **not** begin Stage 3.2.3.

---

## UX audit findings

| Area | Finding |
| --- | --- |
| Project Conditions | Architecture correct (known + remaining); secondary actions looked like bare links |
| Site Constraints | Primary card already suppressed when BI active; stepper/progress/copy still said “Site Constraints” |
| Information architecture | Completed stages competed visually with Quick Estimate |
| Estimate Review | “Ready” card remained substantial with zero actionable items |
| Margin | Save waited on `router.refresh`/RSC remount before figures updated |
| Save feedback | Project Conditions pattern cleaner than margin spinner-only |

---

## Changes delivered

### A. Project Conditions polish

- Subtle per-question grouping (`bg-muted/25` + light border)
- Hierarchy: question → helper → primary controls → outlined secondary buttons
- Not sure / Use reasonable assumption / Skip for now: `variant="outline"`, subordinate, once each
- Semantics unchanged (assume still deferred)

### B. Site Constraints consolidation (user-facing)

- Stepper + mobile progress: **Project Conditions** when BI path active
- Estimate Review / confidence / action labels remapped to conditions language
- Canonical `constraints` table and legacy ConstraintBlock fallback unchanged

### C–E. Assistant IA / Estimate Review / Quick Estimate

- `CompletedSetupDisclosure` compresses completed setup when estimate exists
- Expand reveals edit/review of underlying stages
- Estimate Review stays prominent when actionable/stale; otherwise folds into setup review
- Quick Estimate rail strengthened when an estimate exists

### F–G. Margin responsiveness + save feedback

**Root cause:** figures only updated after full `router.refresh` remount, after DB write + `revalidatePath`.

**Remediation:**

1. Immediate pending overlay via shared `recalculateSellFromCost` (same sell-from-cost core)
2. Server returns authoritative `marginTotals` from `applyMarginToAmounts` / aggregate
3. Overlay commits to server totals; refresh runs in `startTransition`
4. Failure clears overlay; `marginSaveLockRef` blocks concurrent saves
5. Saving… → Saved acknowledgement

### H. Performance

- Marks: `margin_save_ack`, `margin_save_complete`
- Deeper Analyse Job / RSC work remains **PERF-FUTURE-01**

### I. Commercial

- R1 `getCombinedLabourAccessFactor` single-consume preserved (verified)

---

## Migrations

**Zero.**

---

## Status map

| Item | Status |
| --- | --- |
| 3.2.2-R1 | Owner Deck findings received (retest PASS) |
| **3.2.2-R2** | **Complete Local / Owner Preview Pending** |
| 3.2.2 overall | In Owner Preview |
| 3.2.3 | Not Started |
| Company DNA | Not Started |
| Production Scope Discovery | Disabled |
| PERF-FUTURE-01 | Planned (R2 evidence recorded) |

---

## Verification

```bash
npx tsx scripts/verify-stage-3-2-2-r2-ux-margin-responsiveness.ts
```

Owner Preview retest: `docs/runbooks/STAGE_3_2_2_R2_OWNER_PREVIEW_RETEST.md`
