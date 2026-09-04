# Migration 053 — role-aligned RLS

**Status:** Created as `supabase/migrations/053_role_aware_rls_hardening.sql`. Apply Preview-first (`shhpjsoldmqtkdbgrbtm`). **Do not apply Production** until 046–052 have already been applied there.  
**Depends on:** 049 (`organisation_memberships`, `auth_can_mutate_work`). Preview already has 049–052.

Canonical matrix: `docs/architecture/QUOTR_RLS_ROLE_MATRIX.md`.

## Why this exists

App permissions treat company settings and company `$/h` rates as **Owner/Admin** (`company.edit`, `company.rates.manage`).

Pre-053 RLS did not:

| Table | Viewer (RLS) | Estimator (RLS) | App permission |
| --- | --- | --- | --- |
| `organisation_settings` | deny (`auth_can_mutate_work`) | **allow** | Owner/Admin only |
| `rates` | deny | **allow** | Owner/Admin table DML; Estimator calibration via RPC |
| `work_areas` / `project_facts` | **allow** (not in 049 list) | allow | Viewer has no `projects.edit` |
| `organisation_work_areas` | **allow** | allow | company setup is Owner/Admin |
| `organisation_memberships` | SELECT only | SELECT only | writes via RPC — OK |
| billing tables | SELECT own / service_role writes | same | OK |

**Exploit (Estimator):** session JWT + anon key → `PATCH /rest/v1/organisation_settings` for the bound org.

**Not a cross-tenant leak.** Bound `auth_org_id()` still isolates orgs.

## 053 shape

1. `auth_can_manage_company()` — ACTIVE membership role in `('owner','admin')`.
2. Replace 049 work-role restrictive policies on `organisation_settings` and `rates` with company-role restrictive insert/update/delete.
3. Same company-role policies on `organisation_work_areas` (company preference, not project work).
4. Restrictive UPDATE on `organisations` via `auth_can_manage_company()`.
5. `auth_can_mutate_work()` restrictive policies on remaining project work / ISD / notes / quote-counter tables.
6. Branding storage (`organisation-branding`) requires `auth_can_manage_company()`.
7. Authenticated sessions cannot change `profiles.role` / `org_id` (membership DEFINER sync still may).
8. Do **not** revoke authenticated SELECT. Do **not** change public quote token RPCs.

Commercial `$/h` table DML is Owner/Admin. Estimator productivity writes continue through `save_productivity_calibration` SECURITY DEFINER.

## What 053 must not do

- Change commercial formulas, GST, or quote validity.
- Broaden billing invite/removal (BILLING-4 Owner rules stay).
- Allow Viewer to mutate work.
- Touch Production until 046–052 have been applied and verified.

## Rollback

Recreate 049 `*_write_requires_work_role_*` on `organisation_settings` / `rates`. Drop `auth_can_manage_company` policies/function. Work-table restrictive policies can be dropped independently.
