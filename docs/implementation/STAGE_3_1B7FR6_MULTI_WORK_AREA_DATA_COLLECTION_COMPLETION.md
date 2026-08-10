# Stage 3.1B.7F-R6 — Multi-Work-Area Data Collection Completion

**Status:** Complete — Local (Owner Commercial Fitout retest Pending)  
**Date:** 2026-08-10  
**Branch:** `hardening/stage-2a-security`  
**Verify:** `scripts/verify-stage-3-1b7fr6-multi-work-area-data-collection.ts`  
**Audit:** `docs/audits/STAGE_3_1B7FR6_MULTI_WORK_AREA_QUESTION_COVERAGE_AUDIT.md`  
**Retest:** `docs/runbooks/STAGE_3_1B7FR6_COMMERCIAL_FITOUT_RETEST.md`

---

## Intent

Owner Commercial Fitout E2E exposed **systemic multi-Work-Area** gaps (sparse baselines, capped questions, duplicate project-wide asks, non-actionable QE Review, hazmat wording, save latency). R6 fixes the **common architecture** so Deck, Bathroom, Fitout, and future multi-scope jobs behave coherently. This is **not** a Fitout-only workflow.

---

## Root causes

| ID | Cause |
| --- | --- |
| FITOUT-R6-01 | Fitout catalogue emphasised dependencies (services/seismic/waste) without concise CORE baselines under confirmed WAs |
| FITOUT-R6-02 | `MAX_QUESTIONS = 12` silently dropped later WA required questions on first pass |
| FITOUT-R6-03 | WA templates re-asked access / carting / noise / disposal already answered project-wide |
| FITOUT-R6-04 | Hazmat option **None known** ambiguous vs Not sure |
| FITOUT-R6-05 | Attention Review targeted questions stage / lacked precise DOM; button shown without mappable control |
| FITOUT-R6-06/07 | Sequential Fact commits; constraint path refresh without transition |

---

## Fixes shipped

1. **CORE baseline catalogue** (`commercial-fitout.ts`, catalogue **v2**) — framing/lining, ceiling system/trims, door hardware/frames, flooring prep/finish, painting prep/coats, plastering stopping/sanding, demolition handling. Project-level linings suppressed when partitions accepted.
2. **Question generation** — all required included; soft-cap optionals only; Fact-first project-wide suppression; internal walls framing required.
3. **Hazmat** — “No known hazardous material risk” distinct from “Not sure”.
4. **Actionable Review** — attention carries `workAreaId` / `factKey` / `questionId`; Review → Estimate Review / Scope Details editors; scroll `[data-question-id|key|work-area-id]` + focus; unmapped → “More information required” **without** Review.
5. **Disclosure** — incomplete WAs/groups default open (existing R5 multi-group expand retained).
6. **Save performance** — parallel `Promise.all` answer commits; constraint single-edit `startTransition(router.refresh)`.
7. **Bathroom access fallback** — WA access Fact preferred; project `site_access` fallback for Bathroom labour factor only (no double-apply on demolition labour adjustment path).

Batch/section save deferred (document future): current architecture remains per-answer with parallelised commits + prompt Saved ack.

---

## Performance notes (honest)

| Path | Dominant delay | R6 change |
| --- | --- | --- |
| Question answer save | Sequential Fact writes + derived + scope recompute + refresh | Parallel commits; retain latest-write semantics |
| Site Constraint save | Persist + `router.refresh` remount | `startTransition` refresh for single edits |
| Attention → Review | Wrong stage / scroll start | Precise targets + nearest |

No fake SLOs. Owner captures Preview timings on Fitout retest.

Instrumentation continues via existing `preview-performance` / save ack marks (`question_save_ack` / `question_save_complete`).

---

## Boundaries (confirmed)

- Stage 3.2 **not started**
- Company DNA **not started**
- Production Scope Discovery remains **Disabled**
- No migration 034
- No commercial formula changes except Bathroom Restricted access factor recognition already shipped under BATH-CD-01 (not reopened here)
- No Production Scope Discovery enablement

---

## Stage status

| Gate | Status |
| --- | --- |
| R6 local | Complete |
| Fitout Owner Preview retest | **Pending** — do not close Stage 3.1B |
| Deck R5 Owner retest | Pending (separate) |
| Bathroom | FUNCTIONAL PASS |
| Production Scope Discovery | Disabled |
