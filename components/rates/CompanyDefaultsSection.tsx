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
import { saveRateSettings } from "@/lib/rates/actions";
import type { RateSettingsInput } from "@/lib/rates/types";
import type { OrganisationSettings } from "@/components/setup/types";

type CompanyDefaultsSectionProps = {
  settings: OrganisationSettings | null;
  onSettingsChange: (settings: OrganisationSettings) => void;
};

export function CompanyDefaultsSection({
  settings,
  onSettingsChange,
}: CompanyDefaultsSectionProps) {
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
  const [notice, setNotice] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setFieldErrors({});
    setNotice(null);
    setSaving(true);

    const input: RateSettingsInput = {
      default_margin_percent: Number(margin),
      default_contingency_percent: Number(contingency),
      budget_rate_factor: Number(budgetFactor),
      premium_rate_factor: Number(premiumFactor),
      prefer_user_rates: preferUserRates,
      allow_benchmark_rates: allowBenchmarkRates,
      show_profit_in_estimates: showProfit,
    };

    const result = await saveRateSettings(input);
    setSaving(false);

    if (result.error) {
      setError(result.error);
      return;
    }

    if (result.fieldErrors) {
      setFieldErrors(result.fieldErrors);
      return;
    }

    if (settings) {
      onSettingsChange({ ...settings, ...input });
    }

    setNotice(
      "Changing these settings affects future estimates and regenerated estimates. Existing estimates will not change until regenerated."
    );
  }

  return (
    <Card className="border-border/60 shadow-none">
      <CardHeader>
        <CardTitle>Company defaults</CardTitle>
        <CardDescription>
          Default margin and estimating preferences used across new estimates.
        </CardDescription>
      </CardHeader>
      <form onSubmit={handleSubmit}>
        <CardContent className="space-y-6">
          {error ? (
            <p className="rounded-lg border border-destructive/20 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </p>
          ) : null}

          {notice ? (
            <p className="rounded-lg border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
              {notice}
            </p>
          ) : null}

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-2">
              <Label htmlFor="default-margin">Default margin %</Label>
              <Input
                id="default-margin"
                type="number"
                min="0"
                max="80"
                step="0.1"
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
              <Label htmlFor="default-contingency">Default contingency %</Label>
              <Input
                id="default-contingency"
                type="number"
                min="0"
                max="30"
                step="0.1"
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

            <div className="space-y-2">
              <Label htmlFor="budget-factor">Budget factor</Label>
              <Input
                id="budget-factor"
                type="number"
                min="0.5"
                max="1"
                step="0.01"
                value={budgetFactor}
                onChange={(event) => setBudgetFactor(event.target.value)}
                required
              />
              {fieldErrors.budget_rate_factor?.[0] ? (
                <p className="text-sm text-destructive">
                  {fieldErrors.budget_rate_factor[0]}
                </p>
              ) : null}
            </div>

            <div className="space-y-2">
              <Label htmlFor="premium-factor">Premium factor</Label>
              <Input
                id="premium-factor"
                type="number"
                min="1"
                max="2"
                step="0.01"
                value={premiumFactor}
                onChange={(event) => setPremiumFactor(event.target.value)}
                required
              />
              {fieldErrors.premium_rate_factor?.[0] ? (
                <p className="text-sm text-destructive">
                  {fieldErrors.premium_rate_factor[0]}
                </p>
              ) : null}
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-start gap-2">
              <Checkbox
                id="prefer-user-rates"
                checked={preferUserRates}
                onCheckedChange={(checked) =>
                  setPreferUserRates(checked === true)
                }
              />
              <div>
                <Label htmlFor="prefer-user-rates" className="font-normal">
                  Use my rates where available
                </Label>
                <p className="text-xs text-muted-foreground">
                  Your saved rates take priority over benchmark allowances.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-2">
              <Checkbox
                id="allow-benchmark-rates"
                checked={allowBenchmarkRates}
                onCheckedChange={(checked) =>
                  setAllowBenchmarkRates(checked === true)
                }
              />
              <div>
                <Label htmlFor="allow-benchmark-rates" className="font-normal">
                  Allow benchmark fallback rates
                </Label>
                <p className="text-xs text-muted-foreground">
                  When a rate is missing, Quotr can still estimate using
                  benchmark allowances.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-2">
              <Checkbox
                id="show-profit"
                checked={showProfit}
                onCheckedChange={(checked) => setShowProfit(checked === true)}
              />
              <div>
                <Label htmlFor="show-profit" className="font-normal">
                  Show profit in estimates
                </Label>
              </div>
            </div>
          </div>
        </CardContent>
        <CardFooter className="border-t">
          <Button type="submit" disabled={saving}>
            {saving ? "Saving…" : "Save defaults"}
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}
