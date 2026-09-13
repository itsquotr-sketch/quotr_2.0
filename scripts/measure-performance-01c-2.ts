/**
 * PERFORMANCE-01C-2 — scalar Details save query-graph measurement.
 *
 * Replays BEFORE (two project reads + two target fact reads) and AFTER
 * (one project read + one target fact read) against Preview Supabase.
 * Read-only. Not Production.
 *
 * Run: npx --yes tsx scripts/measure-performance-01c-2.ts
 */
import fs from "node:fs";
import path from "node:path";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { PREVIEW_SUPABASE_PROJECT_REF } from "./lib/preview-auth-fixture.ts";

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
  projectId: string;
  workAreaId: string | null;
}> {
  const { data: fact } = await sb
    .from("project_facts")
    .select("project_id, work_area_id, org_id")
    .eq("key", "deck.height_m")
    .limit(1)
    .maybeSingle();

  if (fact?.project_id && fact.org_id) {
    return {
      orgId: fact.org_id,
      projectId: fact.project_id,
      workAreaId: fact.work_area_id ?? null,
    };
  }

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

  const { data: area } = await sb
    .from("work_areas")
    .select("id")
    .eq("project_id", project.id)
    .limit(1)
    .maybeSingle();

  return {
    orgId: project.org_id,
    projectId: project.id,
    workAreaId: area?.id ?? null,
  };
}

function printRow(
  kind: string,
  row: { durationMs: number; queries: number; waves: number }
): void {
  console.log(
    [
      kind.padEnd(28),
      `${row.durationMs}ms`.padStart(8),
      `q=${row.queries}`.padStart(6),
      `waves=${row.waves}`.padStart(9),
    ].join("  ")
  );
}

async function measureScalarPath(
  sb: SupabaseClient,
  orgId: string,
  projectId: string,
  workAreaId: string | null,
  variant: "before" | "after"
) {
  const target = () =>
    q(sb, "project_facts", (t) => {
      let query = t
        .select("id, source")
        .eq("project_id", projectId)
        .eq("key", "deck.height_m");
      query = workAreaId
        ? query.eq("work_area_id", workAreaId)
        : query.is("work_area_id", null);
      return query.maybeSingle();
    });

  const workArea = () =>
    workAreaId
      ? q(sb, "work_areas", (t) =>
          t.select("id").eq("id", workAreaId).eq("project_id", projectId).maybeSingle()
        )
      : Promise.resolve("work_areas-skip");

  if (variant === "before") {
    return timeWaves("scalar-before", [
      () =>
        Promise.all([
          q(sb, "projects", (t) =>
            t
              .select("id")
              .eq("id", projectId)
              .eq("org_id", orgId)
              .is("deleted_at", null)
              .maybeSingle()
          ),
        ]),
      () =>
        Promise.all([
          q(sb, "projects", (t) =>
            t
              .select("id, stage, quality_level")
              .eq("id", projectId)
              .eq("org_id", orgId)
              .maybeSingle()
          ),
          workArea(),
        ]),
      () => Promise.all([target()]),
      () => Promise.all([target()]),
    ]);
  }

  return timeWaves("scalar-after", [
    () =>
      Promise.all([
        q(sb, "projects", (t) =>
          t
            .select("id, stage, quality_level")
            .eq("id", projectId)
            .eq("org_id", orgId)
            .is("deleted_at", null)
            .maybeSingle()
        ),
        workArea(),
      ]),
    () => Promise.all([target()]),
  ]);
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
    `[perf-01c-2] fixture org=…${fixture.orgId.slice(-6)} project=…${fixture.projectId.slice(-6)} wa=${fixture.workAreaId ? "yes" : "no"}`
  );
  console.log("surface                       ms      queries  waves");

  for (const kind of ["cold", "warm"] as const) {
    const before = await measureScalarPath(
      sb,
      fixture.orgId,
      fixture.projectId,
      fixture.workAreaId,
      "before"
    );
    const after = await measureScalarPath(
      sb,
      fixture.orgId,
      fixture.projectId,
      fixture.workAreaId,
      "after"
    );
    console.log(`-- ${kind} --`);
    printRow(`${kind} scalar-before`, before);
    printRow(`${kind} scalar-after`, after);
  }

  console.log(
    "[perf-01c-2] number/select/boolean scalar Details answers share this path (commitUserFactEdit → upsertScopedFact). Post-write ownership + mutation reload are unchanged and excluded from this graph."
  );
}

main().catch((error) => {
  console.error("[perf-01c-2] measure failed:", error instanceof Error ? error.message : error);
  process.exit(1);
});
