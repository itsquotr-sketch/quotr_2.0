# Stage 3.1B.4B — Persistence Completion

**Status:** Complete — Local  
**Date:** 2026-08-05  
**Migration:** `supabase/migrations/028_scope_discovery_persistence.sql`  
**Verify:** `scripts/verify-stage-3-1b4b-persistence.ts`  
**Remote apply:** **Not Applied**  
**Production adoption:** **Not Started**  
**Analyse Job:** **Unchanged**  

---

## 1. Objective

Implement a secure, minimal, locally verified persistence layer for scope-discovery runs, immutable suggestions, and append-only decisions — without wiring Analyse Job, UI, or Work Area acceptance.

---

## 2. Owner approvals

Recorded **Approved 2026-08-05** in `docs/decisions/STAGE_3_1B4B_PERSISTENCE_OWNER_APPROVAL.md`:

1–15 as specified (three tables; evidence JSONB; append-only decisions; soft archive; no raw provider output; active-run idempotency; immutability; future accept RPC not implemented this batch; indefinite retention; RLS via `auth_org_id()`; least-privilege grants; migration `028`; local-only; rollback preserve-after-data).

**ORCH-POL-01 — Approved:** deterministic success + provider failure may complete as `COMPLETED_WITH_WARNINGS`.

---

## 3. Migration objects

`028_scope_discovery_persistence.sql` creates:

- tables + CHECKs + size caps  
- indexes + partial unique active idempotency + one-ACCEPT unique  
- org/project/run/suggestion integrity triggers  
- immutability triggers  
- RLS policies  
- least-privilege grants  
- table/column comments  

---

## 4. Table model

| Table | Role |
| --- | --- |
| `scope_discovery_runs` | Run history, snapshot, versions, provider metadata |
| `scope_discovery_suggestions` | Immutable original proposal + capped evidence JSONB |
| `scope_discovery_decisions` | Append-only ACCEPT / REJECT / MODIFY |

No `scope_discovery_evidence` table. No commercial columns. No raw provider response column.

---

## 5. Constraints

Run statuses/triggers; suggestion kinds; confidence bands; `original_status = PROPOSED`; decision types ACCEPT/REJECT/MODIFY; non-negative latency/tokens; completed_at ≥ started_at; JSONB type checks + size caps.

---

## 6. Indexes / idempotency

- Partial unique `(project_id, idempotency_key) WHERE status = 'RUNNING'`  
- Unique `(run_id, suggestion_identity)`  
- Partial unique ACCEPT per `suggestion_id`  
- Supporting org/project/run/identity indexes  

Completed-run reuse remains application-controlled (ORCH).

---

## 7. Integrity triggers

- Reuse `enforce_child_project_org_match` on all three tables  
- Suggestion must match parent run; parent suggestion same run; related WA same org/project  
- Decision must match suggestion org/project/run; created WA same org/project  
- reused/superseded run same org/project  

---

## 8. Immutability

- Terminal runs: only `archived_at` (+ `updated_at`); no return to RUNNING  
- Suggestions: payload/evidence frozen; only `stale_reason` / `superseded_by_suggestion_id`  
- Decisions: no UPDATE / no DELETE (trigger + no policies)  

---

## 9. RLS

Enabled on all three. `org_id = auth_org_id()`. SELECT/INSERT; limited UPDATE on runs/suggestions; no authenticated DELETE; decisions INSERT/SELECT only.

---

## 10. Grants

Revoke-then-grant (required because migration 026 default privileges otherwise grant UPDATE/DELETE on new tables):

- Authenticated: SELECT/INSERT/UPDATE on runs & suggestions; SELECT/INSERT on decisions (no UPDATE/DELETE).
- Service role: SELECT/INSERT/UPDATE/DELETE.
- Anon: none.
- No GRANT ALL / no TRUNCATE/REFERENCES/TRIGGER to app roles.

---

## 11. Persistence adapters

`lib/scope-discovery/persistence/` — injectable `PersistenceAuthContext`; org from profile; project ownership check; mappers strip secrets; safe errors; **no Work Area creation**.

---

## 12. Local verification

`verify-stage-3-1b4b-persistence.ts` refuses non-local URLs; **39 passed, 0 failed** (migration objects, grants, same-org, cross-org, integrity, immutability + append-only triggers, idempotency, duplicate ACCEPT, mapper sanitisation, Analyse Job non-import).

---

## 13. Full regression

All passed (2026-08-05):

| Check | Result |
| --- | --- |
| `supabase db reset` (001–028) | Pass |
| `tsc --noEmit` | Pass |
| `npm run lint` | Pass |
| `npm run build` | Pass |
| `verify-stage-3-1a-product-stabilisation.ts` | 37/37 |
| `verify-stage-3-1a-r1-preview-remediation.ts` | 42/42 |
| `verify-stage-3-1d-domain-model-refinement.ts` | 45/45 |
| `verify-stage-3-1b1-suggestion-contract.ts` | 53/53 |
| `verify-stage-3-1b2-scope-relationship-catalogue.ts` | 47/47 |
| `verify-stage-3-1b3-ai-discovery-provider.ts` | 55/55 |
| `verify-stage-3-1b4a-discovery-orchestration.ts` | 59/59 |
| `verify-stage-3-1b4b-persistence.ts` | 39/39 |
| `verify-rls-coverage.ts` | Pass |
| `verify-batch-2b10-final-commercial-authority.ts` | Pass |
---

## 14. Remote status

**Migration 028 — Complete — Local, Not Applied Remotely.**

---

## 15. Known limitations

- No production wiring / UI / accept RPC  
- Soft-archive only on runs  
- Decision-derived “current status” is application-composed, not a mutable authoritative column on suggestions  

---

## 16. Rollback

- Pre-adoption / empty local: drop new objects  
- Post-data: disable feature; **preserve** records  

---

## 17. Confirmation — no production adoption

No remote apply, Analyse Job import, UI, Work Area acceptance action, commercial-formula, Company DNA, or Builder Interview work.

---

## 18. Recommendation for 3.1B.5

**Ready Pending Acceptance Lifecycle Gate:** transactional accept (decision + Work Area create + linkage) via RPC/server action; reject/modify; no DNA; preserve Fact SoT; still no Analyse Job rewire until separately gated.
