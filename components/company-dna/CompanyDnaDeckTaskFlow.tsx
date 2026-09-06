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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  resetCompanyDnaCalibration,
  saveCompanyDnaCalibration,
} from "@/lib/company-dna/actions";
import {
  DNA_CREW_HELPER,
  DNA_DECK_TIER1_COMPLETE_BODY,
  DNA_DECK_TIER1_COMPLETE_TITLE,
  DNA_DONE,
  DNA_KEEP_REFINING,
  DNA_OUTLIER_BACK,
  DNA_OUTLIER_YES,
  DNA_RECALIBRATE,
  DNA_RESET_CONSEQUENCE,
  DNA_RESET_CONFIRM_TITLE,
  DNA_RESET_CTA,
  DNA_SAVE_CONTINUE,
  DNA_SKIP_FOR_NOW,
  deckV2IncludedCopy,
  deckV2ScenarioCopy,
  deckV2TaskTitle,
  dnaV2CompleteCopy,
  formatDnaClockTimePerUnit,
  formatDnaDeckProgressIndicator,
  formatDnaDeckResultComparison,
  formatDnaDeckResultPrimary,
  formatDnaHoursPerUnit,
  formatDnaOutlierPrompt,
  formatDnaV2ProgressIndicator,
} from "@/lib/company-dna/copy";
import { v2LandingPath } from "@/lib/company-dna/v2-ui";
import type { CompanyDnaFoundationTask } from "@/lib/company-dna/v2-foundation";
import {
  clockFromDurationHours,
  deriveCompanyProductivityFromClock,
} from "@/lib/company-dna/derive";
import { cn } from "@/lib/utils";

const MINUTE_OPTIONS = [0, 15, 30, 45];

type Evidence = {
  calibrated: boolean;
  derivedProductivity: number | null;
  crewSize: number | null;
  durationHours: number | null;
};

type CompanyDnaDeckTaskFlowProps = {
  task: CompanyDnaFoundationTask;
  evidence: Evidence;
  canCalibrate: boolean;
  nextTask: CompanyDnaFoundationTask | null;
  remainingAfterSave: CompanyDnaFoundationTask | null;
  completesTier1: boolean;
  tier1Calibrated: number;
  tier1Total: number;
  optionalIndex: number;
  optionalTotal: number;
  includedCopy: string;
};

export function CompanyDnaDeckTaskFlow({
  task,
  evidence,
  canCalibrate,
  nextTask,
  remainingAfterSave,
  completesTier1,
  tier1Calibrated,
  tier1Total,
  optionalIndex,
  optionalTotal,
  includedCopy,
}: CompanyDnaDeckTaskFlowProps) {
  const router = useRouter();
  const existingClock =
    evidence.calibrated && evidence.durationHours != null
      ? clockFromDurationHours(evidence.durationHours)
      : null;
  const [crewSize, setCrewSize] = useState(
    evidence.crewSize != null ? String(evidence.crewSize) : "2"
  );
  const [clockHours, setClockHours] = useState(
    existingClock ? String(existingClock.hours) : "1"
  );
  const [minutes, setMinutes] = useState(
    existingClock ? String(existingClock.minutes) : "0"
  );
  const [view, setView] = useState<"form" | "result" | "complete">("form");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [outlierOpen, setOutlierOpen] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const [savedProductivity, setSavedProductivity] = useState<number | null>(
    null
  );
  const [savedFaster, setSavedFaster] = useState(false);
  const [savedPercent, setSavedPercent] = useState(0);

  const preview = useMemo(() => {
    const crew = Number(crewSize);
    const hours = Number(clockHours);
    const mins = Number(minutes);
    if (!Number.isFinite(crew) || !Number.isFinite(hours) || !Number.isFinite(mins)) {
      return null;
    }
    if (crew < 1) return null;
    return deriveCompanyProductivityFromClock({
      task,
      crewSize: crew,
      clockHours: hours,
      minutes: mins,
    });
  }, [clockHours, crewSize, minutes, task]);

  const title = deckV2TaskTitle(task.calibrationTaskKey, task.label);
  const scenario = deckV2ScenarioCopy(task);
  const currentIsTier1 = task.priorityTier === 1;
  const canPrefillFromEvidence =
    evidence.calibrated &&
    evidence.crewSize != null &&
    evidence.durationHours != null;
  const showHistoricalWithoutClock =
    evidence.calibrated && !canPrefillFromEvidence && view === "form";

  async function persist(confirmed: boolean) {
    setSaving(true);
    setError(null);
    const outcome = await saveCompanyDnaCalibration({
      calibrationTaskKey: task.calibrationTaskKey,
      crewSize: Number(crewSize),
      clockHours: Number(clockHours),
      minutes: Number(minutes),
      outlierConfirmed: confirmed,
    });
    setSaving(false);
    if (outcome.confirmRequired) {
      setOutlierOpen(true);
      return;
    }
    if (outcome.error) {
      setError(outcome.error);
      return;
    }
    setSavedProductivity(outcome.derivedProductivity ?? preview?.productivity ?? null);
    setSavedFaster(Boolean(outcome.faster));
    setSavedPercent(outcome.percentVsBenchmark ?? 0);
    setView(completesTier1 ? "complete" : "result");
    router.refresh();
  }

  async function onReset() {
    setSaving(true);
    const outcome = await resetCompanyDnaCalibration(task.calibrationTaskKey);
    setSaving(false);
    setResetOpen(false);
    if (outcome.error) {
      setError(outcome.error);
      return;
    }
    setView("form");
    router.refresh();
  }

  const productivity =
    savedProductivity ??
    (evidence.calibrated ? evidence.derivedProductivity : null);
  const landing = v2LandingPath(task.workAreaType);
  const completeCopy = dnaV2CompleteCopy(task.workAreaType);
  const nextHref = remainingAfterSave
    ? `/app/setup/dna/${encodeURIComponent(remainingAfterSave.calibrationTaskKey)}`
    : `${landing}?view=summary`;
  const progressCopy =
    task.workAreaType === "fence"
      ? formatDnaV2ProgressIndicator({
          workAreaLabel: "Fence",
          tier1Calibrated,
          tier1Total,
          optionalIndex,
          optionalTotal,
          currentIsTier1,
        })
      : formatDnaDeckProgressIndicator({
          tier1Calibrated,
          tier1Total,
          optionalIndex,
          optionalTotal,
          currentIsTier1,
        });

  return (
    <Card
      data-company-dna-task={task.calibrationTaskKey}
      data-company-dna-deck-task={
        task.workAreaType === "deck" ? task.calibrationTaskKey : undefined
      }
      data-company-dna-fence-task={
        task.workAreaType === "fence" ? task.calibrationTaskKey : undefined
      }
      data-company-dna-v2-task={task.calibrationTaskKey}
      className="mx-auto w-full max-w-xl pb-[calc(1.5rem+env(safe-area-inset-bottom))] md:pb-0"
    >
      <CardHeader>
        <p className="text-xs text-muted-foreground" data-company-dna-deck-progress>
          {progressCopy}
        </p>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{scenario}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {view === "form" ? (
          <>
            <p
              className="rounded-lg border bg-muted/40 px-3 py-2 text-sm text-muted-foreground"
              data-company-dna-deck-included
            >
              What’s included: {deckV2IncludedCopy(includedCopy)}
            </p>
            {showHistoricalWithoutClock ? (
              <p className="text-sm" data-company-dna-existing>
                Your current calibration is{" "}
                {formatDnaHoursPerUnit(
                  Number(evidence.derivedProductivity),
                  task.authorityUnit
                )}
                . Original workers and clock time aren’t stored in a form we can
                reload, so enter a new time to recalibrate.
              </p>
            ) : null}

            <p id="dna-crew-helper" className="text-sm text-muted-foreground">
              {DNA_CREW_HELPER}
            </p>
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="dna-crew">Workers</Label>
                <Input
                  id="dna-crew"
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={20}
                  step={1}
                  value={crewSize}
                  aria-describedby="dna-crew-helper dna-crew-unit"
                  onChange={(event) => {
                    setCrewSize(event.target.value);
                    setError(null);
                  }}
                  className="h-11 text-base"
                  disabled={!canCalibrate}
                />
                <p id="dna-crew-unit" className="text-xs text-muted-foreground">
                  people
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="dna-clock-hours">Hours</Label>
                <Input
                  id="dna-clock-hours"
                  type="number"
                  inputMode="numeric"
                  min={0}
                  max={200}
                  step={1}
                  value={clockHours}
                  aria-describedby="dna-time-helper"
                  onChange={(event) => {
                    setClockHours(event.target.value);
                    setError(null);
                  }}
                  className="h-11 text-base"
                  disabled={!canCalibrate}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="dna-minutes">Minutes</Label>
                <select
                  id="dna-minutes"
                  value={minutes}
                  aria-describedby="dna-time-helper"
                  onChange={(event) => {
                    setMinutes(event.target.value);
                    setError(null);
                  }}
                  disabled={!canCalibrate}
                  className="h-11 w-full rounded-xl border border-border/80 bg-background px-3 text-base"
                >
                  {MINUTE_OPTIONS.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <p id="dna-time-helper" className="text-sm text-muted-foreground">
              Enter clock time for the crew, not person-hours. Example: 2 people
              working 1 hour 30 minutes → 1 hour and 30 minutes.
            </p>

            {error ? (
              <p className="text-sm text-destructive" role="alert" id="dna-validation">
                {error}
              </p>
            ) : null}

            <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap pb-[calc(5.5rem+env(safe-area-inset-bottom))] md:pb-0">
              {canCalibrate ? (
                <Button
                  type="button"
                  className="min-h-11"
                  disabled={saving || !preview}
                  onClick={() => void persist(false)}
                  data-company-dna-save
                >
                  {evidence.calibrated ? DNA_RECALIBRATE : DNA_SAVE_CONTINUE}
                </Button>
              ) : null}
              {evidence.calibrated && canCalibrate ? (
                <Button
                  type="button"
                  variant="outline"
                  className="min-h-11"
                  disabled={saving}
                  onClick={() => setResetOpen(true)}
                >
                  {DNA_RESET_CTA}
                </Button>
              ) : null}
              {!currentIsTier1 ? (
                <Link
                  href={nextTask
                    ? `/app/setup/dna/${encodeURIComponent(nextTask.calibrationTaskKey)}`
                    : `${landing}?view=summary`}
                  className={cn(buttonVariants({ variant: "ghost" }), "min-h-11")}
                  data-company-dna-skip
                >
                  {DNA_SKIP_FOR_NOW}
                </Link>
              ) : (
                <Link
                  href={landing}
                  className={cn(buttonVariants({ variant: "ghost" }), "min-h-11")}
                >
                  Back
                </Link>
              )}
            </div>
          </>
        ) : null}

        {view === "result" && productivity != null ? (
          <div className="space-y-3" data-company-dna-deck-result>
            <p className="text-base font-medium">
              {formatDnaDeckResultPrimary({
                productivityHoursPerUnit: productivity,
                unit: task.authorityUnit,
              })}
            </p>
            <p className="text-sm">
              {formatDnaDeckResultComparison({
                faster: savedFaster,
                percentVsBenchmark: savedPercent,
              })}
            </p>
            <p className="text-xs text-muted-foreground" data-company-dna-deck-technical>
              Your productivity:{" "}
              {formatDnaHoursPerUnit(productivity, task.authorityUnit)}
              <br />
              Quotr benchmark:{" "}
              {formatDnaHoursPerUnit(task.benchmarkProductivity, task.authorityUnit)}
              <br />
              Used in estimates: Your calibration
            </p>
            {formatDnaClockTimePerUnit({
              crewSize: Number(crewSize),
              productivityHoursPerUnit: productivity,
              unit: task.authorityUnit,
            }) ? (
              <p className="text-sm text-muted-foreground">
                {formatDnaClockTimePerUnit({
                  crewSize: Number(crewSize),
                  productivityHoursPerUnit: productivity,
                  unit: task.authorityUnit,
                })}
              </p>
            ) : null}
            <div className="flex flex-col gap-2 sm:flex-row pb-[calc(5.5rem+env(safe-area-inset-bottom))] md:pb-0">
              <Link
                href={nextHref}
                className={cn(buttonVariants(), "min-h-11")}
                data-company-dna-next-task
              >
                {remainingAfterSave ? "Continue" : DNA_DONE}
              </Link>
            </div>
          </div>
        ) : null}

        {view === "complete" ? (
          <div className="space-y-3" data-company-dna-deck-complete>
            <p className="text-base font-medium">
              {task.workAreaType === "fence"
                ? completeCopy.title
                : DNA_DECK_TIER1_COMPLETE_TITLE}
            </p>
            <p className="text-sm text-muted-foreground">
              {task.workAreaType === "fence"
                ? completeCopy.body
                : DNA_DECK_TIER1_COMPLETE_BODY}
            </p>
            <div className="flex flex-col gap-2 sm:flex-row pb-[calc(5.5rem+env(safe-area-inset-bottom))] md:pb-0">
              <Link
                href="/app/setup?mode=improve&section=calibrate"
                className={cn(buttonVariants(), "min-h-11")}
                data-company-dna-done
              >
                {DNA_DONE}
              </Link>
              {remainingAfterSave ? (
                <Link
                  href={`/app/setup/dna/${encodeURIComponent(remainingAfterSave.calibrationTaskKey)}`}
                  className={cn(buttonVariants({ variant: "outline" }), "min-h-11")}
                  data-company-dna-keep-refining
                >
                  {DNA_KEEP_REFINING}
                </Link>
              ) : null}
            </div>
          </div>
        ) : null}
      </CardContent>

      <Dialog open={outlierOpen} onOpenChange={setOutlierOpen}>
        <DialogContent showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>Check this time</DialogTitle>
            <DialogDescription>
              {formatDnaOutlierPrompt(Boolean(preview?.faster))}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOutlierOpen(false)}>
              {DNA_OUTLIER_BACK}
            </Button>
            <Button
              type="button"
              disabled={saving}
              onClick={() => {
                setOutlierOpen(false);
                void persist(true);
              }}
            >
              {DNA_OUTLIER_YES}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={resetOpen} onOpenChange={setResetOpen}>
        <DialogContent showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>{DNA_RESET_CONFIRM_TITLE}</DialogTitle>
            <DialogDescription>{DNA_RESET_CONSEQUENCE}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setResetOpen(false)}>
              Cancel
            </Button>
            <Button type="button" disabled={saving} onClick={() => void onReset()}>
              {DNA_RESET_CTA}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
