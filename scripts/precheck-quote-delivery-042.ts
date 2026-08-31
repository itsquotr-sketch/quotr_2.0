/**
 * Read-only shared-DB precheck for 042_quote_delivery.sql.
 * Prints COUNTS only. Does not mutate.
 *
 * Run: npx tsx scripts/precheck-quote-delivery-042.ts
 */
import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";

config({ path: ".env.local" });

const PROJECT_REF = "lxvnylhsbvudzzupxeqr";
const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

function assertSharedDb() {
  if (!url.includes(PROJECT_REF)) {
    throw new Error(
      "Refusing to run: NEXT_PUBLIC_SUPABASE_URL is not the shared quotr_2.0 project."
    );
  }
  if (!serviceKey) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY missing.");
  }
}

async function countOrMissing(
  admin: ReturnType<typeof createClient>,
  table: string
): Promise<{ exists: boolean; count: number | null; error?: string }> {
  const probe = await admin.from(table).select("id").limit(0);
  if (probe.error) {
    const message = probe.error.message ?? "";
    if (
      message.includes("does not exist") ||
      message.includes("schema cache") ||
      probe.error.code === "PGRST205" ||
      probe.error.code === "42P01"
    ) {
      return { exists: false, count: null };
    }
    return { exists: false, count: null, error: message };
  }
  const { count, error } = await admin
    .from(table)
    .select("id", { count: "exact", head: true });
  if (error) {
    return { exists: true, count: null, error: error.message };
  }
  return { exists: true, count: count ?? 0 };
}

async function main() {
  assertSharedDb();
  const admin = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { count: totalQuotes, error: totalErr } = await admin
    .from("quotes")
    .select("id", { count: "exact", head: true });
  if (totalErr) throw totalErr;

  const lockProbe = await admin
    .from("quotes")
    .select("id, send_lock_delivery_id, send_lock_fingerprint")
    .limit(0);
  const lockErrText = [
    lockProbe.error?.message,
    lockProbe.error?.details,
    lockProbe.error?.hint,
    lockProbe.error?.code,
  ]
    .filter(Boolean)
    .join(" ");
  const lockColumnsPresent = !lockProbe.error;
  const lockColumnAbsent =
    Boolean(lockProbe.error) &&
    /does not exist|schema cache|column/i.test(lockErrText);

  let nonNullLockDelivery = 0;
  let nonNullLockFingerprint = 0;
  if (lockColumnsPresent) {
    nonNullLockDelivery = lockProbe.count ?? 0;
    const fp = await admin
      .from("quotes")
      .select("id", { count: "exact", head: true })
      .not("send_lock_fingerprint", "is", null);
    if (fp.error) throw fp.error;
    nonNullLockFingerprint = fp.count ?? 0;
  }

  const statuses = [
    "draft",
    "sent",
    "viewed",
    "accepted",
    "declined",
    "expired",
    "superseded",
    "archived",
  ];
  const statusCounts: Record<string, number> = {};
  for (const status of statuses) {
    const { count, error } = await admin
      .from("quotes")
      .select("id", { count: "exact", head: true })
      .eq("status", status);
    if (error) throw error;
    statusCounts[status] = count ?? 0;
  }

  const { data: numberedRows, error: numberErr } = await admin
    .from("quotes")
    .select("org_id, quote_number, revision_number")
    .not("quote_number", "is", null);
  if (numberErr) throw numberErr;

  const dupMap = new Map<string, number>();
  for (const row of numberedRows ?? []) {
    const key = `${row.org_id}|${row.quote_number}|${row.revision_number ?? 1}`;
    dupMap.set(key, (dupMap.get(key) ?? 0) + 1);
  }
  const duplicateGroups = [...dupMap.values()].filter((n) => n > 1).length;

  const deliveries = await countOrMissing(admin, "quote_deliveries");
  const tokens = await countOrMissing(admin, "quote_access_tokens");
  const receipts = await countOrMissing(admin, "quote_delivery_webhook_receipts");

  const accounted = Object.values(statusCounts).reduce((a, b) => a + b, 0);
  const unknownStatusCount = (totalQuotes ?? 0) - accounted;

  const expectedColumnsAbsent = lockColumnAbsent;
  const gate =
    expectedColumnsAbsent &&
    duplicateGroups === 0 &&
    unknownStatusCount === 0 &&
    !deliveries.exists &&
    !tokens.exists &&
    !receipts.exists
      ? "PASS"
      : lockColumnsPresent
        ? "STOP_COLUMNS_ALREADY_PRESENT"
        : "STOP";

  const result = {
    project: PROJECT_REF,
    totalQuotes: totalQuotes ?? 0,
    sendLockColumnsPresent: lockColumnsPresent,
    sendLockColumnError: lockColumnsPresent ? null : lockErrText,
    nonNullSendLockDeliveryId: nonNullLockDelivery,
    nonNullSendLockFingerprint: nonNullLockFingerprint,
    expectedBeforeMigration: "columns absent",
    statusCounts,
    unknownStatusCount,
    numberedQuotes: numberedRows?.length ?? 0,
    duplicateNumberRevisionGroups: duplicateGroups,
    quote_deliveries: deliveries,
    quote_access_tokens: tokens,
    quote_delivery_webhook_receipts: receipts,
    uniqueIndexGate: duplicateGroups === 0 ? "PASS" : "STOP",
    unknownStatusGate: unknownStatusCount === 0 ? "PASS" : "STOP",
    preApplyGate: gate,
  };

  console.log(JSON.stringify(result, null, 2));
  if (gate !== "PASS") process.exitCode = 1;
}

main().catch((error) => {
  console.error(
    "PRECHECK FAILED",
    error instanceof Error ? error.message : error
  );
  process.exit(1);
});
