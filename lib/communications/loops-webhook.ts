import { createHmac, timingSafeEqual } from "node:crypto";

/** Live "First job and rates" workflow. Not edited by this module. */
export const LIVE_TIP_WORKFLOW_ID = "cmvj3nhtv0e7a0j58xfml0vuz";

/** Unpublished reminder drafts. */
export const REMINDER_WORKFLOW_IDS = [
  "cmvj8dmen05y50j3szg1v4gnr",
  "cmvj8egqx0h5d0j583ygc9ycd",
  "cmvj8ejo20h6m0j5spsa7qj4s",
  "cmvj8emtg00vj0j46kyap046g",
] as const;

const OPTIONAL_WORKFLOW_IDS = new Set<string>([LIVE_TIP_WORKFLOW_ID, ...REMINDER_WORKFLOW_IDS]);
const SIGNATURE_TOLERANCE_MS = 5 * 60 * 1000;
const USER_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function verifyLoopsWebhookSignature(input: {
  secret: string;
  webhookId: string;
  webhookTimestamp: string;
  signatureHeader: string;
  rawBody: string;
  nowMs?: number;
}): boolean {
  const secret = input.secret.trim();
  const webhookId = input.webhookId.trim();
  const timestamp = input.webhookTimestamp.trim();
  if (!secret || !webhookId || !timestamp || !input.signatureHeader) return false;
  const seconds = Number(timestamp);
  if (!Number.isFinite(seconds)) return false;
  const now = input.nowMs ?? Date.now();
  if (Math.abs(now - seconds * 1000) > SIGNATURE_TOLERANCE_MS) return false;
  const encoded = secret.startsWith("whsec_") ? secret.slice("whsec_".length) : secret;
  const key = Buffer.from(encoded, "base64");
  if (key.length === 0) return false;
  const expected = createHmac("sha256", key)
    .update(`${webhookId}.${timestamp}.${input.rawBody}`)
    .digest("base64");
  const expectedBytes = Buffer.from(expected);
  for (const part of input.signatureHeader.split(" ")) {
    const [version, value] = part.split(",");
    if (version !== "v1" || !value) continue;
    const received = Buffer.from(value);
    if (received.length !== expectedBytes.length) continue;
    if (timingSafeEqual(received, expectedBytes)) return true;
  }
  return false;
}

/**
 * A workflow send we can use as 48-hour evidence.
 * Other events, unknown workflows, and contacts without our user id are ignored.
 * The email address is not returned.
 */
export function parseOptionalEmailSend(event: unknown): {
  userId: string;
  workflowId: string;
  sentAtMs: number;
} | null {
  if (!event || typeof event !== "object") return null;
  const row = event as {
    eventName?: unknown;
    eventTime?: unknown;
    loopId?: unknown;
    contactIdentity?: { userId?: unknown };
  };
  if (row.eventName !== "loop.email.sent") return null;
  const workflowId = typeof row.loopId === "string" ? row.loopId : "";
  if (!OPTIONAL_WORKFLOW_IDS.has(workflowId)) return null;
  const userId = typeof row.contactIdentity?.userId === "string" ? row.contactIdentity.userId.trim() : "";
  if (!USER_ID.test(userId)) return null;
  const eventTime = typeof row.eventTime === "number" ? row.eventTime : Number(row.eventTime);
  if (!Number.isFinite(eventTime)) return null;
  return { userId, workflowId, sentAtMs: eventTime * 1000 };
}
