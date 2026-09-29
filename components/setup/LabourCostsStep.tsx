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
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [saving, setSaving] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setFieldErrors({});
    setSaving(true);
    const result = await saveRequiredLabourCosts({ carpenterCost, labourerCost });
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
          What an hour of each role costs your business. These are not the
          rates you charge clients.
        </CardDescription>
      </CardHeader>
      <form onSubmit={handleSubmit} className="flex flex-col">
        <CardContent className="space-y-5">
          <p className="rounded-lg border border-border/60 bg-muted/20 px-3 py-2.5 text-sm leading-snug text-muted-foreground">
            Enter internal hourly costs excluding GST
            {state.settings?.country === "AU" ? "" : " where GST applies"}.
            Quotr uses them as cost. Client charge-out still comes from your
            margin, which you can set later under Rates.
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
            {fieldErrors.carpenterCost?.[0] ? (
              <p className="text-sm text-destructive">{fieldErrors.carpenterCost[0]}</p>
            ) : null}
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
            {fieldErrors.labourerCost?.[0] ? (
              <p className="text-sm text-destructive">{fieldErrors.labourerCost[0]}</p>
            ) : null}
          </div>
        </CardContent>
        <CardFooter className="border-t">
          <Button type="submit" className="h-11 w-full sm:w-auto" disabled={saving}>
            {saving ? "Saving…" : "Continue"}
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}
