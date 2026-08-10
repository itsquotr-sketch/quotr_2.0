# Stage 3.1B.7F-R6-R2 — Question Input-Type Contract Completion

**Status:** Complete — Local (Owner Fitout retest Pending)  
**Date:** 2026-08-10  
**Branch:** `hardening/stage-2a-security`  
**Verify:** `scripts/verify-stage-3-1b7fr6r2-question-input-contract.ts`  
**Retest:** `docs/runbooks/STAGE_3_1B7FR6R2_COMMERCIAL_FITOUT_RETEST.md`

---

## Defect

| ID | Severity | Summary |
| --- | --- | --- |
| FITOUT-R6R2-01 | Critical/High | Question-block creation fails: app `input_type` violates `questions_input_type_check` |

---

## Root cause

DB CHECK from `supabase/migrations/002_assistant_schema.sql` allows only:

`number` | `select` | `boolean` | `text`

Application templates (and UI) include presentation type `multi_select`. R6 removed the 12-question cap, so Fitout inserts include required `demolition.scope_items` (`multi_select`, priority 5) plus optional `painting.surfaces` / bathroom fixtures. Postgres rejected the insert with a raw check-constraint error.

No later migration altered this CHECK. Not an enum — CHECK constraint only.

---

## Exact failing emitters (illegal persisted value)

| Key | Work area | Label | App `inputType` | Illegal if persisted as-is |
| --- | --- | --- | --- | --- |
| `demolition.scope_items` | Demolition | Demolition scope | `multi_select` | Yes — primary Fitout blocker |
| `painting.surfaces` | Painting | Surfaces | `multi_select` | Yes when emitted |
| `bathroom.fixtures_included` | Bathroom | (fixtures) | `multi_select` | Bathroom path; same contract |

R6 Fitout-specific questions (framing, ceilings, doors, flooring, painting location/coats, plastering, hazmat) already used DB-legal types (`select` / `number` / `boolean`).

---

## Fix (no migration 034)

1. Shared contract: `lib/scopes/question-input-types.ts`
2. Persist `multi_select` as DB `text` while keeping `options`
3. Rehydrate UI via **template identity** (`getQuestionTemplateByKey` → `template.inputType`); do **not** promote ordinary `text` rows to multi_select from options alone
4. Preserve multi-select answers as JSON string arrays through `parseAnswerValue` / storage helpers (comma-string still accepted for back-compat; UI order follows option list)
5. Pre-insert `validateQuestionInputType(s)` — fail before DB with safe user copy
6. Sanitize check-constraint / Postgres-shaped errors via `toQuestionBlockUserError`
7. R6-R1 orphan heal + chunk rollback retained

Migration 034 **not** required: multi-select behaviour is representable with existing DB types + presentation mapping.

---

## Boundaries

- Stage 3.2 **not started**
- Company DNA **not started**
- Production Scope Discovery remains **Disabled**
- No commercial formula changes
- Fitout PASS remains Owner-pending

---

## Stage status

| Gate | Status |
| --- | --- |
| R6-R2 local | Complete |
| Fitout Owner retest | **Pending** |
| Stage 3.1B | Open |
| Production Scope Discovery | Disabled |
