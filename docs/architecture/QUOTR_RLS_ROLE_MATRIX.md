# Quotr RLS vs application role matrix

**Canonical after SECURITY-053.**  
App permissions (`lib/team/permissions.ts`) stay more granular (Owner-only `billing.manage` / paid seats). RLS enforces **broad role capability** so PostgREST cannot bypass the app.

Helpers:

- `auth_org_id()` — bound org from `profiles.org_id`
- `auth_can_mutate_work()` — ACTIVE `owner` / `admin` / `estimator`
- `auth_can_manage_company()` — ACTIVE `owner` / `admin` (053)

---

## Pre-053 vulnerabilities (confirmed)

| Surface | Viewer RLS | Estimator RLS | App | Direct PostgREST vs app |
| --- | --- | --- | --- | --- |
| `organisation_settings` | deny (049 work-role) | **allow** | Owner/Admin `company.edit` / rates.manage | **Estimator bypass** |
| `rates` (commercial + productivity rows) | deny | **allow** | Owner/Admin `company.rates.manage`; Estimator calibration via RPC | **Estimator direct rate DML bypass** |
| `organisation_work_areas` | **allow** | **allow** | Company setup (first-run Owner) | **Viewer + Estimator bypass** |
| `work_areas`, `project_facts`, questions, constraints, notes | **allow** | allow | Viewer has no `projects.edit` | **Viewer bypass** |
| `projects`, estimates, pricing, quotes | deny (049) | allow | matches Estimator | OK |
| memberships / invitations / seats | SELECT / none | SELECT / none | RPC Owner-only invite | OK |
| billing tables | SELECT own | SELECT own | writes service_role | OK |
| public quote tokens | none | none | hashed RPCs to anon | OK |
| branding storage | **allow** (any member) | **allow** | `company.edit` | **any-member bypass** |
| `profiles.role` / `org_id` | own-row UPDATE | own-row UPDATE | membership SoT | **role spoof** (compat `profiles.role` still gates `organisations` UPDATE) |

Cross-org SELECT/mutation already required `org_id = auth_org_id()`. Not a tenant leak.

**organisation_work_areas:** first-run is Owner. Estimator does not need a company-setup path. 053 = Owner/Admin only.

**rates:** commercial `$/h` stays Owner/Admin table DML. Estimator productivity writes continue through `save_productivity_calibration` SECURITY DEFINER.

---

## Post-053 authority

| ROLE | APP PERMISSION | RLS BROAD AUTHORITY | Viewer | Estimator | Admin | Owner |
| --- | --- | --- | --- | --- | --- | --- |
| Company administration (`organisation_settings`, org name, logo storage) | `company.edit` | `auth_can_manage_company` | R | R | W | W |
| Company commercial rates (`rates` table DML) | `company.rates.manage` | `auth_can_manage_company` | R | R (table) | W | W |
| Company work-type preferences | `company.edit` | `auth_can_manage_company` | R | R | W | W |
| Calibration evidence / derived productivity | `company.calibration.manage` via DNA RPC | evidence SELECT; RPC DEFINER writes | R | RPC W | RPC W | RPC W |
| Project work (projects, work_areas, facts, questions, constraints, notes, ISD) | `projects.edit` / `estimates.run` | `auth_can_mutate_work` | R | W | W | W |
| Project commercial (estimates, pricing, quotes) | `pricing.edit` / `quotes.*` | `auth_can_mutate_work` (049) | R | W | W | W |
| Team / paid seats | `team.invite` / `billing.manage` Owner-only | no authenticated table DML | R | R | R (no paid invite) | RPC W |
| Billing mirrors | `billing.view` / manage | SELECT; writes service_role | R | R | R | R |
| Public Quote | n/a | token RPCs | n/a | n/a | n/a | n/a |

R = SELECT (org-scoped). W = INSERT/UPDATE/DELETE where the table has those policies.

---

## Grants (unchanged strategy)

Authenticated keeps table SELECT/INSERT/UPDATE/DELETE on application tables from 026. **RLS** is the write gate. Do not revoke Owner/Admin JWT DML.

Already tighter than 026:

- `organisation_memberships` SELECT only
- invitations / seat ops: no authenticated table DML
- `quote_access_tokens` service_role only
- billing writes service_role
- `productivity_calibration_responses` SELECT only

---

## SECURITY DEFINER (053 does not rewrite)

DNA `save_productivity_calibration` / `reset_productivity_to_benchmark`: `search_path = public`, `auth.uid()`, ACTIVE owner/admin/estimator, org from `auth_org_id()`.  
Team RPCs: Owner-only invite/remove unchanged.  
Public quote RPCs: hash token, no org membership required.
