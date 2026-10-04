-- Restrict authenticated writes on estimates and estimate_line_items to an
-- ACTIVE Owner, Admin, or Estimator in the bound organisation.
--
-- Replaces the organisation-wide INSERT/UPDATE/DELETE policies from 002.
-- SELECT policies are unchanged. The 049 restrictive work-role policies stay.
-- public.auth_can_mutate_work() is the existing helper: active membership
-- and role in (owner, admin, estimator). Viewer, pending_billing, and
-- removed memberships are false. service_role bypasses RLS.
-- Plan checks stay in server actions. No commercial rewrite.

drop policy if exists "Users can insert estimates in their organisation"
  on public.estimates;
drop policy if exists "Users can update estimates in their organisation"
  on public.estimates;
drop policy if exists "Users can delete estimates in their organisation"
  on public.estimates;

drop policy if exists "Users can insert estimate line items in their organisation"
  on public.estimate_line_items;
drop policy if exists "Users can update estimate line items in their organisation"
  on public.estimate_line_items;
drop policy if exists "Users can delete estimate line items in their organisation"
  on public.estimate_line_items;

create policy estimates_insert_active_work_role
  on public.estimates
  for insert
  to authenticated
  with check (
    org_id = public.auth_org_id()
    and public.auth_can_mutate_work()
    and exists (
      select 1
      from public.projects p
      where p.id = estimates.project_id
        and p.org_id = public.auth_org_id()
    )
  );

create policy estimates_update_active_work_role
  on public.estimates
  for update
  to authenticated
  using (
    org_id = public.auth_org_id()
    and public.auth_can_mutate_work()
  )
  with check (
    org_id = public.auth_org_id()
    and public.auth_can_mutate_work()
    and exists (
      select 1
      from public.projects p
      where p.id = estimates.project_id
        and p.org_id = public.auth_org_id()
    )
  );

create policy estimates_delete_active_work_role
  on public.estimates
  for delete
  to authenticated
  using (
    org_id = public.auth_org_id()
    and public.auth_can_mutate_work()
  );

create policy estimate_line_items_insert_active_work_role
  on public.estimate_line_items
  for insert
  to authenticated
  with check (
    org_id = public.auth_org_id()
    and public.auth_can_mutate_work()
    and exists (
      select 1
      from public.projects p
      where p.id = estimate_line_items.project_id
        and p.org_id = public.auth_org_id()
    )
    and exists (
      select 1
      from public.estimates e
      where e.id = estimate_line_items.estimate_id
        and e.org_id = public.auth_org_id()
        and e.project_id = estimate_line_items.project_id
    )
  );

create policy estimate_line_items_update_active_work_role
  on public.estimate_line_items
  for update
  to authenticated
  using (
    org_id = public.auth_org_id()
    and public.auth_can_mutate_work()
  )
  with check (
    org_id = public.auth_org_id()
    and public.auth_can_mutate_work()
    and exists (
      select 1
      from public.projects p
      where p.id = estimate_line_items.project_id
        and p.org_id = public.auth_org_id()
    )
    and exists (
      select 1
      from public.estimates e
      where e.id = estimate_line_items.estimate_id
        and e.org_id = public.auth_org_id()
        and e.project_id = estimate_line_items.project_id
    )
  );

create policy estimate_line_items_delete_active_work_role
  on public.estimate_line_items
  for delete
  to authenticated
  using (
    org_id = public.auth_org_id()
    and public.auth_can_mutate_work()
  );

notify pgrst, 'reload schema';
