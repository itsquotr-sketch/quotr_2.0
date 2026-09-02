"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
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
import { saveCompanyBasics } from "@/lib/setup/actions";
import {
  COMPANY_COUNTRIES,
  COMPANY_CURRENCIES,
  getCountryOption,
  resolveCountryForForm,
  resolveCurrencyForForm,
} from "@/lib/setup/locale-catalogue";
import {
  gstRateFromRegisteredChoice,
  gstRegisteredFromRate,
  type GstRegisteredChoice,
} from "@/lib/setup/gst-registered";
import type { CompanyBasicsInput, SetupState } from "./types";

export type CompanyBasicsMode = "basics" | "optional";

type CompanyBasicsStepProps = {
  state: SetupState;
  /**
   * basics — first-run gate: save → pricing basics
   * optional — Setup improve: save stays in Setup (parent callback)
   */
  mode?: CompanyBasicsMode;
  /** Called after successful save in optional mode (no Dashboard redirect). */
  onSaved?: () => void;
};

const selectClassName =
  "flex h-11 w-full rounded-lg border border-input bg-transparent px-3 py-2 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-input/30";

export function CompanyBasicsStep({
  state,
  mode = "basics",
  onSaved,
}: CompanyBasicsStepProps) {
  const router = useRouter();
  const settings = state.settings;

  const initialCountry = resolveCountryForForm(settings?.country);
  const initialCurrency = resolveCurrencyForForm(
    settings?.currency,
    getCountryOption(initialCountry)?.suggestedCurrency ?? "NZD"
  );
  const suggestedGst =
    getCountryOption(initialCountry)?.suggestedGstPercent ?? 15;
  const derivedRegistered = gstRegisteredFromRate(settings?.default_gst_rate);

  const [country, setCountry] = useState(initialCountry);
  const [currency, setCurrency] = useState(initialCurrency);
  const [currencyTouched, setCurrencyTouched] = useState(false);
  const [region, setRegion] = useState(settings?.region ?? "");
  const [gstRegistered, setGstRegistered] = useState<GstRegisteredChoice | "">(
    derivedRegistered ?? ""
  );
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [saving, setSaving] = useState(false);

  function handleCountryChange(nextCountry: string) {
    setCountry(nextCountry);
    const option = getCountryOption(nextCountry);
    if (!option) return;
    if (!currencyTouched) {
      setCurrency(option.suggestedCurrency);
    }
  }

  async function persistBasics(): Promise<boolean> {
    setError(null);
    setFieldErrors({});

    if (gstRegistered !== "yes" && gstRegistered !== "no") {
      setFieldErrors({
        gst_registered: ["Choose whether you are GST registered."],
      });
      return false;
    }

    setSaving(true);
    const countryOption = getCountryOption(country);
    const input: CompanyBasicsInput = {
      currency,
      country,
      region: region || undefined,
      default_gst_rate: gstRateFromRegisteredChoice(
        gstRegistered,
        countryOption?.suggestedGstPercent ?? suggestedGst
      ),
    };

    const result = await saveCompanyBasics(input);
    setSaving(false);

    if (result.error) {
      setError(result.error);
      return false;
    }
    if (result.fieldErrors) {
      setFieldErrors(result.fieldErrors);
      return false;
    }
    return true;
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const ok = await persistBasics();
    if (!ok) return;

    if (mode === "basics") {
      router.push("/app/setup?mode=pricing");
      router.refresh();
      return;
    }

    onSaved?.();
    router.refresh();
  }

  const isBasicsGate = mode === "basics";

  return (
    <Card>
      <CardHeader className="pb-4">
        <CardTitle className="text-xl">
          {isBasicsGate ? "Welcome to Quotr" : "Company basics"}
        </CardTitle>
        <CardDescription>
          {isBasicsGate
            ? "A few company details so quotes use the right currency and tax."
            : "Update country, currency, and tax. Changes apply to new pricing and quotes."}
        </CardDescription>
      </CardHeader>
      <form onSubmit={handleSubmit} className="flex flex-col">
        <CardContent className="space-y-5">
          {error ? (
            <p
              role="alert"
              className="rounded-lg border border-destructive/20 bg-destructive/10 px-3 py-2 text-sm text-destructive"
            >
              {error}
            </p>
          ) : null}

          <div className="space-y-2">
            <Label htmlFor="company-name-display">Company name</Label>
            <Input
              id="company-name-display"
              value={state.organisationName}
              readOnly
              className="h-11 bg-muted/40"
            />
            <p className="text-xs text-muted-foreground">
              From your account signup. Update trading/legal names in Company
              settings.
            </p>
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
            {fieldErrors.country?.[0] ? (
              <p className="text-sm text-destructive">
                {fieldErrors.country[0]}
              </p>
            ) : null}
          </div>

          <div className="space-y-2">
            <Label htmlFor="basics-currency">Currency</Label>
            <select
              id="basics-currency"
              value={currency}
              onChange={(event) => {
                setCurrencyTouched(true);
                setCurrency(event.target.value);
              }}
              required
              className={selectClassName}
            >
              {COMPANY_CURRENCIES.map((option) => (
                <option key={option.code} value={option.code}>
                  {option.label}
                </option>
              ))}
            </select>
            {fieldErrors.currency?.[0] ? (
              <p className="text-sm text-destructive">
                {fieldErrors.currency[0]}
              </p>
            ) : null}
            <p className="text-xs text-muted-foreground">
              Suggested from country — you can override if needed.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="basics-region">Region (optional)</Label>
            <Input
              id="basics-region"
              value={region}
              onChange={(event) => setRegion(event.target.value)}
              placeholder="e.g. Auckland"
              className="h-11"
            />
          </div>

          <fieldset className="space-y-3">
            <legend className="text-sm font-medium leading-none">
              Are you GST registered?
            </legend>
            <div className="flex flex-col gap-2 sm:flex-row">
              <label className="flex h-11 cursor-pointer items-center gap-2 rounded-lg border border-input px-3 text-sm has-[:checked]:border-ring has-[:checked]:ring-3 has-[:checked]:ring-ring/50">
                <input
                  type="radio"
                  name="gst_registered"
                  value="yes"
                  checked={gstRegistered === "yes"}
                  onChange={() => setGstRegistered("yes")}
                  className="size-4"
                />
                Yes
              </label>
              <label className="flex h-11 cursor-pointer items-center gap-2 rounded-lg border border-input px-3 text-sm has-[:checked]:border-ring has-[:checked]:ring-3 has-[:checked]:ring-ring/50">
                <input
                  type="radio"
                  name="gst_registered"
                  value="no"
                  checked={gstRegistered === "no"}
                  onChange={() => setGstRegistered("no")}
                  className="size-4"
                />
                No
              </label>
            </div>
            {fieldErrors.gst_registered?.[0] ? (
              <p className="text-sm text-destructive">
                {fieldErrors.gst_registered[0]}
              </p>
            ) : null}
            {fieldErrors.default_gst_rate?.[0] ? (
              <p className="text-sm text-destructive">
                {fieldErrors.default_gst_rate[0]}
              </p>
            ) : null}
            <p className="text-xs text-muted-foreground">
              {gstRegistered === "no"
                ? "Customer quotes will not add GST. You can change this later in Company settings."
                : gstRegistered === "yes"
                  ? `Customer quotes will use ${getCountryOption(country)?.suggestedGstPercent ?? 15}% GST. You can change the rate later in Company settings.`
                  : "This is for customer quotes only — not your Quotr subscription."}
            </p>
          </fieldset>
        </CardContent>
        <CardFooter className="flex flex-col gap-3 border-t sm:flex-row sm:justify-end">
          <Button type="submit" className="h-11 w-full sm:w-auto" disabled={saving}>
            {saving
              ? "Saving…"
              : isBasicsGate
                ? "Continue"
                : "Save company basics"}
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}
