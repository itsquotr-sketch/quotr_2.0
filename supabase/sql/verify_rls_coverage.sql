-- RLS and parent-org integrity coverage audit.
-- Run against local Supabase only, e.g.:
--   docker exec -i supabase_db_quotr_2.0-main psql -U postgres < supabase/sql/verify_rls_coverage.sql
-- Queries PostgreSQL catalogues directly. Does not require verify_rls_status RPC.

-- ---------------------------------------------------------------------------
-- 1. All public tables: RLS enabled?
-- ---------------------------------------------------------------------------
SELECT
  c.relname AS tablename,
  c.relrowsecurity AS rls_enabled
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relkind = 'r'
ORDER BY c.relname;

-- ---------------------------------------------------------------------------
-- 2. Policy operations per table
-- ---------------------------------------------------------------------------
SELECT
  c.relname AS tablename,
  c.relrowsecurity AS rls_enabled,
  COUNT(p.polname) FILTER (WHERE p.polcmd = 'r') AS select_policies,
  COUNT(p.polname) FILTER (WHERE p.polcmd = 'a') AS insert_policies,
  COUNT(p.polname) FILTER (WHERE p.polcmd = 'w') AS update_policies,
  COUNT(p.polname) FILTER (WHERE p.polcmd = 'd') AS delete_policies,
  COUNT(p.polname) FILTER (WHERE p.polcmd = '*') AS all_policies
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
LEFT JOIN pg_policy p ON p.polrelid = c.oid
WHERE n.nspname = 'public'
  AND c.relkind = 'r'
GROUP BY c.relname, c.relrowsecurity
ORDER BY c.relname;

-- ---------------------------------------------------------------------------
-- 3. Expected organisation-owned tables missing RLS
-- ---------------------------------------------------------------------------
WITH expected(tablename, org_column) AS (
  VALUES
    ('organisations', 'id'),
    ('profiles', 'org_id'),
    ('projects', 'org_id'),
    ('work_areas', 'org_id'),
    ('project_facts', 'org_id'),
    ('question_blocks', 'org_id'),
    ('questions', 'org_id'),
    ('constraints', 'org_id'),
    ('estimates', 'org_id'),
    ('estimate_line_items', 'org_id'),
    ('rates', 'org_id'),
    ('organisation_settings', 'org_id'),
    ('organisation_work_areas', 'org_id'),
    ('project_notes', 'org_id'),
    ('note_proposals', 'org_id'),
    ('pricing_documents', 'org_id'),
    ('pricing_items', 'org_id'),
    ('quotes', 'org_id'),
    ('quote_items', 'org_id'),
    ('pricing_audit_log', 'organisation_id')
)
SELECT
  e.tablename,
  e.org_column,
  COALESCE(c.relrowsecurity, false) AS rls_enabled,
  CASE
    WHEN NOT EXISTS (
      SELECT 1
      FROM information_schema.columns col
      WHERE col.table_schema = 'public'
        AND col.table_name = e.tablename
        AND col.column_name = e.org_column
    ) THEN 'missing_org_column'
    ELSE 'ok'
  END AS org_column_status
FROM expected e
LEFT JOIN pg_class c
  ON c.relname = e.tablename
 AND c.relkind = 'r'
LEFT JOIN pg_namespace n
  ON n.oid = c.relnamespace
 AND n.nspname = 'public'
WHERE COALESCE(c.relrowsecurity, false) = false
   OR NOT EXISTS (
     SELECT 1
     FROM information_schema.columns col
     WHERE col.table_schema = 'public'
       AND col.table_name = e.tablename
       AND col.column_name = e.org_column
   );

-- ---------------------------------------------------------------------------
-- 4. Parent-child organisation integrity triggers (023 + 025)
-- ---------------------------------------------------------------------------
SELECT
  c.relname AS tablename,
  t.tgname AS trigger_name,
  p.proname AS function_name
FROM pg_trigger t
JOIN pg_class c ON c.oid = t.tgrelid
JOIN pg_proc p ON p.oid = t.tgfoid
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND NOT t.tgisinternal
  AND (
    t.tgname LIKE '%org_match%'
    OR p.proname LIKE '%org_match%'
  )
ORDER BY c.relname, t.tgname;

-- Expected trigger tables:
-- pricing_items, quote_items (023)
-- work_areas, project_facts, question_blocks, questions, constraints,
-- estimates, estimate_line_items (025)

WITH expected_triggers(tablename, trigger_name) AS (
  VALUES
    ('pricing_items', 'pricing_items_org_match'),
    ('quote_items', 'quote_items_org_match'),
    ('work_areas', 'work_areas_project_org_match'),
    ('project_facts', 'project_facts_project_org_match'),
    ('question_blocks', 'question_blocks_project_org_match'),
    ('questions', 'questions_project_org_match'),
    ('constraints', 'constraints_project_org_match'),
    ('estimates', 'estimates_project_org_match'),
    ('estimate_line_items', 'estimate_line_items_project_org_match')
)
SELECT e.tablename, e.trigger_name
FROM expected_triggers e
WHERE NOT EXISTS (
  SELECT 1
  FROM pg_trigger t
  JOIN pg_class c ON c.oid = t.tgrelid
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public'
    AND NOT t.tgisinternal
    AND c.relname = e.tablename
    AND t.tgname = e.trigger_name
);

-- ---------------------------------------------------------------------------
-- 5. Gross-margin default and GST constraints
-- ---------------------------------------------------------------------------
SELECT
  column_name,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'organisation_settings'
  AND column_name = 'default_margin_percent';

SELECT
  conname,
  conrelid::regclass::text AS table_name,
  pg_get_constraintdef(oid) AS definition
FROM pg_constraint
WHERE contype = 'c'
  AND conname IN (
    'pricing_documents_gst_rate_check',
    'quotes_gst_rate_check',
    'organisation_settings_default_gst_rate_check'
  )
ORDER BY conname;
