-- Read-only Preview schema probe. No customer data.
select
  (select count(*) from pg_tables where schemaname = 'public' and tablename = any(array[
    'organisations','profiles','organisation_settings','projects','project_facts',
    'constraints','estimates','rates','pricing_documents','pricing_items',
    'quotes','quote_items','quote_events','quote_deliveries','quote_access_tokens',
    'quote_acceptances','quote_declines','notifications','notification_deliveries'
  ])) as required_tables,
  (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname in (
      'auth_org_id',
      'provision_organisation_for_new_user',
      'persist_estimate_generation_v1',
      'send_quote_revision_v1',
      'accept_quote_by_access_token_v1'
    )) as required_rpcs,
  (select count(*) from storage.buckets where id = 'organisation-branding') as branding_buckets,
  (select count(*) from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and policyname like 'organisation_branding%') as branding_policies,
  (select count(*) from pg_policies where schemaname = 'public') as public_policies,
  (select count(*) from pg_trigger t
    join pg_class c on c.oid = t.tgrelid
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and not t.tgisinternal) as public_triggers,
  (select count(*) from public.organisations) as org_rows,
  (select count(*) from public.profiles) as profile_rows,
  (select count(*) from public.quotes) as quote_rows;
