"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { OrganisationSettings } from "@/components/setup/types";

type BenchmarkFallbackSectionProps = {
  settings: OrganisationSettings | null;
};

export function BenchmarkFallbackSection({
  settings,
}: BenchmarkFallbackSectionProps) {
  const benchmarkEnabled = settings?.allow_benchmark_rates ?? true;

  return (
    <Card className="border-dashed border-border/80 bg-muted/10 shadow-none">
      <CardHeader>
        <div className="flex flex-wrap items-center gap-2">
          <CardTitle className="text-base">Benchmark fallback rates</CardTitle>
          <Badge variant="outline" className="text-[10px] font-normal">
            Reference only
          </Badge>
        </div>
        <CardDescription>
          Industry benchmark rates used only when your own rate is missing. These
          are separate from your company rates above.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm text-muted-foreground">Status:</span>
          <Badge variant={benchmarkEnabled ? "secondary" : "outline"}>
            {benchmarkEnabled
              ? "Benchmark fallbacks enabled"
              : "Benchmark fallbacks disabled"}
          </Badge>
        </div>
        <p className="text-sm text-muted-foreground">
          When enabled, Quotr uses benchmark allowances during estimating if a
          matching company rate is not set. Add your own labour, scope and
          material rates to reduce reliance on benchmarks.
        </p>
        {!benchmarkEnabled ? (
          <p className="text-sm text-muted-foreground">
            With benchmarks disabled, missing rates may show as &ldquo;Rate
            missing&rdquo; in regenerated estimates.
          </p>
        ) : null}
        <p className="text-xs text-muted-foreground">
          Toggle benchmark fallbacks in Company defaults. Estimates that show
          &ldquo;Using benchmark allowances&rdquo; can be improved by setting
          rates here, then regenerating.
        </p>
      </CardContent>
    </Card>
  );
}
