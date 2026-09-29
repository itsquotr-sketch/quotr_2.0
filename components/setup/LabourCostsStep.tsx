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
import { saveRequiredLabourCosts } from "@/lib/setup/actions";
import {
  CARPENTER_LABOUR_RATE_KEY,
  LABOURER_LABOUR_RATE_KEY,
} from "@/lib/estimate/labour-trade-mapping";
import type { SetupState } from "./types";

function existingCost(state: SetupState, itemKey: string): string {
  const row = state.rates.find(
    (rate) => rate.item_key === itemKey && rate.cost_rate != null
  );
  return row?.cost_rate != null ? String(row.cost_rate) : "";
}

export function LabourCostsStep({ state }: { state: SetupState }) {
  const router = useRouter();
  const currency = state.settings?.currency === "AUD" ? "AUD" : "NZD";
  const [carpenterCost, setCarpenterCost] = useState(
    existingCost(state, CARPENTER_LABOUR_RATE_KEY)
  );
  const [labourerCost, setLabourerCost] = useState(
    existingCost(state, LABOURER_LABOUR_RATE_KEY)
  );
  const [targetMarginPercent, setTargetMarginPercent] = useState(
    state.settings?.default_margin_percent != null
      ? String(state.settings.default_margin_percent)
      : ""
  );
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [saving, setSaving] = useState(false);
  const errorSignature = [
    error ?? "",
    ...Object.entries(fieldErrors).map(
      ([key, messages]) => `${key}:${messages[0] ?? ""}`
    ),
  ].join("|");
  useFocusOnboardingError(errorSignature);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setFieldErrors({});
    setSaving(true);
    const result = await saveRequiredLabourCosts({
      carpenterCost,
      labourerCost,
      targetMarginPercent,
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
    router.replace("/app/setup?mode=ready");
  }

  return (
    <Card>
      <CardHeader className="pb-4">
        <CardTitle className="text-xl">Internal labour costs</CardTitle>
        <CardDescription>
          Costs to the business, excluding GST. These are not client
          charge-out rates.
        </CardDescription>
      </CardHeader>
      <form
        onSubmit={handleSubmit}
        data-onboarding-form=""
        className="flex flex-col"
      >
        <CardContent className="space-y-5">
          <p className="rounded-lg border border-border/60 bg-muted/20 px-3 py-2.5 text-sm leading-snug text-muted-foreground">
            Labour costs are what an hour costs your business, excluding GST.
            They are not the rates you charge clients. The default gross margin
            is used to calculate client pricing and can be changed later for
            individual pricing where supported.
          </p>
          {error ? (
            <p role="alert" className="rounded-lg border border-destructive/20 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </p>
          ) : null}
          <div className="space-y-2">
            <Label htmlFor="labour-carpenter">Carpenter internal cost per hour ({currency})</Label>
            <Input
              id="labour-carpenter"
              inputMode="decimal"
              value={carpenterCost}
              onChange={(event) => setCarpenterCost(event.target.value)}
              required
              className="h-11"
            />
            <OnboardingFieldError
              id="labour-carpenter"
              message={fieldErrors.carpenterCost?.[0]}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="labour-labourer">Labourer internal cost per hour ({currency})</Label>
            <Input
              id="labour-labourer"
              inputMode="decimal"
              value={labourerCost}
              onChange={(event) => setLabourerCost(event.target.value)}
              required
              className="h-11"
            />
            <OnboardingFieldError
              id="labour-labourer"
              message={fieldErrors.labourerCost?.[0]}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="labour-margin">Default target gross margin %</Label>
            <Input
              id="labour-margin"
              inputMode="decimal"
              value={targetMarginPercent}
              onChange={(event) => setTargetMarginPercent(event.target.value)}
              required
              className="h-11"
            />
            <OnboardingFieldError
              id="labour-margin"
              message={fieldErrors.targetMarginPercent?.[0]}
            />
          </div>
        </CardContent>
        <CardFooter className="border-t">
          <Button
            id="labour-continue"
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
