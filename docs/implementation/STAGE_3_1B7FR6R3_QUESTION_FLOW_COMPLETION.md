# Stage 3.1B.7F-R6-R3 — Stable Scope Details Question Flow Completion

**Status:** Complete — Local (Owner Fitout retest Pending)  
**Date:** 2026-08-10  
**Branch:** `hardening/stage-2a-security`  
**Verify:** `scripts/verify-stage-3-1b7fr6r3-question-flow.ts`  
**Retest:** `docs/runbooks/STAGE_3_1B7FR6R3_QUESTION_FLOW_RETEST.md`

---

## Defect

| ID | Severity | Summary |
| --- | --- | --- |
| FITOUT-R6R3-01 | Medium | Incomplete Scope Details groups auto-collapse after individual answer saves |

---

## Root cause

Category expand state in `QuestionBlock` / `WorkAreaSection` was continuously derived from `defaultExpandedQuestionCategories(...)` (live completeness). As soon as a category’s required questions were satisfied — or on remount after save when local `manualExpanded` reset — the group left the preferred set and collapsed (`return false`), even while the user was still working in that section.

Automatic preference was treated as a live controller, not an initial default.

---

## Fix (presentation only)

1. Sticky-open set: incomplete categories are added on first sight; **never auto-removed** on completion.
2. Manual expand/collapse outranks sticky and preferred.
3. Disclosure state lifted to `QuestionBlock` with stable keys `workAreaId::category`.
4. Work Area section keys use `workAreaId` (stable across saves).
5. Review focus pins target category open via `focusQuestionId` / `focusQuestionKey`.
6. Estimate Review WA details use the same sticky-open idea for outstanding items.

No Fact authority, eligibility, calculator, Scope Discovery, or migration changes.

---

## Boundaries

- Stage 3.2 **not started**
- Production Scope Discovery **Disabled**
- Fitout PASS remains Owner-pending
