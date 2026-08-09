# Stage 3.1C.1B — Provisioning Security Review

**Status:** Complete — Local review  
**Date:** 2026-08-09  
**Migration:** 032 (local only until owner gate)

## Threat model (signup / repair)

| Threat | Mitigation |
| --- | --- |
| Caller supplies foreign `user_id` | Parameter absent; subject = `auth.uid()` only |
| Caller supplies foreign `org_id` / claims orphan org | Parameter absent; new org created or existing profile returned |
| Unauthenticated EXECUTE | Revoked from `anon` / `PUBLIC`; unauthenticated RPC fails |
| Privilege escalation via DEFINER | Narrow body: validate names, advisory lock, insert org+profile only; no project/commercial writes |
| `search_path` hijack | `SET search_path = public` on function |
| Duplicate orgs on retry/concurrency | Idempotent profile check + `pg_advisory_xact_lock` |
| Org without profile (partial failure) | Single transaction; FK failure rolls back org |
| Raw error leakage | App maps to 1A/1B auth taxonomy |
| Service-role in browser | Unchanged: `server-only` admin module; signup does not import it |

## SECURITY DEFINER justification

`organisations` and `profiles` have **no authenticated INSERT RLS policies**. Creating a company requires inserting an organisation before `auth_org_id()` can resolve — chicken-and-egg under INVOKER.

DEFINER is therefore required, and is constrained by:

- no caller-controlled identity parameters;
- auth required (`auth.uid()` null → fail);
- idempotent read path for existing valid profiles;
- fail-closed on inconsistent profile/org linkage;
- EXECUTE limited to `authenticated` (+ `service_role` admin parity);
- no commercial / project / rates side effects.

## Grants

| Role | EXECUTE |
| --- | --- |
| `PUBLIC` | Revoked |
| `anon` | Denied |
| `authenticated` | Granted |
| `service_role` | Granted (admin/tooling parity with 026/029) |

RLS policies on tables: **unchanged**.

## Residual risks / deferred

- Email-confirmation signup leaves auth user without profile until repair (honest `CONFIRMATION_PENDING`) — callback polish is **3.1C.2**.
- Historic orphan organisations are not auto-claimed or bulk-deleted.
- Remote apply of 032 still owner-gated.
