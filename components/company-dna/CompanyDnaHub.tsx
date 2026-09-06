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
import { formatDnaProgressCopy } from "@/lib/company-dna/copy";
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
      className="pb-[calc(1.5rem+env(safe-area-inset-bottom))] md:pb-0"
    >
      <CardHeader>
        <CardTitle>Make Quotr price more like you</CardTitle>
        <CardDescription>
          Tell Quotr how your crew normally completes a few common tasks. We’ll
          use this to improve labour estimates. An approximate answer is fine.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
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
            const nextTask = nextCompanyDnaTask({
              workAreaType: area.workAreaType,
              calibratedTaskKeys: calibratedKeys,
            });
            const href = nextTask
              ? `/app/setup/dna/${encodeURIComponent(nextTask.calibrationTaskKey)}`
              : `/app/setup/dna/${encodeURIComponent(area.tasks[0]?.calibrationTaskKey ?? "")}`;
            const cta = workAreaHubCta(area.status);
            const compact = area.status === "calibrated";
            return (
              <li
                key={area.workAreaType}
                className={cn(
                  "rounded-xl border bg-card",
                  compact ? "px-3 py-2 sm:px-4" : "p-3 sm:p-4 space-y-2"
                )}
                data-company-dna-work-area={area.workAreaType}
                data-company-dna-status={area.status}
                data-setup-compact={compact ? "true" : undefined}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="text-sm font-medium">
                      {COMPANY_DNA_WORK_AREA_LABELS[area.workAreaType]}
                    </h3>
                    <p className="text-xs text-muted-foreground">
                      {compact
                        ? area.statusLabel
                        : formatDnaProgressCopy(area)}
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
                {compact ? null : (
                  <p className="text-sm text-muted-foreground">
                    {area.statusLabel}
                  </p>
                )}
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
