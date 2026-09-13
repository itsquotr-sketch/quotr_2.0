/**
 * PERFORMANCE-01C-4 — mutation-result reload + scalar Details save graph.
 *
 * Replays BEFORE (result loader selects work_areas + organisation_settings)
 * and AFTER (work_areas threaded; settings via 01B reader) against Preview
 * Supabase. Read-only. Not Production.
 *
 * Run: npx --yes tsx scripts/measure-performance-01c-4.ts
 */
import fs from "node:fs";
import path from "node:path";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { PREVIEW_SUPABASE_PROJECT_REF } from "./lib/preview-auth-fixture.ts";

const WORK_AREA_COLUMNS =
  "id, type, name, status, ai_confidence, summary, quote_description, sort_order, created_at";
const ESTIMATE_COLUMNS =
  "id, cost_low, cost_high, sell_low, sell_high, recommended_cost, recommended_sell, gross_profit, margin_percent, markup_percent, is_stale, calibration_version, target_margin_percent, confidence, rate_source_summary, assumptions, missing_info, exclusions, assumption_metadata, latest_requirement_snapshot_id, requirement_generation_id";
const QUESTION_COLUMNS =
  "id, question_block_id, work_area_id, key, label, question_text, input_type, options, required, unit, answer_value, sort_order";
const SETTINGS_COLUMNS =
  "id, org_id, trading_name, legal_name, contact_email, contact_phone, timezone, currency, country, region, default_gst_rate, default_margin_percent, default_contingency_percent, budget_rate_factor, premium_rate_factor, onboarding_status, onboarding_step, onboarding_completed_at, prefer_user_rates, allow_benchmark_rates, show_profit_in_estimates, address_line_1, city, logo_url, default_material_wastage_percent, decking_wastage_percent, sheet_material_wastage_percent, flooring_wastage_percent, paint_wastage_percent, timber_framing_wastage_percent";

function loadEnvLocal(): void {
  const envPath = path.resolve(process.cwd(), ".env.local");
  if (!fs.existsSync(envPath)) return;
  for (const raw of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq <= 0) continue;
    const key = line.slice(0, eq).trim();
    const value = line.slice(eq + 1).trim();
    if (!(key in process.env)) process.env[key] = value;
  }
}

function assertPreviewTarget(url: string): void {
  if (!url.includes(`${PREVIEW_SUPABASE_PROJECT_REF}.supabase.co`)) {
    throw new Error("Refusing to measure: not Preview Supabase.");
  }
}

async function q(
  sb: SupabaseClient,
  table: string,
  run: (from: ReturnType<SupabaseClient["from"]>) => Promise<unknown>
): Promise<string> {
  await run(sb.from(table));
  return table;
}

async function timeWaves(
  label: string,
  waves: (() => Promise<string[]>)[]
): Promise<{ label: string; durationMs: number; queries: number; waves: number }> {
  const started = performance.now();
  let queries = 0;
  for (const wave of waves) {
    queries += (await wave()).length;
  }
  return {
    label,
    durationMs: Math.round(performance.now() - started),
    queries,
    waves: waves.length,
  };
}

async function resolveFixture(sb: SupabaseClient): Promise<{
  orgId: string;
  userId: string;
  projectId: string;
  workAreaId: string | null;
}> {
  const { data: fact } = await sb
    .from("project_facts")
    .select("project_id, work_area_id, org_id")
    .eq("key", "deck.height_m")
    .limit(1)
    .maybeSingle();

  let orgId = fact?.org_id as string | undefined;
  let projectId = fact?.project_id as string | undefined;
  let workAreaId = (fact?.work_area_id as string | null | undefined) ?? null;

  if (!orgId || !projectId) {
    const { data: project } = await sb
      .from("projects")
      .select("id, org_id")
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!project) {
      throw new Error("No Preview project available for measurement.");
    }
    orgId = project.org_id;
    projectId = project.id;
    const { data: area } = await sb
      .from("work_areas")
      .select("id")
      .eq("project_id", project.id)
      .limit(1)
      .maybeSingle();
    workAreaId = area?.id ?? null;
  }

  const { data: membership } = await sb
    .from("organisation_memberships")
    .select("user_id")
    .eq("org_id", orgId)
    .in("status", ["active", "pending_billing"])
    .limit(1)
    .maybeSingle();

  const userId = membership?.user_id as string | undefined;
  if (!userId) {
    throw new Error("No Preview membership available for measurement.");
  }

  return { orgId, userId, projectId, workAreaId };
}

function printRow(
  kind: string,
  row: { durationMs: number; queries: number; waves: number }
): void {
  console.log(
    [
      kind.padEnd(40),
      `${row.durationMs}ms`.padStart(8),
      `q=${row.queries}`.padStart(6),
      `waves=${row.waves}`.padStart(9),
    ].join("  ")
  );
}

function ownership(sb: SupabaseClient, orgId: string, projectId: string) {
  return q(sb, "projects", (t) =>
    t
      .select("id")
      .eq("id", projectId)
      .eq("org_id", orgId)
      .is("deleted_at", null)
      .maybeSingle()
  );
}

function resultReads(
  sb: SupabaseClient,
  orgId: string,
  projectId: string,
  includeWorkAreas: boolean,
  settingsMode: "narrow" | "raw-reader"
) {
  const reads: Promise<string>[] = [
    q(sb, "projects", (t) =>
      t
        .select("id, stage, brief_text, quality_level")
        .eq("id", projectId)
        .eq("org_id", orgId)
        .maybeSingle()
    ),
    q(sb, "question_blocks", (t) =>
      t
        .select("id, stage, title, description, status, sort_order, created_at")
        .eq("project_id", projectId)
        .eq("org_id", orgId)
        .order("sort_order", { ascending: true })
    ),
    q(sb, "questions", (t) =>
      t
        .select(QUESTION_COLUMNS)
        .eq("project_id", projectId)
        .eq("org_id", orgId)
        .order("sort_order", { ascending: true })
    ),
    q(sb, "constraints", (t) =>
      t
        .select("id, key, label, value, source, created_at")
        .eq("project_id", projectId)
        .eq("org_id", orgId)
        .order("created_at", { ascending: true })
    ),
    q(sb, "estimates", (t) =>
      t
        .select(ESTIMATE_COLUMNS)
        .eq("project_id", projectId)
        .eq("org_id", orgId)
        .maybeSingle()
    ),
    q(sb, "project_facts", (t) =>
      t
        .select("key, work_area_id, value, source")
        .eq("project_id", projectId)
        .eq("org_id", orgId)
    ),
    settingsMode === "narrow"
      ? q(sb, "organisation_settings", (t) =>
          t
            .select("default_margin_percent, default_gst_rate")
            .eq("org_id", orgId)
            .maybeSingle()
        )
      : q(sb, "organisation_settings", (t) =>
          t.select(SETTINGS_COLUMNS).eq("org_id", orgId).maybeSingle()
        ),
  ];
  if (includeWorkAreas) {
    reads.splice(
      1,
      0,
      q(sb, "work_areas", (t) =>
        t
          .select(WORK_AREA_COLUMNS)
          .eq("project_id", projectId)
          .eq("org_id", orgId)
          .order("sort_order", { ascending: true })
          .order("created_at", { ascending: true })
      )
    );
  }
  return Promise.all(reads);
}

async function measureLoadResult(
  sb: SupabaseClient,
  fixture: { orgId: string; projectId: string },
  variant: "before" | "after"
) {
  if (variant === "before") {
    return timeWaves("load-result-before", [
      () => Promise.all([ownership(sb, fixture.orgId, fixture.projectId)]),
      () => resultReads(sb, fixture.orgId, fixture.projectId, true, "narrow"),
    ]);
  }
  return timeWaves("load-result-after", [
    () => Promise.all([ownership(sb, fixture.orgId, fixture.projectId)]),
    () => resultReads(sb, fixture.orgId, fixture.projectId, false, "raw-reader"),
  ]);
}

async function measureScalarPath(
  sb: SupabaseClient,
  fixture: {
    orgId: string;
    userId: string;
    projectId: string;
    workAreaId: string | null;
  },
  variant: "before" | "after"
) {
  const target = () =>
    q(sb, "project_facts", (t) => {
      let query = t
        .select("id, source")
        .eq("project_id", fixture.projectId)
        .eq("key", "deck.height_m");
      query = fixture.workAreaId
        ? query.eq("work_area_id", fixture.workAreaId)
        : query.is("work_area_id", null);
      return query.maybeSingle();
    });

  const workAreaLookup = () =>
    fixture.workAreaId
      ? q(sb, "work_areas", (t) =>
          t
            .select("id")
            .eq("id", fixture.workAreaId as string)
            .eq("project_id", fixture.projectId)
            .maybeSingle()
        )
      : Promise.resolve("work_areas-skip");

  const authzWave = () =>
    Promise.all([
      q(sb, "org_billing_customers", (t) =>
        t
          .select("id")
          .eq("org_id", fixture.orgId)
          .eq("billing_environment", "test")
          .maybeSingle()
      ),
      q(sb, "org_subscriptions", (t) =>
        t
          .select("id")
          .eq("org_id", fixture.orgId)
          .eq("billing_environment", "test")
          .maybeSingle()
      ),
      q(sb, "org_billing_overrides", (t) =>
        t
          .select("id")
          .eq("org_id", fixture.orgId)
          .eq("billing_environment", "test")
      ),
      q(sb, "organisation_memberships", (t) =>
        t
          .select("role, status")
          .eq("org_id", fixture.orgId)
          .eq("user_id", fixture.userId)
          .in("status", ["active", "pending_billing"])
          .maybeSingle()
      ),
    ]);

  const derivedWorkAreas = () =>
    q(sb, "work_areas", (t) =>
      t
        .select(WORK_AREA_COLUMNS)
        .eq("project_id", fixture.projectId)
        .eq("org_id", fixture.orgId)
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: true })
    );

  const derivedFacts = () =>
    q(sb, "project_facts", (t) =>
      t
        .select("key, work_area_id, value, source, conflict_warning")
        .eq("project_id", fixture.projectId)
    );

  const ensureWave = () =>
    Promise.all([
      q(sb, "work_areas", (t) =>
        t
          .select("id, type, name, status, sort_order")
          .eq("project_id", fixture.projectId)
          .eq("status", "confirmed")
          .order("sort_order")
      ),
      q(sb, "project_facts", (t) =>
        t
          .select("key, work_area_id, value, source, conflict_warning")
          .eq("project_id", fixture.projectId)
      ),
      q(sb, "questions", (t) =>
        t
          .select("work_area_id, key, label, unit, answer_value, question_block_id, sort_order")
          .eq("project_id", fixture.projectId)
      ),
      q(sb, "question_blocks", (t) =>
        t
          .select("id, status, stage, title")
          .eq("project_id", fixture.projectId)
          .eq("stage", "work_area_questions")
      ),
      q(sb, "constraints", (t) =>
        t.select("key, value").eq("project_id", fixture.projectId)
      ),
    ]);

  const preWrite = [
    () => authzWave(),
    () =>
      Promise.all([
        q(sb, "profiles", (t) =>
          t.select("org_id, role").eq("id", fixture.userId).maybeSingle()
        ),
      ]),
    () =>
      Promise.all([
        q(sb, "projects", (t) =>
          t
            .select("id, stage, quality_level")
            .eq("id", fixture.projectId)
            .eq("org_id", fixture.orgId)
            .is("deleted_at", null)
            .maybeSingle()
        ),
        workAreaLookup(),
      ]),
    () => Promise.all([target()]),
    () => Promise.all([derivedWorkAreas(), derivedFacts()]),
    () => ensureWave(),
  ];

  const staleAndLoadBefore = [
    () => Promise.all([ownership(sb, fixture.orgId, fixture.projectId)]),
    () => Promise.all([ownership(sb, fixture.orgId, fixture.projectId)]),
    () => resultReads(sb, fixture.orgId, fixture.projectId, true, "narrow"),
  ];

  const staleAndLoadAfter = [
    () => Promise.all([ownership(sb, fixture.orgId, fixture.projectId)]),
    () => Promise.all([ownership(sb, fixture.orgId, fixture.projectId)]),
    () => resultReads(sb, fixture.orgId, fixture.projectId, false, "raw-reader"),
  ];

  if (variant === "before") {
    return timeWaves("scalar-before", [...preWrite, ...staleAndLoadBefore]);
  }
  return timeWaves("scalar-after", [...preWrite, ...staleAndLoadAfter]);
}

async function main(): Promise<void> {
  loadEnvLocal();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("Preview env missing.");
  }
  assertPreviewTarget(url);

  const sb = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const fixture = await resolveFixture(sb);
  console.log(
    `[perf-01c-4] fixture org=…${fixture.orgId.slice(-6)} project=…${fixture.projectId.slice(-6)} wa=${fixture.workAreaId ? "yes" : "no"}`
  );
  console.log("surface                                     ms      queries  waves");

  for (const kind of ["cold", "warm"] as const) {
    const loadBefore = await measureLoadResult(sb, fixture, "before");
    const loadAfter = await measureLoadResult(sb, fixture, "after");
    const scalarBefore = await measureScalarPath(sb, fixture, "before");
    const scalarAfter = await measureScalarPath(sb, fixture, "after");
    console.log(`-- ${kind} --`);
    printRow(`${kind} load-result-before`, loadBefore);
    printRow(`${kind} load-result-after`, loadAfter);
    printRow(`${kind} scalar-graph-before`, scalarBefore);
    printRow(`${kind} scalar-graph-after`, scalarAfter);
  }

  console.log(
    "[perf-01c-4] disappeared from loadAssistantMutationResult: work_areas SELECT (threaded from scalar post-commit load). organisation_settings dedicated SELECT replaced by 01B raw reader (still one settings read unless already cached this request). Ownership, project_facts, estimates, questions, question_blocks, constraints, and projects stay fresh. Writes, ensureMissingDetails, and mark-stale are excluded from the load-result graph; the scalar graph includes pre-write 01C-2/01C-3 + ensure reads + two post-write ownership checks + result reload. Estimate UPDATE itself is not timed."
  );
}

main().catch((error) => {
  console.error("[perf-01c-4] measure failed:", error instanceof Error ? error.message : error);
  process.exit(1);
});
