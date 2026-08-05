# Stage 3.1B.5B — Production Wiring Design

**Status:** Complete — Planning  
**Date:** 2026-08-06  
**Batch:** Stage 3.1B.5B (design only — no implementation)  
**Depends on:** Migrations 028/029 (local complete; remote Ready Pending Owner Approval)  
**Does not implement:** Server actions, UI, Analyse Job changes, feature flag code, DNA, Builder Interview  

---

## 1. Objective

Define the authenticated server-side wiring that will later connect:

- scope discovery orchestration;
- run persistence;
- suggestion persistence;
- accept / reject / modify lifecycle;
- existing Work Area creation (via 029 RPCs);
- future UI.

This document is the contract for the next implementation batch after remote migrations are applied.

---

## 2. Current architecture baseline

### Analyse Job (unchanged)

| Item | Location | Behaviour |
| --- | --- | --- |
| Primary action | `lib/assistant/actions.ts` → `saveBriefAndSeedWorkAreas` | Auth + org ownership; brief/notes → `extractFromBrief`; **immediately inserts suggested Work Areas**; seeds facts/questions |
| UI trigger | `components/assistant/ProjectCaptureBlock.tsx` / `BriefInput.tsx` — “Analyse job” | Client calls existing action only |
| Notes path | `lib/project-notes/proposals/actions.ts` → `analyseProjectNotes` | Separate later-stage path; blocked during capture |

**Rule for 3.1B.5B+:** Do not modify Analyse Job until an explicit owner decision chooses supplement vs replace (approval #5).

### Existing Work Area creation (reuse pattern)

| Item | Location |
| --- | --- |
| Manual add | `lib/assistant/work-area-actions.ts` → `addWorkAreaToProject` |
| Pattern | `"use server"`; Zod; `requireAuthOrgContext` / `getAuthOrgContext`; `assertOrgOwnsActiveProject`; insert/update `work_areas`; `ensureMissingDetailsQuestionBlock`; targeted `revalidatePath` |

Discovery acceptance must **not** duplicate ad-hoc WA inserts in app code when 029 RPCs already create the WA atomically with the decision.

### Scope discovery modules (ready, unused by production)

| Layer | Path | Role |
| --- | --- | --- |
| Contract / lifecycle | `lib/scope-discovery/*` | Pure suggestion model |
| Catalogue | `lib/scope-discovery/catalogue/*` | Deterministic edges |
| Provider | `lib/scope-discovery/provider/*` | Validated AI output |
| Orchestration | `lib/scope-discovery/orchestration/*` | Merge, idempotency, stale |
| Persistence | `lib/scope-discovery/persistence/*` | Runs / suggestions / decisions adapters |
| Decisions | `lib/scope-discovery/decisions/*` | RPC wrappers for accept/reject/modify |

---

## 3. Target application flow

```
User explicitly clicks “Analyse Scope”
        ↓
Authenticated server action (feature flag ON)
        ↓
Auth / org context + project ownership
        ↓
Collect sources (brief, notes, work areas, facts, constraints)
        ↓
Build orchestration request + source snapshot
        ↓
Deterministic catalogue evaluation
        ↓
Provider orchestration (injected runner; one repair max)
        ↓
Persist run (RUNNING → terminal) + suggestions
        ↓
Return safe result (no secrets / raw provider body)
        ↓
UI displays proposals (evidence, confidence bands)
        ↓
User accept / reject / modify
        ↓
Decision service → SECURITY INVOKER RPC
        ↓
Atomic decision + Work Area (ACCEPT/MODIFY) or REJECT only
        ↓
Targeted revalidation (project assistant path)
```

No client-side AI. No client-side persistence authority. No Fact fabrication on accept.

---

## 4. Ownership boundaries

### Server action owns

- Auth and organisation context (`requireAuthOrgContext` pattern).
- Project ownership (`assertOrgOwnsActiveProject`).
- Feature-flag gate (`SCOPE_DISCOVERY_ENABLED`).
- Source collection from Supabase (org-scoped queries).
- Request validation (Zod at action boundary).
- Orchestration invocation with injected provider runner.
- Persistence adapter calls (run + suggestions).
- Mapping safe errors to user strings.
- Targeted revalidation after mutations.
- Audit-friendly structured logs (codes, projectId, runId — no secrets).

### Orchestrator owns

- Deterministic + contextual merge.
- Idempotency decision (reuse / run / duplicate in-flight).
- Stale semantics (`evaluateStaleRun`).
- Run result shape (status, suggestions, warnings, versions).
- ORCH-POL-01: deterministic success + provider failure → `COMPLETED_WITH_WARNINGS`.

### Persistence owns

- Durable run history.
- Immutable suggestion payloads.
- Append-only decision rows (when written outside RPC — rare; prefer decision RPCs for accept/reject/modify).
- Org derived from profile context — never trust client `org_id`.

### Acceptance RPC owns

- Atomic decision + Work Area creation (`accept_*`, `modify_accept_*`).
- Append-only REJECT.
- Eligibility, locking, duplicate prevention, error sanitisation codes.
- No Facts, estimates, pricing, quotes, DNA.

### UI owns (future 3.1B.6)

- Explicit trigger control (“Analyse Scope”).
- Progress / loading presentation.
- Evidence display and confidence grouping.
- Accept / reject / modify controls.
- No direct Supabase writes for discovery lifecycle.
- No raw provider errors.

---

## 5. Future server actions (design only)

Proposed module: `lib/scope-discovery/actions.ts` (or `lib/assistant/scope-discovery-actions.ts`) with `"use server"`.

Shared helpers:

- `assertScopeDiscoveryEnabled()` — throw/return safe disabled error when flag off.
- `loadOwnedProjectSources(projectId)` — brief, notes, WAs, facts, constraints.
- `revalidateScopeDiscoveryPaths(projectId)` — `revalidatePath(\`/app/projects/${projectId}\`)` (+ dashboard only if list counts change).

### 5.1 `runScopeDiscovery(projectId)`

| Aspect | Design |
| --- | --- |
| **Input** | `{ projectId: uuid }` — optional future `{ trigger?: ExplicitUserTrigger }` default `USER_REQUESTED_RERUN` |
| **Auth** | Session required; org from profile |
| **Ownership** | Active project in caller org |
| **Transaction** | Not one DB transaction end-to-end (provider latency). Persist RUNNING first; complete run + insert suggestions after orchestration. Decision RPCs are separate later calls. |
| **Return** | `{ ok: true, runId, status, suggestions: SafeSuggestion[], warnings?, reused?: boolean }` or `{ ok: false, code, message }` |
| **Revalidation** | Project path after successful persist |
| **Errors** | Flag off; unauthenticated; not found; validation; duplicate in-flight; provider/orchestration safe codes |
| **Idempotency** | Orchestration + partial unique RUNNING key; return reuse when applicable |
| **Audit** | Log runId, status, latency, token counts, provider_called — never API key / raw body |

### 5.2 `getScopeDiscoveryResults(projectId)`

| Aspect | Design |
| --- | --- |
| **Input** | `{ projectId: uuid, runId?: uuid }` — default latest non-archived terminal run |
| **Auth / ownership** | Same as above |
| **Transaction** | Read-only |
| **Return** | Latest run summary + suggestions with **composed** decision status (from decisions table) + stale flags |
| **Revalidation** | None |
| **Errors** | Flag off optional (may allow read of historical rows when disabled — owner gate); not found |
| **Idempotency** | N/A (read) |
| **Audit** | Optional debug only |

### 5.3 `acceptScopeSuggestion(suggestionId)`

| Aspect | Design |
| --- | --- |
| **Input** | `{ suggestionId: uuid, projectId: uuid, sourceRevision: string, reasonCode?: string, userNote?: string }` |
| **Auth / ownership** | Session + project ownership; RPC re-checks org |
| **Transaction** | Entirely inside `accept_scope_discovery_suggestion` |
| **Return** | `{ ok, decisionId, workAreaId, decisionType: 'ACCEPT' }` |
| **Revalidation** | Project path (Work Areas + scope review) |
| **Errors** | Mapped from `SCOPE_DISCOVERY_DECISION:*` codes via `mapDecisionRpcError` |
| **Idempotency** | Second accept fails with already-accepted / already-scope-created |
| **Audit** | decisionId, workAreaId, suggestionId |
| **Post-step (optional later)** | `ensureMissingDetailsQuestionBlock` for new WA — **not** Fact invent; owner-gated in implementation batch |

### 5.4 `rejectScopeSuggestion(suggestionId, reason)`

| Aspect | Design |
| --- | --- |
| **Input** | `{ suggestionId, projectId, sourceRevision, reasonCode?, userNote? }` |
| **Auth / ownership** | Same |
| **Transaction** | `reject_scope_discovery_suggestion` |
| **Return** | `{ ok, decisionId, decisionType: 'REJECT', idempotentReuse?: boolean }` |
| **Revalidation** | Project path (suggestion list) |
| **Errors** | Same code family |
| **Idempotency** | Retry returns existing REJECT |
| **Audit** | decisionId; no DNA write |

### 5.5 `modifyScopeSuggestion(suggestionId, modification)`

| Aspect | Design |
| --- | --- |
| **Input** | `{ suggestionId, projectId, sourceRevision, modifiedTitle, modifiedDescription?, modifiedWorkAreaType, reasonCode?, userNote? }` |
| **Auth / ownership** | Same |
| **Transaction** | `modify_accept_scope_discovery_suggestion` |
| **Return** | `{ ok, decisionId, workAreaId, decisionType: 'MODIFY' }` |
| **Revalidation** | Project path |
| **Errors** | `INVALID_MODIFICATION`, eligibility, duplicate WA, etc. |
| **Idempotency** | Second scope-create blocked |
| **Audit** | Stores modified fields on decision only; suggestion payload immutable |

### 5.6 `markScopeDiscoveryStale(projectId)`

| Aspect | Design |
| --- | --- |
| **Input** | `{ projectId: uuid, runId?: uuid, reason: string }` — or automatic path when sources change |
| **Auth / ownership** | Same |
| **Transaction** | Update allowed suggestion columns only (`stale_reason`, `superseded_by_suggestion_id`) via persistence adapter |
| **Return** | `{ ok, markedCount }` |
| **Revalidation** | Project path |
| **When** | After material brief/notes/facts/WA/constraint change **if** product chooses explicit stale marking; alternatively UI derives stale from fingerprint without mutation |
| **Errors** | Flag / ownership / validation |
| **Idempotency** | Re-marking same reason is no-op |
| **Audit** | Count + runId |

---

## 6. Source collection contract

Server action loads (org + project scoped):

| Source | Tables / fields |
| --- | --- |
| Brief | `projects.brief_text` |
| Site notes | `project_notes` (non-internal, not deleted) |
| Work areas | `work_areas` (type, status, name, summary) |
| Facts | `project_facts` |
| Constraints | `constraints` |

Maps into `ScopeDiscoveryRequest` / orchestration snapshot. Does not send secrets or commercial rates to the provider.

---

## 7. Persistence sequence for a run

1. Validate request; compute fingerprint + idempotency key.
2. Decide REUSE vs START (orchestration helpers + DB read of prior runs).
3. If START: `insertDiscoveryRun` status `RUNNING` (partial unique enforces single in-flight).
4. Execute orchestration (deterministic + provider).
5. `completeDiscoveryRun` + `insertDiscoverySuggestions`.
6. Return safe DTO to UI.

On failure after RUNNING insert: complete as failed status with safe `errors` JSONB — never leave orphan RUNNING without terminal update when possible; document retry if process crash mid-flight.

---

## 8. Decision sequence

1. UI calls accept/reject/modify action.
2. Action validates Zod + ownership + flag.
3. Action calls `lib/scope-discovery/decisions` service → RPC.
4. RPC creates WA (if accept/modify) + decision row atomically.
5. Action optionally seeds missing-details questions for new WA (future, gated).
6. Revalidate project path.

---

## 9. Error and safety rules

| Rule | Detail |
| --- | --- |
| Safe messages | Map codes to `USER_ERRORS`-style strings; never return SQL/provider stacks |
| Cross-org | Appear as not found |
| No dual-write | Do not also write Analyse Job suggested WAs from discovery path unless owner approves dual-write (default: **no**) |
| No commercial | No rates/margins/GST in discovery payloads |
| No DNA | Decisions are provenance only |
| Service role | Server-only if used; prefer authenticated user JWT for RPCs so RLS + INVOKER apply |

---

## 10. Relationship to Analyse Job

| Policy option | Meaning | Recommendation |
| --- | --- | --- |
| **Supplement** | Analyse Job remains; “Analyse Scope” is separate explicit action | **Recommended for Preview** |
| **Replace** | Analyse Job becomes propose→decide discovery | Deferred until Preview proof + owner gate |

When flag off: Analyse Job behaviour identical to today.

---

## 11. Out of scope for implementation until authorised

- UI components / AssistantShell wiring.
- Changing `saveBriefAndSeedWorkAreas`.
- Company DNA / Builder Interview.
- Commercial formula changes.
- Prompt text changes.
- Remote migration apply (separate runbook + approval).

---

## Document control

| Field | Value |
| --- | --- |
| Path | `docs/architecture/STAGE_3_1B5B_PRODUCTION_WIRING_DESIGN.md` |
| Created | 2026-08-06 |
| Implementation | **Not Started** |
| Status | Complete — Planning |
