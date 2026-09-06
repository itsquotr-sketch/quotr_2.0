"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { CompanyDnaTaskStatus } from "@/lib/company-dna/actions";
import { resetCompanyDnaCalibration } from "@/lib/company-dna/actions";
import {
  DNA_DONE,
  DNA_KEEP_REFINING,
  DNA_RESET_CONSEQUENCE,
  DNA_RESET_CONFIRM_TITLE,
  DNA_RESET_CTA,
  deckV2TaskTitle,
} from "@/lib/company-dna/copy";
import {
  COMPANY_DNA_DECK_OPTIONAL_KEYS,
  listCompanyDnaDeckV2UiTasks,
} from "@/lib/company-dna/deck-v2";
import { companyDnaWorkAreaStatusLabel } from "@/lib/company-dna/derive";
import { cn } from "@/lib/utils";

type CompanyDnaDeckSummaryProps = {
  status: "benchmarks" | "partly" | "calibrated";
  tier1Calibrated: number;
  tier1Total: number;
  tasks: CompanyDnaTaskStatus[];
  nextOptionalHref: string | null;
  canCalibrate: boolean;
};

export function CompanyDnaDeckSummary({
  status,
  tier1Calibrated,
  tier1Total,
  tasks,
  nextOptionalHref,
  canCalibrate,
}: CompanyDnaDeckSummaryProps) {
  const router = useRouter();
  const [resetting, setResetting] = useState<string | null>(null);
  const [confirmKey, setConfirmKey] = useState<string | null>(null);
  const catalogue = listCompanyDnaDeckV2UiTasks();
  const evidence = new Map(
    tasks.map((task) => [task.calibrationTaskKey, task])
  );

  async function onReset(taskKey: string) {
    setResetting(taskKey);
    const outcome = await resetCompanyDnaCalibration(taskKey);
    setResetting(null);
    setConfirmKey(null);
    if (!outcome.error) router.refresh();
  }

  return (
    <Card
      data-company-dna-deck-summary
      className="mx-auto w-full max-w-xl pb-[calc(1.5rem+env(safe-area-inset-bottom))] md:pb-0"
    >
      <CardHeader>
        <CardTitle>Deck calibration</CardTitle>
        <CardDescription>
          Key tasks: {tier1Calibrated} / {tier1Total} calibrated
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm font-medium" data-company-dna-deck-summary-status>
          {companyDnaWorkAreaStatusLabel(status)}
        </p>
        <ul className="space-y-2">
          {catalogue.map((task) => {
            const row = evidence.get(task.calibrationTaskKey);
            const calibrated = Boolean(row?.calibrated);
            return (
              <li
                key={task.calibrationTaskKey}
                className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2"
                data-company-dna-summary-task={task.calibrationTaskKey}
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium">
                    {deckV2TaskTitle(task.calibrationTaskKey, task.label)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {calibrated ? "Your calibration" : "Quotr benchmark"}
                  </p>
                </div>
                <div className="flex shrink-0 flex-wrap gap-1.5">
                  <Link
                    href={`/app/setup/dna/${encodeURIComponent(task.calibrationTaskKey)}`}
                    className={cn(buttonVariants({ variant: "outline", size: "sm" }), "h-8")}
                  >
                    Edit
                  </Link>
                  {calibrated && canCalibrate ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-8"
                      disabled={resetting === task.calibrationTaskKey}
                      onClick={() => setConfirmKey(task.calibrationTaskKey)}
                    >
                      Reset
                    </Button>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
        <div className="flex flex-col gap-2 sm:flex-row pb-[calc(5.5rem+env(safe-area-inset-bottom))] md:pb-0">
          {nextOptionalHref ? (
            <Link
              href={nextOptionalHref}
              className={cn(buttonVariants(), "min-h-11")}
              data-company-dna-keep-refining
            >
              {DNA_KEEP_REFINING}
            </Link>
          ) : null}
          <Link
            href="/app/setup?mode=improve&section=calibrate"
            className={cn(
              buttonVariants({ variant: nextOptionalHref ? "outline" : "default" }),
              "min-h-11"
            )}
          >
            {DNA_DONE}
          </Link>
        </div>
        <p className="text-xs text-muted-foreground">
          Optional tasks: {COMPANY_DNA_DECK_OPTIONAL_KEYS.length}. They are not
          required.
        </p>
      </CardContent>
      <Dialog open={confirmKey != null} onOpenChange={(open) => !open && setConfirmKey(null)}>
        <DialogContent showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>{DNA_RESET_CONFIRM_TITLE}</DialogTitle>
            <DialogDescription>{DNA_RESET_CONSEQUENCE}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setConfirmKey(null)}>
              Cancel
            </Button>
            <Button
              type="button"
              disabled={!confirmKey || resetting === confirmKey}
              onClick={() => confirmKey && void onReset(confirmKey)}
            >
              {DNA_RESET_CTA}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
