/**
 * Preview-only report for disposable "Schedule price QA" fixtures.
 *
 * This does not delete anything. Submitted RFQ responses are frozen
 * (RFQ_RESPONSE_FROZEN), quote events are append-only, and an active
 * supplier-priced line cannot be deleted (SUPPLIER_PRICE_LOCKED). Those
 * rules are the product immutability contract. Migration 062 removed an
 * earlier Preview cleanup that skipped them, and this script does not
 * put that bypass back.
 *
 * Safe retention:
 * - Name every disposable organisation "Schedule price QA " plus a suffix.
 * - Delete only rows the product already allows, such as draft scope
 *   resolutions and schedule applications, before trying to remove the org.
 * - Leave the organisation when a frozen response, quote event, or locked
 *   pricing item remains. Record the id here so Preview cleanup can see it.
 * - Do not disable triggers, and do not run this against Production.
 *
 * Usage: npx tsx scripts/preview-fixture-retention.ts
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createClient } from "@supabase/supabase-js";
import {
  PREVIEW_SUPABASE_PROJECT_REF,
  PRODUCTION_SUPABASE_PROJECT_REF,
} from "../lib/deployment/environment";

function readEnv(path: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const index = trimmed.indexOf("=");
    if (index < 0) continue;
    out[trimmed.slice(0, index)] = trimmed.slice(index + 1).replace(/^"|"$/g, "");
  }
  return out;
}

async function main() {
  const local = readEnv(join(process.cwd(), ".env.local"));
  const url = local.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const service = local.SUPABASE_SERVICE_ROLE_KEY ?? "";
  const ref = new URL(url).hostname.split(".")[0] ?? "";
  if (ref !== PREVIEW_SUPABASE_PROJECT_REF || ref === PRODUCTION_SUPABASE_PROJECT_REF) {
    throw new Error("Refusing non-Preview Supabase URL");
  }
  const admin = createClient(url, service, { auth: { persistSession: false, autoRefreshToken: false } });
  const orgs = await admin.from("organisations").select("id, name").like("name", "Schedule price QA %");
  if (orgs.error) throw new Error(orgs.error.message);
  console.log("FIXTURE_ORGS", orgs.data?.length ?? 0);
  for (const org of orgs.data ?? []) {
    const [responses, events, locked] = await Promise.all([
      admin.from("rfq_responses").select("id", { count: "exact", head: true }).eq("org_id", org.id).eq("status", "submitted"),
      admin.from("quote_events").select("id", { count: "exact", head: true }).eq("org_id", org.id),
      admin.from("rfq_schedule_pricing_applications").select("id", { count: "exact", head: true }).eq("org_id", org.id).is("superseded_at", null),
    ]);
    const blockers = [
      (responses.count ?? 0) > 0 ? `submitted_responses:${responses.count}` : "",
      (events.count ?? 0) > 0 ? `quote_events:${events.count}` : "",
      (locked.count ?? 0) > 0 ? `active_schedule_applications:${locked.count}` : "",
    ].filter(Boolean);
    console.log(JSON.stringify({ id: org.id, name: org.name, blockers: blockers.length > 0 ? blockers : ["none_recorded"] }));
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "report failed");
  process.exitCode = 1;
});
