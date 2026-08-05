# Stage 3.1B.5B — Remote Migration Readiness and Production Wiring Design Completion

**Status:** Complete — Planning  
**Date:** 2026-08-06  
**Batch type:** Remote-readiness, deployment planning, server-integration design  
**Remote apply:** **Not Applied** — Ready Pending Owner Approval  
**Production server wiring:** Ready Pending Remote Migration  
**UI:** Not Started  
**Feature flag:** Planned  
**Analyse Job:** Unchanged  

---

## 1. Objective

Prove migrations 028 and 029 are safe to apply remotely, define the exact remote rollout, and design authenticated server-side wiring for later connection of orchestration, persistence, decision lifecycle, Work Area creation, and UI — without applying migrations, wiring production, or changing Analyse Job.

---

## 2. Remote migration-history result

Commands (read-only):

```bash
npx supabase migration list
npx supabase db diff --linked --schema public
```

| Check | Result |
| --- | --- |
| Remote through 027 | **Aligned** (001–027 local = remote) |
| 028 | Local only — remote empty |
| 029 | Local only — remote empty |
| Name collisions on remote | **None** — no `scope_discovery_*` tables/functions/policies on remote |
| Unexplained conflicting objects | **None** |
| Destructive apply required | **No** — adoption is additive via migration push; do **not** apply the shadow→remote DROP diff |

History alignment: **Pass**. Proceeded with safety audits and planning docs.

---

## 3. Migration 028 safety result

| Criterion | Result |
| --- | --- |
| Additive only | **Pass** — CREATE tables/indexes/triggers/policies/grants |
| Existing data rewrite | **Pass** — none |
| Existing table alteration | **Pass** — reuses `enforce_child_project_org_match` only |
| Broad grants / GRANT ALL | **Pass** — revoke-then-grant least privilege |
| Anon DML | **Pass** — none |
| Cross-org exposure | **Pass** — RLS `org_id = auth_org_id()` |
| Function-name collisions | **Pass** — new `scope_discovery_*` / enforce helpers only |
| Trigger `search_path` | **Residual** — 028 triggers use fully-qualified `public.*` but omit `SET search_path`; aligned with some Stage 2A triggers; optional hardening documented |
| JSONB caps | **Pass** — size CHECKs on snapshot/evidence/warnings/errors |
| Immutability | **Pass** — terminal run / suggestion payload / decision append-only triggers |
| Idempotency | **Pass** — partial unique RUNNING; one ACCEPT unique |
| Rollback before adoption | **Pass** — drop empty objects |

**Verdict:** Safe for remote apply after owner approval.

---

## 4. Migration 029 safety result

| Criterion | Result |
| --- | --- |
| RPC signatures | **Pass** — accept / reject / modify_accept |
| SECURITY INVOKER | **Pass** — caller RLS + auth.uid() |
| `search_path` | **Pass** — `SET search_path = public` on RPCs/helpers |
| auth.uid() / org derivation | **Pass** — profile org; fail closed |
| Project ownership | **Pass** — project must match caller org |
| Duplicate acceptance | **Pass** — locks + partial unique scope-create index |
| Work Area mapping | **Pass** — confirmed WA; `ai_confidence=null`; no Facts |
| Transaction atomicity | **Pass** — function transaction; unique_violation → fail |
| RPC grants | **Pass** — authenticated + service_role; anon revoked |
| Error sanitisation | **Pass** — `SCOPE_DISCOVERY_DECISION:*` codes |
| No Facts / suggestion mutation | **Pass** |
| Function-name collisions | **Pass** |

**Verdict:** Safe for remote apply after 028 and owner approval.

---

## 5. Deliverables created

1. `docs/runbooks/STAGE_3_1B_REMOTE_MIGRATION_028_029_RUNBOOK.md`
2. `docs/architecture/STAGE_3_1B5B_PRODUCTION_WIRING_DESIGN.md`
3. `docs/runbooks/STAGE_3_1B5B_PREVIEW_ROLLOUT_PLAN.md`
4. `docs/decisions/STAGE_3_1B5B_REMOTE_AND_WIRING_APPROVAL.md`
5. `docs/implementation/STAGE_3_1B5B_READINESS_COMPLETION.md` (this file)

---

## 6. Documents updated

- `docs/plans/STAGE_3_1B_INTELLIGENT_SCOPE_DISCOVERY_PLAN.md`
- `docs/product/QUOTR_PRODUCT_BACKLOG.md`
- `docs/plans/STAGE_3_PRODUCT_ROADMAP.md`
- `docs/MVP_HARDENING_GUIDE.md`

---

## 7. Production wiring design (summary)

Explicit Analyse Scope → authenticated server action → sources → catalogue → provider orchestration → persist run/suggestions → safe result → UI proposals → accept/reject/modify → decision RPC → Work Area → targeted revalidation.

Boundaries: server action (auth/flag/sources/orchestrate/persist/revalidate); orchestrator (merge/idempotency/stale); persistence (history); acceptance RPC (atomic WA+decision); UI (trigger/evidence/controls only).

---

## 8. Future server actions (designed, not implemented)

- `runScopeDiscovery(projectId)`
- `getScopeDiscoveryResults(projectId)`
- `acceptScopeSuggestion(suggestionId)`
- `rejectScopeSuggestion(suggestionId, reason)`
- `modifyScopeSuggestion(suggestionId, modification)`
- `markScopeDiscoveryStale(projectId)` where appropriate

Each specified with input schema, auth, ownership, transaction, return shape, revalidation, errors, idempotency, audit.

---

## 9. Feature-flag strategy

| Item | Value |
| --- | --- |
| Name | `SCOPE_DISCOVERY_ENABLED` |
| Default | **Off** until remote migrations + Preview tests pass |
| Scope | Server-side only |
| Secrets | None exposed to client |
| When off | Analyse Job unchanged; discovery actions refuse |
| Rollback | Disable flag; **preserve** data |
| Dual-write | **Not approved** |

Documentation only — no flag constant implemented this batch.

---

## 10. Preview rollout plan

13-step sequence in `STAGE_3_1B5B_PREVIEW_ROLLOUT_PLAN.md`: apply → DB verify → deploy flag-off → smoke existing app → implement actions → Preview enable → discovery/accept tests → Fact/Analyse Job checks → logs → production gate.

---

## 11. Owner approvals required

Register: `docs/decisions/STAGE_3_1B5B_REMOTE_AND_WIRING_APPROVAL.md` (#1–#10).

**Remote apply of 028/029 remains Not Approved** (recommended values recorded; not marked approved).

---

## 12. Verification results

| Check | Result |
| --- | --- |
| `npx tsc --noEmit` | **Pass** |
| `npm run lint` | **Pass** |
| `npm run build` | **Pass** |
| `verify-stage-3-1b4b-persistence.ts` | **39 passed, 0 failed** |
| `verify-stage-3-1b5a-decision-lifecycle.ts` | **46 passed, 0 failed** |
| `verify-rls-coverage.ts` | **Pass** |
| `verify-batch-2b10-final-commercial-authority.ts` | **57/57 Pass** |
| Post-batch `migration list` | Still 001–027 remote; 028/029 local-only |

---

## 13. Confirmation — boundaries held

| Boundary | Status |
| --- | --- |
| No remote migration applied | **Confirmed** |
| No production application code changed | **Confirmed** (docs only) |
| No UI changed | **Confirmed** |
| No Analyse Job changed | **Confirmed** |
| No AI prompt changed | **Confirmed** |
| No commercial formula changed | **Confirmed** |
| No Company DNA / Builder Interview | **Confirmed** |
| No production Work Areas from discovery | **Confirmed** |

---

## 14. Final planning status

| Item | Status |
| --- | --- |
| Stage 3.1B.5B | **Complete — Planning** |
| Migrations 028/029 remote apply | **Ready Pending Owner Approval** |
| Production server wiring | **Ready Pending Remote Migration** |
| UI | **Not Started** |
| Feature flag | **Planned** |
| Analyse Job | **Unchanged** |

---

## 15. Recommended next action

1. Owner review and sign `STAGE_3_1B5B_REMOTE_AND_WIRING_APPROVAL.md` (#1–#10), especially Preview remote apply of 028 then 029.  
2. Execute `STAGE_3_1B_REMOTE_MIGRATION_028_029_RUNBOOK.md` on Preview only.  
3. Implement gated server actions (next batch) per wiring design with flag off.  
4. Follow Preview rollout plan before any production enable.

---

## 16. Proposed commit message

```
docs(3.1B.5B): remote migration readiness and production wiring design

Prove 028/029 are safe for owner-gated remote apply; add runbook,
wiring design, Preview rollout, and approval register without pushing
migrations or changing Analyse Job / UI / production code.
```

---

## Document control

| Field | Value |
| --- | --- |
| Path | `docs/implementation/STAGE_3_1B5B_READINESS_COMPLETION.md` |
| Created | 2026-08-06 |
| Remote apply executed | **No** |
