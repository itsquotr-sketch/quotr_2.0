/**
 * PERFORMANCE-01D — primary navigation / page-latency measurement.
 *
 * Replays BEFORE (current 01C-era graphs) and AFTER (01D) read graphs
 * against Preview Supabase. No writes. No secrets/PII. Not Production.
 *
 * Run: npx --yes tsx scripts/measure-performance-01d.ts
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
  duplicateSignatures: string[];
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

function dupes(signatures: string[]): string[] {
  const counts = new Map<string, number>();
  for (const sig of signatures) {
    counts.set(sig, (counts.get(sig) ?? 0) + 1);
  }
  return [...counts.entries()]
    .filter(([, n]) => n > 1)
    .map(([sig, n]) => `${sig}×${n}`);
}

async function timeGraph(
  label: string,
  waves: (() => Promise<string[]>)[]
): Promise<GraphResult> {
  const started = performance.now();
  const signatures: string[] = [];
  for (const wave of waves) {
    signatures.push(...(await wave()));
  }
  return {
    label,
    durationMs: Math.round(performance.now() - started),
    queries: signatures.length,
    waves: waves.length,
    duplicateSignatures: dupes(signatures),
  };
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

async function resolveFixture(sb: SupabaseClient): Promise<{
  orgId: string;
  projectId: string;
}> {
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

  return { orgId: project.org_id, projectId: project.id };
}

function settings(sb: SupabaseClient, orgId: string) {
  return q(sb, "organisation_settings", (t) =>
    t
      .select(
        "id, org_id, trading_name, legal_name, timezone, default_gst_rate, default_margin_percent, onboarding_status, onboarding_step, website, address_line_2, postcode, address_country, nzbn, gst_number, default_quote_validity_days, default_payment_terms, default_quote_terms, default_quote_exclusions, default_quote_assumptions, brand_primary_colour, brand_accent_colour, default_material_wastage_percent"
      )
      .eq("org_id", orgId)
      .maybeSingle()
  );
}

function membership(sb: SupabaseClient, orgId: string) {
  return q(sb, "organisation_memberships", (t) =>
    t.select("role, status").eq("org_id", orgId).limit(1).maybeSingle()
  );
}

function billing(sb: SupabaseClient, orgId: string) {
  return [
    q(sb, "org_billing_customers", (t) =>
      t.select("id").eq("org_id", orgId).limit(1)
    ),
    q(sb, "org_subscriptions", (t) => t.select("id").eq("org_id", orgId).limit(1)),
    q(sb, "org_billing_overrides", (t) =>
      t.select("id").eq("org_id", orgId).limit(1)
    ),
  ];
}

async function measureAuth(
  sb: SupabaseClient,
  orgId: string
): Promise<GraphResult> {
  return timeGraph("auth", [
    () => wave([q(sb, "profiles", (t) => t.select("org_id").limit(1))]),
    () =>
      wave([
        q(sb, "organisations", (t) =>
          t.select("id").eq("id", orgId).maybeSingle()
        ),
      ]),
  ]);
}

async function measureLayout(
  sb: SupabaseClient,
  orgId: string,
  variant: "before" | "after"
): Promise<GraphResult> {
  const chrome = [
    q(sb, "profiles", (t) => t.select("full_name").limit(1)),
    q(sb, "organisations", (t) => t.select("name").eq("id", orgId).maybeSingle()),
    settings(sb, orgId),
    q(sb, "organisation_work_areas", (t) =>
      t.select("work_area_type").eq("org_id", orgId).eq("enabled", true).limit(1)
    ),
    ...billing(sb, orgId),
  ];

  if (variant === "before") {
    return timeGraph("layout", [
      () =>
        wave([
          ...chrome,
          q(sb, "organisation_settings", (t) =>
            t
              .select("onboarding_status, onboarding_step")
              .eq("org_id", orgId)
              .maybeSingle()
          ),
        ]),
    ]);
  }

  return timeGraph("layout", [() => wave(chrome)]);
}

async function measureDashboard(
  sb: SupabaseClient,
  orgId: string,
  variant: "before" | "after"
): Promise<GraphResult> {
  if (variant === "before") {
    return timeGraph("dashboard", [
      () =>
        wave([
          q(sb, "projects", (t) => t.select("archived_at").limit(1)),
          q(sb, "organisations", (t) =>
            t.select("name").eq("id", orgId).maybeSingle()
          ),
          settings(sb, orgId),
          q(sb, "rates", (t) =>
            t.select("id").eq("org_id", orgId).eq("active", true).limit(1)
          ),
          q(sb, "rates", (t) =>
            t.select("id").eq("org_id", orgId).eq("active", true)
          ),
          q(sb, "organisation_work_areas", (t) =>
            t.select("work_area_type").eq("org_id", orgId).eq("enabled", true)
          ),
          q(sb, "productivity_calibration_responses", (t) =>
            t.select("id, calibration_task_key").eq("org_id", orgId).eq("status", "active")
          ),
          q(sb, "projects", (t) => t.select("id", { count: "exact", head: true })),
          q(sb, "projects", (t) =>
            t.select("id, title, created_at").limit(40)
          ),
          q(sb, "estimates", (t) =>
            t
              .select("id, project_id, created_at, updated_at, generated_at")
              .limit(40)
          ),
          q(sb, "quotes", (t) =>
            t.select("id, project_id, created_at").limit(40)
          ),
        ]),
      () =>
        wave([q(sb, "projects", (t) => t.select("business_status").limit(1))]),
      () =>
        wave([q(sb, "projects", (t) => t.select("client_email").limit(1))]),
      () =>
        wave([
          q(sb, "projects", (t) =>
            t
              .select(
                "id, title, brief_text, client_name, site_address, priority, due_date, notes, stage, quality_level, status, created_at, archived_at, deleted_at, business_status, client_email"
              )
              .eq("org_id", orgId)
              .is("deleted_at", null)
          ),
          q(sb, "projects", (t) =>
            t
              .select("business_status, archived_at")
              .eq("org_id", orgId)
              .is("deleted_at", null)
          ),
        ]),
      () =>
        wave([
          q(sb, "estimates", (t) => t.select("project_id, is_stale").limit(80)),
        ]),
      () =>
        wave([
          q(sb, "pricing_documents", (t) =>
            t
              .select("id, status, project_id, created_at, needs_recalibration")
              .eq("org_id", orgId)
              .neq("status", "archived")
          ),
        ]),
      () =>
        wave([
          q(sb, "quotes", (t) =>
            t
              .select(
                "id, status, pricing_document_id, created_at, revision_number, superseded_by_quote_id, project_id"
              )
              .eq("org_id", orgId)
              .neq("status", "archived")
          ),
        ]),
    ]);
  }

  return timeGraph("dashboard", [
    () =>
      wave([
        q(sb, "projects", (t) => t.select("archived_at").limit(1)),
        q(sb, "projects", (t) => t.select("business_status").limit(1)),
        q(sb, "projects", (t) => t.select("client_email").limit(1)),
        q(sb, "rates", (t) =>
          t.select("id, rate_type").eq("org_id", orgId).eq("active", true)
        ),
        q(sb, "organisation_work_areas", (t) =>
          t.select("work_area_type").eq("org_id", orgId).eq("enabled", true)
        ),
        q(sb, "productivity_calibration_responses", (t) =>
          t
            .select("id, calibration_task_key")
            .eq("org_id", orgId)
            .eq("status", "active")
        ),
        q(sb, "estimates", (t) =>
          t
            .select(
              "id, project_id, is_stale, created_at, updated_at, generated_at"
            )
            .eq("org_id", orgId)
        ),
        q(sb, "pricing_documents", (t) =>
          t
            .select("id, status, project_id, created_at, needs_recalibration")
            .eq("org_id", orgId)
            .neq("status", "archived")
        ),
        q(sb, "quotes", (t) =>
          t
            .select(
              "id, status, pricing_document_id, created_at, revision_number, superseded_by_quote_id, project_id, quote_number, sent_at, viewed_at, accepted_at, declined_at"
            )
            .eq("org_id", orgId)
            .neq("status", "archived")
        ),
      ]),
    () =>
      wave([
        q(sb, "projects", (t) =>
          t
            .select(
              "id, title, client_name, site_address, priority, due_date, stage, created_at, archived_at, deleted_at, business_status, client_email"
            )
            .eq("org_id", orgId)
            .is("deleted_at", null)
        ),
      ]),
  ]);
}

async function measureDashboardWarm(
  sb: SupabaseClient,
  orgId: string,
  variant: "before" | "after"
): Promise<GraphResult> {
  if (variant === "before") {
    return timeGraph("dashboard-warm", [
      () =>
        wave([
          q(sb, "organisations", (t) =>
            t.select("name").eq("id", orgId).maybeSingle()
          ),
          settings(sb, orgId),
          q(sb, "rates", (t) =>
            t.select("id").eq("org_id", orgId).eq("active", true).limit(1)
          ),
          q(sb, "rates", (t) =>
            t.select("id").eq("org_id", orgId).eq("active", true)
          ),
          q(sb, "organisation_work_areas", (t) =>
            t.select("work_area_type").eq("org_id", orgId).eq("enabled", true)
          ),
          q(sb, "productivity_calibration_responses", (t) =>
            t
              .select("id, calibration_task_key")
              .eq("org_id", orgId)
              .eq("status", "active")
          ),
          q(sb, "projects", (t) => t.select("id", { count: "exact", head: true })),
          q(sb, "projects", (t) =>
            t.select("id, title, created_at").limit(40)
          ),
          q(sb, "estimates", (t) =>
            t
              .select("id, project_id, created_at, updated_at, generated_at")
              .limit(40)
          ),
          q(sb, "quotes", (t) =>
            t.select("id, project_id, created_at").limit(40)
          ),
        ]),
      () =>
        wave([
          q(sb, "projects", (t) =>
            t
              .select(
                "id, title, brief_text, client_name, site_address, priority, due_date, notes, stage, quality_level, status, created_at, archived_at, deleted_at, business_status, client_email"
              )
              .eq("org_id", orgId)
              .is("deleted_at", null)
          ),
          q(sb, "projects", (t) =>
            t
              .select("business_status, archived_at")
              .eq("org_id", orgId)
              .is("deleted_at", null)
          ),
        ]),
      () =>
        wave([
          q(sb, "estimates", (t) => t.select("project_id, is_stale").limit(80)),
        ]),
      () =>
        wave([
          q(sb, "pricing_documents", (t) =>
            t
              .select("id, status, project_id, created_at, needs_recalibration")
              .eq("org_id", orgId)
              .neq("status", "archived")
          ),
        ]),
      () =>
        wave([
          q(sb, "quotes", (t) =>
            t
              .select(
                "id, status, pricing_document_id, created_at, revision_number, superseded_by_quote_id, project_id"
              )
              .eq("org_id", orgId)
              .neq("status", "archived")
          ),
        ]),
    ]);
  }

  return timeGraph("dashboard-warm", [
    () =>
      wave([
        q(sb, "rates", (t) =>
          t.select("id, rate_type").eq("org_id", orgId).eq("active", true)
        ),
        q(sb, "organisation_work_areas", (t) =>
          t.select("work_area_type").eq("org_id", orgId).eq("enabled", true)
        ),
        q(sb, "productivity_calibration_responses", (t) =>
          t
            .select("id, calibration_task_key")
            .eq("org_id", orgId)
            .eq("status", "active")
        ),
        q(sb, "estimates", (t) =>
          t
            .select(
              "id, project_id, is_stale, created_at, updated_at, generated_at"
            )
            .eq("org_id", orgId)
        ),
        q(sb, "pricing_documents", (t) =>
          t
            .select("id, status, project_id, created_at, needs_recalibration")
            .eq("org_id", orgId)
            .neq("status", "archived")
        ),
        q(sb, "quotes", (t) =>
          t
            .select(
              "id, status, pricing_document_id, created_at, revision_number, superseded_by_quote_id, project_id, quote_number, sent_at, viewed_at, accepted_at, declined_at"
            )
            .eq("org_id", orgId)
            .neq("status", "archived")
        ),
        q(sb, "projects", (t) =>
          t
            .select(
              "id, title, client_name, site_address, priority, due_date, stage, created_at, archived_at, deleted_at, business_status, client_email"
            )
            .eq("org_id", orgId)
            .is("deleted_at", null)
        ),
      ]),
  ]);
}

async function measureRates(
  sb: SupabaseClient,
  orgId: string,
  variant: "before" | "after"
): Promise<GraphResult> {
  if (variant === "before") {
    return timeGraph("rates", [
      () =>
        wave([
          q(sb, "profiles", (t) => t.select("full_name").limit(1)),
          q(sb, "organisation_settings", (t) =>
            t.select("*").eq("org_id", orgId).maybeSingle()
          ),
          settings(sb, orgId),
          q(sb, "organisations", (t) =>
            t.select("name").eq("id", orgId).maybeSingle()
          ),
          q(sb, "organisation_settings", (t) =>
            t
              .select(
                "trading_name, legal_name, default_material_wastage_percent"
              )
              .eq("org_id", orgId)
              .maybeSingle()
          ),
        ]),
      () =>
        wave([
          q(sb, "rates", (t) =>
            t
              .select(
                "id, rate_type, trade, work_area_type, item_key, label, unit, cost_rate, sell_rate, markup_percent, active, source, source_calibration_id, updated_at"
              )
              .eq("org_id", orgId)
          ),
          q(sb, "organisation_work_areas", (t) =>
            t.select("work_area_type").eq("org_id", orgId).eq("enabled", true)
          ),
          membership(sb, orgId),
          q(sb, "profiles", (t) => t.select("org_id, role").limit(1)),
          ...billing(sb, orgId),
          membership(sb, orgId),
          q(sb, "profiles", (t) => t.select("org_id, role").limit(1)),
          ...billing(sb, orgId),
        ]),
    ]);
  }

  return timeGraph("rates", [
    () =>
      wave([
        q(sb, "rates", (t) =>
          t
            .select(
              "id, rate_type, trade, work_area_type, item_key, label, unit, cost_rate, sell_rate, markup_percent, active, source, source_calibration_id, updated_at"
            )
            .eq("org_id", orgId)
        ),
        q(sb, "organisation_work_areas", (t) =>
          t.select("work_area_type").eq("org_id", orgId).eq("enabled", true)
        ),
        membership(sb, orgId),
        q(sb, "profiles", (t) => t.select("org_id, role").limit(1)),
      ]),
  ]);
}

async function measureCompany(
  sb: SupabaseClient,
  orgId: string,
  variant: "before" | "after"
): Promise<GraphResult> {
  if (variant === "before") {
    return timeGraph("company", [
      () =>
        wave([
          q(sb, "profiles", (t) => t.select("full_name").limit(1)),
          q(sb, "organisations", (t) =>
            t.select("name").eq("id", orgId).maybeSingle()
          ),
          q(sb, "organisation_settings", (t) =>
            t
              .select(
                "trading_name, legal_name, contact_email, website, address_line_2, postcode, nzbn, gst_number"
              )
              .eq("org_id", orgId)
              .maybeSingle()
          ),
          settings(sb, orgId),
        ]),
      () =>
        wave([
          membership(sb, orgId),
        ]),
      () =>
        wave([q(sb, "profiles", (t) => t.select("org_id, role").limit(1))]),
    ]);
  }

  return timeGraph("company", [
    () =>
      wave([
        membership(sb, orgId),
        q(sb, "profiles", (t) => t.select("org_id, role").limit(1)),
      ]),
  ]);
}

async function measureCalibration(
  sb: SupabaseClient,
  orgId: string,
  variant: "before" | "after"
): Promise<GraphResult> {
  if (variant === "before") {
    return timeGraph("calibration", [
      () =>
        wave([
          settings(sb, orgId),
          q(sb, "organisation_work_areas", (t) =>
            t
              .select("work_area_type")
              .eq("org_id", orgId)
              .eq("enabled", true)
              .limit(1)
          ),
        ]),
      () =>
        wave([
          q(sb, "profiles", (t) => t.select("full_name").limit(1)),
          q(sb, "organisation_work_areas", (t) =>
            t.select("work_area_type").eq("org_id", orgId).eq("enabled", true)
          ),
          q(sb, "productivity_calibration_responses", (t) =>
            t
              .select(
                "calibration_task_key, derived_productivity, created_at, status, crew_size, duration_hours"
              )
              .eq("org_id", orgId)
              .eq("status", "active")
          ),
          membership(sb, orgId),
          ...billing(sb, orgId),
        ]),
      () =>
        wave([q(sb, "profiles", (t) => t.select("org_id, role").limit(1))]),
    ]);
  }

  return timeGraph("calibration", [
    () =>
      wave([
        q(sb, "organisation_work_areas", (t) =>
          t.select("work_area_type").eq("org_id", orgId).eq("enabled", true)
        ),
        q(sb, "productivity_calibration_responses", (t) =>
          t
            .select(
              "calibration_task_key, derived_productivity, created_at, status, crew_size, duration_hours"
            )
            .eq("org_id", orgId)
            .eq("status", "active")
        ),
        membership(sb, orgId),
        q(sb, "profiles", (t) => t.select("org_id, role").limit(1)),
      ]),
  ]);
}

async function measureSetup(
  sb: SupabaseClient,
  orgId: string,
  variant: "before" | "after"
): Promise<GraphResult> {
  if (variant === "before") {
    return timeGraph("setup", [
      () =>
        wave([
          q(sb, "organisations", (t) =>
            t.select("name").eq("id", orgId).maybeSingle()
          ),
          q(sb, "profiles", (t) => t.select("full_name").limit(1)),
          q(sb, "organisation_settings", (t) =>
            t.select("*").eq("org_id", orgId).maybeSingle()
          ),
          settings(sb, orgId),
        ]),
      () =>
        wave([
          q(sb, "organisation_work_areas", (t) =>
            t
              .select(
                "id, work_area_type, label, category, description, estimate_support, enabled, sort_order"
              )
              .eq("org_id", orgId)
          ),
        ]),
      () =>
        wave([
          q(sb, "rates", (t) =>
            t
              .select(
                "id, rate_type, item_key, label, unit, cost_rate, sell_rate, markup_percent, active"
              )
              .eq("org_id", orgId)
              .eq("active", true)
          ),
          q(sb, "organisation_work_areas", (t) =>
            t.select("work_area_type").eq("org_id", orgId).eq("enabled", true)
          ),
          q(sb, "productivity_calibration_responses", (t) =>
            t
              .select(
                "calibration_task_key, derived_productivity, created_at, status, crew_size, duration_hours"
              )
              .eq("org_id", orgId)
              .eq("status", "active")
          ),
          membership(sb, orgId),
        ]),
    ]);
  }

  return timeGraph("setup", [
    () =>
      wave([
        q(sb, "organisation_work_areas", (t) =>
          t
            .select(
              "id, work_area_type, label, category, description, estimate_support, enabled, sort_order"
            )
            .eq("org_id", orgId)
        ),
        q(sb, "rates", (t) =>
          t
            .select(
              "id, rate_type, item_key, label, unit, cost_rate, sell_rate, markup_percent, active"
            )
            .eq("org_id", orgId)
            .eq("active", true)
        ),
        q(sb, "organisation_work_areas", (t) =>
          t.select("work_area_type").eq("org_id", orgId).eq("enabled", true)
        ),
        q(sb, "productivity_calibration_responses", (t) =>
          t
            .select(
              "calibration_task_key, derived_productivity, created_at, status, crew_size, duration_hours"
            )
            .eq("org_id", orgId)
            .eq("status", "active")
        ),
        membership(sb, orgId),
        q(sb, "profiles", (t) => t.select("org_id, role").limit(1)),
      ]),
  ]);
}

function printRow(phase: string, kind: string, row: GraphResult): void {
  console.log(
    [
      phase.padEnd(6),
      kind.padEnd(22),
      `${row.durationMs}ms`.padStart(8),
      `q=${row.queries}`.padStart(6),
      `waves=${row.waves}`.padStart(9),
      row.duplicateSignatures.join(",") || "-",
    ].join("  ")
  );
}

function pct(before: number, after: number): string {
  if (before <= 0) return after === 0 ? "0%" : "n/a";
  const value = Math.round(((before - after) / before) * 100);
  return `${value}%`;
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
    `[perf-01d] fixture org=…${fixture.orgId.slice(-6)} project=…${fixture.projectId.slice(-6)}`
  );
  console.log("phase   surface                     ms  queries  waves     dups");

  const summary: Record<string, { before: GraphResult; after: GraphResult }> =
    {};

  for (const kind of ["cold", "warm"] as const) {
    const auth = await measureAuth(sb, fixture.orgId);
    const layoutB = await measureLayout(sb, fixture.orgId, "before");
    const layoutA = await measureLayout(sb, fixture.orgId, "after");
    const dashB =
      kind === "cold"
        ? await measureDashboard(sb, fixture.orgId, "before")
        : await measureDashboardWarm(sb, fixture.orgId, "before");
    const dashA =
      kind === "cold"
        ? await measureDashboard(sb, fixture.orgId, "after")
        : await measureDashboardWarm(sb, fixture.orgId, "after");
    const ratesB = await measureRates(sb, fixture.orgId, "before");
    const ratesA = await measureRates(sb, fixture.orgId, "after");
    const companyB = await measureCompany(sb, fixture.orgId, "before");
    const companyA = await measureCompany(sb, fixture.orgId, "after");
    const calB = await measureCalibration(sb, fixture.orgId, "before");
    const calA = await measureCalibration(sb, fixture.orgId, "after");
    const setupB = await measureSetup(sb, fixture.orgId, "before");
    const setupA = await measureSetup(sb, fixture.orgId, "after");

    console.log(`-- ${kind} --`);
    printRow(kind, "auth", auth);
    printRow(kind, "layout-before", layoutB);
    printRow(kind, "layout-after", layoutA);
    printRow(kind, "dashboard-before", dashB);
    printRow(kind, "dashboard-after", dashA);
    printRow(kind, "rates-before", ratesB);
    printRow(kind, "rates-after", ratesA);
    printRow(kind, "company-before", companyB);
    printRow(kind, "company-after", companyA);
    printRow(kind, "calibration-before", calB);
    printRow(kind, "calibration-after", calA);
    printRow(kind, "setup-before", setupB);
    printRow(kind, "setup-after", setupA);

    if (kind === "warm") {
      summary.layout = { before: layoutB, after: layoutA };
      summary.dashboard = { before: dashB, after: dashA };
      summary.rates = { before: ratesB, after: ratesA };
      summary.company = { before: companyB, after: companyA };
      summary.calibration = { before: calB, after: calA };
      summary.setup = { before: setupB, after: setupA };
    }
  }

  console.log("\n[perf-01d] warm improvement (page graphs, layout persisted)");
  for (const [name, row] of Object.entries(summary)) {
    console.log(
      `${name.padEnd(14)} ${row.before.durationMs}ms → ${row.after.durationMs}ms (${pct(row.before.durationMs, row.after.durationMs)})  q ${row.before.queries}→${row.after.queries}  waves ${row.before.waves}→${row.after.waves}`
    );
  }
  console.log(
    "[perf-01d] Project → Dashboard uses dashboard-warm (layout already mounted) plus any layout re-fetch if the segment is dynamic."
  );
}

main().catch((error) => {
  console.error(
    "[perf-01d] measure failed:",
    error instanceof Error ? error.message : error
  );
  process.exit(1);
});
