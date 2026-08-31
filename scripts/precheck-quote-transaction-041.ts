/**
 * Read-only shared-DB precheck for 041_quote_transaction.sql.
 * Prints COUNTS only. Does not mutate.
 *
 * Run: npx tsx scripts/precheck-quote-transaction-041.ts
 */
import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";

config({ path: ".env.local" });

const PROJECT_REF = "lxvnylhsbvudzzupxeqr";
const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

function assertSharedDb() {
  if (!url.includes(PROJECT_REF)) {
    throw new Error("Refusing to run: NEXT_PUBLIC_SUPABASE_URL is not the shared quotr_2.0 project.");
  }
  if (!serviceKey) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY missing.");
  }
}

async function main() {
  assertSharedDb();
  const admin = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const quotes = admin.from("quotes");

  const { count: totalQuotes, error: totalErr } = await quotes.select("id", {
    count: "exact",
    head: true,
  });
  if (totalErr) throw totalErr;

  const { count: revisedCount, error: revisedErr } = await quotes
    .select("id", { count: "exact", head: true })
    .eq("status", "revised");
  if (revisedErr) throw revisedErr;

  const statuses = [
    "draft",
    "sent",
    "viewed",
    "accepted",
    "declined",
    "expired",
    "revised",
    "superseded",
    "archived",
  ];
  const statusCounts: Record<string, number> = {};
  for (const status of statuses) {
    const { count, error } = await quotes
      .select("id", { count: "exact", head: true })
      .eq("status", status);
    if (error) throw error;
    statusCounts[status] = count ?? 0;
  }

  const { data: numberedRows, error: numberErr } = await quotes
    .select("org_id, quote_number, revision_number")
    .not("quote_number", "is", null);
  if (numberErr) throw numberErr;

  const dupMap = new Map<string, number>();
  let canonicalQ = 0;
  let nonCanonical = 0;
  for (const row of numberedRows ?? []) {
    const number = String(row.quote_number ?? "");
    if (/^Q-\d+$/i.test(number)) canonicalQ += 1;
    else nonCanonical += 1;
    const key = `${row.org_id}|${number}|${row.revision_number ?? 1}`;
    dupMap.set(key, (dupMap.get(key) ?? 0) + 1);
  }
  const duplicateGroups = [...dupMap.values()].filter((n) => n > 1).length;
  const duplicateRows = [...dupMap.values()]
    .filter((n) => n > 1)
    .reduce((sum, n) => sum + n, 0);

  const accounted = Object.values(statusCounts).reduce((a, b) => a + b, 0);
  const unknownStatusCount = (totalQuotes ?? 0) - accounted;

  const result = {
    project: PROJECT_REF,
    totalQuotes: totalQuotes ?? 0,
    duplicateNumberRevisionGroups: duplicateGroups,
    duplicateNumberRevisionRows: duplicateRows,
    revisedCount: revisedCount ?? 0,
    statusCounts,
    unknownStatusCount,
    numberedQuotes: numberedRows?.length ?? 0,
    canonicalQNNNN: canonicalQ,
    nonCanonicalNumbers: nonCanonical,
    uniqueIndexGate: duplicateGroups === 0 ? "PASS" : "STOP",
    revisedGate: "CONVERT_TO_SUPERSEDED",
    unknownStatusGate: unknownStatusCount === 0 ? "PASS" : "STOP",
  };

  console.log(JSON.stringify(result, null, 2));

  if (duplicateGroups > 0 || unknownStatusCount > 0) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error("PRECHECK FAILED", error instanceof Error ? error.message : error);
  process.exit(1);
});
