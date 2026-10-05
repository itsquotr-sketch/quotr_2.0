"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { saveGstRegistration } from "@/lib/setup/actions";
import {
  FIRST_RUN_ADDRESS_PATH,
  FIRST_RUN_WORK_PATH,
} from "@/lib/setup/first-run-stage";
import { getCountryOption, normalizeCountryCode } from "@/lib/setup/locale-catalogue";
import { taxRegistrationCopy } from "@/lib/setup/tax-identifier";
import {
  OnboardingFieldError,
  useFocusOnboardingError,
} from "./focus-onboarding-error";
import { OnboardingActions, OnboardingSurface } from "./OnboardingSurface";
import type { SetupState } from "./types";

function choiceCardClass(selected: boolean) {
  return [
    "flex min-h-11 cursor-pointer items-center gap-3 rounded-lg border px-3 text-sm outline-none",
    "has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-[var(--brand-orange)] has-[:focus-visible]:ring-offset-2",
    selected
      ? "border-[var(--brand-orange)] bg-[var(--brand-orange-muted)]"
      : "border-border bg-background",
  ].join(" ");
}

export function GstRegistrationStep({ state }: { state: SetupState }) {
  const router = useRouter();
  const settings = state.settings;
  const countryCode = normalizeCountryCode(settings?.country) === "AU" ? "AU" : "NZ";
  const copy = taxRegistrationCopy(countryCode);
  const rate = getCountryOption(countryCode)?.suggestedGstPercent ?? (countryCode === "AU" ? 10 : 15);
  const storedChoice =
    settings?.gst_registered === true ? "yes" : settings?.gst_registered === false ? "no" : "";
  const [registered, setRegistered] = useState(storedChoice);
  const [taxIdentifier, setTaxIdentifier] = useState(
    countryCode === "AU" ? (settings?.abn ?? "") : (settings?.gst_number ?? "")
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
    const result = await saveGstRegistration({
      registered,
      taxIdentifier,
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
    router.push(FIRST_RUN_WORK_PATH);
  }

  return (
    <OnboardingSurface
      mode="tax"
      title="GST"
      description="Is your business registered for GST?"
    >
      <form data-onboarding-form onSubmit={handleSubmit} className="space-y-4">
        {error ? (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        ) : null}
        <fieldset className="space-y-2">
          <legend className="sr-only">Is your business registered for GST?</legend>
          <label className={choiceCardClass(registered === "yes")}>
            <input
              type="radio"
              name="registered"
              value="yes"
              checked={registered === "yes"}
              onChange={() => setRegistered("yes")}
              className="size-4 shrink-0"
            />
            Yes, registered
          </label>
          <label className={choiceCardClass(registered === "no")}>
            <input
              type="radio"
              name="registered"
              value="no"
              checked={registered === "no"}
              onChange={() => setRegistered("no")}
              className="size-4 shrink-0"
            />
            No, not registered
          </label>
          <OnboardingFieldError id="registered" message={fieldErrors.registered?.[0]} />
        </fieldset>
        {registered === "yes" ? (
          <div className="space-y-1.5">
            <Label htmlFor="tax-identifier">{copy.identifierLabel}</Label>
            <Input
              id="tax-identifier"
              name="taxIdentifier"
              value={taxIdentifier}
              onChange={(event) => setTaxIdentifier(event.target.value)}
              className="min-h-11 text-base"
              aria-invalid={Boolean(fieldErrors.taxIdentifier)}
            />
            <p className="text-sm text-muted-foreground">{copy.identifierHint}</p>
            <p className="text-sm text-muted-foreground">
              This identifier can appear on client documents. Quotes use the {rate}% GST rate.
            </p>
            <OnboardingFieldError
              id="tax-identifier"
              message={fieldErrors.taxIdentifier?.[0]}
            />
          </div>
        ) : null}
        {registered === "no" ? (
          <p className="text-sm text-muted-foreground">
            GST will not be added to client pricing.
          </p>
        ) : null}
        <OnboardingActions backHref={FIRST_RUN_ADDRESS_PATH} pending={saving} />
      </form>
    </OnboardingSurface>
  );
}
