import { createHmac, createHash, timingSafeEqual } from "node:crypto";
import type { QuoteDeliveryStatus } from "@/lib/quotes/delivery-types";

export type ResendWebhookEvent = {
  providerEventId: string;
  providerMessageId: string | null;
  type: string;
  createdAt: string | null;
};

export function digestWebhookPayload(body: string): string {
  return createHash("sha256").update(body).digest("hex");
}

export function verifyResendWebhookSignature(input: {
  payload: string;
  svixId: string | null;
  svixTimestamp: string | null;
  svixSignature: string | null;
  secret: string | null;
}): boolean {
  const secret = input.secret?.trim();
  const id = input.svixId?.trim();
  const timestamp = input.svixTimestamp?.trim();
  const signatureHeader = input.svixSignature?.trim();
  if (!secret || !id || !timestamp || !signatureHeader) return false;

  const ts = Number(timestamp);
  if (!Number.isFinite(ts)) return false;
  const ageMs = Math.abs(Date.now() - ts * 1000);
  if (ageMs > 5 * 60 * 1000) return false;

  const secretBytes = secret.startsWith("whsec_")
    ? Buffer.from(secret.slice(6), "base64")
    : Buffer.from(secret, "utf8");
  const signed = `${id}.${timestamp}.${input.payload}`;
  const expected = createHmac("sha256", secretBytes).update(signed).digest("base64");

  const candidates = signatureHeader
    .split(" ")
    .map((part) => part.replace(/^v1,/, "").trim())
    .filter(Boolean);

  return candidates.some((candidate) => {
    const a = Buffer.from(candidate);
    const b = Buffer.from(expected);
    return a.length === b.length && timingSafeEqual(a, b);
  });
}

export function parseResendWebhookEvent(payload: unknown): ResendWebhookEvent | null {
  if (!payload || typeof payload !== "object") return null;
  const row = payload as Record<string, unknown>;
  const type = typeof row.type === "string" ? row.type : "";
  const data =
    row.data && typeof row.data === "object"
      ? (row.data as Record<string, unknown>)
      : {};
  const providerEventId =
    typeof row.created_at === "string" && type
      ? `${type}:${typeof data.email_id === "string" ? data.email_id : ""}:${row.created_at}`
      : typeof data.email_id === "string"
        ? `${type}:${data.email_id}`
        : "";
  const svixStableId =
    typeof (payload as { svixId?: unknown }).svixId === "string"
      ? String((payload as { svixId: string }).svixId)
      : "";
  if (!type) return null;
  return {
    providerEventId: svixStableId || providerEventId,
    providerMessageId:
      typeof data.email_id === "string"
        ? data.email_id
        : typeof row.email_id === "string"
          ? row.email_id
          : null,
    type,
    createdAt: typeof row.created_at === "string" ? row.created_at : null,
  };
}

export function mapResendEventToDeliveryStatus(
  type: string
): QuoteDeliveryStatus | null {
  switch (type) {
    case "email.delivered":
      return "delivered";
    case "email.bounced":
      return "bounced";
    case "email.complained":
      return "complained";
    case "email.failed":
    case "email.delivery_delayed":
      return "failed";
    default:
      return null;
  }
}

export function nextDeliveryStatusFromWebhook(
  current: QuoteDeliveryStatus,
  incoming: QuoteDeliveryStatus
): QuoteDeliveryStatus {
  if (current === "complained") return current;
  if (incoming === "bounced" || incoming === "complained") return incoming;
  if (current === "bounced") return current;
  if (incoming === "delivered") return "delivered";
  if (incoming === "failed" && current === "preparing") return "failed";
  return current;
}
