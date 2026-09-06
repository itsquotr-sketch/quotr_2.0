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
  DNA_RW_INTRO_BODY,
  DNA_RW_INTRO_TITLE,
  DNA_RW_NORMAL_CONDITIONS,
} from "@/lib/company-dna/copy";
import {
  COMPANY_DNA_RW_SYSTEMS,
  COMPANY_DNA_RW_SYSTEM_LABELS,
  nextCompanyDnaRwV2Task,
  rwTaskHref,
  type CompanyDnaRwSystemProgress,
} from "@/lib/company-dna/rw-v2";
import { workAreaHubCta } from "@/lib/company-dna/progress";
import { cn } from "@/lib/utils";

type CompanyDnaRwIntroProps = {
  systems: CompanyDnaRwSystemProgress[];
  calibratedTaskKeys: string[];
  canCalibrate: boolean;
  firstTaskHref: string;
};

export function CompanyDnaRwIntro({
  systems,
  calibratedTaskKeys,
  canCalibrate,
  firstTaskHref,
}: CompanyDnaRwIntroProps) {
  return (
    <Card
      data-company-dna-rw-intro
      className="mx-auto w-full max-w-xl pb-[calc(1.5rem+env(safe-area-inset-bottom))] md:pb-0"
    >
      <CardHeader>
        <CardTitle>{DNA_RW_INTRO_TITLE}</CardTitle>
        <CardDescription>{DNA_RW_INTRO_BODY}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <p
          className="rounded-lg border bg-muted/40 px-3 py-2 text-sm text-muted-foreground"
          data-company-dna-rw-normal
        >
          {DNA_RW_NORMAL_CONDITIONS}
        </p>
        <p className="text-sm text-muted-foreground">
          Calibrate timber, sleeper, or masonry when you use them. Shared work
          such as excavation is reused across systems.
        </p>
        <ul className="space-y-2" data-company-dna-rw-systems>
          {COMPANY_DNA_RW_SYSTEMS.map((system) => {
            const row = systems.find((item) => item.system === system);
            if (!row) return null;
            const next = nextCompanyDnaRwV2Task({
              calibratedTaskKeys,
              system,
            });
            const href = next
              ? rwTaskHref(next.calibrationTaskKey, system)
              : firstTaskHref;
            const cta = workAreaHubCta(row.status);
            return (
              <li
                key={system}
                className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2"
                data-company-dna-rw-system={system}
                data-company-dna-rw-system-status={row.status}
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium">
                    {COMPANY_DNA_RW_SYSTEM_LABELS[system]}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {row.tier1Calibrated} of {row.tier1Total} key tasks ·{" "}
                    {row.statusLabel}
                  </p>
                </div>
                {canCalibrate ? (
                  <Link
                    href={href}
                    className={cn(
                      buttonVariants({
                        size: "sm",
                        variant: row.status === "benchmarks" ? "default" : "outline",
                      }),
                      "min-h-11 shrink-0"
                    )}
                    data-company-dna-rw-system-start={system}
                  >
                    {cta}
                  </Link>
                ) : null}
              </li>
            );
          })}
        </ul>
        <div className="flex flex-col gap-2 sm:flex-row pb-[calc(5.5rem+env(safe-area-inset-bottom))] md:pb-0">
          {canCalibrate ? (
            <Link
              href={firstTaskHref}
              className={cn(buttonVariants(), "min-h-11")}
              data-company-dna-rw-start
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
            You can look at Retaining Wall calibration, but you don’t have
            permission to change it.
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}
