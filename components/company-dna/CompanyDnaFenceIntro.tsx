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
  DNA_FENCE_INTRO_BODY,
  DNA_FENCE_INTRO_TITLE,
  DNA_FENCE_NORMAL_CONDITIONS,
} from "@/lib/company-dna/copy";
import { cn } from "@/lib/utils";

type CompanyDnaFenceIntroProps = {
  firstTaskHref: string;
  canCalibrate: boolean;
};

export function CompanyDnaFenceIntro({
  firstTaskHref,
  canCalibrate,
}: CompanyDnaFenceIntroProps) {
  return (
    <Card
      data-company-dna-fence-intro
      className="mx-auto w-full max-w-xl pb-[calc(1.5rem+env(safe-area-inset-bottom))] md:pb-0"
    >
      <CardHeader>
        <CardTitle>{DNA_FENCE_INTRO_TITLE}</CardTitle>
        <CardDescription>{DNA_FENCE_INTRO_BODY}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <p
          className="rounded-lg border bg-muted/40 px-3 py-2 text-sm text-muted-foreground"
          data-company-dna-fence-normal
        >
          {DNA_FENCE_NORMAL_CONDITIONS}
        </p>
        <div className="flex flex-col gap-2 sm:flex-row pb-[calc(5.5rem+env(safe-area-inset-bottom))] md:pb-0">
          {canCalibrate ? (
            <Link
              href={firstTaskHref}
              className={cn(buttonVariants(), "min-h-11")}
              data-company-dna-fence-start
            >
              Start
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
            You can look at Fence calibration, but you don’t have permission to
            change it.
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}
