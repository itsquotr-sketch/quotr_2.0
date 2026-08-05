# Stage 3.1B.5C — Gated Server Integration Completion

**Status:** Complete — Local  
**Date:** 2026-08-06  
**Verify:** `scripts/verify-stage-3-1b5c-gated-server-integration.ts`  
**Remote migrations 028/029:** Applied and Verified (owner-confirmed for this batch)  
**Server integration:** Complete — Local, UI Unwired  
**Preview feature enablement:** Ready Pending Owner Test  
**Production feature:** Disabled  
**Analyse Job:** Unchanged  
**UI:** Not Started  

---

## 1. Objective

Connect existing scope-discovery orchestration, persistence, and decision RPCs to authenticated server-side application services and thin server actions behind `SCOPE_DISCOVERY_ENABLED`, without UI adoption or Analyse Job replacement.

---

## 2. Feature configuration

| Item | Value |
| --- | --- |
| Module | `lib/scope-discovery/configuration/` |
| Env | `SCOPE_DISCOVERY_ENABLED` |
| Enable token | exact `true` |
| Default | Disabled (absent/invalid) |
| Client exposure | None — no `NEXT_PUBLIC_` |
| Provider check | `getScopeDiscoveryAvailability()` — reports configured without secrets |

Disabled path: no provider call, no run/suggestion insert, decisions unavailable.

---

## 3. Source collection

`lib/scope-discovery/application/source-collector.ts`

Collects (org-scoped, active project only): brief, site notes (non-internal), confirmed Work Areas, Facts, Constraints, region, prior runs/decisions.

Bounds in `SOURCE_BOUNDS`. No commercial/pricing/quote records. Org from auth context.

---

## 4. Run service

`lib/scope-discovery/application/run-scope-discovery.ts`

1. Feature gate  
2. Auth + ownership via source collection  
3. Idempotency (reuse / duplicate in-flight / execute)  
4. Insert `RUNNING` before provider  
5. `executeScopeDiscovery` with injected runner  
6. Persist suggestions + complete run  
7. ORCH-POL-01 → `COMPLETED_WITH_WARNINGS` on provider failure with deterministic results  
8. Safe DTO return; no Analyse Job / WA / Fact side effects  

---

## 5. Persistence behaviour

Uses existing 3.1B.4B repositories (+ list/detail helpers). Org derived from auth. No raw provider body. Suggestions validated before insert. Active-run unique index is final concurrency guard.

---

## 6. Read service

`getScopeDiscoveryResults` — composes decision state from append-only decisions; evaluates stale vs current sources; hides results when feature disabled (rollout default).

---

## 7. Decision services

`acceptScopeSuggestionApp` / `rejectScopeSuggestionApp` / `modifyScopeSuggestionApp` wrap 3.1B.5A RPCs behind the feature flag. Work Areas only via acceptance RPC. No Facts.

---

## 8. Stale evaluation

`evaluateScopeDiscoveryStale` — compare snapshots; no provider call; no mutation of completed runs. Formatting/provider-only changes are not material stale.

---

## 9. Server actions

`lib/scope-discovery/actions.ts` — thin `"use server"` wrappers. **Not imported by Assistant UI.**

---

## 10. Safe results / errors

Stable `APPLICATION_ERROR_CODES`; safe messages; no SQL/provider stacks; no secrets in DTOs.

---

## 11. Idempotency / concurrency

Application idempotency + DB partial unique on `RUNNING`. Reuse identical completed; force rerun supported; duplicate in-flight rejected.

---

## 12. Observability

`logDiscoveryEvent` — structured `[scope-discovery]` logs (ids, status, tokens, elapsed). No brief/notes/evidence/secrets.

---

## 13. Verification

`scripts/verify-stage-3-1b5c-gated-server-integration.ts` — local-only; **51 passed, 0 failed**.

---

## 14. Full regression

| Check | Result |
| --- | --- |
| `tsc --noEmit` | Pass |
| `npm run lint` | Pass |
| `npm run build` | Pass |
| `verify-stage-3-1a-product-stabilisation.ts` | 37/37 |
| `verify-stage-3-1a-r1-preview-remediation.ts` | 42/42 |
| `verify-stage-3-1d-domain-model-refinement.ts` | 45/45 |
| `verify-stage-3-1b1-suggestion-contract.ts` | 53/53 |
| `verify-stage-3-1b2-scope-relationship-catalogue.ts` | 47/47 |
| `verify-stage-3-1b3-ai-discovery-provider.ts` | 55/55 |
| `verify-stage-3-1b4a-discovery-orchestration.ts` | Pass |
| `verify-stage-3-1b4b-persistence.ts` | 39/39 |
| `verify-stage-3-1b5a-decision-lifecycle.ts` | 46/46 |
| `verify-stage-3-1b5c-gated-server-integration.ts` | 51/51 |
| `verify-rls-coverage.ts` | Pass |
| `verify-batch-2b10-final-commercial-authority.ts` | 57/57 |

---

## 15. Preview configuration

See `docs/runbooks/STAGE_3_1B5C_PREVIEW_SERVER_INTEGRATION_TEST.md` and updated Preview rollout plan.

Preview: `SCOPE_DISCOVERY_ENABLED=true`  
Production: absent or `false`  
Redeploy required after env change.

---

## 16. Remote migration status

**028/029 — Applied and Verified** (per owner confirmation entering this batch).

---

## 17. Production feature status

**Disabled.** No production enablement in this batch.

---

## 18. Known limitations

- No user-facing proposal UI  
- Results hidden when flag off  
- Missing-details question seed after accept deferred  
- Live Anthropic only when key present and flag on  
- Analyse Job remains separate (supplement policy)

---

## 19. Rollback

Set `SCOPE_DISCOVERY_ENABLED` absent/false. Preserve discovery history and any accepted Work Areas. Analyse Job unchanged.

---

## 20. Recommendation for Stage 3.1B.6

Owner Preview server test → then Assistant UI for Analyse Scope trigger, evidence display, confidence grouping, accept/reject/modify controls — still behind flag; still no Analyse Job replace unless separately approved.

---

## Confirmation

No Analyse Job change; no Assistant UI import; no new migration; no commercial formula / DNA / Builder Interview change.

---

## Document control

| Field | Value |
| --- | --- |
| Path | `docs/implementation/STAGE_3_1B5C_GATED_SERVER_INTEGRATION_COMPLETION.md` |
| Created | 2026-08-06 |
