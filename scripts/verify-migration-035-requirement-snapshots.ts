/**
 * REQ-4A-R1 — migration 035 verification (local Docker only).
 *
 * Run after `npx supabase migration up --local`:
 *   npx tsx scripts/verify-migration-035-requirement-snapshots.ts
 */
import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { resolveLocalDbContainer } from "./local-db-container";

let DB_CONTAINER = "";

function assert(label: string, ok: boolean) {
  console.log(ok ? "PASS" : "FAIL", label);
  if (!ok) process.exitCode = 1;
}

function psql(sql: string): string {
  const normalized = sql.replace(/\r\n/g, "\n").trim();
  return execFileSync(
    "docker",
    [
      "exec",
      "-i",
      DB_CONTAINER,
      "psql",
      "-U",
      "postgres",
      "-v",
      "ON_ERROR_STOP=1",
      "-t",
      "-A",
    ],
    { encoding: "utf8", stdio: ["pipe", "pipe", "pipe"], input: `${normalized}\n` }
  ).trim();
}

function psqlOk(sql: string): boolean {
  try {
    psql(sql);
    return true;
  } catch {
    return false;
  }
}

function psqlLinesFromOutput(output: string): string[] {
  return output
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function lastQueryScalar(output: string): string | undefined {
  return psqlLinesFromOutput(output).find((line) => /^\d+$/.test(line));
}

function psqlAsAuthenticated(userId: string, sql: string): string {
  return psql(`
    BEGIN;
    SET LOCAL ROLE authenticated;
    SELECT set_config('request.jwt.claim.sub', '${userId}', true);
    ${sql}
    ROLLBACK;
  `);
}

function psqlExpectError(sql: string, fragment?: string): boolean {
  try {
    psql(sql);
    return false;
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : typeof error === "string"
          ? error
          : String(error);
    return fragment ? message.includes(fragment) : true;
  }
}

function columnExists(table: string, column: string): boolean {
  const count = psql(`
    SELECT COUNT(*)::text
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = '${table}'
      AND column_name = '${column}'
  `);
  return count === "1";
}

function createOrgFixture(label: string): {
  orgId: string;
  userId: string;
  projectId: string;
  estimateId: string;
} {
  const orgId = randomUUID();
  const userId = randomUUID();
  const projectId = randomUUID();
  const estimateId = randomUUID();
  const email = `035-${label}-${userId.slice(0, 8)}@example.local`;

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
    VALUES ('${orgId}', '035 Org ${label}');

    INSERT INTO public.profiles (id, org_id, role)
    VALUES ('${userId}', '${orgId}', 'owner');

    INSERT INTO public.projects (id, org_id, created_by, title, stage)
    VALUES ('${projectId}', '${orgId}', '${userId}', '035 Project ${label}', 'brief');

    INSERT INTO public.estimates (
      id, org_id, project_id, status, is_stale,
      cost_low, cost_high, sell_low, sell_high,
      recommended_cost, recommended_sell, gross_profit,
      margin_percent, markup_percent, confidence,
      rate_source_summary, assumptions, missing_info, exclusions
    ) VALUES (
      '${estimateId}', '${orgId}', '${projectId}', 'ready', false,
      100, 100, 120, 120,
      100, 120, 20,
      20, 25, 70,
      'test', '[]'::jsonb, '[]'::jsonb, '[]'::jsonb
    );
  `);

  return { orgId, userId, projectId, estimateId };
}

function deleteOrgFixture(orgId: string, userId: string) {
  psql(`
    DELETE FROM public.organisations WHERE id = '${orgId}';
    DELETE FROM auth.users WHERE id = '${userId}';
  `);
}

function testSchema() {
  console.log("\n--- schema ---\n");

  assert(
    "estimate_requirement_snapshots table exists",
    psql(`
      SELECT COUNT(*)::text
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name = 'estimate_requirement_snapshots'
    `) === "1"
  );
  assert(
    "estimates.requirement_generation_id exists",
    columnExists("estimates", "requirement_generation_id")
  );
  assert(
    "estimates.latest_requirement_snapshot_id exists",
    columnExists("estimates", "latest_requirement_snapshot_id")
  );
  assert(
    "pricing_documents.requirement_snapshot_id exists",
    columnExists("pricing_documents", "requirement_snapshot_id")
  );
  assert(
    "estimate_line_items.component_key exists",
    columnExists("estimate_line_items", "component_key")
  );
  assert(
    "pricing_items.component_key exists",
    columnExists("pricing_items", "component_key")
  );
  assert(
    "generation_id unique index exists",
    psql(`
      SELECT COUNT(*)::text
      FROM pg_constraint
      WHERE conname = 'estimate_requirement_snapshots_generation_id_key'
    `) === "1"
  );
  assert(
    "estimate snapshot created index exists",
    psql(`
      SELECT COALESCE(to_regclass('public.estimate_requirement_snapshots_estimate_created_idx')::text, '')
    `).includes("estimate_requirement_snapshots_estimate_created_idx")
  );
  assert(
    "pricing snapshot index exists",
    psql(`
      SELECT COALESCE(to_regclass('public.pricing_documents_requirement_snapshot_idx')::text, '')
    `).includes("pricing_documents_requirement_snapshot_idx")
  );
}

function testSnapshotLifecycle() {
  console.log("\n--- snapshot lifecycle + lineage ---\n");

  const { orgId, userId, projectId, estimateId } = createOrgFixture("lifecycle");
  const generationA = randomUUID();
  const generationB = randomUUID();
  const snapshotA = randomUUID();
  const snapshotB = randomUUID();
  const pricingP1 = randomUUID();
  const pricingP2 = randomUUID();
  const lineA = randomUUID();
  const lineB = randomUUID();
  const pricingItemP1 = randomUUID();
  const pricingItemP2 = randomUUID();
  const quoteQ1 = randomUUID();

  psql(`
    INSERT INTO public.estimate_requirement_snapshots (
      id, org_id, project_id, estimate_id, generation_id, schema_version, payload
    ) VALUES (
      '${snapshotA}', '${orgId}', '${projectId}', '${estimateId}', '${generationA}',
      'estimate-requirement-snapshot-v1',
      '{"schemaVersion":"estimate-requirement-snapshot-v1","generationId":"${generationA}","requirements":[],"componentAuthorities":[]}'::jsonb
    );

    UPDATE public.estimates
    SET requirement_generation_id = '${generationA}',
        latest_requirement_snapshot_id = '${snapshotA}'
    WHERE id = '${estimateId}';

    INSERT INTO public.estimate_line_items (
      id, org_id, project_id, estimate_id, work_area_name, label, category,
      recommended_cost, recommended_sell, sort_order, component_key
    ) VALUES (
      '${lineA}', '${orgId}', '${projectId}', '${estimateId}',
      'Deck', 'Decking materials', 'materials', 100, 120, 0, 'decking.surface'
    );

    INSERT INTO public.pricing_documents (
      id, org_id, project_id, estimate_id, requirement_snapshot_id,
      title, status, subtotal_cost, subtotal_sell, gross_profit,
      margin_percent, markup_percent, gst_rate, gst_amount, total_incl_gst
    ) VALUES (
      '${pricingP1}', '${orgId}', '${projectId}', '${estimateId}', '${snapshotA}',
      'Pricing P1', 'draft', 100, 120, 20, 20, 25, 15, 18, 138
    );

    INSERT INTO public.pricing_items (
      id, org_id, project_id, pricing_document_id, source_estimate_line_item_id,
      item_type, delivery_method, internal_label, client_label,
      total_cost, total_sell, gross_profit, margin_percent, markup_percent,
      sort_order, component_key
    ) VALUES (
      '${pricingItemP1}', '${orgId}', '${projectId}', '${pricingP1}', '${lineA}',
      'material', 'in_house', 'Decking materials', 'Decking materials',
      100, 120, 20, 20, 25, 0, 'decking.surface'
    );

    INSERT INTO public.quotes (
      id, org_id, project_id, pricing_document_id, estimate_id,
      title, status, subtotal, gst_rate, gst_amount, total_incl_gst
    ) VALUES (
      '${quoteQ1}', '${orgId}', '${projectId}', '${pricingP1}', '${estimateId}',
      'Quote Q1', 'draft', 120, 15, 18, 138
    );
  `);

  assert(
    "snapshot A inserted",
    psql(`SELECT COUNT(*)::text FROM public.estimate_requirement_snapshots WHERE id = '${snapshotA}'`) ===
      "1"
  );
  assert(
    "estimate latest pointer = A",
    psql(`
      SELECT latest_requirement_snapshot_id::text
      FROM public.estimates WHERE id = '${estimateId}'
    `) === snapshotA
  );
  assert(
    "pricing P1 links snapshot A",
    psql(`
      SELECT requirement_snapshot_id::text
      FROM public.pricing_documents WHERE id = '${pricingP1}'
    `) === snapshotA
  );
  assert(
    "pricing item P1 retains component_key decking.surface",
    psql(`
      SELECT component_key
      FROM public.pricing_items WHERE id = '${pricingItemP1}'
    `) === "decking.surface"
  );
  assert(
    "estimate line retains component_key decking.surface",
    psql(`
      SELECT component_key
      FROM public.estimate_line_items WHERE id = '${lineA}'
    `) === "decking.surface"
  );

  psql(`
    DELETE FROM public.estimate_line_items WHERE estimate_id = '${estimateId}';

    INSERT INTO public.estimate_line_items (
      id, org_id, project_id, estimate_id, work_area_name, label, category,
      recommended_cost, recommended_sell, sort_order, component_key
    ) VALUES (
      '${lineB}', '${orgId}', '${projectId}', '${estimateId}',
      'Deck', 'Decking materials', 'materials', 120, 144, 0, 'decking.surface'
    );

    INSERT INTO public.estimate_requirement_snapshots (
      id, org_id, project_id, estimate_id, generation_id, schema_version, payload
    ) VALUES (
      '${snapshotB}', '${orgId}', '${projectId}', '${estimateId}', '${generationB}',
      'estimate-requirement-snapshot-v1',
      '{"schemaVersion":"estimate-requirement-snapshot-v1","generationId":"${generationB}","requirements":[],"componentAuthorities":[]}'::jsonb
    );

    UPDATE public.estimates
    SET requirement_generation_id = '${generationB}',
        latest_requirement_snapshot_id = '${snapshotB}',
        recommended_sell = 144
    WHERE id = '${estimateId}';

    INSERT INTO public.pricing_documents (
      id, org_id, project_id, estimate_id, requirement_snapshot_id,
      title, status, subtotal_cost, subtotal_sell, gross_profit,
      margin_percent, markup_percent, gst_rate, gst_amount, total_incl_gst
    ) VALUES (
      '${pricingP2}', '${orgId}', '${projectId}', '${estimateId}', '${snapshotB}',
      'Pricing P2', 'draft', 120, 144, 24, 20, 25, 15, 21.6, 165.6
    );

    INSERT INTO public.pricing_items (
      id, org_id, project_id, pricing_document_id, source_estimate_line_item_id,
      item_type, delivery_method, internal_label, client_label,
      total_cost, total_sell, gross_profit, margin_percent, markup_percent,
      sort_order, component_key
    ) VALUES (
      '${pricingItemP2}', '${orgId}', '${projectId}', '${pricingP2}', '${lineB}',
      'material', 'in_house', 'Decking materials', 'Decking materials',
      120, 144, 24, 20, 25, 0, 'decking.surface'
    );
  `);

  assert(
    "snapshot B inserted",
    psql(`SELECT COUNT(*)::text FROM public.estimate_requirement_snapshots WHERE id = '${snapshotB}'`) ===
      "1"
  );
  assert(
    "snapshot A unchanged after generation B",
    psql(`
      SELECT generation_id::text
      FROM public.estimate_requirement_snapshots WHERE id = '${snapshotA}'
    `) === generationA
  );
  assert(
    "estimate latest pointer moved to B",
    psql(`
      SELECT latest_requirement_snapshot_id::text
      FROM public.estimates WHERE id = '${estimateId}'
    `) === snapshotB
  );
  assert(
    "pricing P1 still links snapshot A after estimate regen",
    psql(`
      SELECT requirement_snapshot_id::text
      FROM public.pricing_documents WHERE id = '${pricingP1}'
    `) === snapshotA
  );
  assert(
    "pricing P2 links snapshot B",
    psql(`
      SELECT requirement_snapshot_id::text
      FROM public.pricing_documents WHERE id = '${pricingP2}'
    `) === snapshotB
  );
  assert(
    "pricing P1 money unchanged (120 sell)",
    psql(`
      SELECT (total_sell = 120)
      FROM public.pricing_items WHERE id = '${pricingItemP1}'
    `) === "t"
  );
  assert(
    "quote Q1 resolves through pricing P1 to snapshot A",
    psql(`
      SELECT pd.requirement_snapshot_id::text
      FROM public.quotes q
      JOIN public.pricing_documents pd ON pd.id = q.pricing_document_id
      WHERE q.id = '${quoteQ1}'
    `) === snapshotA
  );

  deleteOrgFixture(orgId, userId);
}

function testConstraintsAndImmutability() {
  console.log("\n--- constraints + immutability ---\n");

  const { orgId, userId, projectId, estimateId } = createOrgFixture("constraints");
  const generationId = randomUUID();
  const snapshotId = randomUUID();
  const otherOrg = createOrgFixture("other");
  const badGeneration = randomUUID();

  psql(`
    INSERT INTO public.estimate_requirement_snapshots (
      id, org_id, project_id, estimate_id, generation_id, schema_version, payload
    ) VALUES (
      '${snapshotId}', '${orgId}', '${projectId}', '${estimateId}', '${generationId}',
      'estimate-requirement-snapshot-v1',
      '{"schemaVersion":"estimate-requirement-snapshot-v1","generationId":"${generationId}","requirements":[],"componentAuthorities":[]}'::jsonb
    );
  `);

  assert(
    "duplicate generation_id rejected",
    psqlExpectError(`
      INSERT INTO public.estimate_requirement_snapshots (
        org_id, project_id, estimate_id, generation_id, schema_version, payload
      ) VALUES (
        '${orgId}', '${projectId}', '${estimateId}', '${generationId}',
        'estimate-requirement-snapshot-v1',
        '{"schemaVersion":"estimate-requirement-snapshot-v1","generationId":"${generationId}","requirements":[],"componentAuthorities":[]}'::jsonb
      );
    `)
  );

  assert(
    "payload size constraint enforced",
    psqlExpectError(`
      INSERT INTO public.estimate_requirement_snapshots (
        org_id, project_id, estimate_id, generation_id, schema_version, payload
      ) VALUES (
        '${orgId}', '${projectId}', '${estimateId}', '${badGeneration}',
        'estimate-requirement-snapshot-v1',
        jsonb_build_object('pad', repeat('x', 600000))
      );
    `)
  );

  assert(
    "invalid estimate foreign relationship rejected",
    psqlExpectError(`
      INSERT INTO public.estimate_requirement_snapshots (
        org_id, project_id, estimate_id, generation_id, schema_version, payload
      ) VALUES (
        '${orgId}', '${projectId}', '${randomUUID()}', '${randomUUID()}',
        'estimate-requirement-snapshot-v1',
        '{"schemaVersion":"estimate-requirement-snapshot-v1","generationId":"x","requirements":[],"componentAuthorities":[]}'::jsonb
      );
    `)
  );

  assert(
    "cross-org estimate/project mismatch rejected",
    psqlExpectError(`
      INSERT INTO public.estimate_requirement_snapshots (
        org_id, project_id, estimate_id, generation_id, schema_version, payload
      ) VALUES (
        '${otherOrg.orgId}', '${projectId}', '${estimateId}', '${randomUUID()}',
        'estimate-requirement-snapshot-v1',
        '{"schemaVersion":"estimate-requirement-snapshot-v1","generationId":"x","requirements":[],"componentAuthorities":[]}'::jsonb
      );
    `)
  );

  assert(
    "immutability trigger rejects update",
    psqlExpectError(
      `
      UPDATE public.estimate_requirement_snapshots
      SET payload = '{"schemaVersion":"estimate-requirement-snapshot-v1","generationId":"${generationId}","requirements":[],"componentAuthorities":[]}'::jsonb
      WHERE id = '${snapshotId}';
    `,
      "REQ_SNAPSHOT:IMMUTABLE"
    )
  );

  assert(
    "legacy null component_key valid on estimate line",
    psqlOk(`
      INSERT INTO public.estimate_line_items (
        org_id, project_id, estimate_id, work_area_name, label, category,
        recommended_cost, recommended_sell, sort_order, component_key
      ) VALUES (
        '${orgId}', '${projectId}', '${estimateId}',
        'Deck', 'Legacy line', 'materials', 50, 60, 1, NULL
      )
    `)
  );

  deleteOrgFixture(otherOrg.orgId, otherOrg.userId);
  deleteOrgFixture(orgId, userId);
}

function testRls() {
  console.log("\n--- RLS ---\n");

  const policies = psql(`
    SELECT COUNT(*)::text
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'estimate_requirement_snapshots'
  `);
  assert("RLS policies defined on snapshots table", policies === "2");

  const selectPolicy = psql(`
    SELECT COUNT(*)::text
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'estimate_requirement_snapshots'
      AND cmd = 'SELECT'
      AND qual LIKE '%auth_org_id()%'
  `);
  assert("SELECT policy scopes to auth_org_id()", selectPolicy === "1");

  const insertPolicy = psql(`
    SELECT COUNT(*)::text
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'estimate_requirement_snapshots'
      AND cmd = 'INSERT'
  `);
  assert("INSERT policy exists", insertPolicy === "1");

  const updatePolicy = psql(`
    SELECT COUNT(*)::text
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'estimate_requirement_snapshots'
      AND cmd = 'UPDATE'
  `);
  assert("no UPDATE policy (authenticated)", updatePolicy === "0");

  const deletePolicy = psql(`
    SELECT COUNT(*)::text
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'estimate_requirement_snapshots'
      AND cmd = 'DELETE'
  `);
  assert("no DELETE policy (authenticated)", deletePolicy === "0");

  const orgA = createOrgFixture("rls-a");
  const orgB = createOrgFixture("rls-b");
  const generationA = randomUUID();
  const snapshotA = randomUUID();

  psql(`
    INSERT INTO public.estimate_requirement_snapshots (
      id, org_id, project_id, estimate_id, generation_id, schema_version, payload
    ) VALUES (
      '${snapshotA}', '${orgA.orgId}', '${orgA.projectId}', '${orgA.estimateId}', '${generationA}',
      'estimate-requirement-snapshot-v1',
      '{"schemaVersion":"estimate-requirement-snapshot-v1","generationId":"${generationA}","requirements":[],"componentAuthorities":[]}'::jsonb
    );
  `);

  const ownSelect = lastQueryScalar(
    psqlAsAuthenticated(
      orgA.userId,
      `SELECT COUNT(*)::text FROM public.estimate_requirement_snapshots WHERE id = '${snapshotA}';`
    )
  );
  assert("own-org SELECT succeeds under RLS", ownSelect === "1");

  const crossSelect = lastQueryScalar(
    psqlAsAuthenticated(
      orgB.userId,
      `SELECT COUNT(*)::text FROM public.estimate_requirement_snapshots WHERE id = '${snapshotA}';`
    )
  );
  assert("cross-org SELECT fails under RLS", crossSelect === "0");

  assert(
    "cross-org INSERT fails under RLS",
    psqlExpectError(`
      BEGIN;
      SET LOCAL ROLE authenticated;
      SELECT set_config('request.jwt.claim.sub', '${orgB.userId}', true);
      INSERT INTO public.estimate_requirement_snapshots (
        org_id, project_id, estimate_id, generation_id, schema_version, payload
      ) VALUES (
        '${orgA.orgId}', '${orgA.projectId}', '${orgA.estimateId}', '${randomUUID()}',
        'estimate-requirement-snapshot-v1',
        '{"schemaVersion":"estimate-requirement-snapshot-v1","generationId":"x","requirements":[],"componentAuthorities":[]}'::jsonb
      );
      ROLLBACK;
    `)
  );

  assert(
    "authenticated UPDATE fails under RLS",
    psqlExpectError(`
      BEGIN;
      SET LOCAL ROLE authenticated;
      SELECT set_config('request.jwt.claim.sub', '${orgA.userId}', true);
      UPDATE public.estimate_requirement_snapshots
      SET schema_version = 'mutated'
      WHERE id = '${snapshotA}';
      ROLLBACK;
    `)
  );

  assert(
    "authenticated DELETE fails under RLS contract",
    psqlExpectError(`
      BEGIN;
      SET LOCAL ROLE authenticated;
      SELECT set_config('request.jwt.claim.sub', '${orgA.userId}', true);
      DELETE FROM public.estimate_requirement_snapshots
      WHERE id = '${snapshotA}';
      ROLLBACK;
    `)
  );

  deleteOrgFixture(orgA.orgId, orgA.userId);
  deleteOrgFixture(orgB.orgId, orgB.userId);
}

function testCascadeDelete() {
  console.log("\n--- cascade delete semantics ---\n");

  const { orgId, userId, projectId, estimateId } = createOrgFixture("cascade");
  const generationId = randomUUID();
  const snapshotId = randomUUID();

  psql(`
    INSERT INTO public.estimate_requirement_snapshots (
      id, org_id, project_id, estimate_id, generation_id, schema_version, payload
    ) VALUES (
      '${snapshotId}', '${orgId}', '${projectId}', '${estimateId}', '${generationId}',
      'estimate-requirement-snapshot-v1',
      '{"schemaVersion":"estimate-requirement-snapshot-v1","generationId":"${generationId}","requirements":[],"componentAuthorities":[]}'::jsonb
    );
  `);

  psql(`DELETE FROM public.estimates WHERE id = '${estimateId}'`);

  assert(
    "estimate delete cascades snapshot removal",
    psql(`
      SELECT COUNT(*)::text
      FROM public.estimate_requirement_snapshots
      WHERE id = '${snapshotId}'
    `) === "0"
  );

  deleteOrgFixture(orgId, userId);
}

function main() {
  console.log(
    "=== Migration 035 requirement snapshots verification (local only) ==="
  );
  DB_CONTAINER = resolveLocalDbContainer();
  psql("SELECT 1");

  testSchema();
  testSnapshotLifecycle();
  testConstraintsAndImmutability();
  testRls();
  testCascadeDelete();

  if (process.exitCode && process.exitCode !== 0) {
    console.log("\nMigration 035 verification FAILED");
    process.exit(1);
  }
  console.log("\nMigration 035 verification PASSED");
}

main();
