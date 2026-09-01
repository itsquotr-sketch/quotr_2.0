/**
 * Retry pending/failed acceptance notification deliveries for a Preview Quote.
 * Does not re-accept. Does not touch Production. Requires --yes.
 *
 * Does not import Next `server-only` modules. Uses the same flush core as
 * hosted post-commit outbox execution.
 *
 * Usage:
 *   npx vercel env run -e preview -- npx tsx scripts/retry-preview-acceptance-notifications.ts --yes
 *   npx tsx scripts/retry-preview-acceptance-notifications.ts --yes --env path/to/preview.env
 */
import { createClient } from "@supabase/supabase-js";
import fs from "node:fs";
import path from "node:path";
import {
  quoteDeliveryFromAddress,
  quoteDeliverySiteOrigin,
} from "../lib/quotes/delivery-email";
import type { QuoteDeliveryProvider } from "../lib/quotes/delivery-types";
import {
  isMissingNotificationFlushTableError,
  sendPendingQuoteResponseNotificationDeliveries,
  type NotificationFlushDeliveryRow,
  type NotificationFlushStore,
} from "../lib/quotes/notification-flush-core";
import type { QuoteNotificationEmailKind } from "../lib/quotes/notifications";

const PREVIEW_REF = "shhpjsoldmqtkdbgrbtm";
const PRODUCTION_REF = "lxvnylhsbvudzzupxeqr";
const PREVIEW_ORIGIN =
  "https://quotr-2-0-git-hardening-stage-2a-security-quotr1.vercel.app";
const DEFAULT_QUOTE_ID = "7fb61174-30f1-4ff4-a012-1884c5a25214";
const DEFAULT_ORG_ID = "a59f0f43-e3d1-4f23-a391-b8317ed9b521";

function argValue(name: string): string | null {
  const index = process.argv.indexOf(name);
  if (index < 0) return null;
  return process.argv[index + 1] ?? null;
}

function parseEnvFile(filePath: string): Record<string, string> {
  const env: Record<string, string> = {};
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

function refOf(url: string | undefined): string {
  try {
    return new URL(url ?? "").hostname.replace(/\.supabase\.co$/i, "");
  } catch {
    return "invalid";
  }
}

function createResendProvider(): QuoteDeliveryProvider {
  return {
    name: "resend",
    isConfigured() {
      return Boolean(process.env["RESEND_API_KEY"]?.trim());
    },
    async send(payload) {
      const apiKey = process.env["RESEND_API_KEY"]?.trim();
      if (!apiKey) {
        return {
          ok: false,
          retryable: false,
          code: "provider_auth",
          messageSafe: "Email delivery is not configured.",
        };
      }
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          "Idempotency-Key": payload.idempotencyKey,
        },
        body: JSON.stringify({
          from: payload.from,
          to: [payload.to],
          subject: payload.subject,
          html: payload.html,
          text: payload.text,
        }),
      });
      const body = await response.text();
      if (!response.ok) {
        return {
          ok: false,
          retryable: response.status >= 500 || response.status === 429,
          code: "provider_rejected",
          messageSafe: "The email could not be sent.",
        };
      }
      let id = "";
      try {
        const parsed = JSON.parse(body) as { id?: unknown };
        id = typeof parsed.id === "string" ? parsed.id : "";
      } catch {
        id = "";
      }
      if (!id) {
        return {
          ok: false,
          retryable: true,
          code: "provider_unavailable",
          messageSafe: "The email service did not confirm delivery.",
        };
      }
      return { ok: true, providerMessageId: id };
    },
  };
}

function createStore(
  admin: ReturnType<typeof createClient>
): NotificationFlushStore {
  return {
    async listNotificationsForQuote(input) {
      const { data, error } = await admin
        .from("notifications")
        .select("id, payload")
        .eq("org_id", input.orgId)
        .eq("resource_id", input.quoteId);
      if (error) {
        return {
          ok: false,
          missingTable: isMissingNotificationFlushTableError(error),
        };
      }
      return {
        ok: true,
        rows: (data ?? []).map((row) => ({
          id: String(row.id),
          payload: row.payload,
        })),
      };
    },
    async listPendingEmailDeliveries(input) {
      if (input.notificationIds.length === 0) return [];
      const { data, error } = await admin
        .from("notification_deliveries")
        .select(
          "id, org_id, notification_id, email_kind, recipient_email, status, idempotency_key, action_url, attempt_count"
        )
        .in("notification_id", input.notificationIds)
        .eq("org_id", input.orgId)
        .in("status", ["pending", "failed"])
        .eq("channel", "email")
        .order("created_at", { ascending: true });
      if (error || !data) return [];
      return data.map((row) => ({
        id: String(row.id),
        org_id: String(row.org_id),
        notification_id: String(row.notification_id),
        email_kind: row.email_kind as QuoteNotificationEmailKind,
        recipient_email: String(row.recipient_email),
        status: String(row.status),
        idempotency_key: String(row.idempotency_key),
        action_url: typeof row.action_url === "string" ? row.action_url : null,
        attempt_count: Number(row.attempt_count ?? 0),
      })) satisfies NotificationFlushDeliveryRow[];
    },
    async getIssuerSnapshot(input) {
      const { data } = await admin
        .from("quotes")
        .select("issuer_snapshot")
        .eq("id", input.quoteId)
        .eq("org_id", input.orgId)
        .maybeSingle();
      return data?.issuer_snapshot ?? null;
    },
    async updateDelivery(input) {
      await admin
        .from("notification_deliveries")
        .update(input.patch)
        .eq("id", input.id)
        .eq("org_id", input.orgId);
    },
  };
}

const yes = process.argv.includes("--yes");
if (!yes) {
  console.error("Refusing to flush Preview notification deliveries without --yes.");
  process.exit(1);
}

const envPath = argValue("--env");
if (envPath) {
  const loaded = parseEnvFile(path.resolve(envPath));
  for (const [key, value] of Object.entries(loaded)) {
    if (value.trim()) process.env[key] = value;
  }
}

const ref = refOf(process.env.NEXT_PUBLIC_SUPABASE_URL);
if (ref === PRODUCTION_REF) {
  console.error("Refusing to run against Production.");
  process.exit(1);
}
if (ref !== PREVIEW_REF) {
  console.error("Refusing to run against a non-Preview Supabase project.");
  process.exit(1);
}

if (
  !process.env.NEXT_PUBLIC_SITE_URL ||
  /localhost|127\.0\.0\.1/i.test(process.env.NEXT_PUBLIC_SITE_URL)
) {
  process.env.NEXT_PUBLIC_SITE_URL = PREVIEW_ORIGIN;
}

const quoteId = argValue("--quote") ?? DEFAULT_QUOTE_ID;
const orgId = argValue("--org") ?? DEFAULT_ORG_ID;

async function main() {
  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );
  const result = await sendPendingQuoteResponseNotificationDeliveries(
    { quoteId, orgId },
    {
      store: createStore(admin),
      provider: createResendProvider(),
      origin: quoteDeliverySiteOrigin(),
      fromAddress: quoteDeliveryFromAddress(),
    }
  );

  const { data: notifications } = await admin
    .from("notifications")
    .select("id")
    .eq("org_id", orgId)
    .eq("resource_id", quoteId);
  const ids = (notifications ?? []).map((row) => row.id);
  const { data: deliveries } = ids.length
    ? await admin
        .from("notification_deliveries")
        .select("email_kind, status, attempt_count, provider, provider_message_id")
        .in("notification_id", ids)
        .order("email_kind")
    : { data: [] };

  console.log(
    JSON.stringify(
      {
        target: "preview",
        supabase_ref: ref,
        quote_id: quoteId,
        flush: result,
        has_resend_api_key: Boolean(process.env.RESEND_API_KEY?.trim()),
        has_resend_from: Boolean(process.env.RESEND_FROM_EMAIL?.trim()),
        site_origin: process.env.NEXT_PUBLIC_SITE_URL ?? null,
        deliveries: (deliveries ?? []).map((row) => ({
          kind: row.email_kind,
          status: row.status,
          attempt_count: row.attempt_count,
          provider: row.provider,
          has_provider_message_id: Boolean(row.provider_message_id),
        })),
      },
      null,
      2
    )
  );

  if (
    result.skipped === "provider_unconfigured" ||
    (deliveries ?? []).some((row) => row.status !== "submitted")
  ) {
    process.exitCode = 1;
  }
}

void main().catch((error) => {
  console.error(error);
  process.exit(1);
});
