/**
 * Stage 3.1B.6R3.1 — Scope Impact Recommendation UI and Decision Completion.
 *
 * **Status:** Complete — Local, Preview Retest Pending
 * **Stage 3.1B.6:** Preview sign-off not complete
 * **Stage 3.1B.7:** Not Started
 * **UI/UX Overhaul:** Planned
 * **Production:** Disabled
 */

# Stage 3.1B.6R3.1 — Scope Impact Recommendations Completion

**Status:** Complete — Local, Preview Retest Pending  
**Date:** 2026-08-06  
**Verify:** `scripts/verify-stage-3-1b6r31-scope-impact-recommendations.ts`  

---

## 1. Recommendation UI

Scope Review mounts **Scope changes to review** when unresolved
scope-impact recommendations exist (`ScopeImpactRecommendationsPanel`).

Each row shows Work Area, affected scope item, current / suggested state,
human-readable triggering answer, explanation, **Apply change**, and
**Keep current scope**. Raw Fact keys, IDs, catalogue IDs, and provider
metadata are never rendered.

## 2. Apply change

`applyScopeImpactRecommendationAction` →
`applyScopeImpactRecommendationApp` → existing
`batchConfirmScopeItemsApp` for a single scope item:

- SCOPE_EXCLUDING → `NOT_REQUIRED` / REJECT
- SCOPE_ADDING → `INCLUDED` / ACCEPT
- `created_work_area_id` always null
- no Fact created
- duplicate apply blocked when already at intended state
- auth via org ownership; no client `org_id`
- success only after server confirmation + targeted refresh

## 3. Keep current scope

`keepScopeImpactRecommendationAction` appends a same-state decision with
`reason_code = scope_impact_kept` and the recommendation id in `user_note`.

- Retains existing include / not-required decision
- Does not rewrite Facts or Company Defaults
- Does not call the provider
- Does not stale the discovery run
- Unchanged Fact revision does not recreate the recommendation
- Materially changed Fact value yields a new recommendation identity

**No migration 030** — reuses append-only `scope_discovery_decisions`.

## 4. Identity

Deterministic id:
`workAreaId|scopeItemType|factKey|valueDigest|suggestedState`

Deduped across refresh, remount, repeated saves, and estimate regeneration.

## 5. Question / scope sync

After apply exclusion, question gates suppress related unanswered questions
via existing exclusion sets. Inclusion exposes applicable questions without
fabricating measurements. Keep leaves visibility consistent with current
scope.

## 6. Staleness

Recommendations keep Scope Review **CURRENT** (no Analyse again).
Only `FULL_REANALYSIS_REQUIRED` / material source changes show Analyse again.
Unresolved recommendations may show **Review needed** and a soft estimate
warning — they do not relock Quality or block saved work.

## 7. Boundaries

No Production enablement; no commercial formula change; no Company DNA;
no Builder Interview; Analyse Job preserved; **no migration**.

---

## Document control

| Field | Value |
| --- | --- |
| Path | `docs/implementation/STAGE_3_1B6R31_SCOPE_IMPACT_RECOMMENDATIONS_COMPLETION.md` |
| Created | 2026-08-06 |
| Status | Complete — Local, Preview Retest Pending |
