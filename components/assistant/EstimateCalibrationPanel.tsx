"use client";

import Link from "next/link";
import {
  buildCalibrationHints,
  buildEstimateCalibrationSummary,
} from "@/lib/estimate/estimate-calibration";
import { classifyRateSource } from "@/lib/estimate/rate-source-labels";
import type { EstimateLineItem } from "@/components/assistant/types";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

type EstimateCalibrationPanelProps = {
  lineItems: EstimateLineItem[];
};

function rateSourceBadgeVariant(source: string) {
  const type = classifyRateSource(source);
  switch (type) {
    case "user_rate":
    case "work_area_rate":
      return "default" as const;
    case "missing":
      return "outline" as const;
    default:
      return "secondary" as const;
  }
}

export function EstimateCalibrationPanel({
  lineItems,
}: EstimateCalibrationPanelProps) {
  const summary = buildEstimateCalibrationSummary(lineItems);
  const hints = buildCalibrationHints(lineItems, 5);

  return (
    <section className="space-y-3">
      <h3 className="text-sm font-semibold tracking-tight">Calibration</h3>
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Rate usage in this estimate</CardTitle>
          <CardDescription>
            Add rates for benchmark items to improve future estimates.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <dt className="text-xs text-muted-foreground">Your rates</dt>
              <dd className="text-sm font-medium">{summary.userRateCount} items</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">
                Benchmark allowances
              </dt>
              <dd className="text-sm font-medium">{summary.benchmarkCount} items</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">
                Fallback assumptions
              </dt>
              <dd className="text-sm font-medium">{summary.fallbackCount} items</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Missing rates</dt>
              <dd className="text-sm font-medium">{summary.missingCount} items</dd>
            </div>
          </dl>

          {hints.length > 0 ? (
            <div className="rounded-xl border bg-muted/20 px-4 py-3">
              <p className="text-xs font-medium text-muted-foreground">
                Improve this estimate
              </p>
              <ul className="mt-2 space-y-1.5 text-sm">
                {hints.map((hint) => (
                  <li key={hint.itemKey} className="flex items-start gap-2">
                    <span className="text-muted-foreground">•</span>
                    <span>{hint.message}</span>
                  </li>
                ))}
              </ul>
              <Link
                href="/app/rates"
                className="mt-3 inline-block text-sm text-primary underline-offset-2 hover:underline"
              >
                Open Rates
              </Link>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </section>
  );
}

export function RateSourceBadge({ source }: { source: string }) {
  return (
    <Badge variant={rateSourceBadgeVariant(source)} className="text-[10px]">
      {source}
    </Badge>
  );
}
