/**
 * RLS coverage audit — verifies all application tables have RLS enabled.
 *
 * Run: npx tsx scripts/verify-rls-coverage.ts
 *
 * Live catalogue checks use local Docker Postgres only (never remote .env URLs).
 */
import { config } from "dotenv";
import { readFileSync, readdirSync } from "fs";
import { join } from "path";

config({ path: ".env.local" });

function isLocalSupabaseUrl(url: string): boolean {
  try {
    const host = new URL(url).hostname;
    return host === "localhost" || host === "127.0.0.1" || host === "::1";
  } catch {
    return false;
  }
}

const envUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
if (envUrl && !isLocalSupabaseUrl(envUrl)) {
  console.log(
    "NOTE: NEXT_PUBLIC_SUPABASE_URL is non-local; live checks use Docker only and never open that URL."
  );
}

const EXPECTED_APP_TABLES = [
  "organisations",
  "profiles",
  "projects",
  "work_areas",
  "project_facts",
  "question_blocks",
  "questions",
  "constraints",
  "estimates",
  "estimate_line_items",
  "rates",
  "organisation_settings",
  "organisation_work_areas",
  "project_notes",
  "note_proposals",
  "pricing_documents",
  "pricing_items",
  "quotes",
  "quote_items",
  "pricing_audit_log",
  "scope_discovery_runs",
  "scope_discovery_suggestions",
  "scope_discovery_decisions",
] as const;

const TABLES_WITHOUT_RLS_OK: string[] = [];

/** Tables where not all CRUD policies apply to authenticated users (by design). */
const POLICY_EXCEPTIONS: Record<
  string,
  Partial<Record<"select" | "insert" | "update" | "delete", boolean>>
> = {
  organisations: { insert: true, delete: true },
  profiles: { insert: true, delete: true },
  pricing_audit_log: { update: true, delete: true },
  // Discovery: no authenticated DELETE; decisions are append-only (no UPDATE/DELETE policies).
  scope_discovery_runs: { delete: true },
  scope_discovery_suggestions: { delete: true },
  scope_discovery_decisions: { update: true, delete: true },
};

function auditMigrations(): {
  tablesFound: Set<string>;
  rlsEnabled: Set<string>;
  policies: Map<string, string[]>;
} {
  const migrationsDir = join(process.cwd(), "supabase", "migrations");
  const files = readdirSync(migrationsDir).filter((file) => file.endsWith(".sql"));
  const sql = files.map((file) => readFileSync(join(migrationsDir, file), "utf8")).join("\n");

  const tablesFound = new Set<string>();
  const rlsEnabled = new Set<string>();
  const policies = new Map<string, string[]>();

  for (const match of sql.matchAll(/create table (?:if not exists )?public\.(\w+)/gi)) {
    tablesFound.add(match[1]!);
  }

  for (const match of sql.matchAll(
    /alter table (?:if exists )?public\.(\w+) enable row level security/gi
  )) {
    rlsEnabled.add(match[1]!);
  }

  for (const match of sql.matchAll(
    /create policy "([^"]+)"\s+on public\.(\w+)/gi
  )) {
    const table = match[2]!;
    const list = policies.get(table) ?? [];
    list.push(match[1]!);
    policies.set(table, list);
  }

  return { tablesFound, rlsEnabled, policies };
}

function assert(label: string, ok: boolean) {
  console.log(ok ? "PASS" : "FAIL", label);
  if (!ok) process.exitCode = 1;
}

async function auditLiveDatabase(): Promise<void> {
  console.log("\n=== Live catalogue checks (local Docker) ===\n");

  try {
    const { execFileSync } = await import("node:child_process");
    const { resolveLocalDbContainer } = await import("./local-db-container");
    const container = resolveLocalDbContainer();
    const query = `
      SELECT string_agg(tablename, ',' ORDER BY tablename)
      FROM (
        WITH expected(tablename) AS (
          VALUES
            ('organisations'),('profiles'),('projects'),('work_areas'),
            ('project_facts'),('question_blocks'),('questions'),('constraints'),
            ('estimates'),('estimate_line_items'),('rates'),('organisation_settings'),
            ('organisation_work_areas'),('project_notes'),('note_proposals'),
            ('pricing_documents'),('pricing_items'),('quotes'),('quote_items'),
            ('pricing_audit_log'),
            ('scope_discovery_runs'),('scope_discovery_suggestions'),
            ('scope_discovery_decisions')
        )
        SELECT e.tablename
        FROM expected e
        LEFT JOIN pg_class c ON c.relname = e.tablename AND c.relkind = 'r'
        LEFT JOIN pg_namespace n ON n.oid = c.relnamespace AND n.nspname = 'public'
        WHERE COALESCE(c.relrowsecurity, false) = false
      ) missing;
    `;
    const missing = execFileSync(
      "docker",
      ["exec", "-i", container, "psql", "-U", "postgres", "-t", "-A", "-c", query],
      { encoding: "utf8" }
    ).trim();

    assert(
      "Live: no expected org tables missing RLS (incl. pricing_audit_log)",
      missing.length === 0
    );

    const triggerGaps = execFileSync(
      "docker",
      [
        "exec",
        "-i",
        container,
        "psql",
        "-U",
        "postgres",
        "-t",
        "-A",
        "-c",
        `
        WITH expected(tablename, trigger_name) AS (
          VALUES
            ('pricing_items', 'pricing_items_org_match'),
            ('quote_items', 'quote_items_org_match'),
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
        );
        `,
      ],
      { encoding: "utf8" }
    ).trim();

    assert(
      "Live: expected parent-child org-match triggers present",
      triggerGaps === "0"
    );
  } catch (error) {
    console.log(
      "Live Docker catalogue check skipped:",
      error instanceof Error ? error.message : String(error)
    );
    console.log(
      "Run supabase/sql/verify_rls_coverage.sql against local Postgres for live checks."
    );
  }
}

async function main() {
  console.log("=== RLS coverage audit (migrations) ===\n");

  const { tablesFound, rlsEnabled, policies } = auditMigrations();

  for (const table of EXPECTED_APP_TABLES) {
    assert(`Table exists in migrations: ${table}`, tablesFound.has(table));
    assert(`RLS enabled: ${table}`, rlsEnabled.has(table));

    const tablePolicies = policies.get(table) ?? [];
    const hasSelect = tablePolicies.some((name) => name.toLowerCase().includes("select"));
    const hasInsert = tablePolicies.some((name) => name.toLowerCase().includes("insert"));
    const hasUpdate = tablePolicies.some((name) => name.toLowerCase().includes("update"));
    const hasDelete = tablePolicies.some((name) => name.toLowerCase().includes("delete"));

    const exceptions = POLICY_EXCEPTIONS[table] ?? {};

    assert(
      `${table}: has SELECT policy`,
      hasSelect || exceptions.select === true
    );
    assert(
      `${table}: has INSERT policy`,
      hasInsert || exceptions.insert === true
    );
    assert(
      `${table}: has UPDATE policy`,
      hasUpdate || exceptions.update === true
    );
    assert(
      `${table}: has DELETE policy`,
      hasDelete || exceptions.delete === true
    );
  }

  const undocumentedWithoutRls = [...tablesFound].filter(
    (table) =>
      !rlsEnabled.has(table) && !TABLES_WITHOUT_RLS_OK.includes(table) && !table.startsWith("pg_")
  );

  if (undocumentedWithoutRls.length > 0) {
    console.log("\nTables in migrations without RLS:");
    for (const table of undocumentedWithoutRls) {
      console.log(`  - ${table}`);
    }
    process.exitCode = 1;
  } else {
    console.log("\nPASS: No undocumented tables without RLS.");
  }

  await auditLiveDatabase();

  if (!process.exitCode) {
    console.log("\nRLS coverage audit passed.");
  } else {
    console.log("\nRLS coverage audit failed.");
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
