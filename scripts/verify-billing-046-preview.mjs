/**
 * Preview 046 table/RLS probe. Never prints secrets or row payloads.
 */
import { createClient } from "@supabase/supabase-js";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PREVIEW_REF = "shhpjsoldmqtkdbgrbtm";

function parseEnvFile(filePath) {
  const env = {};
  for (const raw of fs.readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#") || !line.includes("=")) continue;
    const idx = line.indexOf("=");
    let value = line.slice(idx + 1);
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    env[line.slice(0, idx)] = value;
  }
  return env;
}

function urlRef(url) {
  try {
    return new URL(url).hostname.replace(/\.supabase\.co$/i, "").toLowerCase();
  } catch {
    return null;
  }
}

const env = parseEnvFile(path.join(ROOT, ".env.local"));
const url = env.NEXT_PUBLIC_SUPABASE_URL?.trim() ?? "";
const anon = env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() ?? "";
const service = env.SUPABASE_SERVICE_ROLE_KEY?.trim() ?? "";
if (urlRef(url) !== PREVIEW_REF) {
  console.log(JSON.stringify({ ok: false, error: "not_preview_ref" }));
  process.exit(1);
}

const admin = createClient(url, service, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const publicClient = createClient(url, anon, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const tables = [
  "org_billing_customers",
  "org_subscriptions",
  "stripe_processed_events",
  "org_billing_overrides",
];

const tableReadable = {};
for (const table of tables) {
  const { error } = await admin.from(table).select("id").limit(1);
  tableReadable[table] = !error;
}

const eventId = `evt_billing1r1_${Date.now()}`;
const { error: insertError } = await admin.from("stripe_processed_events").insert({
  billing_environment: "test",
  stripe_event_id: eventId,
  event_type: "checkout.session.completed",
  status: "ignored",
  error_code: "probe",
  error_safe: "BILLING-1-R1 RLS probe",
});

const { data: probeRow, error: selectError } = await admin
  .from("stripe_processed_events")
  .select("billing_environment, stripe_event_id, status")
  .eq("stripe_event_id", eventId)
  .maybeSingle();

const { error: anonSelectEvents } = await publicClient
  .from("stripe_processed_events")
  .select("id")
  .limit(1);
const { error: anonInsertEvents } = await publicClient
  .from("stripe_processed_events")
  .insert({
    billing_environment: "test",
    stripe_event_id: `${eventId}_anon`,
    event_type: "checkout.session.completed",
    status: "ignored",
  });
const { error: anonSelectSubs } = await publicClient
  .from("org_subscriptions")
  .select("id")
  .limit(1);
const { error: anonInsertSubs } = await publicClient.from("org_subscriptions").insert({
  org_id: "00000000-0000-0000-0000-000000000000",
  billing_environment: "test",
  plan_code: "builder",
  status: "active",
  source: "internal_trial",
  paid_seat_quantity: 1,
});
const { error: anonSelectOverrides } = await publicClient
  .from("org_billing_overrides")
  .select("id")
  .limit(1);
const { error: anonSelectCustomers } = await publicClient
  .from("org_billing_customers")
  .select("id")
  .limit(1);

await admin.from("stripe_processed_events").delete().eq("stripe_event_id", eventId);

const denied = (error) => Boolean(error);

console.log(
  JSON.stringify(
    {
      preview_ref: PREVIEW_REF,
      service_role_tables_readable: tableReadable,
      service_role_insert_event: !insertError,
      service_role_select_event:
        !selectError &&
        probeRow?.billing_environment === "test" &&
        probeRow?.stripe_event_id === eventId,
      service_role_row_was_test_env: probeRow?.billing_environment === "test",
      anon_denied_events_select: denied(anonSelectEvents),
      anon_denied_events_insert: denied(anonInsertEvents),
      anon_denied_subscriptions_select: denied(anonSelectSubs),
      anon_denied_subscriptions_insert: denied(anonInsertSubs),
      anon_denied_overrides_select: denied(anonSelectOverrides),
      anon_denied_customers_select: denied(anonSelectCustomers),
      probe_row_deleted: true,
    },
    null,
    2
  )
);
