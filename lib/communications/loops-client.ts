/**
 * Loops HTTP client. Import this only from server modules
 * (`lib/communications/sync.ts` is marked server-only).
 * Do not import it from a Client Component. The API key is read from
 * LOOPS_API_KEY and is never sent to the browser by this module's callers.
 */

import {
  loopsSubscribedField,
  type LoopsContactProperties,
  type LoopsSyncMode,
} from "@/lib/communications/contact-mapping";

const LOOPS_API_ORIGIN = "https://app.loops.so/api/v1";
const REQUEST_TIMEOUT_MS = 2500;

export function readLoopsApiKey(): string | null {
  const key = process.env.LOOPS_API_KEY?.trim() ?? "";
  return key.length > 0 ? key : null;
}

export type LoopsUpsertResult =
  | { ok: true; skipped: "unconfigured" }
  | { ok: true; skipped?: undefined; sentSubscribed: boolean | undefined }
  | { ok: false; code: string };

type LoopsHttpResponse = {
  ok: boolean;
  status: number;
  json: () => Promise<unknown>;
};

type FetchLike = (input: string, init?: RequestInit) => Promise<LoopsHttpResponse>;

/**
 * Upsert one Loops contact.
 *
 * Loops API 1.22.6 (PUT /contacts/update, GET /contacts/find):
 * - Update upserts. A missing contact is created, and a new contact is
 *   subscribed unless `subscribed` is sent.
 * - Leaving `subscribed` out does not change subscription status, so a
 *   Loops unsubscribe stays unsubscribed. Sending true resubscribes.
 * - Find accepts email or userId, not both, and returns 200 [] when missing.
 * - A 200 update is accepted only when the body says success: true.
 * - This client does not send mailing lists, events, or campaigns.
 *
 * Subscription field:
 * - routine + contact already in Loops (by userId or email): omit `subscribed`
 * - routine + contact missing + marketingConsent false: `subscribed: false`
 * - routine + contact missing + marketingConsent true: `subscribed: true`
 *   (first create of someone who already opted in; not a re-subscribe)
 * - explicit_opt_in: `subscribed: true`
 * - explicit_opt_out: `subscribed: false`
 * - routine + preference still pending: `subscribed` matches the stored
 *   marketing preference, so a failed opt-in or opt-out is retried
 *
 * If a routine find fails, the update is skipped. Guessing would risk
 * creating a subscribed contact. Explicit opt-in and opt-out still send,
 * because the user just changed consent in Quotr.
 *
 * Failures return a code. This function does not throw.
 * It does not log the API key, the email address, or the request body.
 */
export async function upsertLoopsContact(input: {
  properties: LoopsContactProperties;
  mode: LoopsSyncMode;
  marketingConsent: boolean;
  preferencePending?: boolean;
  fetchImpl?: FetchLike;
  apiKey?: string | null;
}): Promise<LoopsUpsertResult> {
  const apiKey = input.apiKey === undefined ? readLoopsApiKey() : input.apiKey;
  if (!apiKey) return { ok: true, skipped: "unconfigured" };

  const email = typeof input.properties.email === "string" ? input.properties.email : "";
  const userId = typeof input.properties.userId === "string" ? input.properties.userId : "";
  if (!email || !userId) return { ok: false, code: "invalid_contact" };

  const fetchImpl = input.fetchImpl ?? fetch;

  try {
    let contactExists = false;
    if (input.mode === "routine") {
      const found = await findExistingLoopsContact({
        userId,
        email,
        apiKey,
        fetchImpl,
      });
      if (!found.ok) return { ok: false, code: found.code };
      contactExists = found.exists;
    }

    const subscribed = loopsSubscribedField({
      mode: input.mode,
      contactExists,
      marketingConsent: input.marketingConsent,
      preferencePending: input.preferencePending,
    });

    const body: Record<string, string | number | boolean | null> = {
      ...input.properties,
      email,
      userId,
    };
    delete body.mailingLists;
    if (typeof subscribed === "boolean") body.subscribed = subscribed;

    const response = await fetchImpl(`${LOOPS_API_ORIGIN}/contacts/update`, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    if (!response.ok) return { ok: false, code: `update_${response.status}` };
    const accepted = await readUpdateAccepted(response);
    if (!accepted) return { ok: false, code: "update_rejected" };
    return {
      ok: true,
      sentSubscribed: typeof subscribed === "boolean" ? subscribed : undefined,
    };
  } catch {
    return { ok: false, code: "network" };
  }
}

/**
 * Find allows one of email or userId. A contact created earlier by email
 * still counts as existing, so a routine update does not send `subscribed`
 * and does not resubscribe an unsubscribed contact.
 */
async function findExistingLoopsContact(input: {
  userId: string;
  email: string;
  apiKey: string;
  fetchImpl: FetchLike;
}): Promise<{ ok: true; exists: boolean } | { ok: false; code: string }> {
  const byUser = await findLoopsContact({
    query: `userId=${encodeURIComponent(input.userId)}`,
    apiKey: input.apiKey,
    fetchImpl: input.fetchImpl,
  });
  if (!byUser.ok || byUser.exists) return byUser;
  return findLoopsContact({
    query: `email=${encodeURIComponent(input.email)}`,
    apiKey: input.apiKey,
    fetchImpl: input.fetchImpl,
  });
}

async function findLoopsContact(input: {
  query: string;
  apiKey: string;
  fetchImpl: FetchLike;
}): Promise<{ ok: true; exists: boolean } | { ok: false; code: string }> {
  try {
    const url = `${LOOPS_API_ORIGIN}/contacts/find?${input.query}`;
    const response = await input.fetchImpl(url, {
      method: "GET",
      headers: { Authorization: `Bearer ${input.apiKey}` },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    if (!response.ok) return { ok: false, code: `find_${response.status}` };
    const parsed = await readFindBody(response);
    return { ok: true, exists: parsed };
  } catch {
    return { ok: false, code: "find_network" };
  }
}

async function readUpdateAccepted(response: LoopsHttpResponse): Promise<boolean> {
  try {
    const body = await response.json();
    return (
      typeof body === "object" &&
      body !== null &&
      (body as { success?: unknown }).success === true
    );
  } catch {
    return false;
  }
}

async function readFindBody(response: LoopsHttpResponse): Promise<boolean> {
  const body = await response.json();
  return Array.isArray(body) && body.length > 0;
}

/**
 * Subscription state for one existing contact. Does not create or update.
 * Missing and unsubscribed contacts are not enrolled by the caller.
 */
export async function readLoopsContactSubscription(input: {
  userId: string;
  apiKey?: string | null;
  fetchImpl?: FetchLike;
}): Promise<"subscribed" | "unsubscribed" | "missing" | "error"> {
  const apiKey = input.apiKey === undefined ? readLoopsApiKey() : input.apiKey;
  const userId = input.userId.trim();
  if (!apiKey || !userId) return "error";
  const fetchImpl = input.fetchImpl ?? fetch;
  try {
    const response = await fetchImpl(
      `${LOOPS_API_ORIGIN}/contacts/find?userId=${encodeURIComponent(userId)}`,
      {
        method: "GET",
        headers: { Authorization: `Bearer ${apiKey}` },
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      }
    );
    if (!response.ok) return "error";
    const body = await response.json();
    if (!Array.isArray(body) || body.length === 0) return "missing";
    const contact = body[0];
    if (!contact || typeof contact !== "object") return "missing";
    return (contact as { subscribed?: unknown }).subscribed === true
      ? "subscribed"
      : "unsubscribed";
  } catch {
    return "error";
  }
}

export function logLoopsFailure(code: string): void {
  console.error("[communications]", { scope: "loops", code });
}

/** A Loops failure must not escape into the Quotr action that triggered it. */
export async function runIsolatedLoopsTask(task: () => Promise<void>): Promise<void> {
  try {
    await task();
  } catch {
    logLoopsFailure("isolated_task_failed");
  }
}
