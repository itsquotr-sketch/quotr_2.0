"use client";

import Link from "next/link";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  COMPANY_DNA_WORK_AREA_LABELS,
} from "@/lib/company-dna/catalogue";
import type { CompanyDnaHubState } from "@/lib/company-dna/actions";
import {
  DNA_HUB_CONCEPT,
  DNA_HUB_INTRO,
  DNA_HUB_TITLE,
  formatDnaOptionalRemaining,
  formatDnaProgressCopy,
  formatDnaSupportedTaskCoverage,
} from "@/lib/company-dna/copy";
import {
  isCompanyDnaV2WorkArea,
  nextCompanyDnaV2Task,
  v2HubHref,
} from "@/lib/company-dna/v2-ui";
import { rwAllSystemsCalibrated } from "@/lib/company-dna/rw-v2";
import { nextCompanyDnaTask, workAreaHubCta } from "@/lib/company-dna/progress";
import { cn } from "@/lib/utils";

type CompanyDnaHubProps = {
  state: CompanyDnaHubState;
  onSkip?: () => void;
};

export function CompanyDnaHub({ state, onSkip }: CompanyDnaHubProps) {
  return (
    <Card
      data-company-dna-hub
      className="mx-auto w-full max-w-2xl pb-[calc(1.5rem+env(safe-area-inset-bottom))] md:pb-0"
    >
      <CardHeader>
        <CardTitle>{DNA_HUB_TITLE}</CardTitle>
        <CardDescription>{DNA_HUB_INTRO}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground" data-company-dna-hub-concept>
          {DNA_HUB_CONCEPT}
        </p>
        <p className="text-sm text-muted-foreground">
          Your usual work is listed first. Key tasks first. You can reset to the
          Quotr benchmark later.
        </p>

        <ul className="space-y-3">
          {state.progress.map((area) => {
            const preferred = state.preferredWorkAreaTypes.includes(
              area.workAreaType
            );
            const calibratedKeys = area.tasks
              .filter((status) => status.calibrated)
              .map((status) => status.calibrationTaskKey);
            const v2 = isCompanyDnaV2WorkArea(area.workAreaType);
            const nextTask = v2
              ? nextCompanyDnaV2Task({
                  workAreaType: area.workAreaType,
                  calibratedTaskKeys: calibratedKeys,
                })
              : nextCompanyDnaTask({
                  workAreaType: area.workAreaType,
                  calibratedTaskKeys: calibratedKeys,
                });
            const href = v2
              ? v2HubHref({
                  workAreaType: area.workAreaType,
                  status: area.status,
                  nextTaskKey: nextTask?.calibrationTaskKey,
                })
              : nextTask
                ? `/app/setup/dna/${encodeURIComponent(nextTask.calibrationTaskKey)}`
                : `/app/setup/dna/${encodeURIComponent(area.tasks[0]?.calibrationTaskKey ?? "")}`;
            const cta = workAreaHubCta(area.status);
            const compact =
              area.status === "calibrated" &&
              (area.workAreaType !== "retaining_wall" ||
                rwAllSystemsCalibrated(calibratedKeys));
            const keyProgress =
              area.workAreaType === "retaining_wall"
                ? null
                : `${area.highImpactCalibrated} of ${area.highImpactTotal} key tasks`;
            const optionalNote =
              area.status === "calibrated"
                ? formatDnaOptionalRemaining({
                    optionalTotal: area.optionalTotal,
                    optionalCalibrated: area.optionalCalibrated,
                  })
                : null;
            return (
              <li
                key={area.workAreaType}
                className={cn(
                  "rounded-xl border bg-card p-3 sm:p-4 space-y-2"
                )}
                data-company-dna-work-area={area.workAreaType}
                data-company-dna-status={area.status}
                data-company-dna-generation={area.generation}
                data-setup-compact={compact ? "true" : undefined}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="text-sm font-medium">
                      {COMPANY_DNA_WORK_AREA_LABELS[area.workAreaType]}
                    </h3>
                    <p className="text-xs text-muted-foreground">
                      {area.statusLabel}
                      {preferred ? " · Common for your company" : ""}
                    </p>
                  </div>
                  <Link
                    href={href}
                    className={cn(
                      buttonVariants({
                        size: "sm",
                        variant: area.status === "benchmarks" ? "default" : "outline",
                      }),
                      "min-h-11 shrink-0 scroll-mb-[5.5rem]"
                    )}
                    data-company-dna-hub-cta
                  >
                    {cta}
                  </Link>
                </div>
                {keyProgress ? (
                  <p className="text-sm text-muted-foreground">{keyProgress}</p>
                ) : null}
                {area.workAreaType === "retaining_wall" ? (
                  <ul className="space-y-0.5 text-sm text-muted-foreground">
                    {(area.systemLines ?? []).map((line) => (
                      <li key={line}>{line}</li>
                    ))}
                  </ul>
                ) : area.status === "calibrated" && area.taskTotal > area.highImpactTotal ? (
                  <p className="text-xs text-muted-foreground">
                    {formatDnaSupportedTaskCoverage({
                      calibratedCount: area.calibratedCount,
                      taskTotal: area.taskTotal,
                    })}
                  </p>
                ) : area.progressDetail ? (
                  <p className="text-sm text-muted-foreground">
                    {area.progressDetail}
                  </p>
                ) : !v2 ? (
                  <p className="text-sm text-muted-foreground">
                    {formatDnaProgressCopy(area)}
                  </p>
                ) : null}
                {optionalNote ? (
                  <p className="text-xs text-muted-foreground">{optionalNote}</p>
                ) : null}
              </li>
            );
          })}
        </ul>

        <div className="flex flex-wrap gap-2 border-t pt-4 pb-[calc(4.5rem+env(safe-area-inset-bottom))] md:pb-0">
          <Button type="button" variant="ghost" className="min-h-11" onClick={() => onSkip?.()}>
            Do this later
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
