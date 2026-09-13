/**
 * PERFORMANCE-01B — Preview DB query-graph measurement.
 *
 * Replays exact 01A AFTER graphs as 01B BEFORE, then 01B AFTER
 * (request-scoped ownership + raw settings reuse). Also measures
 * Dashboard / Company / Rates / Calibration.
 *
 * No writes. No secrets/PII. Not Production.
 *
 * Run: npx --yes tsx scripts/measure-performance-01b.ts
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
  pricingId: string | null;
  quoteId: string | null;
}> {
  const { data: quote } = await sb
    .from("quotes")
    .select("id, project_id, org_id, pricing_document_id")
    .neq("status", "archived")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (quote?.project_id && quote.org_id) {
    return {
      orgId: quote.org_id,
      projectId: quote.project_id,
      pricingId: quote.pricing_document_id ?? null,
      quoteId: quote.id,
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

  return {
    orgId: project.org_id,
    projectId: project.id,
    pricingId: null,
    quoteId: null,
  };
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

function settings(sb: SupabaseClient, orgId: string) {
  return q(sb, "organisation_settings", (t) =>
    t.select("id, org_id, trading_name").eq("org_id", orgId).maybeSingle()
  );
}

async function measureLayout(
  sb: SupabaseClient,
  orgId: string,
  variant: "before" | "after"
): Promise<GraphResult> {
  const shared = [
    q(sb, "profiles", (t) => t.select("full_name").limit(1)),
    q(sb, "organisations", (t) => t.select("name").eq("id", orgId).maybeSingle()),
    settings(sb, orgId),
    q(sb, "organisation_work_areas", (t) =>
      t.select("work_area_type").eq("org_id", orgId).eq("enabled", true).limit(1)
    ),
    q(sb, "org_billing_customers", (t) =>
      t.select("id").eq("org_id", orgId).limit(1)
    ),
    q(sb, "org_subscriptions", (t) => t.select("id").eq("org_id", orgId).limit(1)),
    q(sb, "org_billing_overrides", (t) =>
      t.select("id").eq("org_id", orgId).limit(1)
    ),
  ];

  if (variant === "before") {
    return timeGraph("layout", [
      () =>
        wave([
          ...shared,
          q(sb, "organisation_settings", (t) =>
            t
              .select("onboarding_status, onboarding_step")
              .eq("org_id", orgId)
              .maybeSingle()
          ),
        ]),
    ]);
  }

  return timeGraph("layout", [() => wave(shared)]);
}

function projectDomain(sb: SupabaseClient, orgId: string, projectId: string) {
  return wave([
    q(sb, "projects", (t) =>
      t.select("id, title").eq("id", projectId).eq("org_id", orgId).maybeSingle()
    ),
    q(sb, "work_areas", (t) => t.select("id").eq("project_id", projectId)),
    q(sb, "question_blocks", (t) => t.select("id").eq("project_id", projectId)),
    q(sb, "questions", (t) => t.select("id").eq("project_id", projectId)),
    q(sb, "constraints", (t) => t.select("id").eq("project_id", projectId)),
    q(sb, "estimates", (t) =>
      t.select("id, is_stale").eq("project_id", projectId).maybeSingle()
    ),
    q(sb, "project_facts", (t) => t.select("key").eq("project_id", projectId)),
    q(sb, "organisation_settings", (t) =>
      t.select("default_margin_percent").eq("org_id", orgId).maybeSingle()
    ),
    q(sb, "project_notes", (t) => t.select("id").eq("project_id", projectId).limit(20)),
    q(sb, "pricing_documents", (t) =>
      t.select("id").eq("project_id", projectId).limit(1)
    ),
    q(sb, "quotes", (t) => t.select("id").eq("project_id", projectId).limit(5)),
  ]);
}

async function measureProjectPage(
  sb: SupabaseClient,
  orgId: string,
  projectId: string,
  variant: "before" | "after"
): Promise<GraphResult> {
  const probes = () =>
    wave([
      q(sb, "projects", (t) => t.select("archived_at").limit(1)),
      q(sb, "projects", (t) => t.select("business_status").limit(1)),
      q(sb, "projects", (t) => t.select("client_email").limit(1)),
    ]);

  if (variant === "before") {
    return timeGraph("project-page", [
      probes,
      () =>
        wave([
          ownership(sb, orgId, projectId),
          ownership(sb, orgId, projectId),
          ownership(sb, orgId, projectId),
          ownership(sb, orgId, projectId),
          ownership(sb, orgId, projectId),
          ownership(sb, orgId, projectId),
        ]),
      () => projectDomain(sb, orgId, projectId),
    ]);
  }

  return timeGraph("project-page", [
    probes,
    () => wave([ownership(sb, orgId, projectId)]),
    () => projectDomain(sb, orgId, projectId),
  ]);
}

async function measureEstimateContext(
  sb: SupabaseClient,
  orgId: string,
  projectId: string
): Promise<GraphResult> {
  return timeGraph("estimate-context", [
    () => wave([ownership(sb, orgId, projectId)]),
    () =>
      wave([
        q(sb, "projects", (t) =>
          t
            .select("id, quality_level")
            .eq("id", projectId)
            .eq("org_id", orgId)
            .maybeSingle()
        ),
      ]),
    () =>
      wave([
        q(sb, "work_areas", (t) =>
          t.select("id, type").eq("project_id", projectId).eq("status", "confirmed")
        ),
        q(sb, "project_facts", (t) =>
          t.select("key, work_area_id, value, source").eq("project_id", projectId)
        ),
        q(sb, "constraints", (t) =>
          t.select("key, label, value").eq("project_id", projectId)
        ),
        settings(sb, orgId),
        q(sb, "rates", (t) => t.select("id").eq("org_id", orgId).eq("active", true)),
      ]),
  ]);
}

async function measurePricing(
  sb: SupabaseClient,
  orgId: string,
  projectId: string,
  pricingId: string | null
): Promise<GraphResult> {
  return timeGraph("pricing", [
    () =>
      wave([
        ownership(sb, orgId, projectId),
        q(sb, "pricing_documents", (t) =>
          pricingId
            ? t.select("id").eq("id", pricingId).maybeSingle()
            : t.select("id").limit(1)
        ),
      ]),
    () =>
      wave([
        q(sb, "projects", (t) =>
          t.select("id, title").eq("id", projectId).eq("org_id", orgId).maybeSingle()
        ),
        q(sb, "pricing_documents", (t) =>
          pricingId
            ? t.select("id").eq("id", pricingId).maybeSingle()
            : t.select("id").eq("project_id", projectId).limit(1)
        ),
        q(sb, "pricing_items", (t) =>
          pricingId
            ? t.select("id").eq("pricing_document_id", pricingId)
            : t.select("id").eq("project_id", projectId).limit(20)
        ),
        q(sb, "work_areas", (t) =>
          t.select("id").eq("project_id", projectId).eq("status", "confirmed")
        ),
        q(sb, "estimates", (t) =>
          t
            .select("recommended_sell, is_stale")
            .eq("project_id", projectId)
            .maybeSingle()
        ),
      ]),
  ]);
}

async function measureQuote(
  sb: SupabaseClient,
  orgId: string,
  projectId: string,
  quoteId: string | null
): Promise<GraphResult> {
  if (!quoteId) {
    return {
      label: "quote",
      durationMs: 0,
      queries: 0,
      waves: 0,
      duplicateSignatures: [],
    };
  }

  return timeGraph("quote", [
    () =>
      wave([
        ownership(sb, orgId, projectId),
        q(sb, "quotes", (t) =>
          t.select("id").eq("id", quoteId).eq("org_id", orgId).maybeSingle()
        ),
        q(sb, "projects", (t) => t.select("client_email").limit(1)),
      ]),
    () =>
      wave([
        q(sb, "projects", (t) =>
          t.select("id, title").eq("id", projectId).eq("org_id", orgId).maybeSingle()
        ),
        q(sb, "quotes", (t) =>
          t.select("id, pricing_document_id").eq("id", quoteId).maybeSingle()
        ),
        q(sb, "quote_items", (t) => t.select("id").eq("quote_id", quoteId)),
        q(sb, "organisations", (t) => t.select("name").eq("id", orgId).maybeSingle()),
        q(sb, "organisation_settings", (t) =>
          t.select("trading_name").eq("org_id", orgId).maybeSingle()
        ),
      ]),
    () =>
      wave([
        q(sb, "pricing_documents", (t) => t.select("updated_at").limit(1)),
        q(sb, "quotes", (t) => t.select("id, status").eq("project_id", projectId)),
        q(sb, "quotes", (t) =>
          t.select("id, revision_number").eq("project_id", projectId)
        ),
        q(sb, "quote_deliveries", (t) => t.select("id").eq("quote_id", quoteId).limit(20)),
        q(sb, "quote_acceptances", (t) =>
          t.select("id").eq("quote_id", quoteId).maybeSingle()
        ),
        q(sb, "quote_declines", (t) =>
          t.select("id").eq("quote_id", quoteId).maybeSingle()
        ),
      ]),
    () =>
      wave([
        q(sb, "quote_events", (t) => t.select("id").eq("quote_id", quoteId).limit(40)),
      ]),
  ]);
}

async function measureDashboard(
  sb: SupabaseClient,
  orgId: string,
  variant: "before" | "after"
): Promise<GraphResult> {
  const pageWithoutSettings = [
    q(sb, "projects", (t) => t.select("archived_at").limit(1)),
    q(sb, "projects", (t) => t.select("id, title").eq("org_id", orgId).limit(40)),
    q(sb, "estimates", (t) => t.select("project_id, is_stale").limit(40)),
    q(sb, "pricing_documents", (t) => t.select("id, project_id").limit(40)),
    q(sb, "quotes", (t) => t.select("id, project_id").limit(40)),
    q(sb, "projects", (t) => t.select("business_status, archived_at").eq("org_id", orgId)),
    q(sb, "organisations", (t) => t.select("name").eq("id", orgId).maybeSingle()),
    q(sb, "rates", (t) => t.select("id").eq("org_id", orgId).eq("active", true).limit(20)),
    q(sb, "organisation_work_areas", (t) =>
      t.select("work_area_type").eq("org_id", orgId).eq("enabled", true)
    ),
    q(sb, "productivity_calibration_responses", (t) =>
      t.select("id").eq("org_id", orgId).eq("status", "active")
    ),
    q(sb, "projects", (t) => t.select("id", { count: "exact", head: true })),
    q(sb, "projects", (t) => t.select("id, title, created_at").limit(40)),
    q(sb, "estimates", (t) => t.select("id, project_id, updated_at").limit(40)),
    q(sb, "quotes", (t) => t.select("id, project_id, created_at").limit(40)),
  ];

  if (variant === "before") {
    return timeGraph("dashboard", [
      () =>
        wave([
          q(sb, "profiles", (t) => t.select("full_name").limit(1)),
          q(sb, "organisations", (t) => t.select("name").eq("id", orgId).maybeSingle()),
          settings(sb, orgId),
          q(sb, "organisation_settings", (t) =>
            t
              .select("onboarding_status, onboarding_step")
              .eq("org_id", orgId)
              .maybeSingle()
          ),
          q(sb, "organisation_work_areas", (t) =>
            t.select("work_area_type").eq("org_id", orgId).eq("enabled", true).limit(1)
          ),
          q(sb, "org_billing_customers", (t) =>
            t.select("id").eq("org_id", orgId).limit(1)
          ),
          q(sb, "org_subscriptions", (t) =>
            t.select("id").eq("org_id", orgId).limit(1)
          ),
          q(sb, "org_billing_overrides", (t) =>
            t.select("id").eq("org_id", orgId).limit(1)
          ),
        ]),
      () => wave([...pageWithoutSettings, settings(sb, orgId)]),
    ]);
  }

  return timeGraph("dashboard", [
    () =>
      wave([
        q(sb, "profiles", (t) => t.select("full_name").limit(1)),
        q(sb, "organisations", (t) => t.select("name").eq("id", orgId).maybeSingle()),
        settings(sb, orgId),
        q(sb, "organisation_work_areas", (t) =>
          t.select("work_area_type").eq("org_id", orgId).eq("enabled", true).limit(1)
        ),
        q(sb, "org_billing_customers", (t) =>
          t.select("id").eq("org_id", orgId).limit(1)
        ),
        q(sb, "org_subscriptions", (t) => t.select("id").eq("org_id", orgId).limit(1)),
        q(sb, "org_billing_overrides", (t) =>
          t.select("id").eq("org_id", orgId).limit(1)
        ),
        ...pageWithoutSettings,
      ]),
  ]);
}

async function measureCompany(
  sb: SupabaseClient,
  orgId: string,
  variant: "before" | "after"
): Promise<GraphResult> {
  const page = [
    q(sb, "profiles", (t) => t.select("full_name").limit(1)),
    q(sb, "organisations", (t) => t.select("name").eq("id", orgId).maybeSingle()),
    q(sb, "organisation_settings", (t) =>
      t.select("trading_name, legal_name").eq("org_id", orgId).maybeSingle()
    ),
  ];

  if (variant === "before") {
    return timeGraph("company", [
      () =>
        wave([
          settings(sb, orgId),
          q(sb, "organisation_settings", (t) =>
            t
              .select("onboarding_status, onboarding_step")
              .eq("org_id", orgId)
              .maybeSingle()
          ),
        ]),
      () => wave(page),
    ]);
  }

  return timeGraph("company", [
    () => wave([settings(sb, orgId), ...page]),
  ]);
}

async function measureRates(
  sb: SupabaseClient,
  orgId: string,
  variant: "before" | "after"
): Promise<GraphResult> {
  const page = [
    q(sb, "organisation_settings", (t) =>
      t.select("*").eq("org_id", orgId).maybeSingle()
    ),
    q(sb, "rates", (t) => t.select("id, label").eq("org_id", orgId)),
    q(sb, "organisation_work_areas", (t) =>
      t.select("work_area_type").eq("org_id", orgId).eq("enabled", true)
    ),
    q(sb, "organisations", (t) => t.select("name").eq("id", orgId).maybeSingle()),
    q(sb, "organisation_settings", (t) =>
      t.select("trading_name").eq("org_id", orgId).maybeSingle()
    ),
  ];

  if (variant === "before") {
    return timeGraph("rates", [
      () =>
        wave([
          settings(sb, orgId),
          q(sb, "organisation_settings", (t) =>
            t
              .select("onboarding_status, onboarding_step")
              .eq("org_id", orgId)
              .maybeSingle()
          ),
        ]),
      () => wave(page),
    ]);
  }

  return timeGraph("rates", [() => wave([settings(sb, orgId), ...page])]);
}

async function measureCalibration(
  sb: SupabaseClient,
  orgId: string,
  variant: "before" | "after"
): Promise<GraphResult> {
  const page = [
    q(sb, "profiles", (t) => t.select("full_name").limit(1)),
    q(sb, "productivity_calibration_responses", (t) =>
      t.select("id").eq("org_id", orgId).eq("status", "active").limit(1)
    ),
  ];

  if (variant === "before") {
    return timeGraph("calibration", [
      () =>
        wave([
          settings(sb, orgId),
          q(sb, "organisation_settings", (t) =>
            t
              .select("onboarding_status, onboarding_step")
              .eq("org_id", orgId)
              .maybeSingle()
          ),
          q(sb, "organisation_work_areas", (t) =>
            t.select("work_area_type").eq("org_id", orgId).eq("enabled", true).limit(1)
          ),
        ]),
      () => wave(page),
    ]);
  }

  return timeGraph("calibration", [
    () =>
      wave([
        settings(sb, orgId),
        q(sb, "organisation_work_areas", (t) =>
          t.select("work_area_type").eq("org_id", orgId).eq("enabled", true).limit(1)
        ),
        ...page,
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
    `[perf-01b] fixture org=…${fixture.orgId.slice(-6)} project=…${fixture.projectId.slice(-6)} quote=${fixture.quoteId ? "yes" : "no"} pricing=${fixture.pricingId ? "yes" : "no"}`
  );
  console.log("phase   surface                 ms      queries  waves     dups");

  for (const kind of ["cold", "warm"] as const) {
    const layoutB = await measureLayout(sb, fixture.orgId, "before");
    const layoutA = await measureLayout(sb, fixture.orgId, "after");
    const projectB = await measureProjectPage(
      sb,
      fixture.orgId,
      fixture.projectId,
      "before"
    );
    const projectA = await measureProjectPage(
      sb,
      fixture.orgId,
      fixture.projectId,
      "after"
    );
    const estimate = await measureEstimateContext(
      sb,
      fixture.orgId,
      fixture.projectId
    );
    const pricing = await measurePricing(
      sb,
      fixture.orgId,
      fixture.projectId,
      fixture.pricingId
    );
    const quote = await measureQuote(
      sb,
      fixture.orgId,
      fixture.projectId,
      fixture.quoteId
    );
    const dashB = await measureDashboard(sb, fixture.orgId, "before");
    const dashA = await measureDashboard(sb, fixture.orgId, "after");
    const companyB = await measureCompany(sb, fixture.orgId, "before");
    const companyA = await measureCompany(sb, fixture.orgId, "after");
    const ratesB = await measureRates(sb, fixture.orgId, "before");
    const ratesA = await measureRates(sb, fixture.orgId, "after");
    const calB = await measureCalibration(sb, fixture.orgId, "before");
    const calA = await measureCalibration(sb, fixture.orgId, "after");

    console.log(`-- ${kind} --`);
    printRow(kind, "layout-before", layoutB);
    printRow(kind, "layout-after", layoutA);
    printRow(kind, "project-before", projectB);
    printRow(kind, "project-after", projectA);
    printRow(kind, "estimate-context", estimate);
    printRow(kind, "pricing", pricing);
    printRow(kind, "quote", quote);
    printRow(kind, "dashboard-before", dashB);
    printRow(kind, "dashboard-after", dashA);
    printRow(kind, "company-before", companyB);
    printRow(kind, "company-after", companyA);
    printRow(kind, "rates-before", ratesB);
    printRow(kind, "rates-after", ratesA);
    printRow(kind, "calibration-before", calB);
    printRow(kind, "calibration-after", calA);
  }

  console.log(
    "[perf-01b] isolated pricing/quote/estimate-context graphs unchanged vs 01A-after (already 1 ownership + 1 settings). Project RSC ForRead 6→1. Layout settings 2→1. Create-if-missing company/rates SELECTs are not folded into the raw reader."
  );
}

main().catch((error) => {
  console.error("[perf-01b] measure failed:", error instanceof Error ? error.message : error);
  process.exit(1);
});
