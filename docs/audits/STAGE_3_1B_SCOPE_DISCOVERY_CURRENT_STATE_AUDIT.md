# Stage 3.1B.0 — Scope Discovery Current-State Audit

**Status:** Complete (documentation only)  
**Date:** 2026-08-05  
**Stage:** 3.1B.0 — Intelligent Scope Discovery Audit and Specification  
**Constraint:** No ISD implementation; no AI prompt / UI / migration / commercial changes in this batch  

**Governing:** `docs/architecture/STAGE_3_1D_DOMAIN_MODEL_REFINED.md`, `docs/specifications/ESTIMATE_COMMERCIAL_BOUNDARY.md`, `docs/implementation/STAGE_3_1A_3_1D_PREVIEW_SIGNOFF.md`

---

## 1. Purpose

Document the **actual** Analyse Job / scope-seeding pipeline end-to-end so Stage 3.1B can define Intelligent Scope Discovery without guessing current behaviour.

---

## 2. Pipeline overview

```
Project Brief + Site Notes
  → buildInitialAnalysisInput (ephemeral prompt text)
  → extractFromBrief (Anthropic)
  → coerce / enrich / validate / normalise
  → saveBriefAndSeedWorkAreas mutations
      → work_areas (status=suggested)
      → project_facts (source=ai_extracted; skip source=user)
      → constraints (source=ai_extracted)
      → projects.brief_text, stage=confirm_work_areas, optional quality_level
  → User confirmWorkAreas (confirmed | excluded)
  → Quality → Question blocks → Fact-first answers
  → Derived facts (never overwrite user)
  → Constraints stage + missing-details heal/ensure
  → ready_to_estimate → generateStaticEstimate (deterministic; no AI)
```

**Parallel later path (post-capture notes):**

```
Pending project_notes
  → analyseProjectNotes → extractFromSiteNotes
  → note_proposals (pending_review) — no domain writes yet
  → applyNoteProposal / dismissNoteProposal
      → work_areas confirmed, facts as user, constraints, derived, missing questions
```

---

## 3. Stage machine

| Field | Value |
| --- | --- |
| **File** | `lib/assistant/stage.ts` |
| **Stages** | `brief` → `confirm_work_areas` → `quality` → `work_area_questions` → `constraints` → `ready_to_estimate` → `estimate_ready` |
| **Gate** | `canRunStageAction(stage, action)` |

---

## 4. Step-by-step audit

### 4.1 Project Brief / Site Notes capture

| Field | Value |
| --- | --- |
| **Files** | `components/assistant/ProjectCaptureBlock.tsx`, `components/assistant/AssistantShell.tsx`, `lib/project-notes/actions.ts` |
| **Functions** | `ProjectCaptureBlock`, `handleAnalyseJob`, `createProjectNote` / `updateProjectNote` / `deleteProjectNote` |
| **Input** | Brief textarea (local until Analyse); notes CRUD with `content`, `noteType`, `source` |
| **Output** | UI; notes rows with `analysis_status` (`pending` / `analysed` / `dismissed`) |
| **SoT** | `projects.brief_text` after Analyse; `project_notes` for notes |
| **Mutation** | Note create/update/soft-delete; update resets `analysis_status` → `pending` |
| **Validation** | Org ownership via `assertProjectOwned` |
| **Ownership** | Org-scoped project |
| **Retry / idempotency** | Client action lock on Analyse; note content not content-deduped |
| **Duplicate prevention** | None at note content level |
| **Latency** | Local CRUD only |
| **Provider** | None |
| **Error** | Auth/ownership failures |
| **User-visible** | Distinct Brief vs Site Notes panels; **Analyse job** button |

### 4.2 Combined analysis source text

| Field | Value |
| --- | --- |
| **File** | `lib/project-notes/build-analysis-source.ts` |
| **Function** | `buildInitialAnalysisInput` |
| **Input** | `{ briefText, notes[] }` |
| **Output** | Structured string (“Project brief:” + “Site notes:” …) |
| **SoT** | Ephemeral — **not persisted** |
| **Mutation** | None |

### 4.3 Analyse Job entry

| Field | Value |
| --- | --- |
| **File** | `lib/assistant/actions.ts` |
| **Function** | `saveBriefAndSeedWorkAreas(projectId, briefText)` |
| **Input** | Brief ≤ 5000 chars; loads non-internal notes; org-enabled WA types |
| **Output** | `{ success }` or error message |
| **SoT after success** | Suggested `work_areas`; AI facts/constraints; `projects.stage` |
| **Mutation** | See §5 |
| **Validation** | Length; brief **or** notes required; stage must allow `save_brief` |
| **Ownership** | `requireAuthOrgContext` + `assertOrgOwnsActiveProject` |
| **Retry** | Provider retries only (below); action itself not automatically retried |
| **Idempotency** | If stage already ≥ `confirm_work_areas` → **`{ success: true }` no-op** (cannot re-run Analyse Job) |
| **Duplicate prevention** | Skip WA insert when type already exists on project |
| **Latency** | Dominated by single Anthropic call (unmeasured in product telemetry) |
| **Provider** | Anthropic |
| **Error** | Maps `AIExtractionError` / missing key to safe user strings; logs `[saveBriefAndSeedWorkAreas]` |
| **User-visible** | Stage advances to confirm work areas; suggested WA list |

### 4.4 AI provider call (brief)

| Field | Value |
| --- | --- |
| **Files** | `lib/ai/extract.ts`, `lib/ai/anthropic.ts`, `lib/ai/retry.ts`, `lib/ai/brief-extraction-prompt.ts` |
| **Functions** | `extractFromBrief`, `getAnthropicClient`, `getAnthropicModel`, `withAnthropicRetry` |
| **Input** | Combined source text, allowed types, catalogue types |
| **Output** | `{ output, qualityLevel, constraints }` after enrich/validate |
| **SoT** | Model response is **ephemeral**; not stored as raw analysis run |
| **Mutation** | None in extract layer |
| **Validation** | Zod coerce/filter in `lib/ai/schema.ts`; ≥1 WA required; type ∩ org/catalogue; dedupe by type (highest confidence) |
| **Retry** | Up to 3 attempts with backoff on 429/5xx/network |
| **Idempotency** | None at provider layer |
| **Latency** | Single Messages API call; `max_tokens: 4096`, `temperature: 0`; no streaming |
| **Provider** | Anthropic only (`ANTHROPIC_API_KEY`, `ANTHROPIC_MODEL` default `claude-sonnet-4-6`) |
| **Error** | Throws `AIExtractionError` / transport errors |
| **OpenAI / Gemini** | Not used in this pipeline |

### 4.5 Deterministic enrichment

| Field | Value |
| --- | --- |
| **File** | `lib/ai/enrich-extraction.ts` |
| **Functions** | `enrichExtractionFromBrief`, `extractQualityFromBrief`, `extractConstraintsFromBrief`, scope `infer*` helpers |
| **Input** | Source text + AI extraction |
| **Output** | Enriched facts/WAs + quality + constraint candidates |
| **SoT** | Heuristic phrase/regex rules over text |
| **Mutation** | None until action persists |

### 4.6 Mapping to rows

| Field | Value |
| --- | --- |
| **File** | `lib/ai/mappers.ts` |
| **Functions** | `aiWorkAreasToRows` (status **`suggested`**), `aiFactsToRows`, `factDedupeKey` |

### 4.7 Work Area confirm / exclude

| Field | Value |
| --- | --- |
| **UI** | `components/assistant/WorkAreaConfirmationBlock.tsx` |
| **Action** | `confirmWorkAreas` in `lib/assistant/actions.ts` |
| **Input** | `[{ work_area_id, status: confirmed \| excluded }]` — ≥1 confirmed |
| **Mutation** | `work_areas.status`; `projects.stage = quality`; `markEstimateStale` |
| **Idempotency** | Already ≥ `quality` → success no-op |
| **User-visible** | Include/exclude toggles; confidence labels |

### 4.8 Manual work-area add/exclude (later)

| Field | Value |
| --- | --- |
| **File** | `lib/assistant/work-area-actions.ts` |
| **Functions** | `addWorkAreaToProject`, `excludeWorkAreaFromProject` |
| **Mutation** | Insert/restore `confirmed` or set `excluded`; cannot remove last confirmed |
| **Side effects** | `ensureMissingDetailsQuestionBlock`; `markEstimateStale` |

### 4.9 Quality → Questions → Facts → Derived → Missing

| Step | File / function | Mutation / SoT |
| --- | --- | --- |
| Quality | `saveQuality`, `updateProjectQualityLevel` | `projects.quality_level`; stage advance |
| Question block create | `createDynamicQuestionBlockIfNeeded` → `buildQuestionBlockFromProjectState` (`lib/scopes/questions.ts`) | `question_blocks` + `questions`; reuse if active block exists; derived first |
| Answer save | `saveQuestionBlockAnswers` → `commitUserAnswerToScope` (`lib/assistant/scope-persistence.ts`) | Fact upsert `source=user` then question mirror |
| Fact edit | `updateProjectFact` → `commitUserFactEdit` | Blocks edit of `source=derived` |
| Derived | `persistDerivedFactsForProject` | `source=derived`; `shouldWriteDerivedFact` never overwrites user |
| Missing details | `ensureMissingDetailsQuestionBlock` (`lib/assistant/missing-questions.ts`) | Heal → derive → append “Missing scope details”; stage ≥ constraints |

### 4.10 Constraints

| Path | Behaviour |
| --- | --- |
| Analyse Job | Deterministic + AI constraint candidates → upsert `constraints` `ai_extracted` |
| User stage | `saveConstraints` / `updateProjectConstraint` → `upsertProjectConstraintRecord` `source=user`; stage → `ready_to_estimate` |
| Namespace | Reserved flat keys → constraints; dotted scoped keys → facts (`domain-ownership.ts`) |

### 4.11 Estimate readiness → generation

| Field | Value |
| --- | --- |
| **Entry** | `generateStaticEstimate` / `generateEstimate` / `regenerateStaticEstimate` → `runEstimateGeneration` |
| **Context** | `getEstimateContext` — facts + derived + rates (**not** question answers) |
| **Calculate** | `calculateEstimate` + commercial engine adapters |
| **Persist** | `persistEstimateResult` → `estimates` + `estimate_line_items`; stage `estimate_ready` |
| **Provider** | **None** — deterministic money |
| **AI** | Must not invent commercial totals (per `ESTIMATE_COMMERCIAL_BOUNDARY.md`) |

### 4.12 Later note analysis (proposal gate)

| Field | Value |
| --- | --- |
| **UI** | `components/project-notes/AnalyseNotesSection.tsx`, `NoteProposalReviewPanel.tsx` |
| **Action** | `analyseProjectNotes` (`lib/project-notes/proposals/actions.ts`) |
| **AI** | `extractFromSiteNotes` (`lib/ai/extract-notes.ts`) — separate prompt; one parse retry + transport retry |
| **Gate** | Stage ≥ `confirm_work_areas`; rejects if pending proposal exists; pending notes only |
| **Mutation on analyse** | Insert `note_proposals` (`pending_review`); notes → `analysed` |
| **Does not** | Write work_areas / facts / constraints until apply |
| **Apply** | `applyNoteProposal` — selective IDs; WA add/restore as **confirmed**; facts via `upsertScopedFact` + mirror (**source user**); constraints; derived; missing questions; stale estimate |
| **Dismiss** | `dismissNoteProposal` — status dismissed; scope unchanged |

---

## 5. Analyse Job mutations (ordered)

1. `projects.brief_text`
2. Insert `work_areas` (`status: suggested`) — skip existing types
3. Upsert `project_facts` (`source: ai_extracted`) — **skip if existing `source === user`**
4. `projects.stage = confirm_work_areas` (+ optional `quality_level`)
5. Upsert `constraints` (`source: ai_extracted`) by key

**Not stored:** raw AI JSON, prompt text, model id, token/cost metadata, analysis-run id.

---

## 6. Behaviour matrix — what the system does today

| Concern | Current behaviour |
| --- | --- |
| Creates Work Areas | Analyse Job inserts `suggested` rows immediately |
| Suggests Work Areas | Via suggested status + confidence; note path uses proposal JSON until apply |
| Accepts / rejects suggestions | `confirmWorkAreas` confirmed/excluded; note path apply/dismiss |
| Creates Questions | After quality / missing-details builders from templates + facts |
| Creates Facts | AI extract at Analyse Job; user answers; proposal apply as user; derived |
| Writes Derived Facts | `persistDerivedFactsForProject` with user-overwrite guard |
| Stores analysis metadata | Fragmented: stage, WA confidence, fact/constraint source, note `analysis_status`, `note_proposals` — **no run table** |
| Reruns Analyse Job | **Blocked** after first advance (no-op success) |
| Duplicate suggestions | Type uniqueness on insert; AI schema dedupe by type |
| Changed Brief | Brief locked read-only after Analyse; no invalidation |
| Changed Site Notes | Note → `pending`; Analyse Notes path; blocked while proposal pending |
| Invalidates prior suggestions | **None** for initial Analyse Job |
| Avoids overwriting user edits | AI/derived skip `source=user`; proposal apply intentionally writes user |

---

## 7. Major deficiencies (for ISD design)

1. **Asymmetric suggestion models** — Initial Analyse Job writes suggested WAs immediately; later notes use reviewable proposals.
2. **Analyse Job is one-shot** — no governed rerun, no stale/supersede semantics, brief locked.
3. **No ScopeDiscoveryRun / durable AI audit** — prompt, response, model, tokens, latency not persisted.
4. **No canonical ScopeDiscoverySuggestion contract** — WA rows + `note_proposals` JSON are divergent.
5. **No deterministic scope-relationship catalogue** — missing scope is question/template driven, not parent→child relationship rules.
6. **Rejection memory is weak** — excluded WAs persist as rows; note dismissals do not systematically suppress future AI duplicates without new evidence rules.
7. **No structured evidence objects** — confidence exists; provenance for Evidence Engine / DNA is incomplete.
8. **Photos / documents missing** — D-S6 deferred; no storage RLS design implemented.
9. **Estimate readiness is stage-soft** — missing-details questions appear, but generate is primarily stage-gated.
10. **Single provider** — Anthropic only; no productised fallback policy.
11. **Latency/cost** — no product budgets, progress states beyond “Analysing…”, cancellation, or idempotent cache keys for identical inputs.
12. **Commercial boundary is respected for money** — good; must remain absolute for ISD.

---

## 8. Compatibility anchors (must preserve)

| Anchor | Rule |
| --- | --- |
| Fact SoT | `project_facts` sole estimating/readiness authority (3.1D) |
| User Facts | Never overwritten by AI or derived |
| Constraints namespace | Separate from facts |
| Commercial engine | Deterministic money only after accepted scope inputs |
| Quotes | Historical snapshots immutable |
| Company DNA | Not applied; learning evidence only later |

---

## 9. Relevant verification scripts

| Script | Role |
| --- | --- |
| `scripts/verify-internal-ai-extraction.ts` | Live Anthropic brief extraction |
| `scripts/verify-outdoor-ai-extraction.ts` | Live Anthropic outdoor extraction |
| `scripts/test-notes-extraction.ts` | Analysis source shape |
| `scripts/test-normalise-note-analysis.ts` | Note analysis normalisation |
| `scripts/test-normalise-extracted-facts.ts` | Fact normalisation |
| `scripts/test-parse-json.ts` | AI JSON parse |
| `scripts/debug-estimate-for-brief.ts` | Offline brief → estimate debug |
| `scripts/verify-derived-fact-conflicts.ts` | Derived conflicts |
| `scripts/verify-fact-coverage.ts` | Fact/template coverage |
| `scripts/verify-stage-3-1d-domain-model-refinement.ts` | Fact SoT / persistence |
| `scripts/verify-stage-3-1a-product-stabilisation.ts` | Product stabilisation |
| `scripts/verify-stage-3-1a-r1-preview-remediation.ts` | Capture / Analyse dual sources |
| Adjacent | `verify-rls-coverage.ts`, org isolation, performance smoke |

---

## 10. Conclusion

Current Analyse Job is a **one-shot Anthropic extraction that seeds suggested work areas and AI facts/constraints**, followed by user confirmation and a deterministic estimate path. Later notes already demonstrate a safer **propose → review → apply** pattern. Stage 3.1B should converge on that proposal model, add deterministic relationship/missing-scope rules, evidence/confidence contracts, and analysis-run semantics — without touching commercial formulas or silently mutating Facts / accepted scope.

---

## Document control

| Field | Value |
| --- | --- |
| Path | `docs/audits/STAGE_3_1B_SCOPE_DISCOVERY_CURRENT_STATE_AUDIT.md` |
| Created | 2026-08-05 |
| Batch | Stage 3.1B.0 |
| Implementation | None |
