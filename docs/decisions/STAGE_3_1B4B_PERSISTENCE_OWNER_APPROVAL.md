# Stage 3.1B.4B — Persistence Owner Approval Register

**Status:** Awaiting owner decisions — **Nothing approved**  
**Date:** 2026-08-05  
**Architecture:** `docs/architecture/STAGE_3_1B4B_PERSISTENCE_ARCHITECTURE.md`  
**Security:** `docs/security/STAGE_3_1B4B_PERSISTENCE_SECURITY_REVIEW.md`  
**Verification plan:** `docs/runbooks/STAGE_3_1B4B_PERSISTENCE_VERIFICATION_PLAN.md`

Do **not** create migration `028` or wire production until this register is signed.

---

## Decision register

| # | Decision | Recommended MVP | Owner status | Approved date |
| ---: | --- | --- | --- | --- |
| 1 | **Final table count** | **3 tables:** `scope_discovery_runs`, `scope_discovery_suggestions`, `scope_discovery_decisions` | Pending | — |
| 2 | **Evidence storage** | **JSONB** on immutable suggestion payload; **no** `scope_discovery_evidence` table in MVP | Pending | — |
| 3 | **Decisions model** | **Append-only** event rows; corrections = new rows; no UPDATE of decision body | Pending | — |
| 4 | **Soft-deletable runs/suggestions** | **Optional `archived_at`** on runs only; suggestions follow run; **no** hard delete in normal use | Pending | — |
| 5 | **Raw provider output** | **Do not persist** by default; store validated canonical result + metadata only | Pending | — |
| 6 | **Idempotency uniqueness** | **Partial unique** `(project_id, idempotency_key) WHERE status = 'RUNNING'`; completed reuse is application-level read of latest success | Pending | — |
| 7 | **Completed-run immutability** | **Yes** — freeze snapshot, fingerprint, versions, trigger, objective after terminal status (trigger-enforced) | Pending | — |
| 8 | **Suggestion immutability** | **Yes** — freeze original payload/evidence; status/stale/supersede pointers only may change | Pending | — |
| 9 | **Acceptance RPC / transaction** | **Yes, recommended** — single transaction (or SECURITY DEFINER RPC) for decision insert + Work Area create + status update | Pending | — |
| 10 | **Retention period** | **Retain while project exists**; soft-archive policy TBD; no account-deletion automation in this stage | Pending | — |
| 11 | **RLS policy model** | Org isolation via `auth_org_id()`; SELECT/INSERT; limited UPDATE; **no** client DELETE on discovery tables; **no** decision UPDATE | Pending | — |
| 12 | **Restricted grants** | Align with migration **026**: authenticated + service_role DML; **anon none** | Pending | — |
| 13 | **Migration number and remote gate** | File **`028_…sql`** after `027`; **local Docker first**; remote/Preview only with explicit owner command | Pending | — |
| 14 | **Local-only until Preview adoption** | **Yes** — same Stage 2A discipline | Pending | — |
| 15 | **Rollback strategy** | **Pre-adoption:** drop empty tables. **Post-data:** disable feature flag; **preserve** rows; no destructive production drop | Pending | — |

---

## Explicit non-approvals (carry forward)

| Item | Status |
| --- | --- |
| Creating migration 028 | **Not Approved** |
| Applying persistence schema remotely | **Not Approved** |
| Production Analyse Job adoption | **Not Started** |
| Accept/reject UI | **Not Started** |
| Company DNA writes from decisions | **Forbidden** |
| Commercial columns on discovery tables | **Forbidden** |
| Separate evidence table | **Not in MVP** (unless #2 overturned) |

---

## Owner sign-off block

When approving, copy and complete:

```text
I approve Stage 3.1B.4B persistence decisions #1–#15 as recommended / with amendments:
Amendments: _______________
Migration 028 authorisation: Local only / Local + Preview / Denied
Signed: _______________  Date: _______________
```

Until signed, implementation batch **3.1B.4B** remains **Ready Pending Owner Approval**.

---

## Document control

| Field | Value |
| --- | --- |
| Path | `docs/decisions/STAGE_3_1B4B_PERSISTENCE_OWNER_APPROVAL.md` |
| Created | 2026-08-05 |
| Approvals | **None** |
