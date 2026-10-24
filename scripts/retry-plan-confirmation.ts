/**
 * Retry one paid plan confirmation. There is no scheduler.
 *
 *   npx tsx scripts/retry-plan-confirmation.ts <delivery-uuid>
 *
 * Pending and failed rows are claimed and sent with the stored idempotency
 * key. A provider acceptance whose local acknowledgement failed is retried
 * with that same key, so Resend returns the original message.
 *
 * After the 24-hour idempotency window the claim stops and marks the row
 * reconcile_required. This command does not mint a new key and does not send.
 * Check the provider for that key before any manual follow-up.
 *
 * Refuses preview_test rows. Does not accept an email address argument.
 */
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { teamInviteFromHeader } from "../lib/email/application-email";
import { sendResendEmail } from "../lib/email/resend-send";
import {
  createPlanConfirmationStore,
  deliverPaidPlanConfirmation,
} from "../lib/billing/plan-confirmation-send";
import type { QuoteDeliveryProvider } from "../lib/quotes/delivery-types";

function loadLocalEnv(): void {
  let text = "";
  try {
    text = readFileSync(".env.local", "utf8");
  } catch {
    return;
  }
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq < 1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (process.env[key] == null) process.env[key] = value;
  }
}

async function main(): Promise<void> {
  const deliveryId = process.argv[2]?.trim() ?? "";
  if (process.argv.length !== 3 || !/^[0-9a-f-]{36}$/i.test(deliveryId)) {
    console.error("usage: npx tsx scripts/retry-plan-confirmation.ts <delivery-uuid>");
    process.exit(1);
  }
  loadLocalEnv();
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ?? "";
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ?? "";
  if (!supabaseUrl || !serviceKey) {
    console.error("database credentials are not available");
    process.exit(1);
  }
  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const existing = await admin
    .from("plan_confirmation_deliveries")
    .select("source, status")
    .eq("id", deliveryId)
    .maybeSingle();
  if (existing.error || !existing.data) {
    console.error("delivery was not found");
    process.exit(1);
  }
  if (existing.data.source === "preview_test") {
    console.error("preview test deliveries are not retried by this command");
    process.exit(1);
  }
  const provider: QuoteDeliveryProvider = {
    name: "resend",
    isConfigured: () => Boolean(process.env.RESEND_API_KEY?.trim()),
    send: (payload) => sendResendEmail(payload),
  };
  const result = await deliverPaidPlanConfirmation({
    deliveryId,
    store: createPlanConfirmationStore(admin),
    provider,
    from: teamInviteFromHeader(),
  });
  console.log(
    JSON.stringify(
      {
        outcome: result.outcome,
        idempotencyKey: result.idempotencyKey,
        providerMessageId: result.providerMessageId,
      },
      null,
      2
    )
  );
  if (
    result.outcome === "failed" ||
    result.outcome === "refused" ||
    result.outcome === "missing" ||
    result.outcome === "incomplete"
  ) {
    process.exit(1);
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "retry failed");
  process.exit(1);
});
