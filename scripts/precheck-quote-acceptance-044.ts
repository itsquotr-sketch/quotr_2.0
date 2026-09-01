/**
 * Read-only shared-DB precheck for 044_quote_acceptance.sql.
 * Prints COUNTS only. Does not mutate.
 *
 * Run: npx tsx scripts/precheck-quote-acceptance-044.ts
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
): Promise<{ exists: boolean; count: number | null }> {
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
    return { exists: false, count: null };
  }
  const { count, error } = await admin
    .from(table)
    .select("id", { count: "exact", head: true });
  if (error) {
    return { exists: true, count: null };
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

  const acceptances = await countOrMissing(admin, "quote_acceptances");
  const declines = await countOrMissing(admin, "quote_declines");
  const tokens = await countOrMissing(admin, "quote_access_tokens");
  const events = await countOrMissing(admin, "quote_events");

  const { error: rpcProbeError } = await admin.rpc("accept_quote_revision_v1", {
    p_quote_id: "00000000-0000-0000-0000-000000000000",
  });
  const acceptRpcPresent =
    !rpcProbeError ||
    !/could not find the function|schema cache/i.test(rpcProbeError.message ?? "");

  console.log(
    JSON.stringify(
      {
        project: PROJECT_REF,
        quotes_total: totalQuotes ?? 0,
        quotes_by_status: statusCounts,
        quote_acceptances_exists: acceptances.exists,
        quote_acceptances_count: acceptances.count,
        quote_declines_exists: declines.exists,
        quote_declines_count: declines.count,
        quote_access_tokens_exists: tokens.exists,
        quote_access_tokens_count: tokens.count,
        quote_events_exists: events.exists,
        quote_events_count: events.count,
        accept_quote_revision_v1_present: acceptRpcPresent,
        latest_expected_after_apply: "044_quote_acceptance",
      },
      null,
      2
    )
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
