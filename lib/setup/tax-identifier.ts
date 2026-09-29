/**
 * Country-specific GST / tax identifier for required onboarding.
 * Persists into existing organisation_settings columns.
 * NZ GST number → gst_number. AU ABN → nzbn (documents already label that ABN).
 */

export type TaxCountryCode = "NZ" | "AU";

export type TaxRegistrationCopy = {
  question: string;
  identifierLabel: string;
  identifierHint: string;
  registeredQuoteNote: (percent: number) => string;
  unregisteredQuoteNote: string;
};

const NZ_COPY: TaxRegistrationCopy = {
  question: "Are you GST registered?",
  identifierLabel: "GST number",
  identifierHint: "8 or 9 digits, as issued by Inland Revenue.",
  registeredQuoteNote: (percent) =>
    `Customer quotes will add ${percent}% GST. The GST number is printed on Quote and Variation documents.`,
  unregisteredQuoteNote:
    "Customer quotes will not add GST, and no GST number is printed.",
};

const AU_COPY: TaxRegistrationCopy = {
  question: "Are you registered for GST?",
  identifierLabel: "ABN",
  identifierHint: "11-digit Australian Business Number.",
  registeredQuoteNote: (percent) =>
    `Customer quotes will add ${percent}% GST. The ABN is printed on Quote and Variation documents.`,
  unregisteredQuoteNote:
    "Customer quotes will not add GST, and no ABN is printed from this step.",
};

export function taxRegistrationCopy(countryCode: string): TaxRegistrationCopy {
  return countryCode === "AU" ? AU_COPY : NZ_COPY;
}

export function normalizeNzGstNumber(value: string): string | null {
  const digits = value.replace(/[\s-]/g, "");
  if (!/^\d{8,9}$/.test(digits)) return null;
  return digits;
}

/** Australian Business Number checksum (modulus 89). */
export function normalizeAbn(value: string): string | null {
  const digits = value.replace(/\s/g, "");
  if (!/^\d{11}$/.test(digits)) return null;
  const weights = [10, 1, 3, 5, 7, 9, 11, 13, 15, 17, 19];
  const nums = digits.split("").map((char) => Number(char));
  nums[0] -= 1;
  const sum = nums.reduce((total, digit, index) => total + digit * weights[index], 0);
  if (sum % 89 !== 0) return null;
  return digits;
}

export type RequiredCompanyProfileInput = {
  tradingName: string;
  country: string;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  postcode: string;
  region?: string;
  gstRegistered: string;
  taxIdentifier?: string;
};

export type RequiredCompanyProfileValue = {
  tradingName: string;
  countryCode: TaxCountryCode;
  addressCountry: "New Zealand" | "Australia";
  currency: "NZD" | "AUD";
  addressLine1: string;
  addressLine2: string | null;
  city: string;
  postcode: string;
  region: string | null;
  gstRegistered: boolean;
  gstNumber: string | null;
  nzbn: string | null;
  defaultGstRate: number;
};

export function parseRequiredCompanyProfile(
  input: RequiredCompanyProfileInput,
  suggestedGstPercent: number
):
  | { ok: true; value: RequiredCompanyProfileValue }
  | { ok: false; fieldErrors: Record<string, string[]> } {
  const fieldErrors: Record<string, string[]> = {};
  const tradingName = input.tradingName.trim();
  if (!tradingName) {
    fieldErrors.trading_name = ["Enter your business or trading name."];
  } else if (tradingName.length > 160) {
    fieldErrors.trading_name = ["Trading name is too long."];
  }

  const countryCode = input.country.trim().toUpperCase();
  if (countryCode !== "NZ" && countryCode !== "AU") {
    fieldErrors.country = ["Select New Zealand or Australia."];
  }

  const addressLine1 = input.addressLine1.trim();
  if (!addressLine1) {
    fieldErrors.address_line_1 = ["Enter the street address."];
  } else if (addressLine1.length > 200) {
    fieldErrors.address_line_1 = ["Street address is too long."];
  }

  const addressLine2 = input.addressLine2?.trim() || "";
  if (addressLine2.length > 200) {
    fieldErrors.address_line_2 = ["Address line 2 is too long."];
  }

  const city = input.city.trim();
  if (!city) {
    fieldErrors.city = ["Enter the city or town."];
  } else if (city.length > 120) {
    fieldErrors.city = ["City is too long."];
  }

  const postcode = input.postcode.trim();
  if (!/^\d{4}$/.test(postcode)) {
    fieldErrors.postcode = [
      countryCode === "AU"
        ? "Enter a 4-digit Australian postcode."
        : "Enter a 4-digit postcode.",
    ];
  }

  const region = input.region?.trim() || "";
  if (region.length > 120) {
    fieldErrors.region = ["Region is too long."];
  }

  if (input.gstRegistered !== "yes" && input.gstRegistered !== "no") {
    fieldErrors.gst_registered = ["Choose whether you are GST registered."];
  }

  const registered = input.gstRegistered === "yes";
  let gstNumber: string | null = null;
  let nzbn: string | null = null;
  if (registered && (countryCode === "NZ" || countryCode === "AU")) {
    const raw = input.taxIdentifier?.trim() ?? "";
    if (!raw) {
      fieldErrors.tax_identifier = [
        countryCode === "AU"
          ? "Enter your ABN."
          : "Enter your GST number.",
      ];
    } else if (countryCode === "AU") {
      const abn = normalizeAbn(raw);
      if (!abn) {
        fieldErrors.tax_identifier = [
          "Enter a valid 11-digit ABN.",
        ];
      } else {
        nzbn = abn;
      }
    } else {
      const gst = normalizeNzGstNumber(raw);
      if (!gst) {
        fieldErrors.tax_identifier = [
          "Enter an 8 or 9 digit GST number.",
        ];
      } else {
        gstNumber = gst;
      }
    }
  }

  if (Object.keys(fieldErrors).length > 0 || (countryCode !== "NZ" && countryCode !== "AU")) {
    return { ok: false, fieldErrors };
  }

  const percent = Number.isFinite(suggestedGstPercent) && suggestedGstPercent > 0
    ? suggestedGstPercent
    : countryCode === "AU"
      ? 10
      : 15;

  return {
    ok: true,
    value: {
      tradingName,
      countryCode,
      addressCountry: countryCode === "AU" ? "Australia" : "New Zealand",
      currency: countryCode === "AU" ? "AUD" : "NZD",
      addressLine1,
      addressLine2: addressLine2 || null,
      city,
      postcode,
      region: region || null,
      gstRegistered: registered,
      gstNumber: registered ? gstNumber : null,
      nzbn: registered && countryCode === "AU" ? nzbn : null,
      defaultGstRate: registered ? percent : 0,
    },
  };
}

export function parseRequiredHourlyCost(
  value: string | number | null | undefined,
  label: string
): { ok: true; costRate: number } | { ok: false; error: string } {
  const raw = value == null ? "" : String(value).trim();
  if (!raw) {
    return { ok: false, error: `Enter the ${label} internal cost per hour.` };
  }
  const costRate = Number(raw);
  if (!Number.isFinite(costRate) || costRate <= 0) {
    return { ok: false, error: `${label} cost must be greater than 0.` };
  }
  if (costRate > 10000) {
    return { ok: false, error: `${label} cost looks too high. Check the hourly amount.` };
  }
  return { ok: true, costRate };
}
