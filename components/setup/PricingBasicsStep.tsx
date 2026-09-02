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
import { savePricingBasics } from "@/lib/setup/actions";
import { PRICING_BASICS_DEFAULT_MARGIN } from "@/lib/setup/pricing-basics";
import type { SetupState } from "./types";

type PricingBasicsStepProps = {
  state: SetupState;
};

export function PricingBasicsStep({ state }: PricingBasicsStepProps) {
  const router = useRouter();
  const existingLabour = state.rates.find(
    (rate) => rate.item_key === "labour.carpenter.hour" && rate.cost_rate != null
  );
  const [labourCost, setLabourCost] = useState(
    existingLabour?.cost_rate != null ? String(existingLabour.cost_rate) : ""
  );
  const [margin, setMargin] = useState(
    String(state.settings?.default_margin_percent ?? PRICING_BASICS_DEFAULT_MARGIN)
  );
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [saving, setSaving] = useState(false);

  async function persist(options: { skipAll: boolean }) {
    setError(null);
    setFieldErrors({});
    setSaving(true);
    const result = await savePricingBasics(
      options.skipAll
        ? { skipLabour: true, skipMargin: true }
        : {
            labourCost,
            targetMarginPercent: margin,
          }
    );
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

  async function handleContinue(event: React.FormEvent) {
    event.preventDefault();
    const ok = await persist({ skipAll: false });
    if (!ok) return;
    router.replace("/app/setup?mode=ready");
  }

  async function handleSkip() {
    const ok = await persist({ skipAll: true });
    if (!ok) return;
    router.replace("/app/setup?mode=ready");
  }

  const currency = state.settings?.currency ?? "NZD";

  return (
    <Card>
      <CardHeader className="pb-4">
        <CardTitle className="text-xl">Your pricing basics</CardTitle>
        <CardDescription>
          Optional. Tell Quotr how you normally price labour. You can change
          this later.
        </CardDescription>
      </CardHeader>
      <form onSubmit={handleContinue} className="flex flex-col">
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
            <Label htmlFor="pricing-labour-cost">
              What do you cost your own labour at?
            </Label>
            <div className="flex items-center gap-2">
              <Input
                id="pricing-labour-cost"
                type="number"
                inputMode="decimal"
                min="1"
                step="0.01"
                value={labourCost}
                onChange={(event) => setLabourCost(event.target.value)}
                placeholder="e.g. 60"
                className="h-11"
                aria-describedby="pricing-labour-help"
              />
              <span className="shrink-0 text-sm text-muted-foreground">
                {currency} / hour
              </span>
            </div>
            {fieldErrors.labourCost?.[0] ? (
              <p className="text-sm text-destructive">{fieldErrors.labourCost[0]}</p>
            ) : null}
            <p id="pricing-labour-help" className="text-xs text-muted-foreground">
              Use what an hour of your labour costs the business. You can change
              this later.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="pricing-margin">Your target gross margin</Label>
            <div className="flex items-center gap-2">
              <Input
                id="pricing-margin"
                type="number"
                inputMode="decimal"
                min="0"
                max="95"
                step="0.1"
                value={margin}
                onChange={(event) => setMargin(event.target.value)}
                className="h-11"
                aria-describedby="pricing-margin-help"
              />
              <span className="shrink-0 text-sm text-muted-foreground">%</span>
            </div>
            {fieldErrors.targetMarginPercent?.[0] ? (
              <p className="text-sm text-destructive">
                {fieldErrors.targetMarginPercent[0]}
              </p>
            ) : null}
            <p id="pricing-margin-help" className="text-xs text-muted-foreground">
              Quotr prices from cost so your sell price keeps this target
              margin. Default is {PRICING_BASICS_DEFAULT_MARGIN}%.
            </p>
          </div>
        </CardContent>
        <CardFooter className="flex flex-col gap-3 border-t sm:flex-row sm:justify-end">
          <Button
            type="button"
            variant="ghost"
            className="h-11 w-full sm:w-auto"
            disabled={saving}
            onClick={() => void handleSkip()}
          >
            Skip for now
          </Button>
          <Button type="submit" className="h-11 w-full sm:w-auto" disabled={saving}>
            {saving ? "Saving…" : "Continue"}
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}
