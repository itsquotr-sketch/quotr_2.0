/**
 * Shared welcome retry. Callers must already have proved the database ref.
 * Uses the stored idempotency key. Does not choose a recipient.
 * Rows past the 24-hour window are marked for reconciliation and are not sent.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { accountWelcomeFromHeader } from "../lib/auth/account-welcome";
import {
  createAccountWelcomeStore,
  deliverAccountWelcomeEmail,
} from "../lib/auth/account-welcome-send";
import { sendResendEmail } from "../lib/email/resend-send";
import type { QuoteDeliveryProvider } from "../lib/quotes/delivery-types";

export async function runAccountWelcomeRetry(
  admin: SupabaseClient,
  environment: "preview" | "production"
): Promise<void> {
  const { data, error } = await admin
    .from("account_welcome_deliveries")
    .select("id, status, lease_until, environment, reconcile_required")
    .eq("environment", environment)
    .in("status", ["pending", "failed", "sending"]);

  if (error) {
    console.error(error.code || "query_failed");
    process.exit(1);
  }

  const now = Date.now();
  const due = (data ?? []).filter((row) => {
    if (row.reconcile_required === true) return true;
    if (row.status !== "sending") return true;
    const lease = row.lease_until ? Date.parse(String(row.lease_until)) : 0;
    return !Number.isFinite(lease) || lease <= now;
  });

  const provider: QuoteDeliveryProvider = {
    name: "resend",
    isConfigured: () => Boolean(process.env.RESEND_API_KEY?.trim()),
    send: (payload) => sendResendEmail(payload),
  };
  const store = createAccountWelcomeStore(admin);
  const from = accountWelcomeFromHeader();

  let accepted = 0;
  let failed = 0;
  let skipped = 0;
  let reconcile = 0;
  for (const row of due) {
    const result = await deliverAccountWelcomeEmail({
      deliveryId: String(row.id),
      store,
      provider,
      from,
    });
    if (result.outcome === "accepted" || result.outcome === "accepted_unacked") {
      accepted += 1;
      console.log(
        JSON.stringify({
          outcome: result.outcome,
          providerMessageId: result.providerMessageId,
          deliveryConfirmed: false,
        })
      );
    } else if (result.outcome === "reconcile") {
      reconcile += 1;
      console.log(
        JSON.stringify({
          outcome: "reconcile",
          idempotencyKey: result.idempotencyKey,
        })
      );
    } else if (result.outcome === "failed" || result.outcome === "refused") {
      failed += 1;
    } else {
      skipped += 1;
    }
  }

  console.log(
    JSON.stringify({ due: due.length, accepted, failed, skipped, reconcile })
  );
}
