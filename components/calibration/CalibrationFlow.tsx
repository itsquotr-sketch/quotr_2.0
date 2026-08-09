"use client";

import Link from "next/link";
import { useId, useMemo, useState } from "react";
import { Button, buttonVariants } from "@/components/ui/button";
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
import {
  runCalibrationComparison,
  saveCalibrationResponse,
} from "@/lib/calibration/actions";
import type { CalibrationResponseRecord } from "@/lib/calibration/persistence-types";
import type {
  CalibrationAnswers,
  CalibrationComparison,
  CalibrationConfidence,
  CalibrationScenario,
} from "@/lib/calibration/types";
import { CALIBRATION_EVIDENCE_LABEL } from "@/lib/calibration/types";
import { cn } from "@/lib/utils";

type Step = "brief" | "questions" | "compare" | "saved" | "view";

type CalibrationFlowProps = {
  scenario: CalibrationScenario;
  existing?: CalibrationResponseRecord | null;
  initialAnswers?: CalibrationAnswers | null;
};

function parseOptionalNumber(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
}

function formatMoney(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "—";
  return `$${value.toLocaleString("en-NZ", {
    maximumFractionDigits: 0,
  })}`;
}

function formatDelta(value: number | null): string {
  if (value == null || !Number.isFinite(value)) return "—";
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(0)}%`;
}

function formatDate(value: string | null | undefined): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("en-NZ", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function answersToFormValues(answers: CalibrationAnswers | null | undefined) {
  const values: Record<string, string> = {};
  if (!answers) return values;
  for (const [key, value] of Object.entries(answers)) {
    if (key === "confidence" || key === "notes") continue;
    if (value == null) continue;
    values[key] = String(value);
  }
  if (answers.notes) values.notes = answers.notes;
  return values;
}

function ExampleJobCard({
  scenario,
  sticky = false,
}: {
  scenario: CalibrationScenario;
  sticky?: boolean;
}) {
  return (
    <Card
      className={cn(
        "border-border/70 bg-muted/20 shadow-none",
        sticky && "sticky top-4"
      )}
    >
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Example job</CardTitle>
        <CardDescription>{scenario.title}</CardDescription>
      </CardHeader>
      <CardContent>
        <ul className="space-y-1 text-sm text-muted-foreground">
          {scenario.referenceHighlights.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

function MobileExampleJobDisclosure({
  scenario,
}: {
  scenario: CalibrationScenario;
}) {
  const panelId = useId();
  const [open, setOpen] = useState(false);
  const summary = scenario.referenceHighlights.slice(0, 3).join(" · ");

  return (
    <div className="rounded-xl border border-border/70 bg-muted/20 p-3 lg:hidden">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium">Example job</p>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {scenario.title}
            {summary ? ` · ${summary}` : ""}
          </p>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="shrink-0"
          aria-expanded={open}
          aria-controls={panelId}
          onClick={() => setOpen((prev) => !prev)}
        >
          {open ? "Hide details" : "Show details"}
        </Button>
      </div>
      {open ? (
        <ul
          id={panelId}
          className="mt-3 space-y-1 border-t border-border/60 pt-3 text-sm text-muted-foreground"
        >
          {scenario.referenceHighlights.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function ComparisonSummary({
  comparison,
  answers,
}: {
  comparison: CalibrationComparison;
  answers: CalibrationAnswers;
}) {
  const hoursComparable =
    comparison.quotrLabourHours != null && answers.labour_hours != null;

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-lg border p-3">
          <p className="text-xs text-muted-foreground">Your expected cost</p>
          <p className="text-lg font-medium tabular-nums">
            {formatMoney(comparison.yourExpectedCost)}
          </p>
        </div>
        <div className="rounded-lg border p-3">
          <p className="text-xs text-muted-foreground">Quotr estimate</p>
          <p className="text-lg font-medium tabular-nums">
            {formatMoney(comparison.quotrRecommendedCost)}
          </p>
        </div>
        <div className="rounded-lg border p-3">
          <p className="text-xs text-muted-foreground">Cost difference</p>
          <p className="text-lg font-medium tabular-nums">
            {formatDelta(comparison.costDeltaPercent)}
          </p>
          {comparison.costDeltaPercent != null ? (
            <p className="mt-1 text-xs text-muted-foreground">
              Your expected business cost vs Quotr’s current calculation — not a
              quality judgement.
            </p>
          ) : null}
        </div>
        <div className="rounded-lg border p-3">
          <p className="text-xs text-muted-foreground">Your expected sell</p>
          <p className="text-lg font-medium tabular-nums">
            {formatMoney(comparison.yourExpectedSell)}
          </p>
        </div>
        <div className="rounded-lg border p-3">
          <p className="text-xs text-muted-foreground">Quotr indicative sell</p>
          <p className="text-lg font-medium tabular-nums">
            {formatMoney(comparison.quotrRecommendedSell)}
          </p>
        </div>
        <div className="rounded-lg border p-3">
          <p className="text-xs text-muted-foreground">Sell difference</p>
          <p className="text-lg font-medium tabular-nums">
            {formatDelta(comparison.sellDeltaPercent)}
          </p>
        </div>
      </div>

      {hoursComparable ? (
        <div className="rounded-lg border px-3 py-2 text-sm">
          <span className="font-medium">Labour hours</span>
          <span className="ml-2 tabular-nums text-muted-foreground">
            You {answers.labour_hours}h · Quotr{" "}
            {comparison.quotrLabourHours!.toFixed(1)}h
          </span>
        </div>
      ) : null}

      <div className="space-y-2">
        <h3 className="text-sm font-medium">Where we can compare</h3>
        {comparison.categories
          .filter((row) => row.comparable)
          .map((row) => (
            <div
              key={row.category}
              className="flex flex-wrap justify-between gap-2 rounded-lg border px-3 py-2 text-sm"
            >
              <span>{row.label}</span>
              <span className="tabular-nums text-muted-foreground">
                You {formatMoney(row.yourCost)} · Quotr{" "}
                {formatMoney(row.quotrCost)}
              </span>
            </div>
          ))}
        {comparison.categories.every((row) => !row.comparable) &&
        !hoursComparable ? (
          <p className="text-sm text-muted-foreground">
            Add cost figures above to compare category by category.
          </p>
        ) : null}
      </div>

      <p className="text-sm leading-relaxed text-muted-foreground">
        {comparison.narrative}
      </p>
    </div>
  );
}

export function CalibrationFlow({
  scenario,
  existing = null,
  initialAnswers = null,
}: CalibrationFlowProps) {
  const [step, setStep] = useState<Step>(existing ? "view" : "brief");
  const [values, setValues] = useState<Record<string, string>>(() =>
    answersToFormValues(initialAnswers)
  );
  const [confidence, setConfidence] = useState<CalibrationConfidence | "">(
    initialAnswers?.confidence ?? ""
  );
  const [comparison, setComparison] = useState<CalibrationComparison | null>(
    null
  );
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(null);

  const answers: CalibrationAnswers = useMemo(
    () => ({
      labour_hours: parseOptionalNumber(values.labour_hours ?? ""),
      labour_cost: parseOptionalNumber(values.labour_cost ?? ""),
      materials_cost: parseOptionalNumber(values.materials_cost ?? ""),
      subcontractors_cost: parseOptionalNumber(
        values.subcontractors_cost ?? ""
      ),
      other_cost: parseOptionalNumber(values.other_cost ?? ""),
      expected_total_cost: parseOptionalNumber(
        values.expected_total_cost ?? ""
      ),
      expected_sell: parseOptionalNumber(values.expected_sell ?? ""),
      confidence: confidence || null,
      notes: (values.notes ?? "").trim() || null,
    }),
    [values, confidence]
  );

  const showReference = step === "questions" || step === "compare";

  function startRecalibrate() {
    setError(null);
    setComparison(null);
    setSavedAt(null);
    setStep("brief");
  }

  async function handleCompare() {
    setError(null);
    setBusy(true);
    const result = await runCalibrationComparison({
      scenarioId: scenario.id,
      answers,
    });
    setBusy(false);
    if (result.error && !result.comparison) {
      setError(result.error);
      return;
    }
    setComparison(result.comparison ?? null);
    setStep("compare");
  }

  async function handleSave() {
    setError(null);
    setBusy(true);
    const result = await saveCalibrationResponse({
      scenarioId: scenario.id,
      answers,
    });
    setBusy(false);
    if (result.comparison) setComparison(result.comparison);
    if (result.error) {
      setError(result.error);
      return;
    }
    if (result.saved) {
      setSavedAt(new Date().toISOString());
      setStep("saved");
    }
  }

  return (
    <div className="mx-auto w-full max-w-5xl space-y-4">
      <p className="text-sm">
        <Link
          href="/app/setup?mode=improve&section=calibrate"
          className="text-muted-foreground underline-offset-4 hover:underline"
        >
          Back to Calibrate Quotr
        </Link>
      </p>

      <p className="max-w-2xl text-sm text-muted-foreground">
        Calibration helps Quotr understand how your business prices this type of
        work. It won’t automatically change your company rates.
      </p>

      {step === "view" && existing ? (
        <Card className="max-w-lg">
          <CardHeader>
            <CardTitle>{scenario.title}</CardTitle>
            <CardDescription>
              Latest {CALIBRATION_EVIDENCE_LABEL.toLowerCase()} — observational
              only, not automatic rate changes.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <p className="text-muted-foreground">
              Saved {formatDate(existing.created_at)}
              {existing.confidence
                ? ` · ${existing.confidence} confidence`
                : ""}
              {" · "}scenario v{existing.scenario_version}
            </p>
            <ul className="space-y-1 text-muted-foreground">
              {existing.labour_hours != null ? (
                <li>Labour hours: {existing.labour_hours}</li>
              ) : null}
              {existing.materials_cost != null ? (
                <li>Materials: {formatMoney(existing.materials_cost)}</li>
              ) : null}
              {existing.subcontractors_cost != null ? (
                <li>
                  Subcontractors: {formatMoney(existing.subcontractors_cost)}
                </li>
              ) : null}
              {existing.expected_total_cost != null ? (
                <li>
                  Expected cost: {formatMoney(existing.expected_total_cost)}
                </li>
              ) : null}
              {existing.expected_sell != null ? (
                <li>Expected sell: {formatMoney(existing.expected_sell)}</li>
              ) : null}
            </ul>
            {"quotrRecommendedCost" in (existing.engine_snapshot ?? {}) ? (
              <p className="text-muted-foreground">
                Quotr estimate at save:{" "}
                {formatMoney(
                  Number(
                    (existing.engine_snapshot as { quotrRecommendedCost?: number })
                      .quotrRecommendedCost
                  )
                )}
              </p>
            ) : null}
          </CardContent>
          <CardFooter className="flex flex-wrap gap-2">
            <Button type="button" onClick={startRecalibrate}>
              Recalibrate
            </Button>
            <Link
              href="/app/setup?mode=improve&section=calibrate"
              className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}
            >
              Done
            </Link>
          </CardFooter>
        </Card>
      ) : null}

      {step === "brief" ? (
        <Card className="max-w-lg">
          <CardHeader>
            <CardTitle>{scenario.title}</CardTitle>
            <CardDescription>
              Here’s the example job. You don’t need to re-enter these facts —
              Quotr will use them for a fair comparison.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm leading-relaxed">{scenario.jobBrief}</p>
            <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
              {scenario.scopeItems.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </CardContent>
          <CardFooter>
            <Button type="button" onClick={() => setStep("questions")}>
              How would your business price it?
            </Button>
          </CardFooter>
        </Card>
      ) : null}

      {showReference ? (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_16rem]">
          <div className="min-w-0 space-y-4">
            <MobileExampleJobDisclosure scenario={scenario} />

            {step === "questions" ? (
              <Card>
                <CardHeader>
                  <CardTitle>How would your business price it?</CardTitle>
                  <CardDescription>
                    Short answers only. Blank is fine where you’re unsure. This
                    is {CALIBRATION_EVIDENCE_LABEL.toLowerCase()}, not an
                    automatic rate change.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {error ? (
                    <p className="rounded-lg border border-destructive/20 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                      {error}
                    </p>
                  ) : null}
                  {scenario.questions.map((question) => {
                    if (question.kind === "confidence") {
                      return (
                        <div key={question.id} className="space-y-2">
                          <Label>{question.label}</Label>
                          <div className="flex flex-wrap gap-2">
                            {(["low", "medium", "high"] as const).map(
                              (level) => (
                                <Button
                                  key={level}
                                  type="button"
                                  size="sm"
                                  variant={
                                    confidence === level ? "default" : "outline"
                                  }
                                  onClick={() => setConfidence(level)}
                                >
                                  {level[0]!.toUpperCase() + level.slice(1)}
                                </Button>
                              )
                            )}
                          </div>
                        </div>
                      );
                    }
                    if (question.kind === "text") {
                      return (
                        <div key={question.id} className="space-y-2">
                          <Label htmlFor={question.id}>
                            {question.label}
                            {question.optional ? (
                              <span className="ml-1 text-muted-foreground">
                                (optional)
                              </span>
                            ) : null}
                          </Label>
                          <Input
                            id={question.id}
                            value={values[question.id] ?? ""}
                            onChange={(event) =>
                              setValues((prev) => ({
                                ...prev,
                                [question.id]: event.target.value,
                              }))
                            }
                          />
                        </div>
                      );
                    }
                    return (
                      <div key={question.id} className="space-y-2">
                        <Label htmlFor={question.id}>
                          {question.label}
                          {question.optional ? (
                            <span className="ml-1 text-muted-foreground">
                              (optional)
                            </span>
                          ) : null}
                        </Label>
                        {question.help ? (
                          <p className="text-xs text-muted-foreground">
                            {question.help}
                          </p>
                        ) : null}
                        <div className="relative">
                          {question.unit === "$" ? (
                            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                              $
                            </span>
                          ) : null}
                          <Input
                            id={question.id}
                            type="number"
                            min="0"
                            step="0.01"
                            inputMode="decimal"
                            className={
                              question.unit === "$" ? "pl-7" : undefined
                            }
                            placeholder={
                              question.unit === "hours"
                                ? "e.g. 24"
                                : "Blank = later"
                            }
                            value={values[question.id] ?? ""}
                            onChange={(event) =>
                              setValues((prev) => ({
                                ...prev,
                                [question.id]: event.target.value,
                              }))
                            }
                          />
                        </div>
                      </div>
                    );
                  })}
                </CardContent>
                <CardFooter className="flex flex-wrap justify-between gap-2">
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => setStep("brief")}
                    disabled={busy}
                  >
                    Back
                  </Button>
                  <Button
                    type="button"
                    onClick={() => void handleCompare()}
                    disabled={busy}
                  >
                    {busy ? "Comparing…" : "Compare"}
                  </Button>
                </CardFooter>
              </Card>
            ) : null}

            {step === "compare" && comparison ? (
              <Card>
                <CardHeader>
                  <CardTitle>Compare</CardTitle>
                  <CardDescription>
                    Quotr will use saved calibration as evidence about how your
                    business prices work. It does not automatically alter this
                    estimate or your saved rates.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {error ? (
                    <p className="rounded-lg border border-destructive/20 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                      {error}
                    </p>
                  ) : null}
                  <ComparisonSummary
                    comparison={comparison}
                    answers={answers}
                  />
                </CardContent>
                <CardFooter className="flex flex-wrap justify-between gap-2">
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => setStep("questions")}
                    disabled={busy}
                  >
                    Edit answers
                  </Button>
                  <Button
                    type="button"
                    onClick={() => void handleSave()}
                    disabled={busy}
                  >
                    {busy ? "Saving…" : "Save calibration"}
                  </Button>
                </CardFooter>
              </Card>
            ) : null}
          </div>

          <aside className="hidden lg:block">
            <ExampleJobCard scenario={scenario} sticky />
          </aside>
        </div>
      ) : null}

      {step === "saved" && comparison ? (
        <Card className="max-w-lg">
          <CardHeader>
            <CardTitle>Calibration saved</CardTitle>
            <CardDescription>
              {CALIBRATION_EVIDENCE_LABEL} stored for your company. Quotr did
              not change your rates.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {savedAt ? (
              <p className="text-sm text-muted-foreground">
                Saved {formatDate(savedAt)}
              </p>
            ) : null}
            <ComparisonSummary comparison={comparison} answers={answers} />
          </CardContent>
          <CardFooter className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" onClick={startRecalibrate}>
              Recalibrate
            </Button>
            <Link
              href="/app/setup?mode=improve&section=calibrate"
              className={cn(buttonVariants())}
            >
              Done
            </Link>
          </CardFooter>
        </Card>
      ) : null}
    </div>
  );
}
