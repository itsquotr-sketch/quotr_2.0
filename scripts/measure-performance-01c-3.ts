/**
 * PERFORMANCE-01C-3 — permission/auth section + scalar Details save graph.
 *
 * Replays BEFORE (entitlement then membership) and AFTER (same queries,
 * overlapping entitlement + membership) against Preview Supabase.
 * Read-only. Not Production.
 *
 * Run: npx --yes tsx scripts/measure-performance-01c-3.ts
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

  const orgId = fact?.org_id as string | undefined;
  const projectId = fact?.project_id as string | undefined;
  let workAreaId = (fact?.work_area_id as string | null | undefined) ?? null;

  let resolvedOrg = orgId;
  let resolvedProject = projectId;

  if (!resolvedOrg || !resolvedProject) {
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
    resolvedOrg = project.org_id;
    resolvedProject = project.id;
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
    .eq("org_id", resolvedOrg)
    .in("status", ["active", "pending_billing"])
    .limit(1)
    .maybeSingle();

  const userId = membership?.user_id as string | undefined;
  if (!userId) {
    throw new Error("No Preview membership available for measurement.");
  }

  return {
    orgId: resolvedOrg,
    userId,
    projectId: resolvedProject,
    workAreaId,
  };
}

function printRow(
  kind: string,
  row: { durationMs: number; queries: number; waves: number }
): void {
  console.log(
    [
      kind.padEnd(36),
      `${row.durationMs}ms`.padStart(8),
      `q=${row.queries}`.padStart(6),
      `waves=${row.waves}`.padStart(9),
    ].join("  ")
  );
}

function entitlementWave(sb: SupabaseClient, orgId: string): Promise<string[]> {
  return Promise.all([
    q(sb, "org_billing_customers", (t) =>
      t
        .select("id")
        .eq("org_id", orgId)
        .eq("billing_environment", "test")
        .maybeSingle()
    ),
    q(sb, "org_subscriptions", (t) =>
      t
        .select("id")
        .eq("org_id", orgId)
        .eq("billing_environment", "test")
        .maybeSingle()
    ),
    q(sb, "org_billing_overrides", (t) =>
      t
        .select("id")
        .eq("org_id", orgId)
        .eq("billing_environment", "test")
    ),
  ]);
}

function membershipStart(sb: SupabaseClient, orgId: string, userId: string) {
  return q(sb, "organisation_memberships", (t) =>
    t
      .select("role, status")
      .eq("org_id", orgId)
      .eq("user_id", userId)
      .in("status", ["active", "pending_billing"])
      .maybeSingle()
  );
}

function profileRead(sb: SupabaseClient, userId: string) {
  return q(sb, "profiles", (t) =>
    t.select("org_id, role").eq("id", userId).maybeSingle()
  );
}

async function measureAuthz(
  sb: SupabaseClient,
  orgId: string,
  userId: string,
  variant: "before" | "after"
) {
  if (variant === "before") {
    return timeWaves("authz-before", [
      () => entitlementWave(sb, orgId),
      () => Promise.all([membershipStart(sb, orgId, userId)]),
      () => Promise.all([profileRead(sb, userId)]),
    ]);
  }

  return timeWaves("authz-after", [
    () =>
      Promise.all([
        ...[
          q(sb, "org_billing_customers", (t) =>
            t
              .select("id")
              .eq("org_id", orgId)
              .eq("billing_environment", "test")
              .maybeSingle()
          ),
          q(sb, "org_subscriptions", (t) =>
            t
              .select("id")
              .eq("org_id", orgId)
              .eq("billing_environment", "test")
              .maybeSingle()
          ),
          q(sb, "org_billing_overrides", (t) =>
            t
              .select("id")
              .eq("org_id", orgId)
              .eq("billing_environment", "test")
          ),
        ],
        membershipStart(sb, orgId, userId),
      ]),
    () => Promise.all([profileRead(sb, userId)]),
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

  const workArea = () =>
    fixture.workAreaId
      ? q(sb, "work_areas", (t) =>
          t
            .select("id")
            .eq("id", fixture.workAreaId as string)
            .eq("project_id", fixture.projectId)
            .maybeSingle()
        )
      : Promise.resolve("work_areas-skip");

  const mergedProject = () =>
    q(sb, "projects", (t) =>
      t
        .select("id, stage, quality_level")
        .eq("id", fixture.projectId)
        .eq("org_id", fixture.orgId)
        .is("deleted_at", null)
        .maybeSingle()
    );

  if (variant === "before") {
    return timeWaves("scalar-before", [
      () => entitlementWave(sb, fixture.orgId),
      () => Promise.all([membershipStart(sb, fixture.orgId, fixture.userId)]),
      () => Promise.all([profileRead(sb, fixture.userId)]),
      () => Promise.all([mergedProject(), workArea()]),
      () => Promise.all([target()]),
    ]);
  }

  return timeWaves("scalar-after", [
    () =>
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
        membershipStart(sb, fixture.orgId, fixture.userId),
      ]),
    () => Promise.all([profileRead(sb, fixture.userId)]),
    () => Promise.all([mergedProject(), workArea()]),
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
    `[perf-01c-3] fixture org=…${fixture.orgId.slice(-6)} user=…${fixture.userId.slice(-6)} project=…${fixture.projectId.slice(-6)} wa=${fixture.workAreaId ? "yes" : "no"}`
  );
  console.log("surface                                 ms      queries  waves");

  for (const kind of ["cold", "warm"] as const) {
    const authzBefore = await measureAuthz(sb, fixture.orgId, fixture.userId, "before");
    const authzAfter = await measureAuthz(sb, fixture.orgId, fixture.userId, "after");
    const scalarBefore = await measureScalarPath(sb, fixture, "before");
    const scalarAfter = await measureScalarPath(sb, fixture, "after");
    console.log(`-- ${kind} --`);
    printRow(`${kind} authz-before`, authzBefore);
    printRow(`${kind} authz-after`, authzAfter);
    printRow(`${kind} scalar-before`, scalarBefore);
    printRow(`${kind} scalar-after`, scalarAfter);
  }

  console.log(
    "[perf-01c-3] authz = requireOrgEntitlement (3 billing reads) + requireOrgPermission (membership then profile). Membership still depends on its own row before profiles. 01C-2 merged project+work_area and the target fact SELECT are unchanged. Post-write ownership + mutation reload are excluded."
  );
}

main().catch((error) => {
  console.error("[perf-01c-3] measure failed:", error instanceof Error ? error.message : error);
  process.exit(1);
});
