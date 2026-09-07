"use client";

import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  DNA_BATHROOM_INTRO_BODY,
  DNA_BATHROOM_INTRO_TITLE,
  DNA_BATHROOM_NORMAL_CONDITIONS,
} from "@/lib/company-dna/copy";
import { cn } from "@/lib/utils";

type CompanyDnaBathroomIntroProps = {
  firstTaskHref: string;
  canCalibrate: boolean;
};

export function CompanyDnaBathroomIntro({
  firstTaskHref,
  canCalibrate,
}: CompanyDnaBathroomIntroProps) {
  return (
    <Card
      data-company-dna-bathroom-intro
      className="mx-auto w-full max-w-xl pb-[calc(1.5rem+env(safe-area-inset-bottom))] md:pb-0"
    >
      <CardHeader>
        <CardTitle>{DNA_BATHROOM_INTRO_TITLE}</CardTitle>
        <CardDescription>{DNA_BATHROOM_INTRO_BODY}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <p
          className="rounded-lg border bg-muted/40 px-3 py-2 text-sm text-muted-foreground"
          data-company-dna-bathroom-normal
        >
          {DNA_BATHROOM_NORMAL_CONDITIONS}
        </p>
        <div className="flex flex-col gap-2 sm:flex-row pb-[calc(5.5rem+env(safe-area-inset-bottom))] md:pb-0">
          {canCalibrate ? (
            <Link
              href={firstTaskHref}
              className={cn(buttonVariants(), "min-h-11")}
              data-company-dna-bathroom-start
            >
              Start calibration
            </Link>
          ) : null}
          <Link
            href="/app/setup?mode=improve&section=calibrate"
            className={cn(buttonVariants({ variant: "ghost" }), "min-h-11")}
          >
            Back
          </Link>
        </div>
        {!canCalibrate ? (
          <p className="text-sm text-muted-foreground">
            You can look at Bathroom calibration, but you don’t have permission to
            change it.
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}
