"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { completeSetup } from "@/lib/setup/actions";
import type { SetupState } from "./types";

type ReviewStepProps = {
  state: SetupState;
  onBack: () => void;
  onComplete: () => void;
};

export function ReviewStep({ state, onBack, onComplete }: ReviewStepProps) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [justCompleted, setJustCompleted] = useState(false);

  const settings = state.settings;
  const enabledWorkAreas = state.workAreas.filter((area) => area.enabled);
  const ratesWithValues = state.rates.filter(
    (rate) =>
      rate.cost_rate != null ||
      rate.sell_rate != null ||
      rate.markup_percent != null
  );
  const isCompleted =
    settings?.onboarding_status === "completed" || justCompleted;

  async function handleComplete() {
    setError(null);
    setSaving(true);

    const result = await completeSetup();
    setSaving(false);

    if (result.error) {
      setError(result.error);
      return;
    }

    setJustCompleted(true);
    onComplete();
    router.refresh();
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Review</CardTitle>
        <CardDescription>
          Check your setup summary. You can return here anytime to update your
          preferences.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {justCompleted ? (
          <p className="rounded-lg border border-primary/20 bg-primary/5 px-3 py-2 text-sm text-foreground">
            Setup marked complete. Quotr will use your preferences when preparing
            estimates.
          </p>
        ) : null}

        {error ? (
          <p className="rounded-lg border border-destructive/20 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </p>
        ) : null}

        <section className="space-y-2">
          <h3 className="text-sm font-medium">Setup status</h3>
          <Badge variant={isCompleted ? "default" : "secondary"}>
            {isCompleted ? "Complete" : "Incomplete"}
          </Badge>
        </section>

        <Separator />

        <section className="space-y-2">
          <h3 className="text-sm font-medium">Company</h3>
          <p className="text-sm text-muted-foreground">{state.organisationName}</p>
          {settings ? (
            <dl className="grid gap-2 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-muted-foreground">Currency</dt>
                <dd>{settings.currency}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Country</dt>
                <dd>
                  {settings.country}
                  {settings.region ? ` · ${settings.region}` : ""}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Default margin</dt>
                <dd>{settings.default_margin_percent}%</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Default contingency</dt>
                <dd>{settings.default_contingency_percent}%</dd>
              </div>
            </dl>
          ) : (
            <p className="text-sm text-muted-foreground">
              Company defaults not saved yet.
            </p>
          )}
        </section>

        <Separator />

        <section className="space-y-2">
          <h3 className="text-sm font-medium">
            Enabled work areas ({enabledWorkAreas.length})
          </h3>
          {enabledWorkAreas.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {enabledWorkAreas.map((area) => (
                <Badge key={area.id} variant="secondary">
                  {area.label}
                </Badge>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              No work areas selected yet.
            </p>
          )}
        </section>

        <Separator />

        <section className="space-y-2">
          <h3 className="text-sm font-medium">Starter rates</h3>
          <p className="text-sm text-muted-foreground">
            {ratesWithValues.length} starter rate
            {ratesWithValues.length === 1 ? "" : "s"} entered
            {enabledWorkAreas.length > 0
              ? ` across ${enabledWorkAreas.length} enabled work area${
                  enabledWorkAreas.length === 1 ? "" : "s"
                }`
              : ""}
          </p>
          <p className="text-sm text-muted-foreground">
            Benchmark rates allowed:{" "}
            {settings?.allow_benchmark_rates ? "Yes" : "No"}
          </p>
        </section>
      </CardContent>
      <CardFooter className="flex flex-col gap-3 border-t sm:flex-row sm:justify-between">
        <Button type="button" variant="outline" onClick={onBack} disabled={saving}>
          Back
        </Button>
        <div className="flex flex-col gap-2 sm:flex-row">
          {!isCompleted ? (
            <Button type="button" onClick={handleComplete} disabled={saving}>
              {saving ? "Saving…" : "Mark setup complete"}
            </Button>
          ) : (
            <Button render={<Link href="/app/dashboard" />}>Go to dashboard</Button>
          )}
        </div>
      </CardFooter>
    </Card>
  );
}
