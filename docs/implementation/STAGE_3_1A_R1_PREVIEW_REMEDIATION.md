# Stage 3.1A-R1 — Preview Remediation

**Status:** Complete — Local (Preview retest pending)  
**Date:** 2026-08-05  
**Parent stage:** Stage 3.1A Product Stabilisation  
**Constraint:** No migrations; no commercial formula changes; no AI prompt changes; no ISD; no Company DNA  

---

## 1. Preview findings

Owner Preview passed content persistence, Analyse Job dual sources, substructure save, Saving/Saved states, missing-detail logic, Fact authority, Quality-card spec edit, general UI, and commercial regression.

Failed / incomplete:

| ID | Finding |
| --- | --- |
| R1-001 | Raw enum values with underscores still appeared in UI |
| R1-002 | After rapid answer changes, delay before final answer shown |
| R1-003 | Quick Estimate Spec Edit button still ineffective |
| R1-004 | Pricing client fields stayed stale after Project Details edits |
| R1-005 | Project Brief vs Site Notes visual distinction insufficient |

---

## 2. Root cause — raw enum rendering (R1-001)

Select chips were formatted, but several presentation paths still rendered stored values directly:

- `QuestionBlock.formatAnswer` joined multi-select arrays without labels
- `formatConstraintDisplayValue` returned `String(value)`
- Constraint edit chips showed raw option strings
- `formatFactValueForDisplay` did not format array values

**Correction:** Route all user-visible enum/select paths through `formatAnswerOptionLabel` / `formatFactValueForDisplay`. Storage remains canonical.

---

## 3. Root cause — answer display delay (R1-002)

`AssistantShell` remounted `ScopeSummaryBlock` with `key={scopeReviewQuestionKey}` derived from question ids **and values**. After save + `router.refresh()`, the key changed → full remount → optimistic `editedAnswers` wiped → temporary reversion to lagging server props.

**Correction:**

- Removed remount key
- Local optimistic answers overlay server props while the editor is active or save is in flight
- Latest-write guard retained; pure reconciliation helpers added for regression tests

---

## 4. Reconciliation / race treatment

Contract:

1. Local optimistic value is authoritative while the editor is shown or save is in flight  
2. Only the latest write-guard token may apply Saved / Error  
3. Incoming server props must not overwrite a newer local selection  
4. When a question leaves `activeQuestions` after successful refresh, the chip unmounts and the fact row shows the persisted value  
5. Failed latest request surfaces Error — never Saved  

Helpers: `resolveVisibleAnswerValue`, `shouldClearLocalAnswerEdit`, `mergeAnswersWithRevisions`, `foldRapidAnswerResponses`.

---

## 5. Quick Estimate edit correction (R1-003)

Quality card “Change spec” expanded locally via `setExpanded(true)`. Quick Estimate Edit only set `isEditingQuality`. `forceExpanded` was present but the Quality card could remain off-screen and collapsed state was not always synced for the Estimate path.

**Correction:**

- Canonical `beginQualitySpecEdit` shared by Quality card and EstimatePanel
- Forces editing flag, scrolls Quality card into view
- `forceExpanded={isEditingQuality}` retained; `cardRef` for scroll target
- No second specification editor

---

## 6. Client propagation correction (R1-004)

`updateProject` updated `projects` only. Pricing UI held non-empty snapshot + uncontrolled `defaultValue` inputs, so project edits never appeared.

**Correction:**

| Layer | Behaviour |
| --- | --- |
| Authoritative | `projects.client_name` / `site_address` |
| Draft/reviewed pricing | Synced on project update; workspace load prefers live project values |
| Pricing UI | Controlled client/site inputs; draft overlay prevents dirty overwrite |
| Historical quotes | Untouched |

---

## 7. Project Capture layout refinement (R1-005)

- Distinct panels: **Project Brief — Job overview** and **Site Notes — Ongoing observations**
- Required purpose copy
- “Included in analysis” when brief has content
- `SiteNotesCaptureCard showHeading={false}` removes duplicate heading
- Duplicate footer explanatory copy removed
- Data sources and Analyse Job inputs unchanged

---

## 8. Files changed

### Created
- `lib/assistant/quality-edit.ts`
- `scripts/verify-stage-3-1a-r1-preview-remediation.ts`
- `docs/implementation/STAGE_3_1A_R1_PREVIEW_REMEDIATION.md`

### Modified
- `lib/scopes/fact-labels.ts`
- `lib/assistant/answer-persistence.ts`
- `lib/projects/actions.ts`
- `lib/pricing/actions.ts`
- `components/assistant/QuestionBlock.tsx`
- `components/assistant/ScopeReviewFactRow.tsx`
- `components/assistant/EditableConstraintRow.tsx`
- `components/assistant/ScopeSummaryBlock.tsx`
- `components/assistant/AssistantShell.tsx`
- `components/assistant/CollapsibleStageCard.tsx`
- `components/assistant/ProjectCaptureBlock.tsx`
- `components/pricing/PricingDetailsCard.tsx`
- `components/pricing/PricingWorkspace.tsx`
- `scripts/verify-stage-3-1a-product-stabilisation.ts`
- Backlog / roadmap / completion / smoke docs

---

## 9. Automated verification

| Suite | Result |
| --- | --- |
| `npx tsx scripts/verify-stage-3-1a-r1-preview-remediation.ts` | 42/42 Pass |
| `npx tsx scripts/verify-stage-3-1a-product-stabilisation.ts` | 37/37 Pass |
| `npx tsx scripts/verify-stage-3-1d-domain-model-refinement.ts` | 45/45 Pass |
| `npx tsx scripts/verify-batch-2b10-final-commercial-authority.ts` | 57/57 Pass |
| `npx tsc --noEmit` | Pass |
| `npm run lint` | Pass |
| `npm run build` | Pass |

---

## 10. Manual Preview retests required

1. Select `good_condition` / `none` — UI shows “Good condition” / “None”, never underscores  
2. Rapidly change answers A→B→C — final chip stays on C through Saving→Saved; refresh keeps C  
3. Quick Estimate **Edit** expands Quality card, scrolls into view, save + refresh persist  
4. Edit client/site in Project Details → open/return to Pricing → values match; dirty Pricing edits not wiped  
5. Issued quote client snapshot unchanged  
6. Project Capture shows two distinct panels; Analyse Job still receives brief + notes  

---

## 11. Remaining risks

- Full RSC refresh after answer save still used (no flash of wrong value, but network latency remains)  
- Sequential per-answer DB writes unchanged  
- PricingWorkspace prop sync is best-effort around draft overlays  
- Stage 3.1A / 3.1D remain **Complete — Local** until Preview retest signs off  

---

## 12. Confirmation of out-of-scope constraints

| Constraint | Status |
| --- | --- |
| No migrations / Supabase schema changes | Confirmed |
| No commercial formula changes | Confirmed |
| No AI prompt changes | Confirmed |
| No Company DNA | Confirmed |
| No Intelligent Scope Discovery | Confirmed |
| Stage 3.1A / 3.1D not marked fully Complete | Confirmed |
