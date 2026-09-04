# Migration 053 proposal — role-aligned RLS (DO NOT CREATE / APPLY)

**Status:** Proposal only. No SQL file. No Preview apply. No Production apply.  
**Gate:** Owner approval required.  
**Depends on:** 049 (`organisation_memberships`, `auth_can_mutate_work`). Preview already has 049–052. Production must apply 046–052 **before** 053.

## Why this exists

App permissions treat company settings and company `$/h` rates as **Owner/Admin** (`company.edit`, `company.rates.manage`).

RLS does not:

| Table | Viewer (RLS) | Estimator (RLS) | App permission |
| --- | --- | --- | --- |
| `organisation_settings` | deny (`auth_can_mutate_work`) | **allow** | Owner/Admin only |
| `rates` | deny | **allow** | Owner/Admin only |
| `work_areas` / `project_facts` | **allow** (not in 049 list) | allow | Viewer has no `projects.edit` |
| `organisation_work_areas` | **allow** | allow | company setup UI is Owner/Admin |
| `organisation_memberships` | SELECT only | SELECT only | writes via RPC — OK |
| billing tables | SELECT own / service_role writes | same | OK |

**Exploit (Estimator):** session JWT + `NEXT_PUBLIC_SUPABASE_ANON_KEY` → `PATCH /rest/v1/organisation_settings` for the bound org. Changes default margin, GST, timezone, logo URL, range factors. Next.js server actions refuse the same write.

**Not a cross-tenant leak.** Bound `auth_org_id()` still isolates orgs.

**Viewer:** cannot update `organisation_settings` / `rates` / projects / quotes (049). Can still mutate work-area/fact tables unless 053 extends the restrictive set.

Browser helper `lib/supabase/client.ts` exists (anon key). App screens do not import it today. That is irrelevant — PostgREST accepts the JWT from curl/devtools.

## Proposed shape (sketch only)

1. Add `auth_can_manage_company()` — ACTIVE membership role in `('owner','admin')`.
2. Replace 049 work-role **restrictive** policies on `organisation_settings` with company-role restrictive insert/update/delete.
3. Same for `rates` **if** product intent remains Owner/Admin-only company rate catalogue (matches DNA-02.1).
4. Add 049-style `auth_can_mutate_work()` restrictive policies to: `work_areas`, `project_facts`, `organisation_work_areas`, and other work tables still on org-member CRUD (questions, constraints, project_notes as needed).
5. Tighten storage branding policies (`organisation-branding`) to `auth_can_manage_company()`.
6. Do **not** revoke authenticated SELECT. Do **not** change public quote token RPCs.

Optional harder path: `REVOKE UPDATE` on `organisation_settings` from `authenticated` and expose SECURITY DEFINER save RPCs. Not required if restrictive policies are correct.

## What 053 must not do

- Change commercial formulas, GST, or quote validity.
- Broaden billing invite/removal (BILLING-4 Owner rules stay).
- Allow Viewer to mutate work.
- Touch Production until 046–052 have been applied and verified.

## Risk

Owner/Admin JWT writes (setup, Rates, Company settings) continue to work. Estimator direct clients fail closed (intended). Any forgotten Estimator server action that relied on RLS success for settings/rates would fail — those actions already check `company.rates.manage`.

## Rollback

Recreate 049 `*_write_requires_work_role_*` on `organisation_settings` / `rates`. Drop `auth_can_manage_company` policies/function. Work-table restrictive policies can be dropped independently.

## Beta implication

- **Owner-only Builder testers:** not exploitable in practice (Owner already has the permission).
- **Business Estimator seats:** do not invite until 053 is approved and applied on Preview.
- **Production:** do not migrate or deploy until 053 is decided.
