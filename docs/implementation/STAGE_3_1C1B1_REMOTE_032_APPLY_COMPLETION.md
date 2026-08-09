# Stage 3.1C.1B.1 — Remote Migration 032 Apply Completion

**Status:** Migration 032 — Applied and Verified Remote  
**Follow-on:** Stage 3.1C.1B.2 — App wiring Ready to Commit/Deploy; Preview authentication test Pending  
**Date:** 2026-08-09  
**Target:** Linked Supabase `quotr_2.0` (`lxvnylhsbvudzzupxeqr`)  
**Migration:** `032_transactional_signup_provisioning.sql`  
**Application code in 1B.1 gate:** Not modified  
**Application wiring status (1B.2):** Ready to Commit/Deploy (RPC signup + setup-required UI still required on Preview)  
**Preview authentication test:** Pending  
**3.1C.2:** Not Started  
**Production Scope Discovery:** Disabled  
**Stage 3.2:** Not Started

## 1. Linked target

| Field | Value |
| --- | --- |
| Project name | `quotr_2.0` |
| Project ref | `lxvnylhsbvudzzupxeqr` |
| Region | `ap-northeast-1` |
| Status | `ACTIVE_HEALTHY` |
| Linked | `true` |
| Precedent | Same remote carrying **028–031** |

Inactive legacy project `quotr` (`vwejrzdguuzxdgrvcnox`, `INACTIVE`, `linked=false`) was **not** targeted.

## 2. Migration history before

| Version | Local | Remote |
| --- | --- | --- |
| 001–031 | Present | Present |
| 032 | Present | **Absent** |

No mismatch other than 032 → gate continued.

## 3. SECURITY DEFINER audit (032 SQL)

| Check | Result |
| --- | --- |
| DEFINER necessary | **Yes** — no authenticated INSERT RLS on `organisations`/`profiles` (chicken-and-egg with `auth_org_id()`) |
| `SET search_path` | `search_path = public` (remote `proconfig`: `search_path=public`) |
| Identity | `v_uid := auth.uid()` only |
| No `user_id` / `org_id` args | Args = `p_organisation_name text, p_full_name text` only |
| Unauthenticated rejected | `auth.uid() IS NULL` → `PROVISION:NOT_AUTHENTICATED` |
| Name bounds | trim + non-empty + `char_length <= 200` |
| Idempotent existing profile | Returns existing org with `already_provisioned=true` |
| Inconsistent profile | Fail `PROVISION:PROFILE_INCONSISTENT` (no remapping) |
| Cross-org claim | Impossible — no org_id input; creates new org or returns own |
| Same transaction | Org insert + profile insert in one function body |
| Concurrency | `pg_advisory_xact_lock(87230132, hashtext(uid))` |
| Dynamic SQL / injection | None — bound parameters only |
| Commercial/project/rates writes | None |
| Hidden service-role dependency | None in function |

## 4. Identity / tenant safety

- Subject derived only from `auth.uid()`.
- Cannot attach to another organisation.
- Cannot supply foreign user/org ids.
- Stage 2A `auth_org_id()` still present remotely (unchanged by 032).
- RLS remains enabled on `organisations` and `profiles`.

## 5. Execute grants (remote verified)

| Role | EXECUTE |
| --- | --- |
| `anon` | **false** (`has_function_privilege`) |
| `PUBLIC` | Not present in `routine_privileges` |
| `authenticated` | **true** |
| `service_role` | **true** (intentional admin parity) |
| `postgres` | Owner EXECUTE (expected) |

## 6. Destructive-risk result

| Factor | Result |
| --- | --- |
| DROP / truncate / rewrite | **None** in 032 |
| Table/RLS/policy changes | **None** |
| Data mutation on apply | **None** (function + grants + notify only) |
| Gate | **PASS** |

## 7. Dry-run

```text
npx supabase db push --dry-run --linked
→ Would push these migrations:
  • 032_transactional_signup_provisioning.sql
```

**032 only.** No unrelated migrations.

## 8. Remote apply

```text
npx supabase db push --linked --yes
→ Applying migration 032_transactional_signup_provisioning.sql... OK
```

No remote reset. No history repair. No unrelated SQL.

## 9. History after

| Version | Local | Remote |
| --- | --- | --- |
| 001–032 | Present | Present |

`npx supabase migration list --linked` shows **032** on both sides.

## 10. Post-apply verification (remote)

| Check | Result |
| --- | --- |
| Function exists | `true` |
| `SECURITY DEFINER` | `prosecdef=true` |
| `search_path` | `search_path=public` |
| Args | `p_organisation_name text, p_full_name text` |
| Grants | anon false; authenticated/service_role true |
| RLS orgs/profiles | enabled |
| Row counts after apply | `organisations=2`, `profiles=2` (additive schema apply; no rewrite) |
| `auth_org_id` present | `true` |

No production/customer users were fabricated to exercise the RPC. Local verify already covered idempotency/atomicity; remote checks were metadata + privilege + count inspection.

## 11. Preview deployment / config status

| Item | Status |
| --- | --- |
| Branch | `hardening/stage-2a-security` |
| Origin HEAD | `3ba35ff` — includes migration 032 + `lib/auth/provisioning.ts` + docs |
| Linked Supabase URL target | Same `lxvnylhsbvudzzupxeqr` carrying 032 |
| Production Scope Discovery | **Disabled** (unchanged) |
| Service-role env | Leave in place for admin/tooling; not required for normal signup RPC |

### Deploy gap (resolved by 3.1C.1B.2 commit gate)

1B.1 recorded that HEAD still had legacy `createAdminClient` signup while worktree held RPC wiring. Stage **3.1C.1B.2** audits that wiring, leaves it ready to commit/deploy, and does **not** mark Preview-verified until owner retest.

Owner must commit/push the recommended 1B.2 file set and redeploy Preview before `STAGE_3_1C1B_PREVIEW_AUTH_RETEST.md`.

## 12. Status board

| Item | Status |
| --- | --- |
| Migration 032 | **Remote Applied** |
| Application wiring | **Ready to Commit/Deploy** (3.1C.1B.2) |
| Preview authentication test | **Pending** |
| Stage 3.1C.1B | Complete, Preview Retest Pending |
| Stage 3.1C.2 | Not Started |
| Production Scope Discovery | Disabled |
| Stage 3.2 | Not Started |

## 13. Exact owner Preview tests now required

1. Commit/deploy 1B.2 recommended files (RPC signup + setup-required UI + docs).
2. Confirm Preview URL → `lxvnylhsbvudzzupxeqr`.
3. Run `docs/runbooks/STAGE_3_1C1B_PREVIEW_AUTH_RETEST.md` (Tests A–F).
