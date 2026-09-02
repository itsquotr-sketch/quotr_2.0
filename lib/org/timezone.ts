/**
 * Organisation timezone helpers (BETA-1.5).
 *
 * Canonical identifiers are IANA names (Pacific/Auckland), never UTC+12.
 * Persistence requires organisation_settings.timezone — not present yet.
 * Display currently defaults to Pacific/Auckland until that column exists.
 */

export const DEFAULT_ORG_TIMEZONE = "Pacific/Auckland";
export const NZ_CHATHAM_TIMEZONE = "Pacific/Chatham";

const KNOWN_IANA = new Set([
  "Pacific/Auckland",
  "Pacific/Chatham",
  "Australia/Sydney",
  "Australia/Melbourne",
  "Australia/Brisbane",
  "Australia/Adelaide",
  "Australia/Perth",
  "Australia/Hobart",
  "Australia/Darwin",
  "UTC",
]);

export function isIanaTimezone(value: string | null | undefined): boolean {
  if (!value || typeof value !== "string") return false;
  const trimmed = value.trim();
  if (!trimmed || trimmed.startsWith("UTC") || trimmed.startsWith("GMT")) {
    return false;
  }
  if (KNOWN_IANA.has(trimmed)) return true;
  try {
    Intl.DateTimeFormat("en-NZ", { timeZone: trimmed }).format(new Date());
    return true;
  } catch {
    return false;
  }
}

/**
 * Unambiguous country default only. AU is not guessed (multiple zones).
 * Chatham is only selected when region/context indicates it.
 */
export function defaultTimezoneForCountry(input: {
  country: string | null | undefined;
  region?: string | null;
}): string | null {
  const country = (input.country ?? "").trim().toUpperCase();
  const region = (input.region ?? "").trim().toLowerCase();

  if (country === "NZ" || country === "NEW ZEALAND") {
    if (region.includes("chatham")) return NZ_CHATHAM_TIMEZONE;
    return DEFAULT_ORG_TIMEZONE;
  }

  return null;
}

export function resolveDisplayTimezone(
  stored: string | null | undefined
): string {
  if (stored && isIanaTimezone(stored)) return stored.trim();
  return DEFAULT_ORG_TIMEZONE;
}

export function formatInOrgTimezone(
  value: string | Date | null | undefined,
  timeZone: string = DEFAULT_ORG_TIMEZONE
): string | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  const zone = resolveDisplayTimezone(timeZone);
  return new Intl.DateTimeFormat("en-NZ", {
    timeZone: zone,
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}
