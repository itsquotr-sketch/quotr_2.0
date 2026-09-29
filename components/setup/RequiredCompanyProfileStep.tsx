"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  OnboardingFieldError,
  useFocusOnboardingError,
} from "./focus-onboarding-error";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { saveRequiredCompanyProfile } from "@/lib/setup/actions";
import {
  COMPANY_COUNTRIES,
  getCountryOption,
  resolveCountryForForm,
} from "@/lib/setup/locale-catalogue";
import { taxRegistrationCopy } from "@/lib/setup/tax-identifier";
import type { GstRegisteredChoice } from "@/lib/setup/gst-registered";
import type { SetupState } from "./types";

const selectClassName =
  "flex h-11 w-full rounded-lg border border-input bg-transparent px-3 py-2 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-input/30";

export function RequiredCompanyProfileStep({ state }: { state: SetupState }) {
  const router = useRouter();
  const settings = state.settings;
  const initialCountry = resolveCountryForForm(settings?.country);
  const savedProfile = Boolean(settings?.address_line_1?.trim());

  const [tradingName, setTradingName] = useState(
    settings?.trading_name?.trim() || state.organisationName || ""
  );
  const [country, setCountry] = useState(initialCountry);
  const [addressLine1, setAddressLine1] = useState(settings?.address_line_1 ?? "");
  const [addressLine2, setAddressLine2] = useState(settings?.address_line_2 ?? "");
  const [city, setCity] = useState(settings?.city ?? "");
  const [postcode, setPostcode] = useState(settings?.postcode ?? "");
  const [region, setRegion] = useState(settings?.region ?? "");
  const [gstRegistered, setGstRegistered] = useState<GstRegisteredChoice | "">(
    () => {
      if (!savedProfile) return "";
      if (settings?.gst_number?.trim() || settings?.nzbn?.trim()) return "yes";
      if (settings?.default_gst_rate === 0) return "no";
      return "";
    }
  );
  const [taxIdentifier, setTaxIdentifier] = useState(
    initialCountry === "AU"
      ? (settings?.nzbn ?? "")
      : (settings?.gst_number ?? "")
  );
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [saving, setSaving] = useState(false);

  const copy = taxRegistrationCopy(country);
  const errorSignature = [
    error ?? "",
    ...Object.entries(fieldErrors).map(
      ([key, messages]) => `${key}:${messages[0] ?? ""}`
    ),
  ].join("|");
  useFocusOnboardingError(errorSignature);

  function handleCountryChange(next: string) {
    setCountry(next);
    setTaxIdentifier("");
    setFieldErrors((prev) => {
      const nextErrors = { ...prev };
      delete nextErrors.tax_identifier;
      return nextErrors;
    });
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setFieldErrors({});
    setSaving(true);
    const result = await saveRequiredCompanyProfile({
      required_profile: true,
      trading_name: tradingName,
      country,
      address_line_1: addressLine1,
      address_line_2: addressLine2,
      city,
      postcode,
      region,
      gst_registered: gstRegistered,
      tax_identifier: gstRegistered === "yes" ? taxIdentifier : "",
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
    router.replace("/app/setup?mode=work");
  }

  return (
    <Card>
      <CardHeader className="pb-4">
        <CardTitle className="text-xl">Your business</CardTitle>
        <CardDescription>
          These details appear on quotes and variations. You can change them
          later under Company.
        </CardDescription>
      </CardHeader>
      <form
        onSubmit={handleSubmit}
        data-onboarding-form=""
        className="flex flex-col"
      >
        <CardContent className="space-y-5">
          {error ? (
            <p role="alert" className="rounded-lg border border-destructive/20 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </p>
          ) : null}

          <div className="space-y-2">
            <Label htmlFor="basics-trading-name">Business / trading name</Label>
            <Input
              id="basics-trading-name"
              value={tradingName}
              onChange={(event) => setTradingName(event.target.value)}
              required
              autoComplete="organization"
              className="h-11"
            />
            <OnboardingFieldError
              id="basics-trading-name"
              message={fieldErrors.trading_name?.[0]}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="basics-country">Country</Label>
            <select
              id="basics-country"
              value={country}
              onChange={(event) => handleCountryChange(event.target.value)}
              required
              className={selectClassName}
            >
              {COMPANY_COUNTRIES.map((option) => (
                <option key={option.code} value={option.code}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <fieldset className="space-y-4">
            <legend className="text-sm font-medium">Business address</legend>
            <div className="space-y-2">
              <Label htmlFor="basics-address-1">Street address</Label>
              <Input
                id="basics-address-1"
                value={addressLine1}
                onChange={(event) => setAddressLine1(event.target.value)}
                autoComplete="address-line1"
                required
                className="h-11"
              />
              <OnboardingFieldError
                id="basics-address-1"
                message={fieldErrors.address_line_1?.[0]}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="basics-address-2">Address line 2 (optional)</Label>
              <Input
                id="basics-address-2"
                value={addressLine2}
                onChange={(event) => setAddressLine2(event.target.value)}
                autoComplete="address-line2"
                className="h-11"
              />
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="basics-city">City / town</Label>
                <Input
                  id="basics-city"
                  value={city}
                  onChange={(event) => setCity(event.target.value)}
                  autoComplete="address-level2"
                  required
                  className="h-11"
                />
                <OnboardingFieldError id="basics-city" message={fieldErrors.city?.[0]} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="basics-postcode">Postcode</Label>
                <Input
                  id="basics-postcode"
                  value={postcode}
                  onChange={(event) => setPostcode(event.target.value)}
                  autoComplete="postal-code"
                  inputMode="numeric"
                  required
                  className="h-11"
                />
                <OnboardingFieldError
                  id="basics-postcode"
                  message={fieldErrors.postcode?.[0]}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="basics-region">Suburb or region (optional)</Label>
              <Input
                id="basics-region"
                value={region}
                onChange={(event) => setRegion(event.target.value)}
                className="h-11"
              />
            </div>
          </fieldset>

          <fieldset className="space-y-3">
            <legend className="text-sm font-medium leading-none">{copy.question}</legend>
            <div className="flex flex-col gap-2 sm:flex-row">
              {(["yes", "no"] as const).map((choice) => (
                <label
                  key={choice}
                  className="flex h-11 cursor-pointer items-center gap-2 rounded-lg border border-input px-3 text-sm has-[:checked]:border-ring has-[:checked]:ring-3 has-[:checked]:ring-ring/50"
                >
                  <input
                    type="radio"
                    id={choice === "yes" ? "basics-gst-yes" : "basics-gst-no"}
                    name="gst_registered"
                    value={choice}
                    checked={gstRegistered === choice}
                    onChange={() => setGstRegistered(choice)}
                    className="size-4"
                  />
                  {choice === "yes" ? "Yes" : "No"}
                </label>
              ))}
            </div>
            <OnboardingFieldError
              id="basics-gst-yes"
              message={fieldErrors.gst_registered?.[0]}
            />
            {gstRegistered === "yes" ? (
              <div className="space-y-2">
                <Label htmlFor="basics-tax-id">{copy.identifierLabel}</Label>
                <Input
                  id="basics-tax-id"
                  value={taxIdentifier}
                  onChange={(event) => setTaxIdentifier(event.target.value)}
                  required
                  className="h-11"
                  autoComplete="off"
                />
                <p className="text-xs text-muted-foreground">{copy.identifierHint}</p>
                <OnboardingFieldError
                  id="basics-tax-id"
                  message={fieldErrors.tax_identifier?.[0]}
                />
              </div>
            ) : null}
            <p className="text-xs text-muted-foreground">
              {gstRegistered === "yes"
                ? copy.registeredQuoteNote(
                    getCountryOption(country)?.suggestedGstPercent ?? 15
                  )
                : gstRegistered === "no"
                  ? copy.unregisteredQuoteNote
                  : "This is for customer quotes only — not your Quotr subscription."}
            </p>
          </fieldset>
        </CardContent>
        <CardFooter className="border-t">
          <Button
            id="basics-continue"
            type="submit"
            className="h-11 w-full scroll-mb-4 sm:w-auto"
            disabled={saving}
          >
            {saving ? "Saving…" : "Continue"}
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}
