-- Quotr 2.0 — Unbind tenant when a membership is removed.
-- Additive product correction. Does not change estimating, Pricing, or Quote
-- money formulas.
--
-- 049 left profiles.org_id bound after status=removed, so RLS SELECT via
-- auth_org_id() still showed org data. Access revoke must not wait for Stripe.

create or replace function public.sync_profile_role_from_membership()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'UPDATE' and new.status = 'removed' then
    -- One-user-one-org: clearing org_id is what makes auth_org_id() stop
    -- resolving the removed organisation. Compatibility role is a placeholder
    -- only; it grants nothing while unbound.
    update public.profiles
      set org_id = null,
          role = 'member'
    where id = new.user_id
      and org_id is not distinct from new.org_id
      and not exists (
        select 1
        from public.organisation_memberships m
        where m.user_id = new.user_id
          and m.status = 'active'
      );
    return new;
  end if;
  if new.status = 'active' then
    update public.profiles
      set org_id = new.org_id,
          role = new.role
    where id = new.user_id
      and (org_id is null or org_id = new.org_id)
      and (role is distinct from new.role or org_id is distinct from new.org_id);
  end if;
  return new;
end;
$$;

comment on function public.sync_profile_role_from_membership() is
  'ACTIVE membership binds profiles.org_id and compatibility role. removed clears tenant binding immediately so auth_org_id() no longer resolves the org. pending_billing never binds.';

-- Catch up rows left bound after a remove under the previous trigger.
update public.profiles p
set org_id = null,
    role = 'member'
where p.org_id is not null
  and not exists (
    select 1
    from public.organisation_memberships m
    where m.user_id = p.id
      and m.status = 'active'
  )
  and exists (
    select 1
    from public.organisation_memberships m
    where m.user_id = p.id
      and m.status = 'removed'
      and m.org_id = p.org_id
  );
