-- PLATFORM-02D — remove Preview fixture authorisation from the product schema.
-- 060 and 061 are already applied on Preview and stay in history.
-- This migration restores the pre-060 immutability functions and drops the
-- cleanup functions. It does not use organisation names, emails, or titles.
-- A fresh chain (058 through 062) and an existing Preview database that
-- applies only this file end with the same functions.

create or replace function public.enforce_quote_events_append_only()
returns trigger
language plpgsql
as $$
begin
  raise exception 'quote_events are append-only';
end;
$$;

create or replace function public.enforce_quote_acceptance_evidence_append_only()
returns trigger
language plpgsql
as $$
begin
  raise exception 'quote acceptance evidence is append-only';
end;
$$;

create or replace function public.prevent_quote_item_snapshot_mutation()
returns trigger
language plpgsql
as $$
declare
  quote_status text;
  send_lock uuid;
  target_quote_id uuid;
begin
  target_quote_id := coalesce(new.quote_id, old.quote_id);
  select status, send_lock_delivery_id into quote_status, send_lock
  from public.quotes
  where id = target_quote_id;

  if quote_status is null or quote_status = 'draft' then
    if send_lock is not null then
      raise exception 'QUOTE_TXN:SEND_IN_PROGRESS';
    end if;
    if tg_op = 'DELETE' then
      return old;
    end if;
    return new;
  end if;

  raise exception 'Quote items are immutable once the quote is no longer a draft';
end;
$$;

drop function if exists public.preview_lifecycle_fixture_cleanup(uuid);
drop function if exists public.preview_fixture_org(uuid);

notify pgrst, 'reload schema';
