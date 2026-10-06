import { formatOnboardingAddress } from "@/lib/setup/format-onboarding-address";
import { normalizeCountryCode } from "@/lib/setup/locale-catalogue";

/**
 * Address parts Quotr already stores. A Google place is only a way to fill
 * these strings. It is not saved, and it is not the source of an issued document.
 */
export type AddressCountryCode = "NZ" | "AU";

export type AddressComponentInput = {
  types?: readonly string[] | null;
  longText?: string | null;
  shortText?: string | null;
  long_name?: string | null;
  short_name?: string | null;
};

export type MappedAddress = {
  street: string;
  unit: string;
  suburbOrCity: string;
  region: string;
  postcode: string;
  country: string;
  countryCode: AddressCountryCode | null;
};

export type StructuredAddressDraft = {
  street: string;
  unit: string;
  suburbOrCity: string;
  region: string;
  postcode: string;
  country: string;
};

/** Place Details field mask. Address components only. */
export const ADDRESS_DETAIL_FIELDS = ["addressComponents"] as const;

/**
 * Address-like primary types. Up to five are allowed.
 * Business and political places are left out.
 */
export const ADDRESS_PRIMARY_TYPES = [
  "street_address",
  "premise",
  "subpremise",
  "route",
] as const;

export const ADDRESS_SEARCH_UNAVAILABLE =
  "Address search is unavailable. Enter the address manually.";

export const ADDRESS_SEARCH_NO_MATCH =
  "No matching addresses. You can enter the address manually.";

export const ADDRESS_SEARCH_INCOMPLETE =
  "That suggestion did not include a street address. Enter the address manually.";

export const ADDRESS_SEARCH_FILLED =
  "Address filled. Review it before saving.";

export function addressCountryCode(
  value: string | null | undefined
): AddressCountryCode | null {
  const code = normalizeCountryCode(value);
  if (code === "NZ" || code === "AU") return code;
  return null;
}

/** Lowercase CLDR region codes for Places Autocomplete (New). */
export function includedRegionCodes(
  country: AddressCountryCode | null
): string[] {
  if (country === "NZ") return ["nz"];
  if (country === "AU") return ["au"];
  return ["nz", "au"];
}

export function placesBrowserKeyConfigured(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY?.trim());
}

function same(left: string, right: string): boolean {
  return left.trim().toLowerCase() === right.trim().toLowerCase();
}

function componentText(
  components: readonly AddressComponentInput[],
  type: string,
  form: "long" | "short"
): string {
  const match = components.find((component) => component.types?.includes(type));
  if (!match) return "";
  const longValue = (match.longText ?? match.long_name ?? "").trim();
  const shortValue = (match.shortText ?? match.short_name ?? "").trim();
  if (form === "short") return shortValue || longValue;
  return longValue || shortValue;
}

function firstText(
  components: readonly AddressComponentInput[],
  types: readonly string[],
  form: "long" | "short"
): string {
  for (const type of types) {
    const value = componentText(components, type, form);
    if (value) return value;
  }
  return "";
}

function formatUnit(raw: string): string {
  const value = raw.trim();
  if (!value) return "";
  if (/^(unit|apt|apartment|flat|suite|level|floor|shop|lot|villa)\b/i.test(value)) {
    return value;
  }
  if (/^[A-Za-z0-9][A-Za-z0-9/-]{0,12}$/.test(value)) return `Unit ${value}`;
  return value;
}

function mapLocality(
  components: readonly AddressComponentInput[],
  countryCode: AddressCountryCode | null
): { suburbOrCity: string; region: string } {
  const suburb = firstText(
    components,
    ["sublocality_level_1", "sublocality"],
    "long"
  );
  const locality = firstText(components, ["locality", "postal_town"], "long");
  const adminLong = componentText(components, "administrative_area_level_1", "long");
  const adminShort = componentText(components, "administrative_area_level_1", "short");

  if (countryCode === "AU") {
    return {
      suburbOrCity: locality || suburb,
      region: adminShort || adminLong,
    };
  }

  // NZ city column keeps the suburb when Google also returns a city.
  // The region column keeps administrative_area_level_1, often the city name.
  if (suburb && !same(suburb, locality)) {
    const region = adminLong || locality;
    return {
      suburbOrCity: suburb,
      region: same(region, suburb) ? locality || adminLong : region,
    };
  }

  return {
    suburbOrCity: locality || suburb,
    region: adminLong || adminShort,
  };
}

export function mapAddressComponents(
  components: readonly AddressComponentInput[] | null | undefined
): MappedAddress {
  const source = components ?? [];
  const countryShort = componentText(source, "country", "short");
  const countryLong = componentText(source, "country", "long");
  const countryCode =
    addressCountryCode(countryShort) ?? addressCountryCode(countryLong);
  const country =
    countryCode === "NZ"
      ? "New Zealand"
      : countryCode === "AU"
        ? "Australia"
        : countryLong;
  const locality = mapLocality(source, countryCode);
  const streetNumber = componentText(source, "street_number", "long");
  const route = componentText(source, "route", "long");
  const postcode = componentText(source, "postal_code", "long").replace(/\s+/g, "");

  return {
    street: [streetNumber, route].filter(Boolean).join(" "),
    unit: formatUnit(componentText(source, "subpremise", "long")),
    suburbOrCity: locality.suburbOrCity,
    region: locality.region,
    postcode,
    country,
    countryCode,
  };
}

export function mappedAddressHasDetails(address: MappedAddress): boolean {
  return Boolean(
    address.street || address.unit || address.suburbOrCity || address.region || address.postcode
  );
}

export function shouldApplyPlaceSelection(input: {
  requestGeneration: number;
  currentGeneration: number;
  countryAtRequest: AddressCountryCode | null;
  currentCountry: AddressCountryCode | null;
  mapped: MappedAddress;
}): boolean {
  if (input.requestGeneration !== input.currentGeneration) return false;
  if (input.countryAtRequest !== input.currentCountry) return false;
  if (input.mapped.country.trim() && !input.mapped.countryCode) return false;
  if (
    input.currentCountry &&
    input.mapped.countryCode &&
    input.mapped.countryCode !== input.currentCountry
  ) {
    return false;
  }
  return mappedAddressHasDetails(input.mapped);
}

export function draftFromSelection(
  current: StructuredAddressDraft,
  mapped: MappedAddress,
  options: { lockCountry: boolean }
): StructuredAddressDraft {
  return {
    street: mapped.street,
    unit: mapped.unit,
    suburbOrCity: mapped.suburbOrCity,
    region: mapped.region,
    postcode: mapped.postcode,
    country:
      options.lockCountry || !mapped.country ? current.country : mapped.country,
  };
}

/** One site line for projects.site_address. Drops adjacent duplicates. */
export function formatSiteAddress(
  address: MappedAddress,
  maxLength = 300
): string | null {
  const full = formatOnboardingAddress([
    address.street,
    address.unit,
    address.suburbOrCity,
    address.region,
    address.postcode,
    address.country,
  ]);
  if (full && full.length <= maxLength) return full;
  const withoutCountry = formatOnboardingAddress([
    address.street,
    address.unit,
    address.suburbOrCity,
    address.region,
    address.postcode,
  ]);
  if (withoutCountry && withoutCountry.length <= maxLength) return withoutCountry;
  return null;
}
