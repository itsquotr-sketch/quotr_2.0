# Stage 3.1A — Product Stabilisation Completion

**Status:** Complete  
**Preview sign-off:** 2026-08-05 — `docs/implementation/STAGE_3_1A_3_1D_PREVIEW_SIGNOFF.md`  
**Date:** 2026-08-05  
**Preview / deploy:** Owner Preview executed; defects remediating in **Stage 3.1A-R1** (`docs/implementation/STAGE_3_1A_R1_PREVIEW_REMEDIATION.md`)  
**Intelligent Scope Discovery:** Not started  

> Do **not** mark Stage 3.1A fully Complete until Preview retest of R1 passes.  
> Do **not** close Stage 3.1D on this remediation.

---

## 1. Objective

Resolve confirmed Preview workflow defects, improve answer-save reliability and immediate usability, and establish a governed product backlog before Intelligent Scope Discovery.

## 2. Issues addressed

| ID | Outcome |
| --- | --- |
| BUG-001 | Listed select answers (incl. `unknown`) no longer treated as missing |
| BUG-002 | Persistable filtering, save status, latest-write guard, lighter revalidation |
| BUG-003 | Quality card force-expands when editing spec level |
| BUG-004 | Editable client/site on pricing; syncs project + draft snapshot |
| UX-001 | Human-readable enum labels on chips/displays |
| UX-002 | Canonical `none` option for substructure condition |
| UX-003 | Login form spacing |
| UX-004 | Rates company-defaults form spacing |
| UX-005 | Project Brief vs Site Notes visual separation |

Deferred (documented only): FEAT-001, FEAT-002, FEAT-003.

## 3. Root causes

| Bug | Root cause |
| --- | --- |
| BUG-001 | `"unknown"` was both a select option and a global not-sure token; optional facts with not-sure values stayed in `missingItems` |
| BUG-002 | Autosave sent nulls (Zod fail); last-saved marked before success; heavy sequential writes + double derived facts + dashboard revalidate |
| BUG-003 | Edit set `isEditingQuality` but Quality `CollapsibleStageCard` stayed collapsed (children not rendered) |
| BUG-004 | Pricing showed read-only document snapshot; update schema omitted client fields; project edits did not update displayed snapshot |

## 4. Files changed

### Created
- `docs/product/QUOTR_PRODUCT_BACKLOG.md`
- `docs/audits/STAGE_3_1A_PRODUCT_STABILISATION_AUDIT.md`
- `docs/performance/STAGE_3_1A_ANSWER_SAVE_LATENCY.md`
- `docs/runbooks/STAGE_3_1A_PREVIEW_SMOKE_TEST.md`
- `docs/plans/STAGE_3_PRODUCT_ROADMAP.md`
- `docs/implementation/STAGE_3_1A_PRODUCT_STABILISATION_COMPLETION.md`
- `lib/assistant/answer-persistence.ts`
- `scripts/verify-stage-3-1a-product-stabilisation.ts`

### Modified (application)
- `lib/scopes/fact-labels.ts`, `fact-values.ts`, `questions.ts`, `conditional-rules.ts`
- `lib/scopes/templates/deck.ts`
- `lib/estimate/calculators/deck.ts` (none assumption only — no money formula change)
- `lib/assistant/actions.ts`, `missing-questions.ts`, `types.ts`
- `components/assistant/*` (ScopeReviewMissingSection, AssistantShell, CollapsibleStageCard, QuestionBlock, ScopeReviewFactRow, ProjectCaptureBlock)
- `lib/pricing/schemas.ts`, `types.ts`, `actions.ts`
- `components/pricing/PricingDetailsCard.tsx`
- `app/(auth)/login/page.tsx`, `signup/page.tsx`
- `components/rates/CompanyDefaultsSection.tsx`
- Tracker: `docs/MVP_HARDENING_GUIDE.md`, backlog statuses

## 5. Answer-persistence architecture

- UI answers keyed by question UUID; facts by `(work_area_id, key)`.
- Persistable payload filtered client/server via `filterPersistableAnswers`.
- `saveQuestionBlockAnswers` writes questions + facts, derived facts once, ensure-missing with `skipDerivedPersist`, marks estimate stale, revalidates project path only.
- Scope Review remounts after refresh so missing-item evaluation uses current facts.

## 6. Save-state and race-condition treatment

- Statuses: idle / saving / saved / error (error never shows Saved).
- `createLatestWriteGuard` drops stale overlapping responses.
- Autosave pending key cleared on error; successful key recorded only on `saved`.

## 7. Substructure requirement correction

- `isNotSureValue(value, selectOptions)` — listed options are deliberate unless explicit Not sure tokens.
- `isTemplateFactMissing` / `isQuestionAnswered` pass template options.

## 8. Enum formatting

- `formatAnswerOptionLabel` / expanded `ENUM_ANSWER_LABELS`; chips use presentation labels; storage unchanged.

## 9. `None` treatment

- Canonical stored value `"none"`; display “None”; counts as answered; distinct from unanswered and `"unknown"`.
- Deck calculator adds assumption for none (no replacement allowance path).

## 10. Specification-level correction

- `forceExpanded={isEditingQuality}` on Quality card; collapse disabled while editing.
- Persistence via existing `updateProjectQualityLevel` + stale flag unchanged.

## 11. Client-detail source-of-truth decision

1. **Project** `client_name` / `site_address` are authoritative before quote issuance.
2. **Draft pricing** can edit those fields; updates project and draft pricing snapshot together.
3. Empty pricing snapshot falls back to project values on workspace load.
4. **Quotes** retain their stored snapshot; Stage 3.1A does not rewrite historical quotes.
5. Current schema already stores quote client fields — immutability preserved by not updating quote rows on project/pricing client edits.

## 12. Project Capture changes

- Separate subsections: Project brief / Site notes with purpose copy.
- Same `briefText` + `SiteNotesCaptureCard` inputs for analysis — no AI input merge/loss.

## 13. Login / rates UX

- Form `flex flex-col gap-(--card-spacing)` so Content/Footer spacing applies.

## 14. Performance findings

See `docs/performance/STAGE_3_1A_ANSWER_SAVE_LATENCY.md`. Reliability fixes primary; latency improvements are path-based (no unsupported ms claims).

## 15. Verification results

| Check | Result |
| --- | --- |
| `npx tsc --noEmit` | Pass |
| `npm run lint` | Pass |
| `npx tsx scripts/verify-stage-3-1a-product-stabilisation.ts` | Pass (37/37) |
| Stage 2A.1–2A.3B scripts | Pass |
| Stage 2B.3B–2B.10 scripts | Pass |
| `npm run build` | Pass (recorded in session) |
| Preview smoke | **Passed** 2026-08-05 — `docs/implementation/STAGE_3_1A_3_1D_PREVIEW_SIGNOFF.md` |

## 16. Manual Preview tests still required

**None for Stage 3.1A.** Owner Preview sign-off completed 2026-08-05. Historical runbook: `docs/runbooks/STAGE_3_1A_PREVIEW_SMOKE_TEST.md`.

## 17. Backlog items deferred

FEAT-001, FEAT-002, FEAT-003 — remain **Deferred** (see product backlog).

## 18. Remaining risks

- Sequential per-answer DB writes remain.
- Full RSC refresh still used after save (needed for missing-item correctness).
- Existing fact values of free-text `"unknown"` outside select options still count as not-sure.
- Pricing client edit returns document to draft (same as other metadata edits).

Accepted limitations after Preview sign-off are recorded in `docs/implementation/STAGE_3_1A_3_1D_PREVIEW_SIGNOFF.md` §21.

## 19. Rollback method

Revert the Stage 3.1A commit. No migrations to roll back. Commercial authority switches unchanged. **No rollback was required** after Preview sign-off.

## 20. Recommendation for next release

1. Stage 3.1A and Stage 3.1D are **Complete** (Preview signed off 2026-08-05).
2. Plan **Stage 3.1B — Intelligent Scope Discovery** when explicitly authorised (**Ready to Plan**; not started).
3. Do **not** implement deferred schema proposals until separately approved (**Not Approved**).
4. Keep FEAT-001–003 **Deferred**. Keep commercial engine and Stage 2B goldens frozen unless a separate commercial batch is approved.

---

## Future-learning compatibility check

| # | Question | Answer |
| --- | --- | --- |
| 1 | Deliberate answers distinct from unanswered? | Yes — empty/null vs stored values; not-sure tokens explicit |
| 2 | Is `none` structured rather than missing? | Yes — canonical `"none"` |
| 3 | Are answer changes traceable? | User-sourced facts/answers; further audit trail still limited (no DNA event log yet) |
| 4 | Can DNA use corrections as evidence without auto-changing rules? | Yes — persistence only; no automatic rule mutation |
| 5 | Brief and site notes separately structured? | Yes — UI + stored fields remain distinct |
| 6 | Site constraints ready for taxonomy expansion? | Partial — FEAT-003 deferred with taxonomy requirement |
| 7 | Spec level structured and persistent? | Yes — `projects.quality_level` |
| 8 | Client details governed by clear lifecycle? | Yes — project authoritative pre-quote; quote snapshot immutable |
| 9 | Immediate customer usability improved? | Yes — for confirmed Preview defects |
| 10 | AI reasoning coupled to commercial arithmetic? | No — batch avoided formula/engine changes |

---

## Acceptance (local)

Automated criteria for **Complete — Local** met when verification + Stage 2A/2B regressions + tsc/lint/build pass. Preview criteria remain open.
