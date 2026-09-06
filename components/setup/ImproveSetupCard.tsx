"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { CompanySetupReadiness } from "@/lib/setup/readiness";
import { resolvePersonalisationNextStep } from "@/lib/setup/personalisation-ladder";

type ImproveSetupCardProps = {
  readiness: CompanySetupReadiness;
  /** When true, the org already has projects — keep the card calm. */
  hasProjects?: boolean;
};

export function ImproveSetupCard({
  readiness,
}: ImproveSetupCardProps) {
  if (readiness.needsFirstRunBasics) {
    return null;
  }

  const next = resolvePersonalisationNextStep({
    firstRunComplete: true,
    hasWorkTypePreferences: readiness.hasWorkTypePreferences,
    hasCalibration: readiness.hasCalibration,
    hasHighImpactCalibration: readiness.hasHighImpactCalibration,
    companyRateCount: readiness.companyRateCount,
    hasContactEmail: readiness.hasContactEmail,
    hasAddress: readiness.hasAddress,
    hasLogo: readiness.hasLogo,
    hasTimezone: readiness.hasTimezone,
    preferredWorkAreaTypes: readiness.preferredWorkAreaTypes,
    deckKeyTasksCalibrated: readiness.deckKeyTasksCalibrated,
    deckKeyTasksTotal: readiness.deckKeyTasksTotal,
  });

  if (!next) {
    return null;
  }

  return (
    <Card
      data-dashboard-prompt
      className="border-border/70 bg-muted/15 shadow-none"
    >
      <CardContent className="flex flex-col gap-3 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
        <div className="min-w-0">
          <p className="text-sm font-medium">{next.title}</p>
          <p className="mt-0.5 text-sm text-muted-foreground">{next.reason}</p>
          {next.helper ? (
            <p className="mt-1 text-xs text-muted-foreground">{next.helper}</p>
          ) : null}
        </div>
        <Button
          render={<Link href={next.href} />}
          className="h-9 w-full shrink-0 sm:w-auto"
        >
          {next.cta}
        </Button>
      </CardContent>
    </Card>
  );
}
