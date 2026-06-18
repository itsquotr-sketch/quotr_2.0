"use client";

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
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { saveCompanyDefaults } from "@/lib/setup/actions";
import type { CompanyDefaultsInput, SetupState } from "./types";

type CompanyDefaultsStepProps = {
  state: SetupState;
  onComplete: () => void;
};

export function CompanyDefaultsStep({ state, onComplete }: CompanyDefaultsStepProps) {
  const settings = state.settings;

  const [currency, setCurrency] = useState(settings?.currency ?? "NZD");
  const [country, setCountry] = useState(settings?.country ?? "NZ");
  const [region, setRegion] = useState(settings?.region ?? "");
  const [margin, setMargin] = useState(
    String(settings?.default_margin_percent ?? 25)
  );
  const [contingency, setContingency] = useState(
    String(settings?.default_contingency_percent ?? 10)
  );
  const [budgetFactor, setBudgetFactor] = useState(
    String(settings?.budget_rate_factor ?? 0.9)
  );
  const [premiumFactor, setPremiumFactor] = useState(
    String(settings?.premium_rate_factor ?? 1.15)
  );
  const [preferUserRates, setPreferUserRates] = useState(
    settings?.prefer_user_rates ?? true
  );
  const [allowBenchmarkRates, setAllowBenchmarkRates] = useState(
    settings?.allow_benchmark_rates ?? true
  );
  const [showProfit, setShowProfit] = useState(
    settings?.show_profit_in_estimates ?? true
  );
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [saving, setSaving] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setFieldErrors({});
    setSaving(true);

    const input: CompanyDefaultsInput = {
      currency,
      country,
      region: region || undefined,
      default_margin_percent: Number(margin),
      default_contingency_percent: Number(contingency),
      budget_rate_factor: Number(budgetFactor),
      premium_rate_factor: Number(premiumFactor),
      prefer_user_rates: preferUserRates,
      allow_benchmark_rates: allowBenchmarkRates,
      show_profit_in_estimates: showProfit,
    };

    const result = await saveCompanyDefaults(input);
    setSaving(false);

    if (result.error) {
      setError(result.error);
      return;
    }

    if (result.fieldErrors) {
      setFieldErrors(result.fieldErrors);
      return;
    }

    onComplete();
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Company defaults</CardTitle>
        <CardDescription>
          These settings help Quotr price jobs using your normal commercial
          assumptions.
        </CardDescription>
      </CardHeader>
      <form onSubmit={handleSubmit}>
        <CardContent className="space-y-6">
          {error ? (
            <p className="rounded-lg border border-destructive/20 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </p>
          ) : null}

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="currency">Currency</Label>
              <Input
                id="currency"
                value={currency}
                onChange={(event) => setCurrency(event.target.value)}
                placeholder="NZD"
                required
              />
              {fieldErrors.currency?.[0] ? (
                <p className="text-sm text-destructive">{fieldErrors.currency[0]}</p>
              ) : null}
            </div>
            <div className="space-y-2">
              <Label htmlFor="country">Country</Label>
              <Input
                id="country"
                value={country}
                onChange={(event) => setCountry(event.target.value)}
                placeholder="NZ"
                required
              />
              {fieldErrors.country?.[0] ? (
                <p className="text-sm text-destructive">{fieldErrors.country[0]}</p>
              ) : null}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="region">Region (optional)</Label>
            <Input
              id="region"
              value={region}
              onChange={(event) => setRegion(event.target.value)}
              placeholder="e.g. Auckland"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="margin">Default margin %</Label>
              <Input
                id="margin"
                type="number"
                min="0"
                max="100"
                step="0.01"
                value={margin}
                onChange={(event) => setMargin(event.target.value)}
                required
              />
              {fieldErrors.default_margin_percent?.[0] ? (
                <p className="text-sm text-destructive">
                  {fieldErrors.default_margin_percent[0]}
                </p>
              ) : null}
            </div>
            <div className="space-y-2">
              <Label htmlFor="contingency">Default contingency %</Label>
              <Input
                id="contingency"
                type="number"
                min="0"
                max="100"
                step="0.01"
                value={contingency}
                onChange={(event) => setContingency(event.target.value)}
                required
              />
              {fieldErrors.default_contingency_percent?.[0] ? (
                <p className="text-sm text-destructive">
                  {fieldErrors.default_contingency_percent[0]}
                </p>
              ) : null}
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="budget-factor">Budget rate factor</Label>
              <Input
                id="budget-factor"
                type="number"
                min="0.001"
                max="1"
                step="0.001"
                value={budgetFactor}
                onChange={(event) => setBudgetFactor(event.target.value)}
                required
              />
              <p className="text-xs text-muted-foreground">
                Used when only standard rates are set (default 0.900).
              </p>
              {fieldErrors.budget_rate_factor?.[0] ? (
                <p className="text-sm text-destructive">
                  {fieldErrors.budget_rate_factor[0]}
                </p>
              ) : null}
            </div>
            <div className="space-y-2">
              <Label htmlFor="premium-factor">Premium rate factor</Label>
              <Input
                id="premium-factor"
                type="number"
                min="1"
                max="2"
                step="0.001"
                value={premiumFactor}
                onChange={(event) => setPremiumFactor(event.target.value)}
                required
              />
              <p className="text-xs text-muted-foreground">
                Used when only standard rates are set (default 1.150).
              </p>
              {fieldErrors.premium_rate_factor?.[0] ? (
                <p className="text-sm text-destructive">
                  {fieldErrors.premium_rate_factor[0]}
                </p>
              ) : null}
            </div>
          </div>

          <div className="space-y-3">
            <label className="flex items-start gap-3">
              <Checkbox
                checked={preferUserRates}
                onCheckedChange={(checked) =>
                  setPreferUserRates(checked === true)
                }
              />
              <span className="text-sm">Prefer my rates when estimating</span>
            </label>
            <label className="flex items-start gap-3">
              <Checkbox
                checked={allowBenchmarkRates}
                onCheckedChange={(checked) =>
                  setAllowBenchmarkRates(checked === true)
                }
              />
              <span className="text-sm">
                Allow benchmark rates when my rates are missing
              </span>
            </label>
            <label className="flex items-start gap-3">
              <Checkbox
                checked={showProfit}
                onCheckedChange={(checked) => setShowProfit(checked === true)}
              />
              <span className="text-sm">Show profit in estimates</span>
            </label>
          </div>
        </CardContent>
        <CardFooter className="justify-end border-t">
          <Button type="submit" disabled={saving}>
            {saving ? "Saving…" : "Save and continue"}
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}
