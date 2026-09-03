"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { CompanyDnaTaskDefinition } from "@/lib/company-dna/catalogue";
import { COMPANY_DNA_WORK_AREA_LABELS } from "@/lib/company-dna/catalogue";
import {
  resetCompanyDnaCalibration,
  saveCompanyDnaCalibration,
} from "@/lib/company-dna/actions";
import {
  DNA_BACK_TO_HUB,
  DNA_CREW_HELPER,
  DNA_NEXT_TASK_CTA,
  DNA_OUTLIER_SAVE_ANYWAY,
  DNA_OUTLIER_WARNING,
  DNA_RESET_CONSEQUENCE,
  DNA_RESET_CTA,
  DNA_SAVE_PRIMARY,
  DNA_TIME_HELPER,
  formatDnaPersonHoursLine,
  formatDnaSavedResult,
} from "@/lib/company-dna/copy";
import { deriveCompanyProductivity } from "@/lib/company-dna/derive";
import { cn } from "@/lib/utils";

type CompanyDnaTaskFlowProps = {
  task: CompanyDnaTaskDefinition;
  alreadyCalibrated: boolean;
  canCalibrate: boolean;
  nextTask: CompanyDnaTaskDefinition | null;
};

export function CompanyDnaTaskFlow({
  task,
  alreadyCalibrated,
  canCalibrate,
  nextTask,
}: CompanyDnaTaskFlowProps) {
  const router = useRouter();
  const [crewSize, setCrewSize] = useState("2");
  const [durationHours, setDurationHours] = useState("8");
  const [confirmRequired, setConfirmRequired] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const preview = useMemo(() => {
    const crew = Number(crewSize);
    const hours = Number(durationHours);
    if (!Number.isFinite(crew) || !Number.isFinite(hours)) return null;
    if (crew <= 0 || hours <= 0) return null;
    return deriveCompanyProductivity({
      task,
      crewSize: crew,
      durationHours: hours,
    });
  }, [crewSize, durationHours, task]);

  const workAreaLabel = COMPANY_DNA_WORK_AREA_LABELS[task.workAreaType];

  async function onSave(confirmed = false) {
    setSaving(true);
    setError(null);
    const crew = Number(crewSize);
    const hours = Number(durationHours);
    const outcome = await saveCompanyDnaCalibration({
      calibrationTaskKey: task.calibrationTaskKey,
      crewSize: crew,
      durationHours: hours,
      outlierConfirmed: confirmed || confirmRequired,
    });
    setSaving(false);
    if (outcome.confirmRequired) {
      setConfirmRequired(true);
      setError(DNA_OUTLIER_WARNING);
      return;
    }
    if (outcome.error) {
      setError(outcome.error);
      return;
    }
    setSaved(true);
    setResult(
      formatDnaSavedResult({
        taskLabel: task.label,
        workAreaLabel,
        faster: outcome.faster,
        percentVsBenchmark: outcome.percentVsBenchmark,
      })
    );
    router.refresh();
  }

  async function onReset() {
    setSaving(true);
    setError(null);
    const outcome = await resetCompanyDnaCalibration(task.calibrationTaskKey);
    setSaving(false);
    if (outcome.error) {
      setError(outcome.error);
      return;
    }
    setSaved(false);
    setResult(DNA_RESET_CONSEQUENCE);
    router.refresh();
  }

  return (
    <Card
      data-company-dna-task={task.calibrationTaskKey}
      className="pb-[calc(1.5rem+env(safe-area-inset-bottom))] md:pb-0"
    >
      <CardHeader>
        <CardTitle>{task.label}</CardTitle>
        <CardDescription>{task.prompt}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="rounded-lg border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
          Typical example: {task.scenarioSummary}
        </p>
        <p className="text-sm text-muted-foreground">{task.whyItMatters}</p>

        <p id="dna-crew-helper" className="text-sm text-muted-foreground">
          {DNA_CREW_HELPER}
        </p>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="dna-crew">Crew</Label>
            <Input
              id="dna-crew"
              type="number"
              inputMode="decimal"
              min={1}
              max={20}
              step={1}
              value={crewSize}
              aria-describedby={
                error
                  ? "dna-crew-helper dna-crew-unit dna-validation"
                  : "dna-crew-helper dna-crew-unit"
              }
              aria-invalid={Boolean(error && !confirmRequired)}
              onChange={(event) => {
                setCrewSize(event.target.value);
                setConfirmRequired(false);
                setResult(null);
                setSaved(false);
              }}
              className="h-11 text-base"
              disabled={!canCalibrate}
            />
            <p id="dna-crew-unit" className="text-xs text-muted-foreground">
              people
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="dna-hours">Time</Label>
            <Input
              id="dna-hours"
              type="number"
              inputMode="decimal"
              min={0.25}
              max={200}
              step={0.25}
              value={durationHours}
              aria-describedby={
                error
                  ? "dna-hours-helper dna-hours-unit dna-validation"
                  : "dna-hours-helper dna-hours-unit"
              }
              aria-invalid={Boolean(error && !confirmRequired)}
              onChange={(event) => {
                setDurationHours(event.target.value);
                setConfirmRequired(false);
                setResult(null);
                setSaved(false);
              }}
              className="h-11 text-base"
              disabled={!canCalibrate}
            />
            <p id="dna-hours-unit" className="text-xs text-muted-foreground">
              hours
            </p>
          </div>
        </div>
        <p id="dna-hours-helper" className="text-sm text-muted-foreground">
          {DNA_TIME_HELPER}
        </p>

        {preview ? (
          <p className="text-sm" data-company-dna-preview>
            {formatDnaPersonHoursLine(Number(crewSize), Number(durationHours))}
            {` Quotr will use this to estimate similar ${task.label.toLowerCase()} work.`}
          </p>
        ) : null}

        {error ? (
          <p
            className={cn(
              "text-sm",
              confirmRequired ? "text-foreground" : "text-destructive"
            )}
            role={confirmRequired ? "status" : "alert"}
            id="dna-validation"
          >
            {error}
          </p>
        ) : null}
        {result ? (
          <p className="text-sm" data-company-dna-result>
            {result}
          </p>
        ) : null}

        {saved && nextTask ? (
          <p className="text-sm text-muted-foreground" data-company-dna-next-hint>
            Next: {nextTask.label}.
          </p>
        ) : null}

        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap pb-[calc(4.5rem+env(safe-area-inset-bottom))] md:pb-0">
          {saved && nextTask ? (
            <Link
              href={`/app/setup/dna/${encodeURIComponent(nextTask.calibrationTaskKey)}`}
              className={cn(buttonVariants(), "min-h-11")}
              data-company-dna-next-task
            >
              {DNA_NEXT_TASK_CTA}
            </Link>
          ) : canCalibrate ? (
            <Button
              type="button"
              className="min-h-11"
              disabled={saving || !preview}
              onClick={() => void onSave(confirmRequired)}
            >
              {confirmRequired ? DNA_OUTLIER_SAVE_ANYWAY : DNA_SAVE_PRIMARY}
            </Button>
          ) : null}
          {alreadyCalibrated && canCalibrate ? (
            <Button
              type="button"
              variant="outline"
              className="min-h-11"
              disabled={saving}
              onClick={() => void onReset()}
            >
              {DNA_RESET_CTA}
            </Button>
          ) : null}
          <Link
            href="/app/setup?mode=improve&section=calibrate"
            className={cn(buttonVariants({ variant: "ghost" }), "min-h-11")}
          >
            {saved ? DNA_BACK_TO_HUB : "Back"}
          </Link>
        </div>
        {alreadyCalibrated && canCalibrate ? (
          <p className="text-xs text-muted-foreground">{DNA_RESET_CONSEQUENCE}</p>
        ) : null}
      </CardContent>
    </Card>
  );
}
