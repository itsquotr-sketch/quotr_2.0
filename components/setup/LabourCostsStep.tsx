"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  CARPENTER_LABOUR_RATE_KEY,
  LABOURER_LABOUR_RATE_KEY,
} from "@/lib/estimate/labour-trade-mapping";
import { saveRequiredLabourCosts } from "@/lib/setup/actions";
import {
  FIRST_RUN_READY_PATH,
  FIRST_RUN_WORK_PATH,
} from "@/lib/setup/first-run-stage";
import {
  OnboardingFieldError,
  useFocusOnboardingError,
} from "./focus-onboarding-error";
import { OnboardingActions, OnboardingSurface } from "./OnboardingSurface";
import type { SetupState } from "./types";

type LabourChoice = "" | "company" | "quotr_benchmark";

function existingCost(state: SetupState, itemKey: string): string {
  const row = state.rates.find(
    (rate) =>
      rate.item_key === itemKey &&
      rate.active !== false &&
      rate.cost_rate != null &&
      rate.cost_rate > 0
  );
  return row?.cost_rate != null ? String(row.cost_rate) : "";
}

function storedChoice(value: string | null | undefined): LabourChoice {
  return value === "company" || value === "quotr_benchmark" ? value : "";
}

function choiceCardClass(selected: boolean) {
  return [
    "flex min-h-11 cursor-pointer items-center gap-3 rounded-lg border px-3 text-sm",
    "focus-within:ring-2 focus-within:ring-ring",
    selected ? "border-foreground bg-neutral-50" : "border-border bg-white",
  ].join(" ");
}

function RoleChoice({
  legend,
  name,
  explanation,
  choice,
  onChoice,
  cost,
  onCost,
  costLabel,
  costId,
  hasSavedRate,
  costError,
}: {
  legend: string;
  name: string;
  explanation: string;
  choice: LabourChoice;
  onChoice: (choice: LabourChoice) => void;
  cost: string;
  onCost: (value: string) => void;
  costLabel: string;
  costId: string;
  hasSavedRate: boolean;
  costError?: string;
}) {
  return (
    <fieldset className="space-y-2">
      <legend className="text-sm font-medium text-foreground">{legend}</legend>
      <p className="text-sm text-muted-foreground">{explanation}</p>
      <label className={choiceCardClass(choice === "company")}>
        <input
          type="radio"
          name={name}
          value="company"
          checked={choice === "company"}
          onChange={() => onChoice("company")}
          className="size-4 shrink-0"
        />
        Use my company cost
      </label>
      <label className={choiceCardClass(choice === "quotr_benchmark")}>
        <input
          type="radio"
          name={name}
          value="quotr_benchmark"
          checked={choice === "quotr_benchmark"}
          onChange={() => onChoice("quotr_benchmark")}
          className="size-4 shrink-0"
        />
        Use the Quotr benchmark
      </label>
      {choice !== "company" && costError ? (
        <OnboardingFieldError id={`${costId}-choice`} message={costError} />
      ) : null}
      {choice === "company" ? (
        <div className="space-y-1.5 pt-1">
          <Label htmlFor={costId}>{costLabel}</Label>
          <Input
            id={costId}
            inputMode="decimal"
            value={cost}
            onChange={(event) => onCost(event.target.value)}
            className="min-h-11 text-base"
            aria-invalid={Boolean(costError)}
          />
          <OnboardingFieldError id={costId} message={costError} />
        </div>
      ) : null}
      {choice === "quotr_benchmark" && hasSavedRate ? (
        <p className="text-sm text-muted-foreground">
          A company {legend.toLowerCase()} rate is already saved. Estimates still use that rate.{" "}
          <Link
            href="/app/rates"
            className="underline underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            Manage the saved rate
          </Link>{" "}
          under Rates after setup.
        </p>
      ) : null}
      {choice === "quotr_benchmark" && !hasSavedRate ? (
        <p className="text-sm text-muted-foreground">
          Quotr will use its benchmark until a company cost is added.
        </p>
      ) : null}
    </fieldset>
  );
}

export function LabourCostsStep({ state }: { state: SetupState }) {
  const router = useRouter();
  const [carpenterChoice, setCarpenterChoice] = useState<LabourChoice>(
    storedChoice(state.settings?.carpenter_onboarding_choice)
  );
  const [labourerChoice, setLabourerChoice] = useState<LabourChoice>(
    storedChoice(state.settings?.labourer_onboarding_choice)
  );
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
    ...Object.entries(fieldErrors).map(([key, messages]) => `${key}:${messages[0] ?? ""}`),
  ].join("|");
  useFocusOnboardingError(errorSignature);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setFieldErrors({});
    const nextErrors: Record<string, string[]> = {};
    if (!carpenterChoice) {
      nextErrors.carpenterChoice = ["Choose a carpenter cost."];
    }
    if (!labourerChoice) {
      nextErrors.labourerChoice = ["Choose a labourer cost."];
    }
    if (Object.keys(nextErrors).length > 0) {
      setFieldErrors(nextErrors);
      return;
    }
    setSaving(true);
    const result = await saveRequiredLabourCosts({
      carpenterChoice,
      labourerChoice,
      carpenterCost: carpenterChoice === "company" ? carpenterCost : "",
      labourerCost: labourerChoice === "company" ? labourerCost : "",
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
    router.push(FIRST_RUN_READY_PATH);
  }

  return (
    <OnboardingSurface
      mode="labour"
      title="Labour costs"
      description="Labour cost is what the hour costs the business. It is not the client charge-out rate."
    >
      <form data-onboarding-form onSubmit={handleSubmit} className="space-y-6">
        {error ? (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        ) : null}
        <RoleChoice
          legend="Carpenter"
          name="carpenterChoice"
          explanation="Choose the cost Quotr should use for carpenter hours."
          choice={carpenterChoice}
          onChoice={setCarpenterChoice}
          cost={carpenterCost}
          onCost={setCarpenterCost}
          costLabel="Carpenter internal cost per hour"
          costId="carpenter-cost"
          hasSavedRate={existingCost(state, CARPENTER_LABOUR_RATE_KEY) !== ""}
          costError={fieldErrors.carpenterCost?.[0] ?? fieldErrors.carpenterChoice?.[0]}
        />
        <RoleChoice
          legend="Labourer"
          name="labourerChoice"
          explanation="Choose the cost Quotr should use for labourer hours."
          choice={labourerChoice}
          onChoice={setLabourerChoice}
          cost={labourerCost}
          onCost={setLabourerCost}
          costLabel="Labourer internal cost per hour"
          costId="labourer-cost"
          hasSavedRate={existingCost(state, LABOURER_LABOUR_RATE_KEY) !== ""}
          costError={fieldErrors.labourerCost?.[0] ?? fieldErrors.labourerChoice?.[0]}
        />
        <div className="space-y-1.5">
          <Label htmlFor="target-margin">Default target gross margin %</Label>
          <p className="text-sm text-muted-foreground">
            Margin helps calculate selling prices. It is not the hourly cost.
          </p>
          <Input
            id="target-margin"
            inputMode="decimal"
            value={targetMarginPercent}
            onChange={(event) => setTargetMarginPercent(event.target.value)}
            className="min-h-11 text-base"
            aria-invalid={Boolean(fieldErrors.targetMarginPercent)}
          />
          <OnboardingFieldError
            id="target-margin"
            message={fieldErrors.targetMarginPercent?.[0]}
          />
        </div>
        <OnboardingActions backHref={FIRST_RUN_WORK_PATH} pending={saving} />
      </form>
    </OnboardingSurface>
  );
}
