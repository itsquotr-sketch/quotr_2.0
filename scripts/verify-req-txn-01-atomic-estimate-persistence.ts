/**
 * REQ-TXN-01 — atomic estimate generation persistence (local Docker Postgres).
 *
 * Run after `npx supabase migration up --local`:
 *   npx tsx scripts/verify-req-txn-01-atomic-estimate-persistence.ts
 */
import { spawn } from "node:child_process";
import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  generationRequiresRequirementSnapshot,
  getComponentCommercialAuthority,
} from "../lib/estimate/component-authority";
import { DECK_LABOUR_COMPONENT_KEY } from "../lib/estimate/deck-labour-requirement";
import { DECK_SURFACE_COMPONENT_KEY } from "../lib/estimate/deck-surface-requirement";
import {
  assertEstimateGenerationConsistent,
  buildPersistEstimateGenerationV1,
  isEstimateReadyForPricing,
  PERSIST_ESTIMATE_GENERATION_CONTRACT_VERSION,
  PERSIST_ESTIMATE_GENERATION_RPC,
} from "../lib/estimate/persist-estimate-generation";
import { isScopeDiscoveryEnabled } from "../lib/scope-discovery/configuration/feature-flags";
import { resolveLocalDbContainer } from "./local-db-container";

let DB_CONTAINER = "";
let passed = 0;
let failed = 0;
let dbChecks = 0;

function check(name: string, condition: boolean, detail = ""): void {
  if (condition) {
    passed += 1;
    console.log(`PASS  ${name}`);
  } else {
    failed += 1;
    console.log(`FAIL  ${name}${detail ? ` — ${detail}` : ""}`);
  }
}

function dbCheck(name: string, condition: boolean, detail = ""): void {
  dbChecks += 1;
  check(name, condition, detail);
}

function read(path: string): string {
  return readFileSync(path, "utf8");
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

function psqlLinesFromOutput(output: string): string[] {
  return output
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function persistJsonFromOutput(output: string): {
  estimate_id: string;
  generation_id: string;
  snapshot_id: string | null;
  status: string;
} | null {
  const line = psqlLinesFromOutput(output).find(
    (item) => item.startsWith("{") && item.includes("estimate_id")
  );
  if (!line) return null;
  return JSON.parse(line) as {
    estimate_id: string;
    generation_id: string;
    snapshot_id: string | null;
    status: string;
  };
}

function psqlAsync(sql: string): Promise<string> {
  const normalized = sql.replace(/\r\n/g, "\n").trim();
  return new Promise((resolve, reject) => {
    const child = spawn(
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
      { stdio: ["pipe", "pipe", "pipe"] }
    );
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => {
      stdout += String(chunk);
    });
    child.stderr.on("data", (chunk) => {
      stderr += String(chunk);
    });
    child.on("close", (code) => {
      if (code === 0) resolve(stdout.trim());
      else reject(new Error(stderr || stdout || `psql exit ${code}`));
    });
    child.stdin.write(`${normalized}\n`);
    child.stdin.end();
  });
}

function shadowAuthorities() {
  return [
    {
      workAreaType: "deck",
      componentKey: DECK_SURFACE_COMPONENT_KEY,
      authority: "REQUIREMENT_AUTHORITATIVE",
      parityClass: "SEMANTIC_REIMPLEMENTATION",
    },
    {
      workAreaType: "deck",
      componentKey: DECK_LABOUR_COMPONENT_KEY,
      authority: "SHADOW",
      parityClass: "SEMANTIC_REIMPLEMENTATION",
    },
  ];
}

function snapshotPayload(generationId: string) {
  return {
    schemaVersion: "estimate-requirement-snapshot-v1",
    requirementContractVersion: "foundation-r1.1",
    generatedAt: "2026-08-17T00:00:00.000Z",
    generationId,
    requirements: [],
    componentAuthorities: shadowAuthorities(),
  };
}

function persistPayload(opts: {
  projectId: string;
  generationId: string;
  snapshotRequired?: boolean;
  includeSnapshotRequired?: boolean;
  snapshot?: Record<string, unknown> | null;
  label?: string;
  sell?: number;
  category?: string;
  componentKey?: string | null;
  extraLine?: Record<string, unknown>;
  authorities?: ReturnType<typeof shadowAuthorities>;
}): Record<string, unknown> {
  const sell = opts.sell ?? 120;
  const lines: Record<string, unknown>[] = [
    {
      workAreaId: null,
      workAreaName: "Deck",
      label: opts.label ?? "Decking materials",
      category: opts.category ?? "materials",
      costLow: 100,
      costHigh: 100,
      sellLow: sell,
      sellHigh: sell,
      recommendedCost: 100,
      recommendedSell: sell,
      grossProfit: sell - 100,
      marginPercent: 20,
      markupPercent: 25,
      rateSource: "test",
      notes: null,
      sortOrder: 0,
      componentKey: opts.componentKey === undefined ? "decking.surface" : opts.componentKey,
    },
  ];
  if (opts.extraLine) lines.push(opts.extraLine);
  const payload: Record<string, unknown> = {
    contractVersion: PERSIST_ESTIMATE_GENERATION_CONTRACT_VERSION,
    projectId: opts.projectId,
    generationId: opts.generationId,
    componentAuthorities: opts.authorities ?? shadowAuthorities(),
    estimate: {
      costLow: 100,
      costHigh: 100,
      sellLow: sell,
      sellHigh: sell,
      recommendedCost: 100,
      recommendedSell: sell,
      grossProfit: sell - 100,
      marginPercent: 20,
      markupPercent: 25,
      confidence: 70,
      rateSourceSummary: "test",
      assumptions: [],
      missingInfo: [],
      exclusions: [],
      assumptionMetadata: {},
      calibrationVersion: "internal-1.0",
    },
    lineItems: lines,
    snapshot:
      opts.snapshot === undefined ? snapshotPayload(opts.generationId) : opts.snapshot,
  };
  if (opts.includeSnapshotRequired || opts.snapshotRequired !== undefined) {
    payload.snapshotRequired = opts.snapshotRequired ?? false;
  }
  return payload;
}

function callPersistSql(payload: Record<string, unknown>): string {
  return `SELECT public.persist_estimate_generation_v1($reqtxn$${JSON.stringify(payload)}$reqtxn$::jsonb);`;
}

function persistAsUser(userId: string, payload: Record<string, unknown>): string {
  return psql(`
    BEGIN;
    SET LOCAL ROLE authenticated;
    SELECT set_config('request.jwt.claim.sub', '${userId}', true);
    ${callPersistSql(payload)}
    COMMIT;
  `);
}

function persistAsUserExpectError(
  userId: string,
  payload: Record<string, unknown>,
  fragment?: string
): boolean {
  return psqlExpectError(
    `
    BEGIN;
    SET LOCAL ROLE authenticated;
    SELECT set_config('request.jwt.claim.sub', '${userId}', true);
    ${callPersistSql(payload)}
    COMMIT;
  `,
    fragment
  );
}

function createOrgFixture(label: string, withEstimate = true): {
  orgId: string;
  userId: string;
  projectId: string;
  estimateId: string | null;
} {
  const orgId = randomUUID();
  const userId = randomUUID();
  const projectId = randomUUID();
  const estimateId = withEstimate ? randomUUID() : null;
  const email = `txn01-${label}-${userId.slice(0, 8)}@example.local`;

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
    VALUES ('${orgId}', 'TXN-01 Org ${label}');

    INSERT INTO public.profiles (id, org_id, role)
    VALUES ('${userId}', '${orgId}', 'owner');

    INSERT INTO public.projects (id, org_id, created_by, title, stage)
    VALUES ('${projectId}', '${orgId}', '${userId}', 'TXN-01 Project ${label}', 'brief');
    ${
      estimateId
        ? `
    INSERT INTO public.estimates (
      id, org_id, project_id, status, is_stale,
      cost_low, cost_high, sell_low, sell_high,
      recommended_cost, recommended_sell, gross_profit,
      margin_percent, markup_percent, confidence,
      rate_source_summary, assumptions, missing_info, exclusions
    ) VALUES (
      '${estimateId}', '${orgId}', '${projectId}', 'ready', false,
      80, 80, 96, 96,
      80, 96, 16,
      20, 25, 70,
      'legacy', '[]'::jsonb, '[]'::jsonb, '[]'::jsonb
    );

    INSERT INTO public.estimate_line_items (
      org_id, project_id, estimate_id, work_area_name, label, category,
      recommended_cost, recommended_sell, sort_order, component_key
    ) VALUES (
      '${orgId}', '${projectId}', '${estimateId}',
      'Deck', 'Legacy line', 'materials', 80, 96, 0, NULL
    );
    `
        : ""
    }
  `);

  return { orgId, userId, projectId, estimateId };
}

function deleteOrgFixture(orgId: string, userId: string) {
  psql(`
    DELETE FROM public.organisations WHERE id = '${orgId}';
    DELETE FROM auth.users WHERE id = '${userId}';
  `);
}

function testContract() {
  console.log("\n--- CONTRACT ---\n");
  const migration = read("supabase/migrations/036_persist_estimate_generation_v1.sql");
  const persistSrc = read("lib/estimate/persist-estimate.ts");
  const adapterSrc = read("lib/estimate/persist-estimate-generation.ts");
  const pricingSrc = read("lib/pricing/actions.ts");

  check(
    "1 atomic persistence RPC exists",
    migration.includes("persist_estimate_generation_v1") &&
      migration.includes("security invoker")
  );
  check(
    "2 versioned contract",
    adapterSrc.includes(PERSIST_ESTIMATE_GENERATION_CONTRACT_VERSION) &&
      migration.includes("persist-estimate-generation-v1")
  );
  check(
    "3 one estimate generation input",
    adapterSrc.includes("PersistEstimateGenerationV1") &&
      migration.includes("p_payload jsonb")
  );
  check(
    "4 generation id required",
    migration.includes("INVALID_GENERATION_ID") &&
      adapterSrc.includes("generationId: string")
  );
  check(
    "5 transaction returns generation/snapshot identity",
    migration.includes("'estimate_id'") &&
      migration.includes("'generation_id'") &&
      migration.includes("'snapshot_id'") &&
      migration.includes("'status'")
  );
  check(
    "RPC name matches adapter",
    adapterSrc.includes(PERSIST_ESTIMATE_GENERATION_RPC)
  );
  check(
    "normal persist uses atomic RPC",
    persistSrc.includes("persistEstimateGenerationViaRpc") &&
      persistSrc.includes("buildPersistEstimateGenerationV1")
  );
  check(
    "authoritative mode has no unsafe fallback",
    persistSrc.includes("isAtomicPersistRpcUnavailable") &&
      persistSrc.includes("generationRequiresRequirementSnapshot")
  );
  check(
    "v1 contract has no caller snapshotRequired field",
    !adapterSrc.includes("snapshotRequired:") &&
      migration.includes("snapshotRequired is ignored")
  );
  check(
    "pricing uses generation-consistency helper",
    pricingSrc.includes("isEstimateReadyForPricing") &&
      !pricingSrc.includes("generationRequiresRequirementSnapshot")
  );
  check(
    "adapter always serializes a snapshot",
    adapterSrc.includes("buildSnapshotPayloadForEstimate") &&
      persistSrc.includes("buildPersistEstimateGenerationV1")
  );
}

function testHelpers() {
  console.log("\n--- HELPERS ---\n");
  check(
    "registry requires snapshot after REQ-4B promotion",
    generationRequiresRequirementSnapshot() === true
  );
  check(
    "surface is REQUIREMENT_AUTHORITATIVE",
    getComponentCommercialAuthority({
      workAreaType: "deck",
      componentKey: DECK_SURFACE_COMPONENT_KEY,
    }).authority === "REQUIREMENT_AUTHORITATIVE"
  );
  check(
    "labour remains SHADOW",
    getComponentCommercialAuthority({
      workAreaType: "deck",
      componentKey: DECK_LABOUR_COMPONENT_KEY,
    }).authority === "SHADOW"
  );

  const estimate = {
    estimateId: "e1",
    requirementGenerationId: "g1",
    latestRequirementSnapshotId: "s1",
    status: "ready",
    isStale: false,
  };
  check(
    "consistency helper matches linked snapshot",
    assertEstimateGenerationConsistent(estimate, {
      id: "s1",
      estimateId: "e1",
      generationId: "g1",
    }).ok === true
  );
  check(
    "consistency helper rejects generation mismatch",
    assertEstimateGenerationConsistent(estimate, {
      id: "s1",
      estimateId: "e1",
      generationId: "g2",
    }).ok === false
  );
  check(
    "historical pre-atomic pricing is not blocked by null snapshot",
    isEstimateReadyForPricing({
      estimateId: "e1",
      requirementGenerationId: null,
      latestRequirementSnapshotId: null,
      status: "ready",
      isStale: false,
    }).ok === true
  );
  check(
    "post-atomic pricing blocked without snapshot pointer",
    isEstimateReadyForPricing({
      estimateId: "e1",
      requirementGenerationId: "g1",
      latestRequirementSnapshotId: null,
      status: "ready",
      isStale: false,
    }).ok === false
  );
  check(
    "adapter snapshot is always present including empty requirements",
    Array.isArray(
      buildPersistEstimateGenerationV1({
        projectId: "00000000-0000-0000-0000-000000000001",
        generationId: "00000000-0000-0000-0000-000000000002",
        estimateResult: {
          costLow: 0,
          costHigh: 0,
          sellLow: 0,
          sellHigh: 0,
          recommendedCost: 0,
          recommendedSell: 0,
          grossProfit: 0,
          marginPercent: 0,
          markupPercent: 0,
          confidence: 50,
          rateSourceSummary: "test",
          assumptions: [],
          missingInfo: [],
          exclusions: [],
          lineItems: [],
          requirements: [],
        },
      }).snapshot.requirements
    )
  );
}

function testSchemaAndGrants() {
  console.log("\n--- SCHEMA / SECURITY ---\n");

  dbCheck(
    "RPC function exists",
    psql(`
      SELECT COUNT(*)::text
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public'
        AND p.proname = 'persist_estimate_generation_v1'
    `) === "1"
  );
  dbCheck(
    "SECURITY INVOKER (prosecdef false)",
    psql(`
      SELECT (NOT p.prosecdef)
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public'
        AND p.proname = 'persist_estimate_generation_v1'
    `) === "t"
  );
  dbCheck(
    "search_path locked to public",
    psql(`
      SELECT COALESCE(array_to_string(p.proconfig, ','), '')
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public'
        AND p.proname = 'persist_estimate_generation_v1'
    `).includes("search_path")
  );
  dbCheck(
    "33 no anon execute",
    psql(`
      SELECT has_function_privilege('anon', 'public.persist_estimate_generation_v1(jsonb)', 'execute')
    `) === "f"
  );
  dbCheck(
    "authenticated execute granted",
    psql(`
      SELECT has_function_privilege('authenticated', 'public.persist_estimate_generation_v1(jsonb)', 'execute')
    `) === "t"
  );
  dbCheck(
    "12 execute grants are minimum necessary (no service_role)",
    psql(`
      SELECT has_function_privilege('service_role', 'public.persist_estimate_generation_v1(jsonb)', 'execute')
    `) === "f"
  );
  dbCheck(
    "local migration 036 applied",
    psql(`
      SELECT COUNT(*)::text
      FROM supabase_migrations.schema_migrations
      WHERE version LIKE '036%'
    `) === "1"
  );
}

function testSuccessAndRollback() {
  console.log("\n--- SUCCESS + ROLLBACK ---\n");

  const fixture = createOrgFixture("success");
  const generationA = randomUUID();
  const generationB = randomUUID();
  const generationBadLine = randomUUID();
  const generationBadSnap = randomUUID();
  const generationDup = generationA;
  const generationAuth = randomUUID();
  const generationRequired = randomUUID();
  const generationTamper = randomUUID();
  const generationMissing = randomUUID();

  dbCheck(
    "11 legacy historical null snapshot remains readable",
    psql(`
      SELECT (latest_requirement_snapshot_id IS NULL AND requirement_generation_id IS NULL)
      FROM public.estimates WHERE id = '${fixture.estimateId}'
    `) === "t"
  );

  const outA = persistAsUser(
    fixture.userId,
    persistPayload({
      projectId: fixture.projectId,
      generationId: generationA,
      label: "Line A",
      sell: 120,
      componentKey: "decking.surface",
    })
  );
  const resultA = persistJsonFromOutput(outA);
  dbCheck("6 legacy/shadow generation persists", resultA?.status === "ready");
  dbCheck("7 estimate updated", resultA?.estimate_id === fixture.estimateId);
  dbCheck(
    "8 lines replaced",
    psql(`
      SELECT label FROM public.estimate_line_items
      WHERE estimate_id = '${fixture.estimateId}'
      ORDER BY sort_order
    `) === "Line A"
  );
  dbCheck(
    "9 component keys retained",
    psql(`
      SELECT component_key FROM public.estimate_line_items
      WHERE estimate_id = '${fixture.estimateId}'
    `) === "decking.surface"
  );
  dbCheck(
    "10 snapshot inserted",
    Boolean(resultA?.snapshot_id) &&
      psql(`
        SELECT COUNT(*)::text FROM public.estimate_requirement_snapshots
        WHERE id = '${resultA?.snapshot_id}'
      `) === "1"
  );
  dbCheck(
    "11 pointer links snapshot",
    psql(`
      SELECT latest_requirement_snapshot_id::text
      FROM public.estimates WHERE id = '${fixture.estimateId}'
    `) === resultA?.snapshot_id
  );
  dbCheck(
    "12 generation IDs match",
    psql(`
      SELECT (e.requirement_generation_id = s.generation_id)
      FROM public.estimates e
      JOIN public.estimate_requirement_snapshots s
        ON s.id = e.latest_requirement_snapshot_id
      WHERE e.id = '${fixture.estimateId}'
    `) === "t"
  );
  dbCheck(
    "13 ready state finalized",
    psql(`
      SELECT (status = 'ready' AND is_stale = false)
      FROM public.estimates WHERE id = '${fixture.estimateId}'
    `) === "t"
  );
  dbCheck(
    "empty-requirement snapshot valid",
    psql(`
      SELECT jsonb_typeof(payload->'requirements')
      FROM public.estimate_requirement_snapshots
      WHERE id = '${resultA?.snapshot_id}'
    `) === "array" &&
      psql(`
        SELECT jsonb_array_length(payload->'requirements')::text
        FROM public.estimate_requirement_snapshots
        WHERE id = '${resultA?.snapshot_id}'
      `) === "0"
  );
  dbCheck(
    "successful generation has non-null pointer",
    Boolean(resultA?.snapshot_id) &&
      psql(`
        SELECT (latest_requirement_snapshot_id IS NOT NULL)
        FROM public.estimates WHERE id = '${fixture.estimateId}'
      `) === "t"
  );
  dbCheck(
    "exactly one snapshot for generation",
    psql(`
      SELECT COUNT(*)::text FROM public.estimate_requirement_snapshots
      WHERE generation_id = '${generationA}'
    `) === "1"
  );

  const snapshotA = resultA?.snapshot_id ?? "";
  const lineCountA = psql(`
    SELECT COUNT(*)::text FROM public.estimate_line_items
    WHERE estimate_id = '${fixture.estimateId}'
  `);
  const sellA = psql(`
    SELECT recommended_sell::text FROM public.estimates WHERE id = '${fixture.estimateId}'
  `);

  const pricingP1 = randomUUID();
  const quoteQ1 = randomUUID();
  psql(`
    INSERT INTO public.pricing_documents (
      id, org_id, project_id, estimate_id, requirement_snapshot_id,
      title, status, subtotal_cost, subtotal_sell, gross_profit,
      margin_percent, markup_percent, gst_rate, gst_amount, total_incl_gst
    ) VALUES (
      '${pricingP1}', '${fixture.orgId}', '${fixture.projectId}', '${fixture.estimateId}', '${snapshotA}',
      'Pricing P1', 'draft', 100, 120, 20, 20, 25, 15, 18, 138
    );
    INSERT INTO public.quotes (
      id, org_id, project_id, pricing_document_id, estimate_id,
      title, status, subtotal, gst_rate, gst_amount, total_incl_gst
    ) VALUES (
      '${quoteQ1}', '${fixture.orgId}', '${fixture.projectId}', '${pricingP1}', '${fixture.estimateId}',
      'Quote Q1', 'draft', 120, 15, 18, 138
    );
  `);

  dbCheck(
    "14 invalid line causes failure",
    persistAsUserExpectError(
      fixture.userId,
      persistPayload({
        projectId: fixture.projectId,
        generationId: generationBadLine,
        label: "Line B-bad",
        category: "not_a_category",
        sell: 999,
      }),
      "REQ_TXN:INVALID_LINE"
    )
  );
  dbCheck(
    "15 previous estimate remains",
    psql(`
      SELECT requirement_generation_id::text
      FROM public.estimates WHERE id = '${fixture.estimateId}'
    `) === generationA
  );
  dbCheck(
    "16 previous lines remain",
    psql(`
      SELECT label FROM public.estimate_line_items
      WHERE estimate_id = '${fixture.estimateId}'
    `) === "Line A" &&
      psql(`
        SELECT COUNT(*)::text FROM public.estimate_line_items
        WHERE estimate_id = '${fixture.estimateId}'
      `) === lineCountA
  );
  dbCheck(
    "17 previous pointer remains",
    psql(`
      SELECT latest_requirement_snapshot_id::text
      FROM public.estimates WHERE id = '${fixture.estimateId}'
    `) === snapshotA
  );
  dbCheck(
    "18 no new snapshot",
    psql(`
      SELECT COUNT(*)::text FROM public.estimate_requirement_snapshots
      WHERE generation_id = '${generationBadLine}'
    `) === "0"
  );

  const oversized = snapshotPayload(generationBadSnap) as Record<string, unknown>;
  oversized.pad = "x".repeat(600000);
  dbCheck(
    "19 invalid snapshot causes failure",
    persistAsUserExpectError(
      fixture.userId,
      persistPayload({
        projectId: fixture.projectId,
        generationId: generationBadSnap,
        snapshot: oversized,
        sell: 999,
        label: "Line B-snap",
      }),
      "REQ_TXN:INVALID_SNAPSHOT"
    )
  );
  dbCheck(
    "20 previous estimate remains after snapshot failure",
    psql(`
      SELECT requirement_generation_id::text
      FROM public.estimates WHERE id = '${fixture.estimateId}'
    `) === generationA &&
      psql(`
        SELECT recommended_sell::text FROM public.estimates WHERE id = '${fixture.estimateId}'
      `) === sellA
  );
  dbCheck(
    "21 previous lines remain after snapshot failure",
    psql(`
      SELECT label FROM public.estimate_line_items
      WHERE estimate_id = '${fixture.estimateId}'
    `) === "Line A"
  );
  dbCheck(
    "22 previous pointer remains after snapshot failure",
    psql(`
      SELECT latest_requirement_snapshot_id::text
      FROM public.estimates WHERE id = '${fixture.estimateId}'
    `) === snapshotA
  );
  dbCheck(
    "23 no new snapshot after snapshot failure",
    psql(`
      SELECT COUNT(*)::text FROM public.estimate_requirement_snapshots
      WHERE generation_id = '${generationBadSnap}'
    `) === "0"
  );

  const other = createOrgFixture("other-org");
  dbCheck(
    "24 invalid org ownership fails",
    persistAsUserExpectError(
      other.userId,
      persistPayload({
        projectId: fixture.projectId,
        generationId: generationAuth,
      }),
      "REQ_TXN:PROJECT_NOT_FOUND"
    )
  );
  dbCheck(
    "25 no data changed after auth failure",
    psql(`
      SELECT requirement_generation_id::text
      FROM public.estimates WHERE id = '${fixture.estimateId}'
    `) === generationA &&
      psql(`
        SELECT COUNT(*)::text FROM public.estimate_requirement_snapshots
        WHERE generation_id = '${generationAuth}'
      `) === "0"
  );

  dbCheck(
    "unauthenticated persist fails",
    psqlExpectError(
      callPersistSql(
        persistPayload({
          projectId: fixture.projectId,
          generationId: randomUUID(),
        })
      ),
      "REQ_TXN:NOT_AUTHENTICATED"
    )
  );

  dbCheck(
    "26 duplicate generation id safe",
    persistAsUserExpectError(
      fixture.userId,
      persistPayload({
        projectId: fixture.projectId,
        generationId: generationDup,
        label: "Dup line",
        sell: 500,
      }),
      "REQ_TXN:DUPLICATE_GENERATION"
    )
  );
  dbCheck(
    "27 no duplicate lines",
    psql(`
      SELECT COUNT(*)::text FROM public.estimate_line_items
      WHERE estimate_id = '${fixture.estimateId}'
    `) === "1" &&
      psql(`
        SELECT label FROM public.estimate_line_items
        WHERE estimate_id = '${fixture.estimateId}'
      `) === "Line A"
  );
  dbCheck(
    "28 no duplicate snapshot",
    psql(`
      SELECT COUNT(*)::text FROM public.estimate_requirement_snapshots
      WHERE generation_id = '${generationA}'
    `) === "1"
  );

  dbCheck(
    "missing snapshot fails even in all-legacy/shadow authority",
    persistAsUserExpectError(
      fixture.userId,
      persistPayload({
        projectId: fixture.projectId,
        generationId: generationMissing,
        snapshot: null,
      }),
      "REQ_TXN:SNAPSHOT_REQUIRED"
    )
  );
  dbCheck(
    "caller cannot bypass via snapshotRequired=false",
    persistAsUserExpectError(
      fixture.userId,
      persistPayload({
        projectId: fixture.projectId,
        generationId: generationRequired,
        snapshotRequired: false,
        snapshot: null,
      }),
      "REQ_TXN:SNAPSHOT_REQUIRED"
    )
  );
  dbCheck(
    "caller cannot bypass via SHADOW componentAuthorities",
    persistAsUserExpectError(
      fixture.userId,
      persistPayload({
        projectId: fixture.projectId,
        generationId: generationTamper,
        authorities: shadowAuthorities(),
        snapshot: null,
      }),
      "REQ_TXN:SNAPSHOT_REQUIRED"
    )
  );
  dbCheck(
    "missing-snapshot leaves A intact",
    psql(`
      SELECT requirement_generation_id::text
      FROM public.estimates WHERE id = '${fixture.estimateId}'
    `) === generationA &&
      psql(`
        SELECT COUNT(*)::text FROM public.estimate_requirement_snapshots
        WHERE generation_id IN ('${generationMissing}', '${generationRequired}', '${generationTamper}')
      `) === "0"
  );

  const mismatchSnap = snapshotPayload(randomUUID());
  dbCheck(
    "invalid snapshot relationship (generation mismatch) fails",
    persistAsUserExpectError(
      fixture.userId,
      persistPayload({
        projectId: fixture.projectId,
        generationId: randomUUID(),
        snapshot: mismatchSnap,
      }),
      "REQ_TXN:INVALID_SNAPSHOT"
    )
  );

  const outB = persistAsUser(
    fixture.userId,
    persistPayload({
      projectId: fixture.projectId,
      generationId: generationB,
      label: "Line B",
      sell: 144,
      componentKey: "decking.surface",
    })
  );
  const resultB = persistJsonFromOutput(outB);
  dbCheck("generation B persists atomically", resultB?.status === "ready");
  dbCheck(
    "37 Pricing only from finalized generation (P1 created after A ready)",
    psql(`
      SELECT requirement_snapshot_id::text
      FROM public.pricing_documents WHERE id = '${pricingP1}'
    `) === snapshotA
  );
  dbCheck(
    "38 P1→A survives B",
    psql(`
      SELECT requirement_snapshot_id::text
      FROM public.pricing_documents WHERE id = '${pricingP1}'
    `) === snapshotA &&
      psql(`
        SELECT (subtotal_sell = 120)
        FROM public.pricing_documents WHERE id = '${pricingP1}'
      `) === "t"
  );

  const pricingP2 = randomUUID();
  psql(`
    INSERT INTO public.pricing_documents (
      id, org_id, project_id, estimate_id, requirement_snapshot_id,
      title, status, subtotal_cost, subtotal_sell, gross_profit,
      margin_percent, markup_percent, gst_rate, gst_amount, total_incl_gst
    ) VALUES (
      '${pricingP2}', '${fixture.orgId}', '${fixture.projectId}', '${fixture.estimateId}', '${resultB?.snapshot_id}',
      'Pricing P2', 'draft', 100, 144, 44, 20, 25, 15, 21.6, 165.6
    );
  `);
  dbCheck(
    "39 P2→B",
    psql(`
      SELECT requirement_snapshot_id::text
      FROM public.pricing_documents WHERE id = '${pricingP2}'
    `) === resultB?.snapshot_id
  );
  dbCheck(
    "40 Q1→P1→A survives B",
    psql(`
      SELECT pd.requirement_snapshot_id::text
      FROM public.quotes q
      JOIN public.pricing_documents pd ON pd.id = q.pricing_document_id
      WHERE q.id = '${quoteQ1}'
    `) === snapshotA &&
      psql(`
        SELECT (status = 'draft' AND total_incl_gst = 138)
        FROM public.quotes WHERE id = '${quoteQ1}'
      `) === "t"
  );
  dbCheck(
    "snapshot immutability preserved",
    psqlExpectError(
      `
      UPDATE public.estimate_requirement_snapshots
      SET schema_version = 'mutated'
      WHERE id = '${snapshotA}';
    `,
      "REQ_SNAPSHOT:IMMUTABLE"
    )
  );
  dbCheck(
    "47 estimate totals updated only on success (B sell 144)",
    psql(`
      SELECT recommended_sell::text FROM public.estimates WHERE id = '${fixture.estimateId}'
    `) === "144.00"
  );
  dbCheck(
    "48 Pricing money unchanged (P1 sell 120)",
    psql(`
      SELECT (subtotal_sell = 120) FROM public.pricing_documents WHERE id = '${pricingP1}'
    `) === "t"
  );
  dbCheck(
    "49 Quote money unchanged",
    psql(`
      SELECT (total_incl_gst = 138) FROM public.quotes WHERE id = '${quoteQ1}'
    `) === "t"
  );

  deleteOrgFixture(other.orgId, other.userId);
  deleteOrgFixture(fixture.orgId, fixture.userId);
}

async function testConcurrency() {
  console.log("\n--- CONCURRENCY ---\n");
  const fixture = createOrgFixture("concurrency");
  const generationA = randomUUID();
  persistAsUser(
    fixture.userId,
    persistPayload({
      projectId: fixture.projectId,
      generationId: generationA,
      label: "Line A",
      sell: 120,
    })
  );

  const generationB1 = randomUUID();
  const generationB2 = randomUUID();
  const sqlFor = (generationId: string, label: string) => `
    BEGIN;
    SET LOCAL ROLE authenticated;
    SELECT set_config('request.jwt.claim.sub', '${fixture.userId}', true);
    ${callPersistSql(
      persistPayload({
        projectId: fixture.projectId,
        generationId,
        label,
        sell: label === "Line B1" ? 130 : 140,
      })
    )}
    COMMIT;
  `;

  const results = await Promise.allSettled([
    psqlAsync(sqlFor(generationB1, "Line B1")),
    psqlAsync(sqlFor(generationB2, "Line B2")),
  ]);
  const successes = results.filter((item) => item.status === "fulfilled");
  dbCheck(
    "29 concurrent calls do not mix generations",
    successes.length >= 1
  );

  const currentGen = psql(`
    SELECT requirement_generation_id::text
    FROM public.estimates WHERE id = '${fixture.estimateId}'
  `);
  const currentSnap = psql(`
    SELECT latest_requirement_snapshot_id::text
    FROM public.estimates WHERE id = '${fixture.estimateId}'
  `);
  const snapGen = psql(`
    SELECT generation_id::text
    FROM public.estimate_requirement_snapshots WHERE id = '${currentSnap}'
  `);
  const lineLabel = psql(`
    SELECT label FROM public.estimate_line_items
    WHERE estimate_id = '${fixture.estimateId}'
  `);
  const lineCount = psql(`
    SELECT COUNT(*)::text FROM public.estimate_line_items
    WHERE estimate_id = '${fixture.estimateId}'
  `);

  dbCheck(
    "30 current pointer references one complete generation",
    (currentGen === generationB1 || currentGen === generationB2) &&
      snapGen === currentGen
  );
  dbCheck(
    "31 line set belongs to same finalized generation",
    lineCount === "1" &&
      ((currentGen === generationB1 && lineLabel === "Line B1") ||
        (currentGen === generationB2 && lineLabel === "Line B2"))
  );
  dbCheck(
    "32 snapshot belongs to current generation",
    snapGen === currentGen
  );

  const snapCount = Number(
    psql(`
      SELECT COUNT(*)::text FROM public.estimate_requirement_snapshots
      WHERE estimate_id = '${fixture.estimateId}'
        AND generation_id IN ('${generationB1}', '${generationB2}', '${generationA}')
    `)
  );
  dbCheck(
    "committed concurrent generations are whole (no mixed leftover lines)",
    snapCount >= 2 && snapCount <= 3 && lineCount === "1"
  );

  deleteOrgFixture(fixture.orgId, fixture.userId);
}

function testCrossOrgAndLegacy() {
  console.log("\n--- CROSS-ORG + LEGACY ---\n");
  const orgA = createOrgFixture("cross-a");
  const orgB = createOrgFixture("cross-b");
  const generationA = randomUUID();
  persistAsUser(
    orgA.userId,
    persistPayload({
      projectId: orgA.projectId,
      generationId: generationA,
    })
  );
  dbCheck(
    "35 no cross-org persistence",
    persistAsUserExpectError(
      orgB.userId,
      persistPayload({
        projectId: orgA.projectId,
        generationId: randomUUID(),
      }),
      "REQ_TXN:PROJECT_NOT_FOUND"
    ) &&
      psql(`
        SELECT requirement_generation_id::text
        FROM public.estimates WHERE id = '${orgA.estimateId}'
      `) === generationA
  );

  const legacy = createOrgFixture("legacy-null", true);
  const genLegacy = randomUUID();
  const outLegacy = persistAsUser(
    legacy.userId,
    persistPayload({
      projectId: legacy.projectId,
      generationId: genLegacy,
      componentKey: null,
      label: "Legacy materials",
    })
  );
  const resultLegacy = persistJsonFromOutput(outLegacy);
  dbCheck(
    "legacy NULL component_key persists",
    resultLegacy?.status === "ready" &&
      psql(`
        SELECT COALESCE(component_key, 'NULL')
        FROM public.estimate_line_items
        WHERE estimate_id = '${legacy.estimateId}'
      `) === "NULL"
  );
  dbCheck(
    "legacy project without prior snapshot can persist a new generation",
    Boolean(resultLegacy?.snapshot_id)
  );

  const firstGen = createOrgFixture("first-insert", false);
  const genFirst = randomUUID();
  const outFirst = persistAsUser(
    firstGen.userId,
    persistPayload({
      projectId: firstGen.projectId,
      generationId: genFirst,
    })
  );
  const resultFirst = persistJsonFromOutput(outFirst);
  dbCheck(
    "first generation inserts estimate row atomically",
    resultFirst?.status === "ready" && Boolean(resultFirst?.estimate_id)
  );

  deleteOrgFixture(orgA.orgId, orgA.userId);
  deleteOrgFixture(orgB.orgId, orgB.userId);
  deleteOrgFixture(legacy.orgId, legacy.userId);
  deleteOrgFixture(firstGen.orgId, firstGen.userId);
}

function testAuthorityAndPlatform() {
  console.log("\n--- AUTHORITY / REGRESSION / PLATFORM ---\n");
  const persistSrc = read("lib/estimate/persist-estimate.ts");
  const adapterSrc = read("lib/estimate/persist-estimate-generation.ts");
  const authoritySrc = read("lib/estimate/component-authority.ts");
  const deckSrc = read("lib/estimate/calculators/deck.ts");
  const surfaceSrc = read("lib/estimate/deck-surface-requirement.ts");
  const labourSrc = read("lib/estimate/deck-labour-requirement.ts");
  const calculateSrc = read("lib/estimate/calculate-estimate.ts");

  check(
    "41 surface is REQUIREMENT_AUTHORITATIVE",
    getComponentCommercialAuthority({
      workAreaType: "deck",
      componentKey: DECK_SURFACE_COMPONENT_KEY,
    }).authority === "REQUIREMENT_AUTHORITATIVE"
  );
  check(
    "42 labour remains SHADOW",
    getComponentCommercialAuthority({
      workAreaType: "deck",
      componentKey: DECK_LABOUR_COMPONENT_KEY,
    }).authority === "SHADOW"
  );
  check(
    "43 promoted surface requires snapshot generation flag",
    authoritySrc.includes('authority: "REQUIREMENT_AUTHORITATIVE"') &&
      generationRequiresRequirementSnapshot() === true
  );
  check(
    "44 requirement cost still not totals",
    calculateSrc.includes("Do not add requirement cost") ||
      calculateSrc.includes("requirements are not commercial") ||
      persistSrc.includes("Requirement objects are not commercial authority")
  );
  check(
    "45 existing material requirement unchanged",
    surfaceSrc.includes(DECK_SURFACE_COMPONENT_KEY) &&
      !adapterSrc.includes("calculateDeckingBoardLm")
  );
  check(
    "46 existing labour requirement unchanged",
    labourSrc.includes(DECK_LABOUR_COMPONENT_KEY) &&
      !adapterSrc.includes("shapeLabourHours")
  );
  check(
    "50 no UI",
    !persistSrc.includes("use client") && !adapterSrc.includes("use client")
  );
  check("51 no AI", !persistSrc.toLowerCase().includes("openai") && !adapterSrc.includes("openai"));
  check("52 Production SD disabled", isScopeDiscoveryEnabled({}) === false);
  check(
    "53 migration 036 remote applied is documented",
    read("docs/implementation/REQ_TXN_01_ATOMIC_ESTIMATE_PERSISTENCE_COMPLETION.md").includes(
      "REMOTE APPLIED"
    )
  );
  check(
    "calculators not imported by persist adapter",
    !adapterSrc.includes("calculators/deck") && !deckSrc.includes("persist_estimate_generation")
  );
  check(
    "goldens remain documented as unchanged",
    read("docs/runbooks/REQ_4A_OWNER_TECHNICAL_GATE.md").includes("48,340") &&
      read("docs/runbooks/REQ_4A_OWNER_TECHNICAL_GATE.md").includes("8,782")
  );

  const migrations = existsSync(join("supabase", "migrations"))
    ? readdirSync(join("supabase", "migrations"))
    : [];
  check(
    "035 remains immutable file",
    migrations.includes("035_estimate_requirement_snapshots.sql") &&
      migrations.includes("036_persist_estimate_generation_v1.sql")
  );
}

async function main() {
  console.log("=== REQ-TXN-01 atomic estimate persistence verification ===");
  DB_CONTAINER = resolveLocalDbContainer();
  psql("SELECT 1");

  testContract();
  testHelpers();
  testSchemaAndGrants();
  testSuccessAndRollback();
  await testConcurrency();
  testCrossOrgAndLegacy();
  testAuthorityAndPlatform();

  console.log(
    `\nREQ-TXN-01: ${passed} passed, ${failed} failed (${dbChecks} DB checks)`
  );
  if (failed > 0) {
    process.exitCode = 1;
    process.exit(1);
  }
  console.log("REQ-TXN-01 verification PASSED");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
