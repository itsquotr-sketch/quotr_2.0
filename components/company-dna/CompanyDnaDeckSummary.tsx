"use client";

import { useState } from "react";
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
import type { CompanyDnaTaskStatus } from "@/lib/company-dna/actions";
import { resetCompanyDnaCalibration } from "@/lib/company-dna/actions";
import {
  DNA_CALIBRATE,
  DNA_DONE,
  DNA_KEEP_REFINING,
  DNA_RECALIBRATE,
  DNA_RESET_CONSEQUENCE,
  DNA_RESET_CONFIRM_TITLE,
  DNA_RESET_CTA,
  DNA_SOURCE_QUOTR_BENCHMARK,
  DNA_SOURCE_YOUR_CALIBRATION,
  deckV2TaskTitle,
  formatDnaOptionalRemaining,
  formatDnaRwHubProgress,
} from "@/lib/company-dna/copy";
import {
  listCompanyDnaV2UiTasks,
  v2OptionalKeys,
} from "@/lib/company-dna/v2-ui";
import {
  COMPANY_DNA_RW_SYSTEM_LABELS,
  isCompanyDnaRwSharedTaskKey,
  rwSystemOfTask,
  rwTaskHref,
  type CompanyDnaRwSystemProgress,
} from "@/lib/company-dna/rw-v2";
import { companyDnaWorkAreaStatusLabel } from "@/lib/company-dna/derive";
import { cn } from "@/lib/utils";

type CompanyDnaDeckSummaryProps = {
  workAreaType?: "deck" | "fence" | "retaining_wall" | "bathroom";
  status: "benchmarks" | "partly" | "calibrated";
  tier1Calibrated: number;
  tier1Total: number;
  tasks: CompanyDnaTaskStatus[];
  nextOptionalHref: string | null;
  canCalibrate: boolean;
  systemProgress?: CompanyDnaRwSystemProgress[];
};

export function CompanyDnaDeckSummary({
  workAreaType = "deck",
  status,
  tier1Calibrated,
  tier1Total,
  tasks,
  nextOptionalHref,
  canCalibrate,
  systemProgress = [],
}: CompanyDnaDeckSummaryProps) {
  const router = useRouter();
  const [resetting, setResetting] = useState<string | null>(null);
  const [confirmKey, setConfirmKey] = useState<string | null>(null);
  const catalogue = listCompanyDnaV2UiTasks(workAreaType);
  const optionalCount = v2OptionalKeys(workAreaType).length;
  const areaLabel =
    workAreaType === "fence"
      ? "Fence"
      : workAreaType === "retaining_wall"
        ? "Retaining wall"
        : workAreaType === "bathroom"
          ? "Bathroom"
          : "Deck";
  const isRw = workAreaType === "retaining_wall";
  const evidence = new Map(
    tasks.map((task) => [task.calibrationTaskKey, task])
  );

  async function onReset(taskKey: string) {
    setResetting(taskKey);
    const outcome = await resetCompanyDnaCalibration(taskKey);
    setResetting(null);
    setConfirmKey(null);
    if (!outcome.error) router.refresh();
  }

  return (
    <Card
      data-company-dna-deck-summary={workAreaType === "deck" ? "" : undefined}
      data-company-dna-fence-summary={workAreaType === "fence" ? "" : undefined}
      data-company-dna-bathroom-summary={workAreaType === "bathroom" ? "" : undefined}
      data-company-dna-rw-summary={isRw ? "" : undefined}
      data-company-dna-v2-summary={workAreaType}
      className="mx-auto w-full max-w-xl pb-[calc(1.5rem+env(safe-area-inset-bottom))] md:pb-0"
    >
      <CardHeader>
        <CardTitle>{areaLabel} calibration</CardTitle>
        <CardDescription>
          {isRw && systemProgress.length > 0
            ? formatDnaRwHubProgress({ systems: systemProgress })
            : `Key tasks: ${tier1Calibrated} / ${tier1Total} calibrated`}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm font-medium" data-company-dna-deck-summary-status>
          {companyDnaWorkAreaStatusLabel(status)}
        </p>
        {isRw ? (
          <div className="space-y-4">
            {              (
              [
                ["shared", "Shared retaining tasks"],
                ["timber", COMPANY_DNA_RW_SYSTEM_LABELS.timber],
                ["sleeper", COMPANY_DNA_RW_SYSTEM_LABELS.sleeper],
                ["masonry", COMPANY_DNA_RW_SYSTEM_LABELS.masonry],
              ] as const
            ).map(([group, heading]) => {
              const groupTasks = catalogue.filter((task) => {
                if (group === "shared") {
                  return isCompanyDnaRwSharedTaskKey(task.calibrationTaskKey);
                }
                return rwSystemOfTask(task.calibrationTaskKey) === group;
              });
              if (groupTasks.length === 0) return null;
              const systemRow =
                group === "shared"
                  ? null
                  : systemProgress.find((item) => item.system === group);
              return (
                <div key={group} data-company-dna-rw-summary-group={group}>
                  <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    {heading}
                    {systemRow
                      ? ` · ${systemRow.tier1Calibrated} of ${systemRow.tier1Total} key tasks`
                      : ""}
                  </p>
                  <ul className="space-y-2">
                    {groupTasks.map((task) => {
                      const row = evidence.get(task.calibrationTaskKey);
                      const calibrated = Boolean(row?.calibrated);
                      const system =
                        group === "shared"
                          ? "timber"
                          : group;
                      return (
                        <li
                          key={task.calibrationTaskKey}
                          className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2"
                          data-company-dna-summary-task={task.calibrationTaskKey}
                        >
                          <div className="min-w-0">
                            <p className="text-sm font-medium">
                              {deckV2TaskTitle(task.calibrationTaskKey, task.label)}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {calibrated
                                ? DNA_SOURCE_YOUR_CALIBRATION
                                : DNA_SOURCE_QUOTR_BENCHMARK}
                            </p>
                          </div>
                          <div className="flex shrink-0 flex-wrap gap-1.5">
                            <Link
                              href={rwTaskHref(task.calibrationTaskKey, system)}
                              className={cn(
                                buttonVariants({ variant: "outline", size: "sm" }),
                                "h-8"
                              )}
                            >
                              {calibrated ? DNA_RECALIBRATE : DNA_CALIBRATE}
                            </Link>
                            {calibrated && canCalibrate ? (
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="h-8"
                                disabled={resetting === task.calibrationTaskKey}
                                onClick={() => setConfirmKey(task.calibrationTaskKey)}
                              >
                                {DNA_RESET_CTA}
                              </Button>
                            ) : null}
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              );
            })}
          </div>
        ) : (
        <ul className="space-y-2">
          {catalogue.map((task) => {
            const row = evidence.get(task.calibrationTaskKey);
            const calibrated = Boolean(row?.calibrated);
            return (
              <li
                key={task.calibrationTaskKey}
                className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2"
                data-company-dna-summary-task={task.calibrationTaskKey}
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium">
                    {deckV2TaskTitle(task.calibrationTaskKey, task.label)}
                  </p>
                    <p className="text-xs text-muted-foreground">
                      {calibrated
                        ? DNA_SOURCE_YOUR_CALIBRATION
                        : DNA_SOURCE_QUOTR_BENCHMARK}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-wrap gap-1.5">
                    <Link
                      href={`/app/setup/dna/${encodeURIComponent(task.calibrationTaskKey)}`}
                      className={cn(buttonVariants({ variant: "outline", size: "sm" }), "h-8")}
                    >
                      {calibrated ? DNA_RECALIBRATE : DNA_CALIBRATE}
                    </Link>
                    {calibrated && canCalibrate ? (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-8"
                        disabled={resetting === task.calibrationTaskKey}
                        onClick={() => setConfirmKey(task.calibrationTaskKey)}
                      >
                        {DNA_RESET_CTA}
                      </Button>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
        )}
        <div className="flex flex-col gap-2 sm:flex-row pb-[calc(5.5rem+env(safe-area-inset-bottom))] md:pb-0">
          {nextOptionalHref ? (
            <Link
              href={nextOptionalHref}
              className={cn(buttonVariants(), "min-h-11")}
              data-company-dna-keep-refining
            >
              {DNA_KEEP_REFINING}
            </Link>
          ) : null}
          <Link
            href="/app/setup?mode=improve&section=calibrate"
            className={cn(
              buttonVariants({ variant: nextOptionalHref ? "outline" : "default" }),
              "min-h-11"
            )}
          >
            {DNA_DONE}
          </Link>
        </div>
        <p className="text-xs text-muted-foreground">
          {status === "calibrated"
            ? formatDnaOptionalRemaining({
                optionalTotal: optionalCount,
                optionalCalibrated: catalogue.filter(
                  (task) =>
                    v2OptionalKeys(workAreaType).includes(
                      task.calibrationTaskKey
                    ) && Boolean(evidence.get(task.calibrationTaskKey)?.calibrated)
                ).length,
              }) ??
              "Key tasks complete. Optional refinement is available when you need it."
            : "Optional tasks are not required to use your key productivity."}
        </p>
      </CardContent>
      <Dialog open={confirmKey != null} onOpenChange={(open) => !open && setConfirmKey(null)}>
        <DialogContent showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>{DNA_RESET_CONFIRM_TITLE}</DialogTitle>
            <DialogDescription>{DNA_RESET_CONSEQUENCE}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setConfirmKey(null)}>
              Cancel
            </Button>
            <Button
              type="button"
              disabled={!confirmKey || resetting === confirmKey}
              onClick={() => confirmKey && void onReset(confirmKey)}
            >
              {DNA_RESET_CTA}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
