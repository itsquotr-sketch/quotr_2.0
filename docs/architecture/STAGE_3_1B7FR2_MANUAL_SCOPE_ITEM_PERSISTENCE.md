# Stage 3.1B.7F-R2 — Manual Scope Item Persistence Decision

**Status:** Approved — Local + Remote **030/031 Applied and Verified**  
**Date:** 2026-08-08  
**Remote apply:** Complete on linked `quotr_2.0` (`lxvnylhsbvudzzupxeqr`) —  
  030 schema + 031 ACL hardening  
  (`STAGE_3_1B7FR21_REMOTE_030_APPLY_COMPLETION.md`,  
  `STAGE_3_1B7FR22_MANUAL_SCOPE_ACL_HARDENING_COMPLETION.md`)  

## Decision

**Option B — dedicated tables** under confirmed Work Areas:

- `work_area_scope_items` — user-authored scope definitions  
- `work_area_scope_item_decisions` — append-only INCLUDE / EXCLUDE  

**Not chosen:** extending `scope_discovery_suggestions` with `origin=user`.

## Why not extend suggestions (Option A)

| Constraint | Problem for user items |
| --- | --- |
| `run_id NOT NULL` | Forces attaching to a discovery run or inventing one |
| `original_status = 'PROPOSED'` only | User items are not model proposals |
| Immutable suggestion payload | User title/description edits fight immutability |
| Origin type `deterministic \| ai \| merged` | Cannot honestly say `user` |
| Decision ACCEPT creates Work Areas for some kinds | Risk of accidental WA creation |

Pretending a builder-authored item is a discovery suggestion would violate
“do not fabricate an AI suggestion” and confuse provenance forever.

## Model

```
confirmed work_areas
  └── work_area_scope_items (origin='user' only)
        └── work_area_scope_item_decisions (INCLUDE | EXCLUDE, append-only)
```

System-proposed scope remains on `scope_discovery_suggestions` +
`scope_discovery_decisions`. UI merges both for Scope Review.

## Rules

- Parent `work_area_id` required; same org/project as WA  
- No Fact creation  
- No catalogue mutation  
- No Company DNA  
- No commercial money on these rows  
- Default decision on create: INCLUDE  
- Latest decision wins for Included / Not required  
- Optional `scope_item_type` for future canonical mapping only when explicit  

## Pricing boundary

Unsupported manual items appear as **Pricing required** in Estimate Review /
breakdown listings. They must not look calculated at $0. When Final Pricing is
created, they may be carried as allowance stubs with null rates and clear notes
for the builder to price.

## Local vs remote

- Local Docker: apply via migration reset through **031**  
- Remote / Preview DB: **030 + 031 Applied and Verified** on linked `quotr_2.0`
  (`lxvnylhsbvudzzupxeqr`) — see  
  `STAGE_3_1B7FR21_REMOTE_030_APPLY_COMPLETION.md` and  
  `STAGE_3_1B7FR22_MANUAL_SCOPE_ACL_HARDENING_COMPLETION.md`  
- **service_role:** SELECT/INSERT/UPDATE/DELETE (admin DML; not GRANT ALL)  
- **authenticated:** SELECT/INSERT only on both tables (031; 028-style revoke)  
- **anon:** no DML  
- RLS from 030 unchanged; grants + RLS defence in depth  

## ACL note (7F-R2.2)

026 default privileges previously left UPDATE/DELETE on authenticated for 030
tables. 031 revoked and regranted least privilege matching live server actions.
