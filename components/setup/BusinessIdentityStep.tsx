"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { saveBusinessIdentity } from "@/lib/setup/actions";
import { FIRST_RUN_ADDRESS_PATH } from "@/lib/setup/first-run-stage";
import { normalizeCountryCode } from "@/lib/setup/locale-catalogue";
import {
  OnboardingFieldError,
  useFocusOnboardingError,
} from "./focus-onboarding-error";
import { OnboardingActions, OnboardingSurface } from "./OnboardingSurface";
import type { SetupState } from "./types";

const fieldClass = "min-h-11 text-base";

export function BusinessIdentityStep({ state }: { state: SetupState }) {
  const router = useRouter();
  const settings = state.settings;
  const [tradingName, setTradingName] = useState(
    settings?.trading_name?.trim() || state.organisationName || ""
  );
  const [legalName, setLegalName] = useState(settings?.legal_name ?? "");
  const [contactEmail, setContactEmail] = useState(settings?.contact_email ?? "");
  const [contactPhone, setContactPhone] = useState(settings?.contact_phone ?? "");
  const [website, setWebsite] = useState(settings?.website ?? "");
  const [country, setCountry] = useState(
    normalizeCountryCode(settings?.country) ?? ""
  );
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
    const result = await saveBusinessIdentity({
      tradingName,
      legalName,
      contactEmail,
      contactPhone,
      website,
      country,
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
    router.push(FIRST_RUN_ADDRESS_PATH);
  }

  return (
    <OnboardingSurface
      mode="basics"
      title="Your business"
      description="Your trading name is the name clients normally see."
    >
      <form data-onboarding-form onSubmit={handleSubmit} className="space-y-4">
        {error ? (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        ) : null}
        <div className="space-y-1.5">
          <Label htmlFor="trading-name">Trading name</Label>
          <Input
            id="trading-name"
            name="tradingName"
            autoComplete="organization"
            value={tradingName}
            onChange={(event) => setTradingName(event.target.value)}
            className={fieldClass}
            aria-invalid={Boolean(fieldErrors.tradingName)}
          />
          <OnboardingFieldError id="trading-name" message={fieldErrors.tradingName?.[0]} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="legal-name">Legal name (optional)</Label>
          <Input
            id="legal-name"
            name="legalName"
            value={legalName}
            onChange={(event) => setLegalName(event.target.value)}
            className={fieldClass}
            aria-invalid={Boolean(fieldErrors.legalName)}
          />
          <OnboardingFieldError id="legal-name" message={fieldErrors.legalName?.[0]} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="business-email">Business email</Label>
          <Input
            id="business-email"
            name="contactEmail"
            type="email"
            autoComplete="email"
            inputMode="email"
            value={contactEmail}
            onChange={(event) => setContactEmail(event.target.value)}
            className={fieldClass}
            aria-invalid={Boolean(fieldErrors.contactEmail)}
          />
          <OnboardingFieldError id="business-email" message={fieldErrors.contactEmail?.[0]} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="business-phone">Phone</Label>
          <Input
            id="business-phone"
            name="contactPhone"
            type="tel"
            autoComplete="tel"
            inputMode="tel"
            value={contactPhone}
            onChange={(event) => setContactPhone(event.target.value)}
            className={fieldClass}
            aria-invalid={Boolean(fieldErrors.contactPhone)}
          />
          <OnboardingFieldError id="business-phone" message={fieldErrors.contactPhone?.[0]} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="website">Website (optional)</Label>
          <Input
            id="website"
            name="website"
            type="text"
            inputMode="url"
            autoComplete="url"
            value={website}
            onChange={(event) => setWebsite(event.target.value)}
            className={fieldClass}
            aria-invalid={Boolean(fieldErrors.website)}
          />
          <OnboardingFieldError id="website" message={fieldErrors.website?.[0]} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="country">Country</Label>
          <select
            id="country"
            name="country"
            value={country}
            onChange={(event) => setCountry(event.target.value)}
            aria-invalid={Boolean(fieldErrors.country)}
            className="flex min-h-11 w-full min-w-0 rounded-xl border border-border/80 bg-background px-3 text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <option value="">Choose a country</option>
            <option value="NZ">New Zealand</option>
            <option value="AU">Australia</option>
          </select>
          <OnboardingFieldError id="country" message={fieldErrors.country?.[0]} />
        </div>
        <OnboardingActions pending={saving} />
      </form>
    </OnboardingSurface>
  );
}
