# Stage 3.1B.7F-R6-R1 — Scope Details Eligibility + Specification Completion

**Status:** Complete — Local (Owner Fitout retest Pending)  
**Date:** 2026-08-10  
**Branch:** `hardening/stage-2a-security`  
**Verify:** `scripts/verify-stage-3-1b7fr6r1-scope-details-specification.ts`  
**Retest:** `docs/runbooks/STAGE_3_1B7FR6R1_COMMERCIAL_FITOUT_RETEST.md`

---

## Defects

| ID | Severity | Summary |
| --- | --- | --- |
| FITOUT-R6R1-01 | High | Scope Details showed zero questions / “No additional details are required” |
| FITOUT-R6R1-02 | Medium/High | Budget Specification appeared not to work |

---

## Root causes

### FITOUT-R6R1-01 — Zero Scope Details questions
R6 expanded multi-WA question generation. `createDynamicQuestionBlockIfNeeded` inserted the block first, then all questions in one payload. On insert failure it returned an error **without deleting the empty block**. A retry hit `existingBlocks.length > 0` and reused the **orphan empty block**, advancing to `work_area_questions` with `questions.length === 0` → QuestionBlock empty state.

Secondary hardening: catalogue aliases (`partitions` → `internal_walls`, `linings` → `plastering`) now resolve to question templates so baseline/catalogue identities cannot silently yield empty templates.

### FITOUT-R6R1-02 — Budget “does not work”
Canonical tier model already includes `budget | standard | premium | unknown` (DB check + schema + estimate factors). Client `handleQualityContinue` / `handleQualityEdit` **silently scrolled** to Scope Review when discovery completion was incomplete (R6 CORE baselines add more MUST_CONSIDER / important open items). No error was shown, so selecting Budget felt broken. Additionally, once stage was past Specification, `saveQuality` early-returned success **without** persisting a newly selected tier or healing empty question blocks.

---

## Fixes

1. Detect empty orphan `question_blocks`; delete and recreate.
2. Chunked question inserts; rollback block + rows on failure.
3. Past-spec `saveQuality` persists quality tier; reopens `work_area_questions` **only** when a question block was newly created (`didCreateBlock`). Populated existing blocks do not regress stage. No Scope Discovery rerun.
4. Explicit `setActionError` when Specification is blocked by incomplete Scope Review.
5. Question registry aliases for catalogue baseline identities.

No commercial formula changes. No migration 034.

---

## Canonical specification tiers

| Value | UI | Persist | Estimate |
| --- | --- | --- | --- |
| `budget` | Budget | `projects.quality_level` | `budget_rate_factor` / finish “Budget” |
| `standard` | Standard | same | default / finish “Standard” |
| `premium` | Premium | same | `premium_rate_factor` / finish “Premium” |
| `unknown` | Not sure | same | treated as unspecified |

Budget is **not** silently mapped to Standard.

---

## Boundaries

- Stage 3.2 **not started**
- Company DNA **not started**
- Production Scope Discovery remains **Disabled**
- No migration 034
- Fitout PASS remains Owner-pending

---

## Stage status

| Gate | Status |
| --- | --- |
| R6-R1 local | Complete |
| Fitout Owner retest | **Pending** |
| Stage 3.1B | Open |
| Production Scope Discovery | Disabled |
