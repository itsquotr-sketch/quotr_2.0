/**
 * Canonical country / currency catalogue for company basics (Stage 3.1C.3-R2A).
 * Extensible without schema rewrite. Persists ISO codes into existing text columns.
 */

export type CountryOption = {
  code: string;
  label: string;
  suggestedCurrency: string;
  suggestedGstPercent: number;
};

export type CurrencyOption = {
  code: string;
  label: string;
};

/** Initial markets — add rows to grow the product without UI rewrite. */
export const COMPANY_COUNTRIES: readonly CountryOption[] = [
  {
    code: "NZ",
    label: "New Zealand",
    suggestedCurrency: "NZD",
    suggestedGstPercent: 15,
  },
  {
    code: "AU",
    label: "Australia",
    suggestedCurrency: "AUD",
    suggestedGstPercent: 10,
  },
] as const;

export const COMPANY_CURRENCIES: readonly CurrencyOption[] = [
  { code: "NZD", label: "New Zealand Dollar (NZD)" },
  { code: "AUD", label: "Australian Dollar (AUD)" },
  // Reserved for later without UI rewrite:
  // { code: "GBP", label: "British Pound (GBP)" },
  // { code: "USD", label: "US Dollar (USD)" },
  // { code: "EUR", label: "Euro (EUR)" },
] as const;

const COUNTRY_ALIASES: Record<string, string> = {
  nz: "NZ",
  "new zealand": "NZ",
  "newzealand": "NZ",
  au: "AU",
  australia: "AU",
  aus: "AU",
};

const CURRENCY_ALIASES: Record<string, string> = {
  nzd: "NZD",
  "nz dollar": "NZD",
  "new zealand dollar": "NZD",
  aud: "AUD",
  "australian dollar": "AUD",
  "aus dollar": "AUD",
};

function normalizeKey(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

/**
 * Map free-text or code legacy values to a catalogue country code.
 * Returns null when unknown (do not force re-basics for established orgs).
 */
export function normalizeCountryCode(
  value: string | null | undefined
): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;

  const upper = trimmed.toUpperCase();
  if (COMPANY_COUNTRIES.some((c) => c.code === upper)) {
    return upper;
  }

  const alias = COUNTRY_ALIASES[normalizeKey(trimmed)];
  return alias ?? null;
}

/**
 * Map free-text or code legacy values to an ISO currency code in catalogue.
 */
export function normalizeCurrencyCode(
  value: string | null | undefined
): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;

  const upper = trimmed.toUpperCase();
  if (COMPANY_CURRENCIES.some((c) => c.code === upper)) {
    return upper;
  }

  const alias = CURRENCY_ALIASES[normalizeKey(trimmed)];
  return alias ?? null;
}

export function getCountryOption(code: string): CountryOption | undefined {
  return COMPANY_COUNTRIES.find((c) => c.code === code);
}

export function getCurrencyOption(code: string): CurrencyOption | undefined {
  return COMPANY_CURRENCIES.find((c) => c.code === code);
}

export function isSupportedCountryCode(code: string): boolean {
  return COMPANY_COUNTRIES.some((c) => c.code === code);
}

export function isSupportedCurrencyCode(code: string): boolean {
  return COMPANY_CURRENCIES.some((c) => c.code === code);
}

/**
 * Resolve UI select values from persisted settings without rewriting remote data.
 */
export function resolveCountryForForm(
  persisted: string | null | undefined,
  fallback = "NZ"
): string {
  return normalizeCountryCode(persisted) ?? fallback;
}

export function resolveCurrencyForForm(
  persisted: string | null | undefined,
  fallback = "NZD"
): string {
  return normalizeCurrencyCode(persisted) ?? fallback;
}
