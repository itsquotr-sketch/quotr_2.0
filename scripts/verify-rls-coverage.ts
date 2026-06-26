/**
 * RLS coverage audit — verifies all application tables have RLS enabled.
 *
 * Run: npx tsx scripts/verify-rls-coverage.ts
 *
 * With SUPABASE_SERVICE_ROLE_KEY in .env.local, also queries live database.
 */
import { config } from "dotenv";
import { readFileSync, readdirSync } from "fs";
import { join } from "path";

config({ path: ".env.local" });

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
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    console.log("\nLive DB audit skipped (set SUPABASE_SERVICE_ROLE_KEY to query database).");
    return;
  }

  const { createClient } = await import("@supabase/supabase-js");
  const admin = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data, error } = await admin.rpc("verify_rls_status" as never);

  if (error) {
    // Fallback: query pg_tables via REST is not available; migration audit is authoritative.
    console.log("\nLive DB RPC not available — migration audit used as source of truth.");
    console.log("Run supabase/sql/verify_rls_coverage.sql in SQL editor for live check.");
    return;
  }

  console.log("\nLive database RLS status:", data);
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
