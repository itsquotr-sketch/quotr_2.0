/**
 * Organisation timezone authority (BETA-1.5-R1).
 *
 * Canonical store: organisation_settings.timezone (IANA id).
 * Display only — persisted timestamps remain UTC.
 *
 * Persistence accepts the application catalogue only. A DB CHECK may reject
 * UTC+12 / GMT offsets but does not validate the full IANA database.
 */

export const DEFAULT_ORG_TIMEZONE = "Pacific/Auckland";
export const NZ_CHATHAM_TIMEZONE = "Pacific/Chatham";

export type OrgTimezoneCountry = "NZ" | "AU";

export type OrgTimezoneOption = {
  id: string;
  label: string;
  country: OrgTimezoneCountry;
};

export const ORG_TIMEZONE_CATALOGUE: readonly OrgTimezoneOption[] = [
  {
    id: "Pacific/Auckland",
    label: "Auckland / Wellington — New Zealand",
    country: "NZ",
  },
  {
    id: "Pacific/Chatham",
    label: "Chatham Islands — New Zealand",
    country: "NZ",
  },
  {
    id: "Australia/Sydney",
    label: "Sydney / Melbourne",
    country: "AU",
  },
  {
    id: "Australia/Brisbane",
    label: "Brisbane",
    country: "AU",
  },
  {
    id: "Australia/Adelaide",
    label: "Adelaide",
    country: "AU",
  },
  {
    id: "Australia/Perth",
    label: "Perth",
    country: "AU",
  },
  {
    id: "Australia/Hobart",
    label: "Hobart",
    country: "AU",
  },
  {
    id: "Australia/Darwin",
    label: "Darwin",
    country: "AU",
  },
] as const;

const CATALOGUE_IDS = new Set(
  ORG_TIMEZONE_CATALOGUE.map((option) => option.id)
);

function looksLikeUtcOffset(value: string): boolean {
  const trimmed = value.trim();
  return (
    /^(UTC|GMT)/i.test(trimmed) ||
    /^[+-]?\d{1,2}(:\d{2})?$/.test(trimmed) ||
    /^(UTC|GMT)?[+-]\d/i.test(trimmed)
  );
}

export function isCatalogueTimezone(
  value: string | null | undefined
): boolean {
  if (!value || typeof value !== "string") return false;
  return CATALOGUE_IDS.has(value.trim());
}

export function timezoneLabel(id: string | null | undefined): string | null {
  if (!id) return null;
  const match = ORG_TIMEZONE_CATALOGUE.find((option) => option.id === id.trim());
  return match?.label ?? null;
}

export function timezonesForCountry(
  country: string | null | undefined
): OrgTimezoneOption[] {
  const code = (country ?? "").trim().toUpperCase();
  const normalised =
    code === "NEW ZEALAND" ? "NZ" : code === "AUSTRALIA" ? "AU" : code;
  if (normalised === "NZ" || normalised === "AU") {
    return ORG_TIMEZONE_CATALOGUE.filter((option) => option.country === normalised);
  }
  return [...ORG_TIMEZONE_CATALOGUE];
}

/**
 * Application-level IANA check for display of a stored value.
 * Offsets such as UTC+12 / GMT+12 are never accepted.
 */
export function isIanaTimezone(value: string | null | undefined): boolean {
  if (!value || typeof value !== "string") return false;
  const trimmed = value.trim();
  if (!trimmed || looksLikeUtcOffset(trimmed)) return false;
  if (CATALOGUE_IDS.has(trimmed)) return true;
  if (!/^[A-Za-z_]+\/[A-Za-z0-9_+-]+(?:\/[A-Za-z0-9_+-]+)?$/.test(trimmed)) {
    return false;
  }
  try {
    Intl.DateTimeFormat("en-NZ", { timeZone: trimmed }).format(new Date());
    return true;
  } catch {
    return false;
  }
}

/**
 * Suggested timezone when the user picks a country/region.
 * NZ → Auckland, or Chatham when region indicates it.
 * AU → Sydney / Melbourne (Australia/Sydney); user can override.
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

  if (country === "AU" || country === "AUSTRALIA") {
    return "Australia/Sydney";
  }

  return null;
}

/**
 * Canonical display resolution:
 *   explicit organisation timezone → validated value
 *   else → Pacific/Auckland legacy fallback
 */
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
