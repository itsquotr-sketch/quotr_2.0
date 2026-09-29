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
 * Subscription semantics (Stage 1):
 * - routine + contact already in Loops: do not send `subscribed`
 * - routine + contact missing + marketingConsent false: `subscribed: false`
 *   (Loops would otherwise create the contact as subscribed)
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
      const found = await findLoopsContact({
        userId,
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
    return {
      ok: true,
      sentSubscribed: typeof subscribed === "boolean" ? subscribed : undefined,
    };
  } catch {
    return { ok: false, code: "network" };
  }
}

async function findLoopsContact(input: {
  userId: string;
  apiKey: string;
  fetchImpl: FetchLike;
}): Promise<{ ok: true; exists: boolean } | { ok: false; code: string }> {
  try {
    const url = `${LOOPS_API_ORIGIN}/contacts/find?userId=${encodeURIComponent(input.userId)}`;
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

async function readFindBody(response: LoopsHttpResponse): Promise<boolean> {
  const body = await response.json();
  return Array.isArray(body) && body.length > 0;
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
