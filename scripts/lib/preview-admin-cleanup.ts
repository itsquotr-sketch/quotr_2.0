/**
 * Verifier-only Preview cleanup.
 *
 * Product schema does not authorise deletes by organisation name.
 * The Preview SQL login role owns the tables and can disable user triggers
 * inside a transaction. service_role cannot set session_replication_role,
 * and it does not bypass these triggers.
 *
 * Callers must register the organisation UUIDs this process created.
 * Any other UUID is refused before SQL runs.
 */
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  PREVIEW_SUPABASE_PROJECT_REF,
  PRODUCTION_SUPABASE_PROJECT_REF,
} from "./preview-auth-fixture";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const registeredOrgIds = new Set<string>();

const IMMUTABILITY_TRIGGERS = [
  ["public.quote_events", "quote_events_no_delete"],
  ["public.quote_acceptances", "quote_acceptances_no_delete"],
  ["public.quote_declines", "quote_declines_no_delete"],
  ["public.quote_items", "quote_items_protect_snapshot"],
] as const;

export function registerPreviewFixtureOrg(orgId: string): void {
  const id = requireUuid(orgId);
  registeredOrgIds.add(id);
}

export function isRegisteredPreviewFixtureOrg(orgId: string): boolean {
  return registeredOrgIds.has(orgId.toLowerCase());
}

export function assertExplicitCleanupTargets(orgIds: readonly string[]): string[] {
  if (orgIds.length === 0) {
    throw new Error("cleanup refused: no explicit organisation ids");
  }
  return orgIds.map((orgId) => {
    const id = requireUuid(orgId);
    if (!registeredOrgIds.has(id)) {
      throw new Error("cleanup refused: organisation was not created by this verifier");
    }
    return id;
  });
}

export function cleanupPreviewFixtureOrgs(orgIds: readonly string[]): void {
  const ids = assertExplicitCleanupTargets(orgIds);
  const directory = mkdtempSync(join(tmpdir(), "quotr-preview-cleanup-"));
  const file = join(directory, "cleanup.sql");
  try {
    writeFileSync(file, cleanupSql(ids), "utf8");
    runPreviewSqlFile(file);
  } finally {
    enableImmutabilityTriggers();
    rmSync(directory, { recursive: true, force: true });
  }
}

export function queryPreviewRows(selectSql: string): unknown[] {
  const sql = selectSql.trim();
  if (!/^\s*select\b/i.test(sql) || sql.includes(";")) {
    throw new Error("preview admin query must be a single select");
  }
  const directory = mkdtempSync(join(tmpdir(), "quotr-preview-query-"));
  const file = join(directory, "query.sql");
  try {
    writeFileSync(file, sql, "utf8");
    const parsed = JSON.parse(runPreviewSqlFile(file)) as { rows?: unknown[] };
    return parsed.rows ?? [];
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}

function requireUuid(orgId: string): string {
  const id = orgId.trim().toLowerCase();
  if (!UUID_RE.test(id)) {
    throw new Error("cleanup refused: target is not a uuid");
  }
  if (id.includes(PRODUCTION_SUPABASE_PROJECT_REF)) {
    throw new Error("cleanup refused: production target");
  }
  return id;
}

function cleanupSql(orgIds: readonly string[]): string {
  const list = orgIds.map((id) => `'${id}'`).join(", ");
  const array = `array[${list}]::uuid[]`;
  const disable = IMMUTABILITY_TRIGGERS.map(
    ([table, trigger]) => `alter table ${table} disable trigger ${trigger};`
  ).join("\n");
  const enable = IMMUTABILITY_TRIGGERS.map(
    ([table, trigger]) => `alter table ${table} enable trigger ${trigger};`
  ).join("\n");
  return `
begin;
${disable}
delete from public.projects where org_id = any (${array});
delete from public.organisation_memberships where org_id = any (${array});
delete from public.profiles where org_id = any (${array});
delete from public.organisations where id = any (${array});
${enable}
commit;
`;
}

function enableImmutabilityTriggers(): void {
  const directory = mkdtempSync(join(tmpdir(), "quotr-preview-enable-"));
  const file = join(directory, "enable.sql");
  const enable = IMMUTABILITY_TRIGGERS.map(
    ([table, trigger]) => `alter table ${table} enable trigger ${trigger};`
  ).join("\n");
  try {
    writeFileSync(file, `begin;\n${enable}\ncommit;\n`, "utf8");
    runPreviewSqlFile(file);
  } catch (error) {
    console.error("failed to re-enable immutability triggers", error);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}

function runPreviewSqlFile(file: string): string {
  const result = spawnSync(
    "npx",
    [
      "--yes",
      "supabase",
      "db",
      "query",
      "--linked",
      "--project-ref",
      PREVIEW_SUPABASE_PROJECT_REF,
      "--file",
      file,
    ],
    {
      cwd: join(__dirname, "..", ".."),
      encoding: "utf8",
      shell: true,
    }
  );
  const stdout = result.stdout ?? "";
  if (result.status !== 0) {
    throw new Error(
      `${result.error?.message ?? ""}\n${result.stderr ?? ""}\n${stdout}`.trim() ||
        "preview admin sql failed"
    );
  }
  const jsonStart = stdout.indexOf("{");
  const jsonEnd = stdout.lastIndexOf("}");
  return jsonStart >= 0 && jsonEnd > jsonStart ? stdout.slice(jsonStart, jsonEnd + 1) : stdout;
}
