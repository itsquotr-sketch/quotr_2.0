/**
 * Batch 2A.4 focused verification — local database integrity.
 *
 * Run after `supabase db reset` against local Docker only:
 *   npx --yes tsx scripts/verify-batch-2a4-database-integrity.ts
 *
 * Uses local Postgres via docker exec (service-role-independent trigger proofs).
 * Does not use production data or remote credentials.
 */
import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import {
  assertOrgOwnsActiveProject,
  assertOrgOwnsProject,
  type AuthOrgContext,
} from "../lib/security/org-ownership";

const DB_CONTAINER = "supabase_db_quotr_2.0-main";

function assert(label: string, ok: boolean) {
  console.log(ok ? "PASS" : "FAIL", label);
  if (!ok) process.exitCode = 1;
}

function psql(sql: string): string {
  return execFileSync(
    "docker",
    ["exec", "-i", DB_CONTAINER, "psql", "-U", "postgres", "-v", "ON_ERROR_STOP=1", "-t", "-A", "-c", sql],
    { encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] }
  ).trim();
}

function psqlOk(sql: string): boolean {
  try {
    execFileSync(
      "docker",
      ["exec", "-i", DB_CONTAINER, "psql", "-U", "postgres", "-v", "ON_ERROR_STOP=1", "-t", "-A", "-c", sql],
      { encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] }
    );
    return true;
  } catch {
    return false;
  }
}

type QueryResult<T> = { data: T | null; error: { message: string } | null };

function createMockSupabase(
  handlers: Record<string, () => QueryResult<unknown>>
) {
  const from = (table: string) => {
    const handler = handlers[table];
    const chain: Record<string, unknown> = {};
    const self = () => chain;
    chain.select = self;
    chain.eq = self;
    chain.is = self;
    chain.maybeSingle = async () =>
      handler ? handler() : { data: null, error: null };
    return chain;
  };

  return { from } as AuthOrgContext["supabase"];
}

function testMigrationArtifacts() {
  console.log("\n--- Migration chain artifacts ---\n");

  const marginDefault = psql(`
    SELECT column_default
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'organisation_settings'
      AND column_name = 'default_margin_percent'
  `);
  assert(
    "organisation_settings.default_margin_percent default is 20.00",
    marginDefault.includes("20")
  );

  const expectedTriggers = [
    "pricing_items_org_match",
    "quote_items_org_match",
    "work_areas_project_org_match",
    "project_facts_project_org_match",
    "question_blocks_project_org_match",
    "questions_project_org_match",
    "constraints_project_org_match",
    "estimates_project_org_match",
    "estimate_line_items_project_org_match",
  ];

  for (const triggerName of expectedTriggers) {
    const found = psql(`
      SELECT COUNT(*)::text
      FROM pg_trigger t
      JOIN pg_class c ON c.oid = t.tgrelid
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public'
        AND NOT t.tgisinternal
        AND t.tgname = '${triggerName}'
    `);
    assert(`trigger present: ${triggerName}`, found === "1");
  }

  const gstPricing = psql(`
    SELECT COUNT(*)::text FROM pg_constraint
    WHERE conname = 'pricing_documents_gst_rate_check'
  `);
  const gstQuotes = psql(`
    SELECT COUNT(*)::text FROM pg_constraint
    WHERE conname = 'quotes_gst_rate_check'
  `);
  assert("pricing_documents gst_rate check exists", gstPricing === "1");
  assert("quotes gst_rate check exists", gstQuotes === "1");

  const rlsAudit = psql(`
    SELECT c.relrowsecurity::text
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = 'pricing_audit_log'
  `);
  assert("pricing_audit_log has RLS enabled", rlsAudit === "true");

  const missingOrgTriggers = psql(`
    WITH expected(tablename, trigger_name) AS (
      VALUES
        ('work_areas', 'work_areas_project_org_match'),
        ('project_facts', 'project_facts_project_org_match'),
        ('question_blocks', 'question_blocks_project_org_match'),
        ('questions', 'questions_project_org_match'),
        ('constraints', 'constraints_project_org_match'),
        ('estimates', 'estimates_project_org_match'),
        ('estimate_line_items', 'estimate_line_items_project_org_match')
    )
    SELECT COUNT(*)::text
    FROM expected e
    WHERE NOT EXISTS (
      SELECT 1 FROM pg_trigger t
      JOIN pg_class c ON c.oid = t.tgrelid
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND NOT t.tgisinternal
        AND c.relname = e.tablename AND t.tgname = e.trigger_name
    )
  `);
  assert("no missing S1-007 project-child org triggers", missingOrgTriggers === "0");
}

function createOrgFixture(label: string): {
  orgId: string;
  userId: string;
  projectId: string;
} {
  const orgId = randomUUID();
  const userId = randomUUID();
  const projectId = randomUUID();
  const email = `2a4-${label}-${userId.slice(0, 8)}@example.local`;

  psql(`
    INSERT INTO auth.users (
      id, instance_id, aud, role, email, encrypted_password,
      email_confirmed_at, created_at, updated_at,
      raw_app_meta_data, raw_user_meta_data, is_super_admin, is_sso_user, is_anonymous
    ) VALUES (
      '${userId}',
      '00000000-0000-0000-0000-000000000000',
      'authenticated',
      'authenticated',
      '${email}',
      crypt('password', gen_salt('bf')),
      now(), now(), now(),
      '{}'::jsonb,
      '{}'::jsonb,
      false,
      false,
      false
    );

    INSERT INTO public.organisations (id, name)
    VALUES ('${orgId}', '2A4 ${label}');

    INSERT INTO public.profiles (id, org_id, role)
    VALUES ('${userId}', '${orgId}', 'owner');

    INSERT INTO public.projects (id, org_id, created_by, title, stage)
    VALUES ('${projectId}', '${orgId}', '${userId}', 'Project ${label}', 'brief');
  `);

  return { orgId, userId, projectId };
}

function deleteOrgFixture(orgId: string, userId: string) {
  psql(`
    DELETE FROM public.organisations WHERE id = '${orgId}';
    DELETE FROM auth.users WHERE id = '${userId}';
  `);
}

function testParentChildOrgIntegrity() {
  console.log("\n--- Parent-child organisation integrity ---\n");

  const a = createOrgFixture("A");
  const b = createOrgFixture("B");
  const { orgId: orgA, projectId: projectA } = a;
  const { orgId: orgB } = b;

  const childTables: Array<{
    table: string;
    insertSql: (orgId: string, projectId: string, id: string) => string;
  }> = [
    {
      table: "work_areas",
      insertSql: (orgId, projectId, id) => `
        INSERT INTO public.work_areas (id, org_id, project_id, type, name, status, sort_order)
        VALUES ('${id}', '${orgId}', '${projectId}', 'outdoor', 'Area', 'confirmed', 0)
      `,
    },
    {
      table: "project_facts",
      insertSql: (orgId, projectId, id) => `
        INSERT INTO public.project_facts (id, org_id, project_id, key, label, value, source)
        VALUES ('${id}', '${orgId}', '${projectId}', 'fact_${id.slice(0, 8)}', 'Fact', '"1"'::jsonb, 'user')
      `,
    },
    {
      table: "question_blocks",
      insertSql: (orgId, projectId, id) => `
        INSERT INTO public.question_blocks (id, org_id, project_id, stage, title, status, sort_order)
        VALUES ('${id}', '${orgId}', '${projectId}', 'work_area_questions', 'Block', 'active', 0)
      `,
    },
    {
      table: "constraints",
      insertSql: (orgId, projectId, id) => `
        INSERT INTO public.constraints (id, org_id, project_id, key, label, value)
        VALUES ('${id}', '${orgId}', '${projectId}', 'c_${id.slice(0, 8)}', 'Constraint', '"x"'::jsonb)
      `,
    },
  ];

  for (const child of childTables) {
    const okId = randomUUID();
    const badId = randomUUID();

    assert(
      `${child.table}: matching org insert succeeds`,
      psqlOk(child.insertSql(orgA, projectA, okId))
    );

    assert(
      `${child.table}: mismatched org insert rejected`,
      !psqlOk(child.insertSql(orgB, projectA, badId))
    );

    assert(
      `${child.table}: mismatched org update rejected`,
      !psqlOk(`
        UPDATE public.${child.table}
        SET org_id = '${orgB}'
        WHERE id = '${okId}'
      `)
    );

    const stillA = psql(`
      SELECT org_id::text FROM public.${child.table} WHERE id = '${okId}'
    `);
    assert(
      `${child.table}: rejected update did not modify existing row`,
      stillA === orgA
    );
  }

  const estimateId = randomUUID();
  assert(
    "estimates: matching org insert succeeds",
    psqlOk(`
      INSERT INTO public.estimates (id, org_id, project_id, status)
      VALUES ('${estimateId}', '${orgA}', '${projectA}', 'draft')
    `)
  );
  assert(
    "estimates: mismatched org insert rejected",
    !psqlOk(`
      INSERT INTO public.estimates (id, org_id, project_id, status)
      VALUES ('${randomUUID()}', '${orgB}', '${projectA}', 'draft')
    `)
  );
  assert(
    "estimates: mismatched org update rejected",
    !psqlOk(`
      UPDATE public.estimates SET org_id = '${orgB}' WHERE id = '${estimateId}'
    `)
  );

  const lineId = randomUUID();
  assert(
    "estimate_line_items: matching org insert succeeds",
    psqlOk(`
      INSERT INTO public.estimate_line_items (
        id, org_id, project_id, estimate_id, work_area_name, label, category, sort_order
      ) VALUES (
        '${lineId}', '${orgA}', '${projectA}', '${estimateId}', 'Area', 'Labour', 'labour', 0
      )
    `)
  );
  assert(
    "estimate_line_items: mismatched org insert rejected",
    !psqlOk(`
      INSERT INTO public.estimate_line_items (
        id, org_id, project_id, estimate_id, work_area_name, label, category, sort_order
      ) VALUES (
        '${randomUUID()}', '${orgB}', '${projectA}', '${estimateId}', 'Area', 'Labour', 'labour', 1
      )
    `)
  );
  assert(
    "estimate_line_items: mismatched org update rejected",
    !psqlOk(`
      UPDATE public.estimate_line_items SET org_id = '${orgB}' WHERE id = '${lineId}'
    `)
  );

  const blockId = randomUUID();
  psql(`
    INSERT INTO public.question_blocks (id, org_id, project_id, stage, title, status, sort_order)
    VALUES ('${blockId}', '${orgA}', '${projectA}', 'constraints', 'QBlock', 'active', 1)
  `);
  const questionId = randomUUID();
  assert(
    "questions: matching org insert succeeds",
    psqlOk(`
      INSERT INTO public.questions (
        id, org_id, project_id, question_block_id, key, label, question_text, input_type, required, sort_order
      ) VALUES (
        '${questionId}', '${orgA}', '${projectA}', '${blockId}', 'q_${questionId.slice(0, 8)}',
        'Label', 'Question?', 'text', false, 0
      )
    `)
  );
  assert(
    "questions: mismatched org insert rejected",
    !psqlOk(`
      INSERT INTO public.questions (
        id, org_id, project_id, question_block_id, key, label, question_text, input_type, required, sort_order
      ) VALUES (
        '${randomUUID()}', '${orgB}', '${projectA}', '${blockId}', 'q_bad',
        'Label', 'Question?', 'text', false, 1
      )
    `)
  );

  deleteOrgFixture(a.orgId, a.userId);
  deleteOrgFixture(b.orgId, b.userId);
}

function testGstAndMarginDefaults() {
  console.log("\n--- GST bounds and margin default behaviour ---\n");

  const fixture = createOrgFixture("GST");
  const { orgId, projectId } = fixture;
  const pricingId = randomUUID();
  const quoteId = randomUUID();

  const settingsId = randomUUID();
  psql(`
    INSERT INTO public.organisation_settings (id, org_id)
    VALUES ('${settingsId}', '${orgId}')
  `);
  const storedMargin = psql(`
    SELECT default_margin_percent::text
    FROM public.organisation_settings WHERE id = '${settingsId}'
  `);
  assert(
    "new organisation_settings row receives 20% default margin",
    Number(storedMargin) === 20
  );

  psql(`
    UPDATE public.organisation_settings
    SET default_margin_percent = 33
    WHERE id = '${settingsId}'
  `);
  const kept = psql(`
    SELECT default_margin_percent::text
    FROM public.organisation_settings WHERE id = '${settingsId}'
  `);
  assert("explicit stored margin remains unchanged", Number(kept) === 33);

  assert(
    "GST 0 accepted on pricing_documents",
    psqlOk(`
      INSERT INTO public.pricing_documents (
        id, org_id, project_id, title, status, gst_rate, subtotal_cost, subtotal_sell,
        gross_profit, margin_percent, markup_percent, gst_amount, total_incl_gst
      ) VALUES (
        '${pricingId}', '${orgId}', '${projectId}', 'P', 'draft', 0, 0, 0, 0, 0, 0, 0, 0
      )
    `)
  );

  assert(
    "GST 15 accepted on quotes",
    psqlOk(`
      INSERT INTO public.quotes (
        id, org_id, project_id, title, status, gst_rate, subtotal, gst_amount, total_incl_gst
      ) VALUES (
        '${quoteId}', '${orgId}', '${projectId}', 'Q', 'draft', 15, 0, 0, 0
      )
    `)
  );

  assert(
    "GST 100 accepted on pricing_documents update",
    psqlOk(`UPDATE public.pricing_documents SET gst_rate = 100 WHERE id = '${pricingId}'`)
  );

  assert(
    "negative GST rejected",
    !psqlOk(`UPDATE public.pricing_documents SET gst_rate = -1 WHERE id = '${pricingId}'`)
  );

  assert(
    "GST above 100 rejected",
    !psqlOk(`UPDATE public.quotes SET gst_rate = 100.01 WHERE id = '${quoteId}'`)
  );

  const historicalCount = psql(`
    SELECT COUNT(*)::text FROM public.organisation_settings
    WHERE default_margin_percent = 33 AND id = '${settingsId}'
  `);
  assert(
    "no historical-row bulk margin rewrite occurred",
    historicalCount === "1"
  );

  deleteOrgFixture(fixture.orgId, fixture.userId);
}

async function testSoftDeleteHelpers() {
  console.log("\n--- Soft-delete active visibility helpers ---\n");

  const activeCtx: AuthOrgContext = {
    orgId: "org-a",
    user: { id: "user-a" },
    supabase: createMockSupabase({
      projects: () => ({ data: { id: "project-a" }, error: null }),
    }),
  };

  const deletedCtx: AuthOrgContext = {
    orgId: "org-a",
    user: { id: "user-a" },
    supabase: createMockSupabase({
      projects: () => ({ data: null, error: null }),
    }),
  };

  const active = await assertOrgOwnsActiveProject(activeCtx, "project-a");
  assert(
    "active project child data path accepts active project",
    !("error" in active)
  );

  const hidden = await assertOrgOwnsActiveProject(deletedCtx, "project-a");
  assert(
    "soft-deleted project hidden from normal active ownership helper",
    "error" in hidden && hidden.error === "Project not found."
  );

  const anyIncludingDeleted: AuthOrgContext = {
    orgId: "org-a",
    user: { id: "user-a" },
    supabase: createMockSupabase({
      projects: () => ({ data: { id: "project-a" }, error: null }),
    }),
  };
  const lifecycle = await assertOrgOwnsProject(anyIncludingDeleted, "project-a");
  assert(
    "assertOrgOwnsProject remains available for lifecycle paths",
    !("error" in lifecycle)
  );
}

function testIdempotentReapplySnippet() {
  console.log("\n--- Idempotence smoke (re-create triggers) ---\n");

  assert(
    "re-running create or replace function succeeds",
    psqlOk(`
      CREATE OR REPLACE FUNCTION public.enforce_child_project_org_match()
      RETURNS trigger
      LANGUAGE plpgsql
      AS $$
      DECLARE
        project_org uuid;
      BEGIN
        SELECT org_id INTO project_org FROM public.projects WHERE id = NEW.project_id;
        IF project_org IS NULL THEN
          RAISE EXCEPTION 'project not found';
        END IF;
        IF NEW.org_id IS DISTINCT FROM project_org THEN
          RAISE EXCEPTION '% org_id must match project org_id', TG_TABLE_NAME;
        END IF;
        RETURN NEW;
      END;
      $$;
    `)
  );

  assert(
    "drop/create work_areas trigger succeeds",
    psqlOk(`
      DROP TRIGGER IF EXISTS work_areas_project_org_match ON public.work_areas;
      CREATE TRIGGER work_areas_project_org_match
        BEFORE INSERT OR UPDATE ON public.work_areas
        FOR EACH ROW
        EXECUTE FUNCTION public.enforce_child_project_org_match();
    `)
  );
}

async function main() {
  console.log("=== Batch 2A.4 database integrity verification (local only) ===");

  try {
    psql("SELECT 1");
  } catch {
    console.error("FAIL local Postgres container not reachable:", DB_CONTAINER);
    process.exit(1);
  }

  testMigrationArtifacts();
  testParentChildOrgIntegrity();
  testGstAndMarginDefaults();
  await testSoftDeleteHelpers();
  testIdempotentReapplySnippet();

  if (process.exitCode && process.exitCode !== 0) {
    console.log("\nBatch 2A.4 verification FAILED");
    process.exit(1);
  }
  console.log("\nBatch 2A.4 verification PASSED");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
