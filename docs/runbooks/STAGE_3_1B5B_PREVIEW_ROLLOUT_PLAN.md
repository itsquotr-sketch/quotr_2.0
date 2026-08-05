# Stage 3.1B.5B — Preview Rollout Plan

**Status:** In progress — migrations applied; server actions **Complete — Local** (3.1B.5C)  
**Date:** 2026-08-06  
**Depends on:** Remote migration runbook + owner approvals  
**Related:**  
- `docs/runbooks/STAGE_3_1B_REMOTE_MIGRATION_028_029_RUNBOOK.md`  
- `docs/architecture/STAGE_3_1B5B_PRODUCTION_WIRING_DESIGN.md`  
- `docs/decisions/STAGE_3_1B5B_REMOTE_AND_WIRING_APPROVAL.md`  
- `docs/implementation/STAGE_3_1B5C_GATED_SERVER_INTEGRATION_COMPLETION.md`  
- `docs/runbooks/STAGE_3_1B5C_PREVIEW_SERVER_INTEGRATION_TEST.md`  

---

## Purpose

Ordered Preview rollout so migrations land safely, existing product stays unchanged, server wiring ships behind a flag, and only then is discovery exercised on test projects.

Do not skip steps. Do not enable production until the Production gate passes.

---

## Vercel feature flag configuration

Configure in the Vercel dashboard (do not change automatically from this runbook). Redeploy after env changes.

**Preview**

```
SCOPE_DISCOVERY_ENABLED=true
```

**Production**

```
SCOPE_DISCOVERY_ENABLED=
```

or explicitly `false` — must remain **Disabled**.

Also confirm Preview has `ANTHROPIC_API_KEY` (and model env as used by the app). Do **not** add `NEXT_PUBLIC_SCOPE_DISCOVERY_ENABLED`.

Full Preview server integration checklist: `docs/runbooks/STAGE_3_1B5C_PREVIEW_SERVER_INTEGRATION_TEST.md`.

---

## Sequence

### 1. Apply 028/029 remotely

- Execute `STAGE_3_1B_REMOTE_MIGRATION_028_029_RUNBOOK.md` against **Preview** first.
- Owner approvals #1 and #2 required.
- Stop on any verification failure.

### 2. Verify DB only

- Confirm tables, RLS, indexes, RPCs, grants (runbook §§8–10).
- Confirm no Analyse Job / UI behaviour change (none deployed yet).
- Feature remains off / unimplemented.

### 3. Deploy code with feature disabled

- Deploy application build that may contain future action stubs **or** docs-only until next batch.
- `SCOPE_DISCOVERY_ENABLED` = false (env / server config).
- No public UI entry for Analyse Scope.

### 4. Verify existing app unchanged

Preview smoke:

- Create/open project; capture brief + notes.
- Run current **Analyse job** — suggested Work Areas still seed as today.
- Answer questions; estimate; pricing path smoke as per 3.1A sign-off.
- Confirm no discovery tables required for happy path.

### 5. Implement server actions in next batch — **Complete — Local** (3.1B.5C)

- Implemented actions per `STAGE_3_1B5B_PRODUCTION_WIRING_DESIGN.md` in `lib/scope-discovery/actions.ts` and application layer.
- Still behind flag; still no UI (Assistant UI not wired).
- Local verification via `scripts/verify-stage-3-1b5c-gated-server-integration.ts`.
- Preview verification: `docs/runbooks/STAGE_3_1B5C_PREVIEW_SERVER_INTEGRATION_TEST.md`.

### 6. Enable only in Preview

- Set `SCOPE_DISCOVERY_ENABLED=true` on Preview only.
- Production remains false.
- Owner approval #7 (Preview-only initial rollout).

### 7. Run discovery with test project

- Explicit Analyse Scope (or direct server action call).
- Confirm run + suggestions persisted.
- Confirm latency/cost logged within budget expectations.
- Confirm Analyse Job still available if supplement policy.

### 8. Test accept / reject / modify

- Accept → one confirmed WA + ACCEPT decision.
- Reject → REJECT, no WA; retry idempotent.
- Modify → corrected WA + MODIFY; original suggestion immutable.

### 9. Verify Work Area creation

- WA fields match mapping (type, name, summary, status=confirmed, ai_confidence=null).
- sort_order contiguous; org/project match.
- No duplicate confirmed type.

### 10. Verify no Fact fabrication

- Accept/modify must not insert/update `project_facts`.
- Optional missing-details question seed (if enabled) must not invent answered Facts.

### 11. Verify old Analyse Job remains available or replacement policy

- If **supplement** (recommended): Analyse Job still works; discovery is separate.
- If **replace** (only with approval #5): document cutover; keep flag rollback.

### 12. Review logs / cost / latency

- Check structured logs: run status, tokens, latency_ms, failure codes.
- Confirm no secrets / raw provider bodies.
- Compare to `STAGE_3_1B_SCOPE_DISCOVERY_LATENCY_AND_COST_BUDGET.md`.

### 13. Production gate

Before production:

| Gate | Required |
| --- | --- |
| Preview sequence 1–12 green | ☐ |
| Owner approvals #1–#10 as applicable | ☐ |
| Migrations on production via runbook | ☐ (separate apply) |
| Flag off until smoke | ☐ |
| Analyse Job policy decided (#5) | ☐ |
| Rollback understood (#8, #9) | ☐ |
| UI batch (3.1B.6) ready or limited internal-only actions | ☐ |

Production enable of the flag is a **separate** owner decision after Preview proof.

---

## Rollback summary

| Stage | Action |
| --- | --- |
| Flag on, bad behaviour | Set `SCOPE_DISCOVERY_ENABLED=false`; preserve data |
| Bad migration before data | Drop 029 then 028 objects per runbook §16 |
| Bad migration after data | Flag off; preserve; no destructive drop |
| Analyse Job | Unchanged path continues when flag off |

---

## Document control

| Field | Value |
| --- | --- |
| Path | `docs/runbooks/STAGE_3_1B5B_PREVIEW_ROLLOUT_PLAN.md` |
| Created | 2026-08-06 |
| Last updated | 2026-08-06 |
| Migrations 028/029 | **Applied and Verified** |
| Server actions (step 5) | **Complete — Local** (3.1B.5C) |
| Preview flag enablement | **Ready Pending Owner Test** |
| Production enablement | **Not Approved** |
