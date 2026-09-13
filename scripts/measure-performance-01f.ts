/**
 * PERFORMANCE-01F — Billing + Profile read-graph measurement.
 *
 * Replays BEFORE (duplicate getUser/profile/org) vs AFTER (layout reuse)
 * against Preview Supabase. No writes. Not Production. Auth getUser itself
 * is not replayed (GoTrue); DB extras only.
 *
 * Run: npx --yes tsx scripts/measure-performance-01f.ts
 */
import fs from "node:fs";
import path from "node:path";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { PREVIEW_SUPABASE_PROJECT_REF } from "./lib/preview-auth-fixture.ts";

type GraphResult = {
  label: string;
  durationMs: number;
  queries: number;
  waves: number;
};

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

async function wave(jobs: Promise<string>[]): Promise<string[]> {
  return Promise.all(jobs);
}

async function timeGraph(
  label: string,
  waves: (() => Promise<string[]>)[]
): Promise<GraphResult> {
  const started = performance.now();
  for (const next of waves) {
    await next();
  }
  return {
    label,
    durationMs: Math.round(performance.now() - started),
    queries: waves.length === 0 ? 0 : -1,
    waves: waves.length,
  };
}

async function timeGraphCounted(
  label: string,
  waves: (() => Promise<string[]>)[]
): Promise<GraphResult> {
  const started = performance.now();
  let queries = 0;
  for (const next of waves) {
    queries += (await next()).length;
  }
  return {
    label,
    durationMs: Math.round(performance.now() - started),
    queries,
    waves: waves.length,
  };
}

function billing(sb: SupabaseClient, orgId: string) {
  return [
    q(sb, "org_billing_customers", (t) =>
      t.select("id").eq("org_id", orgId).limit(1)
    ),
    q(sb, "org_subscriptions", (t) =>
      t.select("id").eq("org_id", orgId).limit(1)
    ),
    q(sb, "org_billing_overrides", (t) =>
      t.select("id").eq("org_id", orgId).limit(1)
    ),
  ];
}

async function measureBillingBefore(
  sb: SupabaseClient,
  orgId: string
): Promise<GraphResult> {
  return timeGraphCounted("billing-page-before", [
    () =>
      wave([
        q(sb, "profiles", (t) => t.select("full_name").limit(1)),
      ]),
    () => wave(billing(sb, orgId)),
  ]);
}

async function measureBillingAfter(): Promise<GraphResult> {
  return timeGraphCounted("billing-page-after", []);
}

async function measureProfileBefore(
  sb: SupabaseClient,
  orgId: string
): Promise<GraphResult> {
  return timeGraphCounted("profile-page-before", [
    () => wave([q(sb, "profiles", (t) => t.select("full_name, role, org_id").limit(1))]),
    () =>
      wave([
        q(sb, "organisations", (t) =>
          t.select("name").eq("id", orgId).maybeSingle()
        ),
      ]),
  ]);
}

async function measureProfileAfter(): Promise<GraphResult> {
  return timeGraphCounted("profile-page-after", []);
}

async function measureLayout(
  sb: SupabaseClient,
  orgId: string
): Promise<GraphResult> {
  return timeGraphCounted("layout", [
    () =>
      wave([
        q(sb, "profiles", (t) => t.select("full_name, role").limit(1)),
        q(sb, "organisations", (t) =>
          t.select("name").eq("id", orgId).maybeSingle()
        ),
        q(sb, "organisation_settings", (t) =>
          t
            .select("trading_name, timezone")
            .eq("org_id", orgId)
            .maybeSingle()
        ),
        q(sb, "organisation_work_areas", (t) =>
          t
            .select("work_area_type")
            .eq("org_id", orgId)
            .eq("enabled", true)
            .limit(1)
        ),
        ...billing(sb, orgId),
      ]),
  ]);
}

async function measureCompany(
  sb: SupabaseClient,
  orgId: string
): Promise<GraphResult> {
  return timeGraphCounted("company", [
    () =>
      wave([
        q(sb, "organisation_settings", (t) =>
          t.select("*").eq("org_id", orgId).maybeSingle()
        ),
        q(sb, "organisations", (t) =>
          t.select("name").eq("id", orgId).maybeSingle()
        ),
        q(sb, "organisation_memberships", (t) =>
          t.select("role, status").eq("org_id", orgId).limit(1).maybeSingle()
        ),
      ]),
  ]);
}

async function resolveFixture(
  sb: SupabaseClient
): Promise<{ orgId: string }> {
  const { data, error } = await sb
    .from("organisations")
    .select("id")
    .limit(1)
    .maybeSingle();
  if (error || !data?.id) {
    throw new Error("No Preview organisation fixture.");
  }
  return { orgId: data.id };
}

function printRow(kind: string, row: GraphResult): void {
  console.log(
    [
      kind.padEnd(24),
      `${row.durationMs}ms`.padStart(8),
      `q=${row.queries}`.padStart(6),
      `waves=${row.waves}`.padStart(9),
    ].join("  ")
  );
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
  console.log(`[perf-01f] fixture org=…${fixture.orgId.slice(-6)}`);
  console.log("surface                        ms  queries  waves");

  for (const pass of ["cold", "warm"] as const) {
    const layout = await measureLayout(sb, fixture.orgId);
    const billingBefore = await measureBillingBefore(sb, fixture.orgId);
    const billingAfter = await measureBillingAfter();
    const profileBefore = await measureProfileBefore(sb, fixture.orgId);
    const profileAfter = await measureProfileAfter();
    const company = await measureCompany(sb, fixture.orgId);

    console.log(`-- ${pass} --`);
    printRow("layout", layout);
    printRow("billing-extra-before", billingBefore);
    printRow("billing-extra-after", billingAfter);
    printRow("profile-extra-before", profileBefore);
    printRow("profile-extra-after", profileAfter);
    printRow("company (01D range)", company);
    void timeGraph;
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
