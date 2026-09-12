/**
 * PERFORMANCE-01A — Preview DB query-graph measurement.
 *
 * Replays BEFORE (pre-01A) and AFTER (01A) read graphs against Preview
 * Supabase. No writes. No secrets/PII in output. Not Production.
 *
 * Run: npx --yes tsx scripts/measure-performance-01a.ts
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

async function measureLayout(
  sb: SupabaseClient,
  orgId: string,
  variant: "before" | "after"
): Promise<GraphResult> {
  if (variant === "before") {
    return timeGraph("layout", [
      () => wave([q(sb, "profiles", (t) => t.select("full_name").limit(1))]),
      () =>
        wave([
          q(sb, "organisations", (t) => t.select("name").eq("id", orgId).maybeSingle()),
          q(sb, "organisation_settings", (t) =>
            t.select("trading_name, timezone").eq("org_id", orgId).maybeSingle()
          ),
        ]),
      () =>
        wave([
          q(sb, "organisation_settings", (t) =>
            t.select("onboarding_status, onboarding_step").eq("org_id", orgId).maybeSingle()
          ),
          q(sb, "organisation_work_areas", (t) =>
            t.select("work_area_type").eq("org_id", orgId).eq("enabled", true).limit(1)
          ),
        ]),
      () =>
        wave([
          q(sb, "org_billing_customers", (t) =>
            t.select("id").eq("org_id", orgId).limit(1)
          ),
          q(sb, "org_subscriptions", (t) => t.select("id").eq("org_id", orgId).limit(1)),
          q(sb, "org_billing_overrides", (t) =>
            t.select("id").eq("org_id", orgId).limit(1)
          ),
        ]),
    ]);
  }

  return timeGraph("layout", [
    () =>
      wave([
        q(sb, "profiles", (t) => t.select("full_name").limit(1)),
        q(sb, "organisations", (t) => t.select("name").eq("id", orgId).maybeSingle()),
        q(sb, "organisation_settings", (t) =>
          t.select("trading_name, timezone").eq("org_id", orgId).maybeSingle()
        ),
        q(sb, "organisation_settings", (t) =>
          t.select("onboarding_status, onboarding_step").eq("org_id", orgId).maybeSingle()
        ),
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
      ]),
  ]);
}

async function measureProjectPage(
  sb: SupabaseClient,
  orgId: string,
  projectId: string,
  variant: "before" | "after"
): Promise<GraphResult> {
  const domain = () =>
    wave([
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

  if (variant === "before") {
    return timeGraph("project-page", [
      () =>
        wave([
          q(sb, "projects", (t) =>
            t.select("archived_at").limit(1)
          ),
        ]),
      () => wave([q(sb, "projects", (t) => t.select("business_status").limit(1))]),
      () => wave([q(sb, "projects", (t) => t.select("client_email").limit(1))]),
      domain,
      () =>
        wave([
          q(sb, "estimates", (t) =>
            t.select("is_stale").eq("project_id", projectId).maybeSingle()
          ),
        ]),
    ]);
  }

  return timeGraph("project-page", [
    () =>
      wave([
        q(sb, "projects", (t) => t.select("archived_at").limit(1)),
        q(sb, "projects", (t) => t.select("business_status").limit(1)),
        q(sb, "projects", (t) => t.select("client_email").limit(1)),
      ]),
    domain,
  ]);
}

async function measureEstimateContext(
  sb: SupabaseClient,
  orgId: string,
  projectId: string,
  variant: "before" | "after"
): Promise<GraphResult> {
  const domain = () =>
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
      q(sb, "organisation_settings", (t) =>
        t.select("default_margin_percent").eq("org_id", orgId).maybeSingle()
      ),
      q(sb, "rates", (t) => t.select("id").eq("org_id", orgId).eq("active", true)),
    ]);

  if (variant === "before") {
    return timeGraph("estimate-context", [
      () =>
        wave([
          q(sb, "projects", (t) =>
            t.select("id").eq("id", projectId).eq("org_id", orgId).maybeSingle()
          ),
        ]),
      () => wave([q(sb, "projects", (t) => t.select("archived_at").limit(1))]),
      () =>
        wave([
          q(sb, "projects", (t) =>
            t.select("id, quality_level").eq("id", projectId).eq("org_id", orgId).maybeSingle()
          ),
        ]),
      () =>
        wave([
          q(sb, "projects", (t) =>
            t.select("deleted_at").eq("id", projectId).eq("org_id", orgId).maybeSingle()
          ),
        ]),
      domain,
    ]);
  }

  return timeGraph("estimate-context", [
    () =>
      wave([
        q(sb, "projects", (t) =>
          t.select("id").eq("id", projectId).eq("org_id", orgId).maybeSingle()
        ),
      ]),
    () =>
      wave([
        q(sb, "projects", (t) =>
          t.select("id, quality_level").eq("id", projectId).eq("org_id", orgId).maybeSingle()
        ),
      ]),
    domain,
  ]);
}

async function measurePricing(
  sb: SupabaseClient,
  orgId: string,
  projectId: string,
  pricingId: string | null,
  variant: "before" | "after"
): Promise<GraphResult> {
  const domain = () =>
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
        t.select("recommended_sell, is_stale").eq("project_id", projectId).maybeSingle()
      ),
    ]);

  if (variant === "before") {
    return timeGraph("pricing", [
      () =>
        wave([
          q(sb, "projects", (t) =>
            t.select("id").eq("id", projectId).eq("org_id", orgId).maybeSingle()
          ),
        ]),
      () =>
        wave([
          q(sb, "pricing_documents", (t) =>
            pricingId
              ? t.select("id").eq("id", pricingId).maybeSingle()
              : t.select("id").limit(1)
          ),
        ]),
      domain,
    ]);
  }

  return timeGraph("pricing", [
    () =>
      wave([
        q(sb, "projects", (t) =>
          t.select("id").eq("id", projectId).eq("org_id", orgId).maybeSingle()
        ),
        q(sb, "pricing_documents", (t) =>
          pricingId
            ? t.select("id").eq("id", pricingId).maybeSingle()
            : t.select("id").limit(1)
        ),
      ]),
    domain,
  ]);
}

async function measureQuote(
  sb: SupabaseClient,
  orgId: string,
  projectId: string,
  quoteId: string | null,
  variant: "before" | "after"
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

  const first = () =>
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
    ]);

  const independent = () =>
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
    ]);

  const events = () =>
    wave([
      q(sb, "quote_events", (t) => t.select("id").eq("quote_id", quoteId).limit(40)),
    ]);

  if (variant === "before") {
    return timeGraph("quote", [
      () =>
        wave([
          q(sb, "projects", (t) =>
            t.select("id").eq("id", projectId).eq("org_id", orgId).maybeSingle()
          ),
        ]),
      () =>
        wave([
          q(sb, "quotes", (t) =>
            t.select("id").eq("id", quoteId).eq("org_id", orgId).maybeSingle()
          ),
        ]),
      () => wave([q(sb, "projects", (t) => t.select("client_email").limit(1))]),
      () =>
        wave([
          q(sb, "organisation_settings", (t) =>
            t.select("id").eq("org_id", orgId).maybeSingle()
          ),
        ]),
      first,
      () =>
        wave([
          q(sb, "pricing_documents", (t) => t.select("updated_at").limit(1)),
        ]),
      () =>
        wave([
          q(sb, "quotes", (t) => t.select("id, status").eq("project_id", projectId)),
        ]),
      () =>
        wave([
          q(sb, "quotes", (t) =>
            t.select("id, revision_number").eq("project_id", projectId)
          ),
        ]),
      events,
      () =>
        wave([
          q(sb, "quote_deliveries", (t) =>
            t.select("id").eq("quote_id", quoteId).limit(20)
          ),
        ]),
      () =>
        wave([
          q(sb, "quote_acceptances", (t) =>
            t.select("id").eq("quote_id", quoteId).maybeSingle()
          ),
          q(sb, "quote_declines", (t) =>
            t.select("id").eq("quote_id", quoteId).maybeSingle()
          ),
        ]),
    ]);
  }

  return timeGraph("quote", [
    () =>
      wave([
        q(sb, "projects", (t) =>
          t.select("id").eq("id", projectId).eq("org_id", orgId).maybeSingle()
        ),
        q(sb, "quotes", (t) =>
          t.select("id").eq("id", quoteId).eq("org_id", orgId).maybeSingle()
        ),
        q(sb, "projects", (t) => t.select("client_email").limit(1)),
      ]),
    first,
    independent,
    events,
  ]);
}

function printRow(phase: string, kind: string, row: GraphResult): void {
  console.log(
    [
      phase.padEnd(6),
      kind.padEnd(18),
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
    `[perf-01a] fixture org=…${fixture.orgId.slice(-6)} project=…${fixture.projectId.slice(-6)} quote=${fixture.quoteId ? "yes" : "no"} pricing=${fixture.pricingId ? "yes" : "no"}`
  );
  console.log("phase   surface             ms      queries  waves     dups");

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
    const estimateB = await measureEstimateContext(
      sb,
      fixture.orgId,
      fixture.projectId,
      "before"
    );
    const estimateA = await measureEstimateContext(
      sb,
      fixture.orgId,
      fixture.projectId,
      "after"
    );
    const pricingB = await measurePricing(
      sb,
      fixture.orgId,
      fixture.projectId,
      fixture.pricingId,
      "before"
    );
    const pricingA = await measurePricing(
      sb,
      fixture.orgId,
      fixture.projectId,
      fixture.pricingId,
      "after"
    );
    const quoteB = await measureQuote(
      sb,
      fixture.orgId,
      fixture.projectId,
      fixture.quoteId,
      "before"
    );
    const quoteA = await measureQuote(
      sb,
      fixture.orgId,
      fixture.projectId,
      fixture.quoteId,
      "after"
    );

    console.log(`-- ${kind} --`);
    printRow(kind, "layout-before", layoutB);
    printRow(kind, "layout-after", layoutA);
    printRow(kind, "project-before", projectB);
    printRow(kind, "project-after", projectA);
    printRow(kind, "estimate-before", estimateB);
    printRow(kind, "estimate-after", estimateA);
    printRow(kind, "pricing-before", pricingB);
    printRow(kind, "pricing-after", pricingA);
    printRow(kind, "quote-before", quoteB);
    printRow(kind, "quote-after", quoteA);
  }

  console.log(
    "[perf-01a] details/refine open: extra-server-queries=0 (client compose of SSR assistant state)"
  );
}

main().catch((error) => {
  console.error("[perf-01a] measure failed:", error instanceof Error ? error.message : error);
  process.exit(1);
});
