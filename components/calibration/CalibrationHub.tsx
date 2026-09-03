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
import { orderCalibrationScenarios } from "@/lib/calibration/catalogue";
import type { CalibrationScenarioStatus } from "@/lib/calibration/persistence-types";
import { cn } from "@/lib/utils";

type CalibrationHubProps = {
  preferredWorkAreaTypes: string[];
  statuses?: CalibrationScenarioStatus[];
  onSkip?: () => void;
};

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

export function CalibrationHub({
  preferredWorkAreaTypes,
  statuses = [],
  onSkip,
}: CalibrationHubProps) {
  const [showAll, setShowAll] = useState(preferredWorkAreaTypes.length === 0);
  const statusById = useMemo(() => {
    const map = new Map<string, CalibrationScenarioStatus>();
    for (const status of statuses) map.set(status.scenarioId, status);
    return map;
  }, [statuses]);

  const scenarios = useMemo(() => {
    const ordered = orderCalibrationScenarios(preferredWorkAreaTypes);
    if (showAll || preferredWorkAreaTypes.length === 0) return ordered;
    const preferred = ordered.filter((s) =>
      preferredWorkAreaTypes.includes(s.workAreaType)
    );
    return preferred.length > 0 ? preferred : ordered;
  }, [preferredWorkAreaTypes, showAll]);

  const preferredHaveScenarios = useMemo(
    () =>
      preferredWorkAreaTypes.some((type) =>
        scenarios.some((scenario) => scenario.workAreaType === type)
      ),
    [preferredWorkAreaTypes, scenarios]
  );

  const showingFallbackCatalogue =
    preferredWorkAreaTypes.length > 0 &&
    !showAll &&
    !preferredHaveScenarios;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Historical pricing notes</CardTitle>
        <CardDescription>
          These older example-job comparisons are kept as evidence. They do not
          change estimates. Calibrate crew productivity from Make Quotr price
          more like you.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm text-muted-foreground">
            ~3 minutes per example. Optional.
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

        {showingFallbackCatalogue ? (
          <p className="rounded-lg border border-dashed px-3 py-2 text-sm text-muted-foreground">
            No calibration examples yet for your preferred work types — showing
            Deck and Bathroom so you can still give Quotr a feel for how you
            price.
          </p>
        ) : null}

        <ul className="space-y-3">
          {scenarios.map((scenario) => {
            const preferred = preferredWorkAreaTypes.includes(
              scenario.workAreaType
            );
            const status = statusById.get(scenario.id);
            const calibrated = Boolean(status?.calibrated && status.latest);
            return (
              <li
                key={scenario.id}
                className="rounded-xl border bg-card p-4 space-y-2"
              >
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <h3 className="text-sm font-medium">{scenario.title}</h3>
                  <span className="text-xs text-muted-foreground">
                    {calibrated ? "Calibrated" : "Not calibrated"}
                    {preferred ? " · Common for your company" : ""}
                  </span>
                </div>
                <p className="text-sm text-muted-foreground">
                  {scenario.summary}
                </p>
                {calibrated && status?.latest ? (
                  <p className="text-xs text-muted-foreground">
                    Latest {formatDate(status.latest.created_at)}
                    {status.latest.confidence
                      ? ` · ${status.latest.confidence} confidence`
                      : ""}
                  </p>
                ) : null}
                <div className="flex flex-wrap gap-2">
                  <Link
                    href={`/app/setup/calibrate/${encodeURIComponent(scenario.id)}`}
                    className={cn(
                      buttonVariants({
                        size: "sm",
                        variant: calibrated ? "outline" : "default",
                      })
                    )}
                  >
                    {calibrated
                      ? "View / Recalibrate"
                      : `Calibrate ${scenario.title}`}
                  </Link>
                </div>
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
