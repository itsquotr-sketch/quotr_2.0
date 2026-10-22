import {
  ACCOUNT_WELCOME_REPLY_TO,
  buildAccountWelcomeEmail,
  type AccountWelcomeEnvironment,
  type AccountWelcomeSource,
  type AccountWelcomeStatus,
} from "@/lib/auth/account-welcome";
import { isSafeMailboxAddress } from "@/lib/email/application-email";
import type {
  QuoteDeliveryProvider,
  QuoteDeliveryProviderResult,
} from "@/lib/quotes/delivery-types";

export type AccountWelcomeClaimedRow = {
  id: string;
  status: AccountWelcomeStatus;
  idempotencyKey: string;
  recipientEmail: string;
  fullName: string | null;
  providerMessageId: string | null;
  leaseUntil: string | null;
  source: AccountWelcomeSource;
  environment: AccountWelcomeEnvironment | null;
  idempotencyStartedAt: string | null;
};

export type AccountWelcomeDeliveryStore = {
  claim(id: string, now: Date): Promise<
    | {
        claimed: false;
        reason: "accepted" | "in_flight" | "reconcile" | "missing";
        providerMessageId: string | null;
        idempotencyKey: string | null;
      }
    | { claimed: true; row: AccountWelcomeClaimedRow }
  >;
  acknowledge(id: string, providerMessageId: string): Promise<boolean>;
  fail(id: string, errorSafe: string): Promise<void>;
};

type WelcomeRpc = {
  rpc(
    fn: string,
    args: Record<string, unknown>
  ): PromiseLike<{ data: unknown; error: { message?: string } | null }>;
};

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function text(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function environmentOf(value: unknown): AccountWelcomeEnvironment | null {
  if (value === "preview" || value === "production" || value === "development") {
    return value;
  }
  return null;
}

export function createAccountWelcomeStore(db: WelcomeRpc): AccountWelcomeDeliveryStore {
  return {
    async claim(id) {
      const { data, error } = await db.rpc("claim_account_welcome_delivery_v1", {
        p_id: id,
      });
      if (error) {
        return {
          claimed: false,
          reason: "missing",
          providerMessageId: null,
          idempotencyKey: null,
        };
      }
      const row = asRecord(data);
      if (!row || row.ok !== true) {
        return {
          claimed: false,
          reason: "missing",
          providerMessageId: null,
          idempotencyKey: null,
        };
      }
      if (row.claimed !== true) {
        const reason =
          row.reason === "accepted" ||
          row.reason === "in_flight" ||
          row.reason === "reconcile"
            ? row.reason
            : "missing";
        return {
          claimed: false,
          reason,
          providerMessageId: text(row.provider_message_id),
          idempotencyKey: text(row.idempotency_key),
        };
      }
      const status = row.status;
      const source = row.source;
      const idempotencyKey = text(row.idempotency_key);
      const recipientEmail = text(row.recipient_email);
      const claimedId = text(row.id);
      if (
        (status !== "pending" &&
          status !== "sending" &&
          status !== "accepted" &&
          status !== "failed") ||
        (source !== "signup" && source !== "preview_test") ||
        !idempotencyKey ||
        !recipientEmail ||
        !claimedId
      ) {
        return {
          claimed: false,
          reason: "missing",
          providerMessageId: null,
          idempotencyKey: null,
        };
      }
      return {
        claimed: true,
        row: {
          id: claimedId,
          status,
          idempotencyKey,
          recipientEmail,
          fullName: text(row.full_name),
          providerMessageId: text(row.provider_message_id),
          leaseUntil: text(row.lease_until),
          source,
          environment: environmentOf(row.environment),
          idempotencyStartedAt: text(row.idempotency_started_at),
        },
      };
    },
    async acknowledge(id, providerMessageId) {
      const { data, error } = await db.rpc(
        "acknowledge_account_welcome_delivery_v1",
        {
          p_id: id,
          p_provider_message_id: providerMessageId,
        }
      );
      if (error) return false;
      return asRecord(data)?.ok === true;
    },
    async fail(id, errorSafe) {
      await db.rpc("fail_account_welcome_delivery_v1", {
        p_id: id,
        p_error_safe: errorSafe,
      });
    },
  };
}

export type AccountWelcomeDeliveryResult = {
  outcome:
    | "skipped_accepted"
    | "skipped_in_flight"
    | "missing"
    | "accepted"
    | "accepted_unacked"
    | "failed"
    | "refused"
    | "reconcile";
  providerMessageId: string | null;
  idempotencyKey: string | null;
  from: string | null;
};

function safeFailure(result: Extract<QuoteDeliveryProviderResult, { ok: false }>): string {
  const message = result.messageSafe.trim() || "The email could not be sent.";
  return message.slice(0, 180);
}

/**
 * Claim, send with the stored idempotency key, then acknowledge.
 * A provider acceptance whose acknowledgement write fails stays unaccepted
 * and keeps the same key, so the next attempt is a provider replay.
 */
export async function deliverAccountWelcomeEmail(input: {
  deliveryId: string;
  store: AccountWelcomeDeliveryStore;
  provider: QuoteDeliveryProvider;
  from: string | null;
  now?: Date;
  allowRecipient?: (email: string) => boolean;
}): Promise<AccountWelcomeDeliveryResult> {
  const now = input.now ?? new Date();
  const claimed = await input.store.claim(input.deliveryId, now);
  if (!claimed.claimed) {
    if (claimed.reason === "accepted") {
      return {
        outcome: "skipped_accepted",
        providerMessageId: claimed.providerMessageId,
        idempotencyKey: claimed.idempotencyKey,
        from: input.from,
      };
    }
    if (claimed.reason === "in_flight") {
      return {
        outcome: "skipped_in_flight",
        providerMessageId: null,
        idempotencyKey: claimed.idempotencyKey,
        from: input.from,
      };
    }
    if (claimed.reason === "reconcile") {
      return {
        outcome: "reconcile",
        providerMessageId: null,
        idempotencyKey: claimed.idempotencyKey,
        from: input.from,
      };
    }
    return {
      outcome: "missing",
      providerMessageId: null,
      idempotencyKey: null,
      from: input.from,
    };
  }

  const row = claimed.row;
  if (
    !input.from ||
    !input.provider.isConfigured() ||
    !isSafeMailboxAddress(row.recipientEmail) ||
    !isSafeMailboxAddress(ACCOUNT_WELCOME_REPLY_TO)
  ) {
    await input.store.fail(row.id, "Email delivery is not configured.");
    return {
      outcome: "failed",
      providerMessageId: null,
      idempotencyKey: row.idempotencyKey,
      from: input.from,
    };
  }

  if (input.allowRecipient && !input.allowRecipient(row.recipientEmail)) {
    await input.store.fail(row.id, "The welcome email recipient was refused.");
    return {
      outcome: "refused",
      providerMessageId: null,
      idempotencyKey: row.idempotencyKey,
      from: input.from,
    };
  }

  const email = buildAccountWelcomeEmail({
    fullName: row.fullName,
    previewTest: row.source === "preview_test" && row.environment === "preview",
    environment: row.environment,
  });
  let sent: QuoteDeliveryProviderResult;
  try {
    sent = await input.provider.send({
      to: row.recipientEmail,
      from: input.from,
      replyTo: ACCOUNT_WELCOME_REPLY_TO,
      subject: email.subject,
      html: email.html,
      text: email.text,
      idempotencyKey: row.idempotencyKey,
    });
  } catch {
    await input.store.fail(row.id, "Could not reach the email service. Try again shortly.");
    return {
      outcome: "failed",
      providerMessageId: null,
      idempotencyKey: row.idempotencyKey,
      from: input.from,
    };
  }

  if (!sent.ok) {
    await input.store.fail(row.id, safeFailure(sent));
    return {
      outcome: "failed",
      providerMessageId: null,
      idempotencyKey: row.idempotencyKey,
      from: input.from,
    };
  }

  let acknowledged = false;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      acknowledged = await input.store.acknowledge(row.id, sent.providerMessageId);
    } catch {
      acknowledged = false;
    }
    if (acknowledged) break;
  }

  if (!acknowledged) {
    return {
      outcome: "accepted_unacked",
      providerMessageId: sent.providerMessageId,
      idempotencyKey: row.idempotencyKey,
      from: input.from,
    };
  }

  return {
    outcome: "accepted",
    providerMessageId: sent.providerMessageId,
    idempotencyKey: row.idempotencyKey,
    from: input.from,
  };
}
