import {
  IP_ADDRESS_MAX_CHARS,
  USER_AGENT_MAX_CHARS,
} from "@/lib/quotes/acceptance";

/**
 * Contextual evidence only — not identity proof.
 * Trust the first X-Forwarded-For hop that Vercel sets. Never a form field.
 */
export function clientIpFromHeaders(headerList: Headers): string | null {
  const forwarded = headerList.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim() ?? "";
    if (first && first.length <= IP_ADDRESS_MAX_CHARS && !/[\r\n]/.test(first)) {
      return first;
    }
  }
  const realIp = headerList.get("x-real-ip")?.trim() ?? "";
  if (realIp && realIp.length <= IP_ADDRESS_MAX_CHARS && !/[\r\n]/.test(realIp)) {
    return realIp;
  }
  return null;
}

export function userAgentFromHeaders(headerList: Headers): string | null {
  const raw = headerList.get("user-agent")?.trim() ?? "";
  if (!raw) return null;
  return raw.slice(0, USER_AGENT_MAX_CHARS);
}
