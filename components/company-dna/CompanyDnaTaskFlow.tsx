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
import {
  resetCompanyDnaCalibration,
  saveCompanyDnaCalibration,
} from "@/lib/company-dna/actions";
import { deriveCompanyProductivity } from "@/lib/company-dna/derive";
import { cn } from "@/lib/utils";

type CompanyDnaTaskFlowProps = {
  task: CompanyDnaTaskDefinition;
  alreadyCalibrated: boolean;
  canCalibrate: boolean;
};

export function CompanyDnaTaskFlow({
  task,
  alreadyCalibrated,
  canCalibrate,
}: CompanyDnaTaskFlowProps) {
  const router = useRouter();
  const [crewSize, setCrewSize] = useState("2");
  const [durationHours, setDurationHours] = useState("8");
  const [confirmRequired, setConfirmRequired] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);

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
      const direction = outcome.faster ? "faster" : "slower";
      setError(
        `This is much ${direction} than Quotr's benchmark. Is that right?`
      );
      return;
    }
    if (outcome.error) {
      setError(outcome.error);
      return;
    }
    if (
      outcome.percentVsBenchmark != null &&
      Number.isFinite(outcome.percentVsBenchmark) &&
      Math.abs(outcome.percentVsBenchmark) >= 5
    ) {
      const abs = Math.round(Math.abs(outcome.percentVsBenchmark));
      setResult(
        outcome.faster
          ? `Got it — your crew is about ${abs}% faster than the Quotr benchmark for this task.`
          : `Got it — your crew takes about ${abs}% longer than the Quotr benchmark for this task.`
      );
    } else {
      setResult(
        `Saved. Quotr will use this for future ${task.workAreaType.replaceAll("_", " ")} estimates.`
      );
    }
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
    setResult("Using the Quotr benchmark for this task again.");
    router.refresh();
  }

  return (
    <Card data-company-dna-task={task.calibrationTaskKey}>
      <CardHeader>
        <CardTitle>{task.label}</CardTitle>
        <CardDescription>{task.prompt}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="rounded-lg border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
          Typical example: {task.scenarioSummary}
        </p>
        <p className="text-sm text-muted-foreground">
          How many people from your team would normally be working on this
          task? An approximate answer is fine.
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
              onChange={(event) => {
                setCrewSize(event.target.value);
                setConfirmRequired(false);
                setResult(null);
              }}
              className="h-11 text-base"
              disabled={!canCalibrate}
            />
            <p className="text-xs text-muted-foreground">people</p>
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
              onChange={(event) => {
                setDurationHours(event.target.value);
                setConfirmRequired(false);
                setResult(null);
              }}
              className="h-11 text-base"
              disabled={!canCalibrate}
            />
            <p className="text-xs text-muted-foreground">hours</p>
          </div>
        </div>

        {error ? (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        ) : null}
        {result ? (
          <p className="text-sm" data-company-dna-result>
            {result}
          </p>
        ) : null}

        <div className="flex flex-col gap-2 sm:flex-row">
          <Button
            type="button"
            className="min-h-11"
            disabled={!canCalibrate || saving || !preview}
            onClick={() => void onSave(confirmRequired)}
          >
            {confirmRequired ? "Yes, save this" : "Save for future estimates"}
          </Button>
          {alreadyCalibrated ? (
            <Button
              type="button"
              variant="outline"
              className="min-h-11"
              disabled={!canCalibrate || saving}
              onClick={() => void onReset()}
            >
              Use Quotr benchmark
            </Button>
          ) : null}
          <Link
            href="/app/setup?mode=improve&section=calibrate"
            className={cn(buttonVariants({ variant: "ghost" }), "min-h-11")}
          >
            Back
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}
