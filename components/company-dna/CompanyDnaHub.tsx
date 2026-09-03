"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
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
  listCompanyDnaTasksForWorkArea,
} from "@/lib/company-dna/catalogue";
import type { CompanyDnaHubState } from "@/lib/company-dna/actions";
import { cn } from "@/lib/utils";

type CompanyDnaHubProps = {
  state: CompanyDnaHubState;
  onSkip?: () => void;
};

export function CompanyDnaHub({ state, onSkip }: CompanyDnaHubProps) {
  const [showAll, setShowAll] = useState(
    state.preferredWorkAreaTypes.length === 0
  );

  const visible = useMemo(() => {
    if (showAll || state.preferredWorkAreaTypes.length === 0) {
      return state.progress;
    }
    const preferred = state.progress.filter((item) =>
      state.preferredWorkAreaTypes.includes(item.workAreaType)
    );
    return preferred.length > 0 ? preferred : state.progress;
  }, [showAll, state.preferredWorkAreaTypes, state.progress]);

  return (
    <Card data-company-dna-hub>
      <CardHeader>
        <CardTitle>Make Quotr price more like you</CardTitle>
        <CardDescription>
          Tell Quotr how your crew normally completes a few common tasks. We’ll
          use this to improve labour estimates. An approximate answer is fine.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm text-muted-foreground">
            One task at a time. You can reset to the Quotr benchmark later.
          </p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setShowAll((prev) => !prev)}
          >
            {showAll ? "Show preferred first" : "Show all"}
          </Button>
        </div>

        <ul className="space-y-3">
          {visible.map((area) => {
            const preferred = state.preferredWorkAreaTypes.includes(
              area.workAreaType
            );
            const nextTask = listCompanyDnaTasksForWorkArea(
              area.workAreaType
            ).find(
              (task) =>
                !area.tasks.some(
                  (status) =>
                    status.calibrationTaskKey === task.calibrationTaskKey &&
                    status.calibrated
                )
            );
            const href = nextTask
              ? `/app/setup/dna/${encodeURIComponent(nextTask.calibrationTaskKey)}`
              : `/app/setup/dna/${encodeURIComponent(area.tasks[0]?.calibrationTaskKey ?? "")}`;
            return (
              <li
                key={area.workAreaType}
                className="rounded-xl border bg-card p-4 space-y-2"
                data-company-dna-work-area={area.workAreaType}
              >
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <h3 className="text-sm font-medium">
                    {COMPANY_DNA_WORK_AREA_LABELS[area.workAreaType]}
                  </h3>
                  <span className="text-xs text-muted-foreground">
                    {area.calibratedCount} of {area.taskTotal} calibrated
                    {preferred ? " · Common for your company" : ""}
                  </span>
                </div>
                <p className="text-sm text-muted-foreground">
                  {area.statusLabel}
                </p>
                <Link
                  href={href}
                  className={cn(
                    buttonVariants({
                      size: "sm",
                      variant:
                        area.status === "benchmarks" ? "default" : "outline",
                    }),
                    "min-h-11"
                  )}
                >
                  {area.status === "benchmarks"
                    ? `Calibrate ${COMPANY_DNA_WORK_AREA_LABELS[area.workAreaType]}`
                    : "Continue / edit"}
                </Link>
              </li>
            );
          })}
        </ul>

        <div className="flex flex-wrap gap-2 border-t pt-4">
          <Button type="button" variant="ghost" onClick={() => onSkip?.()}>
            Do this later
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
