-- RLS coverage audit — run in Supabase SQL editor or via psql.
-- Every application table holding org/project data should have rowsecurity = true.

SELECT
  tablename,
  rowsecurity AS rls_enabled
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY tablename;

-- Expected application tables (all should show rls_enabled = true):
-- organisations, profiles, projects, work_areas, project_facts,
-- question_blocks, questions, constraints, estimates, estimate_line_items,
-- rates, organisation_settings, organisation_work_areas, project_notes,
-- note_proposals, pricing_documents, pricing_items, quotes, quote_items

-- Tables/functions that are safe without RLS (none expected in public schema for app data).

SELECT
  c.relname AS tablename,
  c.relrowsecurity AS rls_enabled,
  COUNT(p.polname) FILTER (WHERE p.polcmd = 'r') AS select_policies,
  COUNT(p.polname) FILTER (WHERE p.polcmd = 'a') AS insert_policies,
  COUNT(p.polname) FILTER (WHERE p.polcmd = 'w') AS update_policies,
  COUNT(p.polname) FILTER (WHERE p.polcmd = 'd') AS delete_policies
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
LEFT JOIN pg_policy p ON p.polrelid = c.oid
WHERE n.nspname = 'public'
  AND c.relkind = 'r'
GROUP BY c.relname, c.relrowsecurity
ORDER BY c.relname;
