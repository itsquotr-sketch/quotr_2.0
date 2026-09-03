"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
  });

  if (!next) {
    return null;
  }

  return (
    <Card className="border-border/70 bg-muted/15 shadow-none">
      <CardHeader className="pb-3">
        <CardTitle className="text-base">{next.title}</CardTitle>
        <CardDescription>{next.reason}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        {next.helper ? (
          <p className="text-xs text-muted-foreground">{next.helper}</p>
        ) : (
          <span />
        )}
        <Button render={<Link href={next.href} />} className="h-10 w-full sm:w-auto">
          {next.cta}
        </Button>
      </CardContent>
    </Card>
  );
}
