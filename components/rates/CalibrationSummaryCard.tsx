"use client";

import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { buildCalibrationSummary } from "@/lib/rates/calibration";
import type { RatesPageState } from "@/lib/rates/types";

type CalibrationSummaryCardProps = {
  state: RatesPageState;
};

function statusVariant(
  status: ReturnType<typeof buildCalibrationSummary>["status"]
): "default" | "secondary" | "outline" {
  switch (status) {
    case "good_setup":
      return "default";
    case "needs_rates":
      return "outline";
    case "using_mostly_benchmarks":
      return "secondary";
  }
}

function formatLastUpdated(value: string | null): string {
  if (!value) return "—";
  try {
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(value));
  } catch {
    return "—";
  }
}

export function CalibrationSummaryCard({ state }: CalibrationSummaryCardProps) {
  const summary = buildCalibrationSummary(state);

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle>Calibration summary</CardTitle>
            <CardDescription className="mt-1.5">
              A quick view of how well Quotr is tuned to your business.
            </CardDescription>
          </div>
          <Badge variant={statusVariant(summary.status)}>
            {summary.statusLabel}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <div>
            <dt className="text-xs text-muted-foreground">Default margin</dt>
            <dd className="mt-0.5 text-sm font-medium">
              {summary.defaultMarginPercent}%
            </dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Active rates</dt>
            <dd className="mt-0.5 text-sm font-medium">
              {summary.activeRateCount}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">
              Recommended rates missing
            </dt>
            <dd className="mt-0.5 text-sm font-medium">
              {summary.recommendedMissingCount}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">
              Benchmark fallbacks
            </dt>
            <dd className="mt-0.5 text-sm font-medium">
              {summary.benchmarkFallbackEnabled ? "Enabled" : "Disabled"}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Last rate update</dt>
            <dd className="mt-0.5 text-sm font-medium">
              {formatLastUpdated(summary.lastUpdatedAt)}
            </dd>
          </div>
        </dl>
      </CardContent>
    </Card>
  );
}
