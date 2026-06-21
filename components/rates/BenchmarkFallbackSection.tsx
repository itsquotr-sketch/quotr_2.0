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
    <Card>
      <CardHeader>
        <CardTitle>Benchmark fallbacks</CardTitle>
        <CardDescription>
          When you do not have a user rate set, Quotr uses benchmark allowances
          so estimates can still be produced. You can improve accuracy by adding
          your own rates above.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm text-muted-foreground">Fallback status:</span>
          <Badge variant={benchmarkEnabled ? "secondary" : "outline"}>
            {benchmarkEnabled ? "Enabled" : "Disabled"}
          </Badge>
        </div>
        <p className="text-sm text-muted-foreground">
          When you do not have a rate set, Quotr uses benchmark allowances so
          estimates can still be produced. Add your own rates to improve
          accuracy.
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm text-muted-foreground">Status:</span>
          <Badge variant={benchmarkEnabled ? "secondary" : "outline"}>
            {benchmarkEnabled
              ? "Benchmark fallbacks enabled"
              : "Benchmark fallbacks disabled"}
          </Badge>
        </div>
        {!benchmarkEnabled ? (
          <p className="text-sm text-muted-foreground">
            With benchmarks disabled, missing rates may show as &ldquo;Rate
            missing&rdquo; in regenerated estimates.
          </p>
        ) : null}
        <p className="text-sm text-muted-foreground">
          Toggle benchmark fallbacks in Company defaults above. Estimates that
          show &ldquo;Using benchmark allowances&rdquo; can be improved by
          setting rates here, then regenerating.
        </p>
      </CardContent>
    </Card>
  );
}
