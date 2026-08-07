# Stage 3.1B.7F-R2.1 — Migration 030 Remote Apply Completion

**Status:** Complete — Remote Applied and Verified  
**Date:** 2026-08-08  
**Target:** Linked Supabase `quotr_2.0` (`lxvnylhsbvudzzupxeqr`)  
**Migration:** `030_work_area_scope_items.sql`  
**Production Scope Discovery:** Disabled (unchanged)  
**Stage 3.2:** Not Started  

## Linked target

| Field | Value |
| --- | --- |
| Project name | `quotr_2.0` |
| Project ref | `lxvnylhsbvudzzupxeqr` |
| Region | `ap-northeast-1` |
| Status | `ACTIVE_HEALTHY` |
| Link | `linked=true` (CLI) |
| Precedent | Same remote that already carries **028/029** |

Inactive historical project `quotr` (`vwejrzdguuzxdgrvcnox`) was **not** targeted.

## Pre-apply history

| Version | Local | Remote |
| --- | --- | --- |
| 001–029 | Present | Present |
| 030 | Present | **Absent** |

`npx supabase db push --dry-run --linked` → would push **only** `030_work_area_scope_items.sql`.

## Collision / destructive gates

| Gate | Result |
| --- | --- |
| Remote tables `work_area_scope_items` / `_decisions` | Absent (no collision) |
| Remote enforce-parent functions | Absent (count 0) |
| Discovery tables 028 still present | Present |
| Destructive SQL in 030 | None (`DROP TABLE` / truncate / data rewrite absent). Only `DROP TRIGGER IF EXISTS set_updated_at` on the **new** table before recreate — noop on first create |
| Dry-run migrations | Additive only (030) |

## Apply

```text
npx supabase db push --linked --yes
→ Applying migration 030_work_area_scope_items.sql... OK
```

No remote reset. No history repair. No unrelated SQL.

## Post-apply history

| Version | Local | Remote |
| --- | --- | --- |
| 001–030 | Present | Present |

## Post-apply verification (remote SQL)

- Both tables exist; **RLS enabled** on both.
- Policies (org-scoped via `auth_org_id()`):
  - items: SELECT / INSERT / UPDATE
  - decisions: SELECT / INSERT only (append-only at policy layer)
- **No DELETE policies** on either table; **no UPDATE policy** on decisions → RLS denies those ops for `authenticated`.
- **anon:** zero table grants.
- Existing counts unchanged by schema apply: `work_areas=130`, `scope_discovery_runs=11`, `pricing_documents=10`; new tables empty (`0` / `0`).

### Grant-layer note (non-blocking)

Migration **026** default privileges grant `SELECT/INSERT/UPDATE/DELETE` on new tables to `authenticated`. Migration **028** revoked then re-granted least privilege. **030** did not include that revoke step, so `information_schema` currently shows broader table privileges than the intended GRANT lines.

**Effective security still matches intent** because RLS has no DELETE (items/decisions) and no UPDATE (decisions) policies. Recommend a future additive **031** revoke/regrant (028 parity) — **not** applied in this gate.

## Feature flags

| Env | `SCOPE_DISCOVERY_ENABLED` |
| --- | --- |
| Preview | Remains `true` (unchanged; not modified by this gate) |
| Production | Remains absent/false (unchanged) |

## Next action

Owner Deck Preview retest of manual **Add scope item** persistence on Preview app against remote 030 — see `docs/runbooks/STAGE_3_1B7FR2_DECK_PREVIEW_RETEST.md`.
