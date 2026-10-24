/**
 * One Preview plan-confirmation email.
 * Recipient is fixed to hello+test@erccontracting.co.nz.
 * Synthetic amounts only. Does not read or replay org_subscriptions.
 *
 * Run from the repo: npx tsx scripts/send-preview-plan-confirmation-test.ts
 */
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { teamInviteFromHeader } from "../lib/email/application-email";
import { sendResendEmail } from "../lib/email/resend-send";
import {
  buildPlanConfirmationEmail,
  PLAN_CONFIRMATION_PREVIEW_TEST_FACTS,
  PLAN_CONFIRMATION_PREVIEW_TEST_RECIPIENT,
} from "../lib/billing/plan-confirmation";
import {
  createPlanConfirmationStore,
  deliverPaidPlanConfirmation,
} from "../lib/billing/plan-confirmation-send";
import type { QuoteDeliveryProvider } from "../lib/quotes/delivery-types";

const SYNTHETIC = {
  ...PLAN_CONFIRMATION_PREVIEW_TEST_FACTS,
  billingUrl: "https://quotr-2-0-o4jc2a1rd-quotr1.vercel.app/app/settings/billing",
};

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

function previewDatabase(url: string): boolean {
  try {
    return new URL(url).hostname.startsWith("shhpjsoldmqtkdbgrbtm.");
  } catch {
    return false;
  }
}

async function main(): Promise<void> {
loadLocalEnv();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ?? "";
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ?? "";
if (!previewDatabase(supabaseUrl) || !serviceKey) {
  console.error("preview database was not available");
  process.exit(1);
}

const admin = createClient(supabaseUrl, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const { data, error } = await admin.rpc("enqueue_paid_plan_confirmation_preview_test_v1", {
  p_plan_code: SYNTHETIC.planCode,
  p_included_users: SYNTHETIC.includedUsers,
  p_paid_users: SYNTHETIC.paidUsers,
  p_currency: SYNTHETIC.currency,
  p_recurring_exclusive_cents: SYNTHETIC.recurringExclusiveCents,
  p_recurring_tax_cents: SYNTHETIC.recurringTaxCents,
  p_tax_display_name: SYNTHETIC.taxDisplayName,
  p_tax_percent: SYNTHETIC.taxPercent,
  p_tax_inclusive: SYNTHETIC.taxInclusive,
  p_opening_exclusive_cents: SYNTHETIC.openingExclusiveCents,
  p_opening_tax_cents: SYNTHETIC.openingTaxCents,
  p_opening_total_cents: SYNTHETIC.openingTotalCents,
  p_opening_kind: SYNTHETIC.openingKind,
  p_next_billing_at: SYNTHETIC.nextBillingAt,
  p_billing_url: SYNTHETIC.billingUrl,
});

if (error || !data || typeof data !== "object") {
  const message = error?.message ?? "";
  const code = message.includes("PLAN:") ? message.slice(message.indexOf("PLAN:")).split(/\s/)[0] : "enqueue";
  console.error(`enqueue failed ${code}`);
  process.exit(1);
}

const row = data as Record<string, unknown>;
const deliveryId = typeof row.id === "string" ? row.id : "";
const recipient = typeof row.recipient_email === "string" ? row.recipient_email : "";
if (!deliveryId || recipient !== PLAN_CONFIRMATION_PREVIEW_TEST_RECIPIENT) {
  console.error("recipient lock refused the send");
  process.exit(1);
}

const stored = await admin
  .from("plan_confirmation_deliveries")
  .select("company_name, plan_code, included_users, paid_users, currency, recurring_exclusive_cents, recurring_tax_cents, tax_display_name, opening_exclusive_cents, opening_tax_cents, opening_total_cents, opening_kind, next_billing_at, billing_url, recipient_email")
  .eq("id", deliveryId)
  .maybeSingle();
const storedRow = stored.data;
if (!storedRow || storedRow.recipient_email !== PLAN_CONFIRMATION_PREVIEW_TEST_RECIPIENT) {
  console.error("recipient lock refused the send");
  process.exit(1);
}
const preview = buildPlanConfirmationEmail({
  companyName: storedRow.company_name,
  billingUrl: storedRow.billing_url,
  previewTest: true,
  facts: {
    planCode: storedRow.plan_code,
    currency: storedRow.currency,
    includedUsers: storedRow.included_users,
    paidUsers: storedRow.paid_users,
    recurringExclusiveCents: storedRow.recurring_exclusive_cents,
    recurringTaxCents: storedRow.recurring_tax_cents,
    taxDisplayName: storedRow.tax_display_name,
    taxPercent: SYNTHETIC.taxPercent,
    taxInclusive: false,
    openingExclusiveCents: storedRow.opening_exclusive_cents,
    openingTaxCents: storedRow.opening_tax_cents,
    openingTotalCents: storedRow.opening_total_cents,
    openingKind: storedRow.opening_kind,
    nextBillingAt: storedRow.next_billing_at,
  },
});

const provider: QuoteDeliveryProvider = {
  name: "resend",
  isConfigured: () => Boolean(process.env.RESEND_API_KEY?.trim()),
  send: (payload) => {
    if (payload.to !== PLAN_CONFIRMATION_PREVIEW_TEST_RECIPIENT) {
      return Promise.resolve({
        ok: false,
        retryable: false,
        code: "invalid_recipient",
        messageSafe: "The recipient email was rejected.",
      });
    }
    return sendResendEmail(payload);
  },
};

const delivered = await deliverPaidPlanConfirmation({
  deliveryId,
  store: createPlanConfirmationStore(admin),
  provider,
  from: teamInviteFromHeader(),
  allowRecipient: (email) => email === PLAN_CONFIRMATION_PREVIEW_TEST_RECIPIENT,
});

const retry = await deliverPaidPlanConfirmation({
  deliveryId,
  store: createPlanConfirmationStore(admin),
  provider,
  from: teamInviteFromHeader(),
  allowRecipient: (email) => email === PLAN_CONFIRMATION_PREVIEW_TEST_RECIPIENT,
});

console.log(
  JSON.stringify(
    {
      recipient: PLAN_CONFIRMATION_PREVIEW_TEST_RECIPIENT,
      subject: preview.subject,
      text: preview.text,
      send: delivered.outcome,
      recipientMatched: delivered.recipientEmail === PLAN_CONFIRMATION_PREVIEW_TEST_RECIPIENT || delivered.outcome === "skipped_accepted",
      providerMessageId: delivered.providerMessageId,
      retry: retry.outcome,
    },
    null,
    2
  )
);

if (delivered.outcome !== "accepted" && delivered.outcome !== "skipped_accepted") {
  process.exit(1);
}
if (retry.outcome !== "skipped_accepted") {
  process.exit(1);
}
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "preview plan confirmation test failed");
  process.exit(1);
});
