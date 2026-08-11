# Stage 3.1B.7F-R6-R4.1 — Scope-Level Attention Review Routing

**Status:** Complete — Local / Deploying  
**Date:** 2026-08-11  
**Branch:** `hardening/stage-2a-security`  
**Verify:** `scripts/verify-stage-3-1b7fr6r4-attention-routing.ts`  
**Retest:** `docs/runbooks/STAGE_3_1B7FR6R4_FINAL_FITOUT_RETEST.md` (R4.1 steps)

---

## Prior R6-R4 deployment

R6-R4 (`b0716c5`) **was** committed, pushed, and Ready on the stable Preview alias before this batch. Owner feedback is a follow-on UX correction (R4.1), not a missed deploy of R6-R4.

---

## Defect

| ID | Severity | Summary |
| --- | --- | --- |
| FITOUT-R6R4-01 | Medium/High | (R6-R4) Fake Scope Details Review without target |
| FITOUT-R6R41-01 | Medium/High | Scope-level attention (e.g. Seismic) lacked a useful Review action |

---

## Seismic classification

`fitout.ceilings.seismic` → **SCOPE_EXISTENCE** (not SCOPE_DETAIL questionnaire).

- No Scope Details question invented
- PROPOSED → Quick Estimate **SCOPE** attention: “Review scope” + Review → Scope Review row
- Explicit INCLUDE (no answerable question) → resolved (not endless NEEDS_DETAIL)
- Explicit EXCLUDE → resolved
- Batch confirm uses `scope_item_included` when no answerable detail question

---

## Attention contract

| Kind | Copy | Review |
| --- | --- | --- |
| QUESTION | Review in Scope Details | Requires questionId |
| SCOPE | Review scope | Scope Review (+ suggestionId / WA) |
| ASSUMPTION / PRICING_REQUIRED | Allowance / confirmation required | No fake Scope Details CTA |
| NON_ACTIONABLE_INFORMATION | More information required | None |

---

## Boundaries

- Stage 3.2 **not started**
- Production Scope Discovery **Disabled**
- No migration / formula change
- PERF-FUTURE-01 remains Planned only
