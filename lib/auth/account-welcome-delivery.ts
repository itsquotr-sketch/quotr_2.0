import "server-only";

import { after } from "next/server";
import {
  accountWelcomeFromHeader,
  isAccountWelcomeDeliveryEnabled,
  resolveAccountWelcomeEnvironment,
  type AccountWelcomeEnvironment,
  type AccountWelcomeStatus,
} from "@/lib/auth/account-welcome";
import {
  createAccountWelcomeStore,
  deliverAccountWelcomeEmail,
  type AccountWelcomeDeliveryResult,
} from "@/lib/auth/account-welcome-send";
import { getQuoteDeliveryProvider } from "@/lib/quotes/delivery-provider";
import { createAdminClient } from "@/lib/supabase/admin";
import type { SupabaseClient } from "@supabase/supabase-js";

const PREVIEW_TEST_RECIPIENT = "hello+test@erccontracting.co.nz";

function createWelcomeAdmin(): SupabaseClient {
  try {
    return createAdminClient();
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message.includes("Missing Supabase")) {
      throw new Error("WELCOME_ADMIN_MISSING");
    }
    if (message.includes("not a service_role")) {
      throw new Error("WELCOME_ADMIN_ROLE");
    }
    throw new Error("WELCOME_ADMIN_UNAVAILABLE");
  }
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function text(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function statusOf(value: unknown): AccountWelcomeStatus | null {
  if (
    value === "pending" ||
    value === "sending" ||
    value === "accepted" ||
    value === "failed"
  ) {
    return value;
  }
  return null;
}

async function deliverId(
  admin: SupabaseClient,
  deliveryId: string,
  allowRecipient?: (email: string) => boolean
): Promise<AccountWelcomeDeliveryResult> {
  return deliverAccountWelcomeEmail({
    deliveryId,
    store: createAccountWelcomeStore(admin),
    provider: getQuoteDeliveryProvider(),
    from: accountWelcomeFromHeader(),
    allowRecipient,
  });
}

export async function deliverAccountWelcomeById(
  deliveryId: string
): Promise<AccountWelcomeDeliveryResult> {
  const admin = createWelcomeAdmin();
  return deliverId(admin, deliveryId);
}

/**
 * Records the welcome row before the HTTP response finishes, then sends
 * after that response. Resend is not on the confirmation path. A thrown
 * error is swallowed so confirmation, profile creation, and login continue.
 */
export async function scheduleAccountWelcomeEmail(input: {
  userId: string;
  orgId: string;
  environment?: AccountWelcomeEnvironment | null;
}): Promise<void> {
  try {
    if (!isAccountWelcomeDeliveryEnabled()) return;
    const environment =
      input.environment ?? resolveAccountWelcomeEnvironment();
    if (!environment) return;
    const admin = createWelcomeAdmin();
    const { data, error } = await admin.rpc("enqueue_account_welcome_signup_v1", {
      p_user_id: input.userId,
      p_org_id: input.orgId,
      p_environment: environment,
    });
    if (error) return;
    const row = asRecord(data);
    const deliveryId = text(row?.id);
    const status = statusOf(row?.status);
    if (!deliveryId || !status || status === "accepted") return;
    after(async () => {
      try {
        await deliverAccountWelcomeById(deliveryId);
      } catch {
        // The row stays pending, failed, or sending for a later retry.
      }
    });
  } catch {
    // Welcome mail must not block confirmation or provisioning.
  }
}

export async function sendPreviewAccountWelcomeTest(): Promise<
  AccountWelcomeDeliveryResult & { recipientMatched: boolean; errorCode?: string }
> {
  const admin = createWelcomeAdmin();
  const { data, error } = await admin.rpc(
    "enqueue_account_welcome_preview_test_v1"
  );
  if (error || !data) {
    const message = error?.message ?? "";
    const errorCode = message.includes("WELCOME:")
      ? message.slice(message.indexOf("WELCOME:"), message.indexOf("WELCOME:") + 40).split(/\s/)[0]
      : "enqueue";
    return {
      outcome: "failed",
      providerMessageId: null,
      idempotencyKey: null,
      from: accountWelcomeFromHeader(),
      recipientMatched: false,
      errorCode,
    };
  }
  const row = asRecord(data);
  const deliveryId = text(row?.id);
  const recipient = text(row?.recipient_email);
  const recipientMatched = recipient === PREVIEW_TEST_RECIPIENT;
  if (!deliveryId || !recipientMatched) {
    return {
      outcome: "refused",
      providerMessageId: text(row?.provider_message_id),
      idempotencyKey: text(row?.idempotency_key),
      from: accountWelcomeFromHeader(),
      recipientMatched: false,
    };
  }
  if (row?.status === "accepted" && text(row.provider_message_id)) {
    return {
      outcome: "skipped_accepted",
      providerMessageId: text(row.provider_message_id),
      idempotencyKey: text(row.idempotency_key),
      from: accountWelcomeFromHeader(),
      recipientMatched: true,
    };
  }
  const delivered = await deliverId(admin, deliveryId, (email) => {
    return email === PREVIEW_TEST_RECIPIENT;
  });
  return { ...delivered, recipientMatched: true };
}
