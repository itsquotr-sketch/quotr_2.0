/**
 * Reads the host of a sent RFQ link back from the mail provider.
 * The raw token, recipient, and message body are not returned.
 */

export type SentRfqLinkCheck = {
  host: string | null;
  providerStatus: string | null;
  readStatus: number | null;
  htmlLength: number;
  textLength: number;
};

const LINK_HOST = /https?:\/\/([a-z0-9.-]+)\/r\/rfq_[a-z0-9_-]+/gi;

export function hostFromRfqMessage(body: string): string | null {
  LINK_HOST.lastIndex = 0;
  const match = LINK_HOST.exec(body);
  const host = match?.[1]?.toLowerCase() ?? "";
  if (!host || host.includes("..") || host === "localhost") return host === "localhost" ? "localhost" : null;
  return host;
}

export async function readSentRfqLink(messageId: string): Promise<SentRfqLinkCheck> {
  const empty: SentRfqLinkCheck = {
    host: null,
    providerStatus: null,
    readStatus: null,
    htmlLength: 0,
    textLength: 0,
  };
  const apiKey = process.env["RESEND_API_KEY"]?.trim();
  if (!apiKey || !messageId.trim()) return empty;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  try {
    const response = await fetch(`https://api.resend.com/emails/${encodeURIComponent(messageId)}`, {
      headers: { Authorization: `Bearer ${apiKey}` },
      signal: controller.signal,
    });
    const text = await response.text();
    if (!response.ok) return { ...empty, readStatus: response.status };
    const parsed = JSON.parse(text) as {
      html?: unknown;
      text?: unknown;
      last_event?: unknown;
    };
    const html = typeof parsed.html === "string" ? parsed.html : "";
    const plain = typeof parsed.text === "string" ? parsed.text : "";
    const providerStatus = typeof parsed.last_event === "string" ? parsed.last_event : null;
    return {
      host: hostFromRfqMessage(`${plain}\n${html}`),
      providerStatus,
      readStatus: response.status,
      htmlLength: html.length,
      textLength: plain.length,
    };
  } catch {
    return empty;
  } finally {
    clearTimeout(timer);
  }
}
