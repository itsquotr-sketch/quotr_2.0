/**
 * Account phone capture for new signups.
 *
 * The stored comparison value is E.164. Display text is what the person
 * typed and is never used to decide uniqueness. Phone is not a login.
 */

import { parsePhoneNumberFromString } from "libphonenumber-js";

export const ACCOUNT_PHONE_COUNTRIES = ["NZ", "AU"] as const;

export type AccountPhoneCountry = (typeof ACCOUNT_PHONE_COUNTRIES)[number];

export const PHONE_ALREADY_LINKED_MESSAGE =
  "This phone number is already linked to an account. Sign in or use a different number.";

export type NormalizedAccountPhone = {
  e164: string;
  display: string;
  country: AccountPhoneCountry;
};

export type AccountPhoneFailure = {
  ok: false;
  field: "phone_country" | "phone_number";
  message: string;
};

export type AccountPhoneResult =
  | ({ ok: true } & NormalizedAccountPhone)
  | AccountPhoneFailure;

const EXAMPLES: Record<AccountPhoneCountry, string> = {
  NZ: "021 123 4567",
  AU: "0412 345 678",
};

export function isAccountPhoneCountry(
  value: unknown
): value is AccountPhoneCountry {
  return value === "NZ" || value === "AU";
}

/**
 * Normalize a NZ or AU number to E.164. Local and international forms of the
 * same number return the same `e164`. The selected country wins: a +61 number
 * is not accepted while New Zealand is selected.
 */
export function normalizeAccountPhone(
  countryInput: unknown,
  rawInput: unknown
): AccountPhoneResult {
  if (!isAccountPhoneCountry(countryInput)) {
    return {
      ok: false,
      field: "phone_country",
      message: "Choose New Zealand or Australia.",
    };
  }

  const raw = typeof rawInput === "string" ? rawInput.trim() : "";
  if (!raw) {
    return {
      ok: false,
      field: "phone_number",
      message: "Phone number is required.",
    };
  }
  if (raw.length > 40) {
    return {
      ok: false,
      field: "phone_number",
      message: `Enter a valid ${countryName(countryInput)} number, such as ${EXAMPLES[countryInput]}.`,
    };
  }

  const parsed = parsePhoneNumberFromString(raw, countryInput);
  if (!parsed?.isValid() || parsed.country !== countryInput) {
    return {
      ok: false,
      field: "phone_number",
      message: `Enter a valid ${countryName(countryInput)} number, such as ${EXAMPLES[countryInput]}.`,
    };
  }

  return {
    ok: true,
    e164: parsed.number,
    display: raw,
    country: countryInput,
  };
}

function countryName(country: AccountPhoneCountry): string {
  return country === "NZ" ? "New Zealand" : "Australian";
}

/**
 * Auth user metadata for signup. Invite signups must not carry a new
 * organisation name, even if one was submitted.
 */
export function buildSignupUserMetadata(input: {
  invite: boolean;
  fullName: string;
  organisationName?: string | null;
  phone: NormalizedAccountPhone;
}): Record<string, string> {
  const metadata: Record<string, string> = {
    full_name: input.fullName,
    signup_phone_required: "true",
    phone_e164: input.phone.e164,
    phone_country: input.phone.country,
    phone_display: input.phone.display,
  };
  if (!input.invite) {
    metadata.organisation_name = input.organisationName?.trim() ?? "";
  }
  return metadata;
}

export function signupAuthErrorText(error: {
  message?: string | null;
  code?: string | null;
}): string {
  return `${error.message ?? ""} ${error.code ?? ""}`.trim();
}

export function isExplicitPhoneClaimFailure(text: string): boolean {
  const value = text.toLowerCase();
  return (
    value.includes("phone:already_linked") ||
    value.includes("phone_number_already_linked")
  );
}

/**
 * GoTrue hides trigger text behind this generic database failure.
 * Email uniqueness is a different, earlier error and must not match.
 */
export function isSignupDatabaseSaveFailure(text: string): boolean {
  const value = text.toLowerCase();
  return (
    value.includes("database error saving new user") ||
    value.includes("unexpected_failure") ||
    value.includes("phone:invalid")
  );
}
