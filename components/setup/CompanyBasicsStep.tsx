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
import type { CompanyBasicsInput, SetupState } from "./types";

type CompanyBasicsStepProps = {
  state: SetupState;
  /** After save: go to dashboard (first-run) or continue wizard. */
  mode?: "first-run" | "wizard";
  onContinueWizard?: () => void;
};

export function CompanyBasicsStep({
  state,
  mode = "first-run",
  onContinueWizard,
}: CompanyBasicsStepProps) {
  const router = useRouter();
  const settings = state.settings;

  const [currency, setCurrency] = useState(settings?.currency ?? "NZD");
  const [country, setCountry] = useState(settings?.country ?? "NZ");
  const [region, setRegion] = useState(settings?.region ?? "");
  const [gstRate, setGstRate] = useState(
    String(settings?.default_gst_rate ?? 15)
  );
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [saving, setSaving] = useState(false);

  async function persistBasics(): Promise<boolean> {
    setError(null);
    setFieldErrors({});
    setSaving(true);

    const input: CompanyBasicsInput = {
      currency,
      country,
      region: region || undefined,
      default_gst_rate: Number(gstRate),
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

  async function handleContinueToQuotr(event: React.FormEvent) {
    event.preventDefault();
    const ok = await persistBasics();
    if (!ok) return;
    router.push("/app/dashboard");
    router.refresh();
  }

  async function handleContinueWizard(event: React.MouseEvent) {
    event.preventDefault();
    const ok = await persistBasics();
    if (!ok) return;
    onContinueWizard?.();
  }

  return (
    <Card>
      <CardHeader className="pb-4">
        <CardTitle className="text-xl">Set up your company</CardTitle>
        <CardDescription>
          Quotr uses these details to tailor estimates and quotes. You can change
          them later in Company settings.
        </CardDescription>
      </CardHeader>
      <form onSubmit={handleContinueToQuotr} className="flex flex-col">
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
              From your account signup. Update trading/legal names anytime in
              Company settings.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="basics-currency">Currency</Label>
              <Input
                id="basics-currency"
                value={currency}
                onChange={(event) => setCurrency(event.target.value)}
                placeholder="NZD"
                required
                className="h-11"
                autoComplete="off"
              />
              {fieldErrors.currency?.[0] ? (
                <p className="text-sm text-destructive">
                  {fieldErrors.currency[0]}
                </p>
              ) : null}
            </div>
            <div className="space-y-2">
              <Label htmlFor="basics-country">Country</Label>
              <Input
                id="basics-country"
                value={country}
                onChange={(event) => setCountry(event.target.value)}
                placeholder="NZ"
                required
                className="h-11"
                autoComplete="country"
              />
              {fieldErrors.country?.[0] ? (
                <p className="text-sm text-destructive">
                  {fieldErrors.country[0]}
                </p>
              ) : null}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="basics-region">Region</Label>
            <Input
              id="basics-region"
              value={region}
              onChange={(event) => setRegion(event.target.value)}
              placeholder="e.g. Auckland"
              className="h-11"
            />
            <p className="text-xs text-muted-foreground">
              Optional — helps local context for estimates.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="basics-gst">Default GST rate (%)</Label>
            <Input
              id="basics-gst"
              type="number"
              inputMode="decimal"
              min="0"
              max="100"
              step="0.01"
              value={gstRate}
              onChange={(event) => setGstRate(event.target.value)}
              required
              className="h-11"
            />
            {fieldErrors.default_gst_rate?.[0] ? (
              <p className="text-sm text-destructive">
                {fieldErrors.default_gst_rate[0]}
              </p>
            ) : null}
            <p className="text-xs text-muted-foreground">
              New Zealand default is 15%. Use 0 if you do not charge GST.
            </p>
          </div>
        </CardContent>
        <CardFooter className="flex flex-col gap-3 border-t sm:flex-row sm:justify-end">
          {mode === "wizard" && onContinueWizard ? (
            <Button
              type="button"
              variant="outline"
              className="h-11 w-full sm:w-auto"
              disabled={saving}
              onClick={handleContinueWizard}
            >
              {saving ? "Saving…" : "Save and continue setup"}
            </Button>
          ) : null}
          <Button type="submit" className="h-11 w-full sm:w-auto" disabled={saving}>
            {saving ? "Saving…" : "Continue to Quotr"}
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}
