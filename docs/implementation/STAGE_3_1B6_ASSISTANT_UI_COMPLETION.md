# Stage 3.1B.6 — Assistant UI Completion

**Status:** Complete — Local; Preview sign-off **not** complete (see 3.1B.6R3.1)  
**Date:** 2026-08-06  
**Verify:** `scripts/verify-stage-3-1b6-assistant-ui.ts`  
**Remediation:** Stage 3.1B.6R1–**R3.1** — `docs/implementation/STAGE_3_1B6R31_SCOPE_IMPACT_RECOMMENDATIONS_COMPLETION.md`  
**Scope Discovery UI:** Complete — Local, Preview Retest Pending (after 3.1B.6R3.1)  
**Preview feature:** Enabled only by owner configuration (`SCOPE_DISCOVERY_ENABLED=true`)  
**Production feature:** Disabled  
**Existing Analyse Job:** Preserved  
**Stage 3.1B.7:** Not Started  
**UI/UX Overhaul:** Planned  

---

## 1. Objective

Deliver the first user-facing Intelligent Scope Discovery workflow on the Assistant page behind `SCOPE_DISCOVERY_ENABLED`, without replacing Analyse Job, fabricating Facts, changing commercial formulas, or enabling Production.

---

## 2. Placement

| Item | Detail |
| --- | --- |
| Card title | Scope Review |
| Position | After Work Areas confirmation, before Quality |
| Gate | Server prop `scopeDiscoveryEnabled` from `isScopeDiscoveryEnabled()` on the project page |
| When hidden | Flag off → no card, no discovery action invocation from UI |

Existing estimate **Scope Review** (facts / missing details) remains later in the flow and is unchanged.

---

## 3. Analysis trigger

- Explicit **Analyse scope** / **Analyse again** only.
- Calls `runScopeDiscoveryAction`.
- Duplicate clicks blocked via analysing lock.
- No auto-run on page load or project edits.
- Progress copy rotates through preparing / reviewing / checking / finalising (no fake percentages).
- Page remains interactive outside the card.

---

## 4. Results UX

Groups (collapsible):

1. Important considerations  
2. Worth checking  
3. Other possibilities  
4. Conflicts or issues  

Plus added / dismissed history (dismissed collapsed by default).

Confidence shown as High / Medium / Low bands only.

Evidence shown as human-readable summaries from validated evidence items only.

---

## 5. Decisions

| UI action | Server action | Effect |
| --- | --- | --- |
| Add work area | `acceptScopeSuggestionAction` | Creates Work Area via RPC; no Facts |
| Edit and add | `modifyScopeSuggestionAction` | Title / type / description only |
| Dismiss | `rejectScopeSuggestionAction` | Optional reason + note; no DNA |

Pending action scoped per suggestion. Latest-write guard on results refresh. Targeted `router.refresh()` after success.

---

## 6. Stale / provider fallback

- Stale notice when source snapshot materially changed; **Analyse again** is explicit.
- `COMPLETED_WITH_WARNINGS` with provider failure → restrained copy: structured checks completed; contextual suggestions unavailable.
- No provider names, stack traces, or automatic retry.

---

## 7. FEAT-001 (partial)

Implemented for Scope Discovery result groups and suggestion detail expand/collapse.

Broader collapse for all existing estimate Work Area cards remains **Deferred**.

---

## 8. Files

**Created**

- `lib/scope-discovery/ui/*`
- `components/assistant/ScopeDiscoveryReviewBlock.tsx`
- `components/assistant/ScopeDiscoverySuggestionCard.tsx`
- `components/assistant/ScopeDiscoveryEditDialog.tsx`
- `components/assistant/ScopeDiscoveryDismissDialog.tsx`
- `scripts/verify-stage-3-1b6-assistant-ui.ts`
- `docs/runbooks/STAGE_3_1B6_SCOPE_DISCOVERY_PREVIEW_SMOKE_TEST.md`
- this completion doc

**Modified**

- `lib/scope-discovery/application/types.ts` / `result-mappers.ts` / `get-results.ts`
- `lib/scope-discovery/persistence/suggestion-repository.ts`
- `lib/scope-discovery/actions.ts` (comment)
- `components/assistant/AssistantShell.tsx`
- `components/assistant/WorkAreaConfirmationBlock.tsx` / `ScopeSummaryBlock.tsx` (`data-work-area-id`)
- `app/(protected)/app/projects/[projectId]/page.tsx`
- product / plan / rollout docs

---

## 9. Verification

`scripts/verify-stage-3-1b6-assistant-ui.ts` — **49 passed, 0 failed**.

Full regression (this batch): `tsc`, `lint`, `build`, Stage 3.1A/R1/3.1D, 3.1B.1–3.1B.6, RLS, 2B.10 — all passed.

## 10. Known limitations

- Preview UI sign-off still required.
- Production remains disabled.
- Missing-details question seed after accept still deferred.
- Full work-area card collapse (non-ISD) still deferred.
- History browser is MVP (latest run + dismissed count).
- Browser E2E not automated locally — use Preview smoke runbook.

## 11. Confirmation

No migration; no Analyse Job replacement; no commercial formula change; no Company DNA; no Builder Interview.

---

## Document control

| Field | Value |
| --- | --- |
| Path | `docs/implementation/STAGE_3_1B6_ASSISTANT_UI_COMPLETION.md` |
| Created | 2026-08-06 |
