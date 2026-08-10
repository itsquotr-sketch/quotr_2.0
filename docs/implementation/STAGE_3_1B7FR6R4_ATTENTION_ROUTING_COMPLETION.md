# Stage 3.1B.7F-R6-R4 — Actionable Attention Routing Completion

**Status:** Complete — Local (Owner Fitout retest Pending)  
**Date:** 2026-08-11  
**Branch:** `hardening/stage-2a-security`  
**Verify:** `scripts/verify-stage-3-1b7fr6r4-attention-routing.ts`  
**Retest:** `docs/runbooks/STAGE_3_1B7FR6R4_FINAL_FITOUT_RETEST.md`

---

## Defect

| ID | Severity | Summary |
| --- | --- | --- |
| FITOUT-R6R4-01 | Medium/High | Quick Estimate seismic attention said “Review in Scope Details” with no Review action |

---

## Root cause

1. Catalogue relationship `fitout.ceilings.seismic` routes to Fact `fitout.ceiling_seismic`.
2. **No** Scope Details question template exists for that Fact (and no calculator reads it).
3. Included + `included_pending_detail` kept the item as `NEEDS_DETAIL` → pending title “Seismic interfaces”.
4. Attention builder defaulted `actionable !== false` and used copy “Review in Scope Details” even without `questionId`.
5. EstimatePanel Review CTA required `questionId` **or** specific targets — `reviewTarget: "questions"` without `questionId` rendered **no button**.
6. Secondary bug: `actionable = matched || hasEditors` could falsely mark unmatched labels actionable when the WA had other questions.

---

## Fix (presentation / routing only)

**Classification (outcome B):** seismic is **not** question-actionable — no invented engineering question.

1. Attention contract: `Review in Scope Details` **only** when `questionId` present; otherwise honest non-actionable / allowance copy.
2. `attentionShowsReviewButton` invariant used by EstimatePanel.
3. `hasEditors` false-positive removed — match concrete question only.
4. Pending-detail composition: Fact keys without a question template do not stay `NEEDS_DETAIL` (same spirit as R5 unmapped pending).

No migration, formula, Scope Discovery enablement, or eligibility redesign.

---

## Attention contract (kinds)

| Kind | Typical copy | Review |
| --- | --- | --- |
| QUESTION | Review in Scope Details | Required + target |
| SCOPE | Open clarification / awaiting confirmation | Scope Review |
| PRICING_REQUIRED / ASSUMPTION | Allowance / confirmation required | No fake Scope Details CTA |
| NON_ACTIONABLE_INFORMATION | More information required | None |

---

## Latency backlog

Recorded as **PERF-FUTURE-01** (not a 3.1B release blocker):  
`docs/performance/ASSISTANT_RESPONSIVENESS_LATENCY_OPTIMISATION_PASS.md`

---

## Verification

- `npx tsx scripts/verify-stage-3-1b7fr6r4-attention-routing.ts` — PASSED (16)
- `npx tsc --noEmit` — PASSED
- `npm run lint` — PASSED
- `npm run build` — PASSED

## Regression

| Suite | Result |
| --- | --- |
| R6-R4 | PASSED |
| R6-R3 | PASSED |
| R6-R2 | PASSED |
| R6-R1 | PASSED |
| R6 | PASSED |
| R5 | PASSED |
| R4 | PASSED |
| R3 | PASSED |
| R2 | PASSED |
| R1 | PASSED |
| 7G | PASSED |
| 3.1A / 3.1A-R1 | PASSED |
| 3.1D | PASSED |
| Bathroom commercial detail | PASSED |
| RLS coverage | PASSED |
| 2B.10 | PASSED |
| 3.1C smoke (1A/1B/2A) | PASSED |

## Status gates

| Gate | Status |
| --- | --- |
| Fitout | **Owner retest Pending** (local Fixed) |
| Stage 3.1B | Open — do not close until Owner final retest |
| Stage 3.2 | Not started |
| Production Scope Discovery | Disabled |

Proposed commit (when requested):

```
fix(ui): require Review targets for Scope Details attention (7F-R6-R4)
```
