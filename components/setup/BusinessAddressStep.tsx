"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AddressSearch } from "@/components/addresses/AddressSearch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { addressCountryCode } from "@/lib/addresses/map-place";
import { saveBusinessAddress } from "@/lib/setup/actions";
import {
  FIRST_RUN_BASICS_PATH,
  FIRST_RUN_TAX_PATH,
} from "@/lib/setup/first-run-stage";
import { normalizeCountryCode } from "@/lib/setup/locale-catalogue";
import {
  OnboardingFieldError,
  useFocusOnboardingError,
} from "./focus-onboarding-error";
import { OnboardingActions, OnboardingSurface } from "./OnboardingSurface";
import type { SetupState } from "./types";

const fieldClass = "min-h-11 text-base";

export function BusinessAddressStep({ state }: { state: SetupState }) {
  const router = useRouter();
  const settings = state.settings;
  const countryCode = normalizeCountryCode(settings?.country);
  const australia = countryCode === "AU";
  const countryLabel =
    settings?.address_country?.trim() ||
    (australia ? "Australia" : countryCode === "NZ" ? "New Zealand" : "Choose a country first");
  const [addressLine1, setAddressLine1] = useState(settings?.address_line_1 ?? "");
  const [addressLine2, setAddressLine2] = useState(settings?.address_line_2 ?? "");
  const [city, setCity] = useState(settings?.city ?? "");
  const [region, setRegion] = useState(settings?.region ?? "");
  const [postcode, setPostcode] = useState(settings?.postcode ?? "");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const errorSignature = [
    error ?? "",
    ...Object.entries(fieldErrors).map(([key, messages]) => `${key}:${messages[0] ?? ""}`),
  ].join("|");
  useFocusOnboardingError(errorSignature);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setFieldErrors({});
    setSaving(true);
    const result = await saveBusinessAddress({
      addressLine1,
      addressLine2,
      city,
      region,
      postcode,
    });
    setSaving(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    if (result.fieldErrors) {
      setFieldErrors(result.fieldErrors);
      return;
    }
    router.push(FIRST_RUN_TAX_PATH);
  }

  return (
    <OnboardingSurface
      mode="address"
      title="Business address"
      description="Search for the address or type it below. Country comes from the previous step."
    >
      <form data-onboarding-form onSubmit={handleSubmit} className="space-y-4">
        {error ? (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        ) : null}
        <AddressSearch
          countryCode={addressCountryCode(countryCode)}
          onAddress={(mapped) => {
            setAddressLine1(mapped.street);
            setAddressLine2(mapped.unit);
            setCity(mapped.suburbOrCity);
            setRegion(mapped.region);
            setPostcode(mapped.postcode.slice(0, 4));
          }}
        />
        <div className="space-y-1.5">
          <Label htmlFor="street-address">Street address</Label>
          <Input
            id="street-address"
            name="addressLine1"
            autoComplete="address-line1"
            value={addressLine1}
            onChange={(event) => setAddressLine1(event.target.value)}
            className={fieldClass}
            aria-invalid={Boolean(fieldErrors.addressLine1)}
          />
          <OnboardingFieldError id="street-address" message={fieldErrors.addressLine1?.[0]} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="address-line-2">Address line 2 (optional)</Label>
          <Input
            id="address-line-2"
            name="addressLine2"
            autoComplete="address-line2"
            value={addressLine2}
            onChange={(event) => setAddressLine2(event.target.value)}
            className={fieldClass}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="city">{australia ? "Suburb or city" : "City or town"}</Label>
          <Input
            id="city"
            name="city"
            autoComplete="address-level2"
            value={city}
            onChange={(event) => setCity(event.target.value)}
            className={fieldClass}
            aria-invalid={Boolean(fieldErrors.city)}
          />
          <OnboardingFieldError id="city" message={fieldErrors.city?.[0]} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="region">{australia ? "State" : "Region"}</Label>
          <Input
            id="region"
            name="region"
            autoComplete="address-level1"
            value={region}
            onChange={(event) => setRegion(event.target.value)}
            className={fieldClass}
            aria-invalid={Boolean(fieldErrors.region)}
          />
          <OnboardingFieldError id="region" message={fieldErrors.region?.[0]} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="postcode">Postcode</Label>
          <Input
            id="postcode"
            name="postcode"
            inputMode="numeric"
            autoComplete="postal-code"
            maxLength={4}
            value={postcode}
            onChange={(event) => setPostcode(event.target.value)}
            className={fieldClass}
            aria-invalid={Boolean(fieldErrors.postcode)}
          />
          <OnboardingFieldError id="postcode" message={fieldErrors.postcode?.[0]} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="address-country">Country</Label>
          <Input id="address-country" value={countryLabel} readOnly className={fieldClass} />
        </div>
        <OnboardingActions backHref={FIRST_RUN_BASICS_PATH} pending={saving} />
      </form>
    </OnboardingSurface>
  );
}
