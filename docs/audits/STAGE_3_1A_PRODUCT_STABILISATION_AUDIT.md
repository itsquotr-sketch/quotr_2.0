# Stage 3.1A — Product Stabilisation Audit

**Status:** Complete (pre-implementation)  
**Date:** 2026-08-05  
**Scope:** BUG-001–004, UX-001–005  
**Constraint:** No fixes based on assumptions; code-traced only  

---

## BUG-001 — Substructure answer reported as missing

### Relevant files
- `lib/scopes/templates/deck.ts` — `deck.substructure_condition` options
- `lib/scopes/fact-labels.ts` — `isNotSureValue`, `formatFactValueForDisplay`
- `lib/scopes/fact-values.ts` — duplicated `NOT_SURE_VALUES`
- `lib/scopes/questions.ts` — `isTemplateFactMissing`
- `lib/scopes/conditional-rules.ts` — `isQuestionAnswered`, visibility
- `lib/assistant/missing-questions.ts`, `lib/assistant/mappers.ts`, `lib/assistant/state.ts`
- `components/assistant/ScopeSummaryBlock.tsx`, `ScopeReviewMissingSection.tsx`

### Functions / actions
- `isNotSureValue`, `isTemplateFactMissing`, `isQuestionAnswered`
- `buildMissingItems` / scope review enrichment
- `saveQuestionBlockAnswers` → `ensureMissingDetailsQuestionBlock`

### Data flow
Template options → facts / question answers → `isTemplateFactMissing` → `missingItems` badge → optional active question editor.

### Source of truth
- Answered value: `project_facts` (wins) + `questions.answer_value`
- Missing badge: `isTemplateFactMissing` over facts (not merely “row has value”)

### Mutation path
`ScopeReviewMissingSection` → `handleSaveWorkAreaQuestions` → `saveQuestionBlockAnswers` → questions + project_facts → derived facts → ensure missing → stale → revalidate → `router.refresh()`

### Validation / ownership
Zod UUID + union value; org-scoped project load; RLS.

### Revalidation / cache
`revalidatePath` dashboard + project; full RSC refresh; Scope Review remounts on question key change.

### Latency / bottleneck
Not primary for BUG-001; see BUG-002.

### Root cause (verified)
`"unknown"` is both a **listed select option** and a global **not-sure token**. For optional templates, `isTemplateFactMissing` returns true when `factHasValue && isNotSureValue`. Saving `unknown` therefore:

1. Persists successfully
2. Removes the active unanswered editor (value present)
3. Keeps “Substructure condition” in `missingItems`
4. Displays as “Not sure” / suppresses fact chip

No key/name mismatch for `deck.substructure_condition` (`key === factKey`).

### Smallest safe correction
Treat values that are **explicit listed select options** as deliberate answers except true not-sure tokens (`Not sure`, `not_sure`, `unsure`). Add canonical `none` (UX-002). Do not remove `"unknown"` from free-text not-sure without option awareness.

### Regression risks
Boolean “Not sure” must remain unanswered; free-text unknown paths; deck calculator `unknown` assumption string.

### Required tests
Unanswered missing; valid option satisfies; `none` satisfies; `unknown` as listed option satisfies; refresh; change answer; readiness uses persisted facts.

---

## BUG-002 — Work-area answers save slowly / fail intermittently

### Relevant files
- `components/assistant/ScopeReviewMissingSection.tsx`
- `components/assistant/AssistantShell.tsx` — `handleSaveWorkAreaQuestions`
- `lib/assistant/actions.ts` — `saveQuestionBlockAnswers`
- `lib/assistant/missing-questions.ts`, `persist-derived-facts.ts`

### Current data flow
Debounced autosave (700ms) → payload of **all** answers including nulls → Zod rejects null → `"Invalid answers."` → `lastSavedRef` already set → no retry while unchanged.

### Source of truth
Same as BUG-001 (`questions` + `project_facts`).

### Mutation path
Sequential per-answer question update + fact select/upsert; then `persistDerivedFactsForProject`; then `ensureMissingDetailsQuestionBlock` (calls derived again); `markEstimateStale`; revalidate dashboard+project; client `router.refresh()`.

### Validation / ownership
Zod rejects null/empty; org ownership via `loadProjectStage`.

### Revalidation / cache
Broad; remount resets local save refs.

### Latency / bottleneck (observed from code path)
1. Null payload validation failures (failed saves)
2. N sequential DB round-trips
3. Double derived-fact persistence
4. Full assistant state reload via refresh
5. Dashboard revalidate on every answer save

### Root cause (verified)
- **Fail path:** null values in payload + premature `lastSavedRef`
- **Slow path:** sequential writes + duplicate derived work + broad refresh

### Smallest safe correction
Filter persistable answers; set last-saved only on success; visible Saving/Saved/Error; request sequence / latest-write guard; skip empty autosave; project-only revalidate on answer save; avoid duplicate client mutation.

### Regression risks
Partial block saves; stage advancement for primary Q&A block; missing-details regeneration.

### Required tests
Rapid edits latest wins; failed save shows error not Saved; malformed fails; cross-org fails; readiness after save.

---

## BUG-003 — Specification level cannot be edited

### Relevant files
- `components/assistant/EstimatePanel.tsx` — Edit control
- `components/assistant/AssistantShell.tsx` — `handleQualityEdit` / save
- `components/assistant/QualityBlock.tsx`
- `components/assistant/CollapsibleStageCard.tsx`
- `lib/assistant/actions.ts` — `updateProjectQualityLevel`
- `lib/estimate/stale.ts`

### Data flow
Edit → `setIsEditingQuality(true)` only → Quality `CollapsibleStageCard` remains collapsed (`defaultExpanded={!qualitySubmitted}`) → children not rendered → edit UI invisible.

### Source of truth
`projects.quality_level`; estimate marked stale; regenerate consumes context.

### Mutation path
`updateProjectQualityLevel` → update project → `markEstimateStale` → revalidate. Persistence path is sound.

### Root cause (verified)
Collapsed Quality card omits children; Estimate panel Edit does not expand the card. Collapsed-header “Change spec” already expands + edits.

### Smallest safe correction
Force-expand Quality card when `isEditingQuality` (controlled/`forceExpanded`).

### Regression risks
Card collapse UX; accidental re-submit of quality stage.

### Required tests
Load/edit/persist/refresh; invalid level; ownership; stale flag; no formula change.

---

## BUG-004 — Client name/address cannot be added later from pricing

### Relevant files
- `components/projects/NewProjectDialog.tsx`, `EditProjectDialog.tsx`
- `lib/projects/actions.ts` — `createProject` / `updateProject`
- `lib/pricing/actions.ts` — snapshot on create; `updatePricingDocument`
- `lib/pricing/schemas.ts` — `pricingDocumentInputSchema` (no client fields)
- `components/pricing/PricingDetailsCard.tsx` — read-only client/site
- `lib/quotes/build-from-pricing.ts` — quote snapshot

### Source of truth (current)
| Layer | Role |
| --- | --- |
| `projects.client_name` / `site_address` | Live project metadata |
| `pricing_documents.client_*` | Snapshot at pricing create |
| `quotes.client_*` | Snapshot at quote create |

### Root cause (verified)
Pricing UI displays document snapshot as read-only; update schema omits client fields; editing project via header updates project only — pricing card still shows null/old snapshot.

### Domain rule (chosen for Stage 3.1A)
1. **Project** client/site details are the authoritative editable source before a quote is issued.
2. **Draft pricing** displays and can edit those details; edits update the project and sync the draft pricing document snapshot.
3. **Quote create** snapshots client details (document then project fallback — existing behaviour).
4. **Sent/accepted/superseded quotes** retain stored snapshot; not rewritten by project/pricing edits.

### Smallest safe correction
Editable client/site on `PricingDetailsCard`; extend document input + `updatePricingDocument` to persist snapshot fields **and** update owning project; do not touch quote rows.

### Regression risks
Quote snapshot immutability; validation length; reviewed pricing returning to draft on metadata edit (existing behaviour for other fields).

### Required tests
Create without client; add via pricing; refresh; project reflects; historical quote unchanged; ownership.

---

## UX-001 — Human-readable answer formatting

### Relevant files
`lib/scopes/fact-labels.ts`, `QuestionBlock.tsx` (`SelectChips`), `ScopeReviewFactRow.tsx`

### Root cause
Chips render raw option strings; `ENUM_ANSWER_LABELS` incomplete; submitted summary only partially formats.

### Correction
Expand label map + shared `formatAnswerOptionLabel`; use in chips/display; do not mutate storage.

---

## UX-002 — None for substructure condition

### Relevant files
`lib/scopes/templates/deck.ts`, `lib/estimate/calculators/deck.ts`, fact-labels

### Root cause
No N/A option; `none` already treated as answered in `isQuestionAnswered` but not offered.

### Correction
Add canonical `none`; label “None”; calculator treats as no replacement allowance / no unknown assumption.

---

## UX-003 — Login spacing

### Relevant files
`app/(auth)/login/page.tsx`, `components/ui/card.tsx`

### Root cause
`<form>` wraps Content+Footer so Card flex gap does not separate password and submit.

### Correction
Add flex column gap on form (or footer top padding). Targeted only.

---

## UX-004 — Rates spacing

### Relevant files
`components/rates/CompanyDefaultsSection.tsx`, rates page shell

### Root cause
Same form-wrap Card gap issue on company defaults.

### Correction
Form flex gap / footer spacing aligned with login fix; no rate logic changes.

---

## UX-005 — Project Capture separation

### Relevant files
`components/assistant/ProjectCaptureBlock.tsx`, `SiteNotesCaptureCard`, analysis input builders

### Root cause
Brief and notes share one undifferentiated stack with overlapping helper copy.

### Correction
Visually separate Project Brief vs Site Notes subsections; preserve fields and Analyse inputs; no new media uploads.

---

## Uncertainty / diagnostics

All P0 bugs were conclusively traced in code. No migration required. No AI prompt change required for these defects.

---

## Commercial / schema guards

- No commercial formula changes
- No migrations
- No Intelligent Scope Discovery / Company DNA work
- Stage 2A/2B regression suites must remain green
