# Stage 3.1B.7F-R2.2 — Manual Scope Item ACL Hardening

**Status:** Complete — Migration 031 Applied and Verified Remote  
**Date:** 2026-08-08  
**Target:** Linked Supabase `quotr_2.0` (`lxvnylhsbvudzzupxeqr`)  
**Migration:** `031_work_area_scope_items_acl_hardening.sql`  
**History:** Local/remote aligned **001–031**  
**Deck Preview Retest:** Ready  
**Production:** Disabled  
**Stage 3.2:** Not Started  
**Stage 3.1B Owner E2E:** Open  

## Purpose

Defence-in-depth ACL hardening after 030 remote apply. Migration **026** default
privileges leave `SELECT/INSERT/UPDATE/DELETE` on new tables for
`authenticated`. Migration **028** revoked then regranted least privilege;
**030** did not. RLS already blocked prohibited ops; **031** removes unnecessary
table privileges.

No application behaviour change. No schema redesign. No RLS policy edits.

## Pre-031 grants (local + remote identical)

| Role | `work_area_scope_items` | `work_area_scope_item_decisions` |
| --- | --- | --- |
| anon | none | none |
| authenticated | SELECT, INSERT, **UPDATE**, **DELETE** | SELECT, INSERT, **UPDATE**, **DELETE** |
| service_role | ALL (incl. REFERENCES/TRIGGER/TRUNCATE) | ALL |

## Application operations audited

`lib/work-areas/scope-items/actions.ts` and `lib/pricing/actions.ts`:

| Table | Operations used |
| --- | --- |
| `work_area_scope_items` | SELECT, INSERT only |
| `work_area_scope_item_decisions` | SELECT, INSERT only |

No `.update()` / `.delete()` paths. Include/exclude is append-only via decisions.

## Final least-privilege model

| Role | items | decisions |
| --- | --- | --- |
| anon | none | none |
| authenticated | SELECT, INSERT | SELECT, INSERT |
| service_role | SELECT, INSERT, UPDATE, DELETE | SELECT, INSERT, UPDATE, DELETE |

RLS from 030 retained (including unused items UPDATE policy — grant layer now
denies authenticated UPDATE). Cross-org still via `auth_org_id()`.

## Migration 031

Revoke-all then grant (028 style). Privilege-only. Idempotent revoke/regrant.

## Verification

| Step | Result |
| --- | --- |
| Local `db reset` through 031 | Pass |
| Local grants match model | Pass |
| RLS coverage | Pass |
| Remote history before | 001–030; 031 absent |
| Dry-run | `031` only |
| Remote `db push --linked` | Applied |
| Remote grants post-apply | Match model; anon none |
| Remote RLS enabled | Pass |
| Row counts | items/decisions `0`; WA `130`; pricing `10` |
| `tsc` / `lint` / `build` | Pass |
| 7F-R2 / 7F-R1 / 2B.10 / RLS | Pass |

## Next action

Owner Deck Preview retest —  
`docs/runbooks/STAGE_3_1B7FR2_DECK_PREVIEW_RETEST.md`.
