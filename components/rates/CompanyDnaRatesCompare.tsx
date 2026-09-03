"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  COMPANY_DNA_TASKS,
  COMPANY_DNA_WORK_AREA_LABELS,
  orderCompanyDnaWorkAreas,
} from "@/lib/company-dna/catalogue";
import { DNA_RATES_PRODUCTIVITY_HELPER, DNA_RESET_CTA } from "@/lib/company-dna/copy";
import { resetCompanyDnaCalibration } from "@/lib/company-dna/actions";
import { LABOUR_RATE_CATALOGUE } from "@/lib/rates/catalogue";
import type { RatesPageRate } from "@/lib/rates/types";
import { formatMoney } from "@/lib/rates/cost-first-presentation";
import { cn } from "@/lib/utils";

type CompanyDnaRatesCompareProps = {
  rates: RatesPageRate[];
  variant: "productivity" | "labour";
  preferredWorkAreaTypes?: string[];
  canCalibrate?: boolean;
  onChanged?: () => void;
};

function usedProductivitySource(rate: RatesPageRate | undefined): string {
  if (rate?.active && rate.cost_rate != null) {
    if (rate.source === "calibrated_productivity") {
      return "Your calibrated productivity";
    }
    return "Your rate";
  }
  return "Quotr benchmark";
}

function formatHoursPerUnit(value: number, unit: string): string {
  const displayUnit = unit === "m2" ? "m²" : unit;
  const rounded =
    Number.isInteger(value) || Math.abs(value) >= 1
      ? String(value)
      : String(value);
  return `${rounded} h/${displayUnit}`;
}

export function CompanyDnaRatesCompare({
  rates,
  variant,
  preferredWorkAreaTypes = [],
  canCalibrate = false,
  onChanged,
}: CompanyDnaRatesCompareProps) {
  const [resetting, setResetting] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const orderedTasks = useMemo(() => {
    const order = orderCompanyDnaWorkAreas(preferredWorkAreaTypes);
    return order.flatMap((workAreaType) =>
      COMPANY_DNA_TASKS.filter((task) => task.workAreaType === workAreaType)
    );
  }, [preferredWorkAreaTypes]);

  async function onReset(taskKey: string) {
    setResetting(taskKey);
    setNotice(null);
    const outcome = await resetCompanyDnaCalibration(taskKey);
    setResetting(null);
    if (outcome.error) {
      setNotice(outcome.error);
      return;
    }
    setNotice("Future estimates will use the Quotr benchmark for this task.");
    onChanged?.();
  }

  if (variant === "labour") {
    const carpenter = LABOUR_RATE_CATALOGUE.find(
      (entry) => entry.item_key === "labour.carpenter.hour"
    );
    if (!carpenter) return null;
    const row = rates.find(
      (rate) => rate.item_key === carpenter.item_key && rate.active
    );
    return (
      <div
        className="rounded-xl border p-4 space-y-2 pb-[calc(1.5rem+env(safe-area-inset-bottom))] md:pb-4"
        data-company-dna-rate-compare="labour"
      >
        <h3 className="text-sm font-medium">{carpenter.label}</h3>
        <p className="text-sm text-muted-foreground">
          Quotr benchmark: {formatMoney(carpenter.defaultCostRate ?? 60)}/hr
        </p>
        <p className="text-sm text-muted-foreground">
          Your rate:{" "}
          {row?.cost_rate != null ? `${formatMoney(row.cost_rate)}/hr` : "Not set"}
        </p>
        <p className="text-sm">
          Used:{" "}
          {row?.cost_rate != null
            ? `${formatMoney(row.cost_rate)}/hr — Your rate`
            : `${formatMoney(carpenter.defaultCostRate ?? 60)}/hr — Quotr benchmark`}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3" data-company-dna-rate-compare="productivity">
      <p className="text-sm text-muted-foreground">{DNA_RATES_PRODUCTIVITY_HELPER}</p>
      {notice ? (
        <p className="text-sm text-muted-foreground" role="status">
          {notice}
        </p>
      ) : null}
      {orderedTasks.map((task) => {
        const row = rates.find(
          (rate) =>
            rate.item_key === task.productivityRateKey &&
            rate.rate_type === "productivity" &&
            rate.active
        );
        const used = usedProductivitySource(row);
        const calibrated =
          row?.active &&
          row.cost_rate != null &&
          row.source === "calibrated_productivity";
        return (
          <div
            key={task.calibrationTaskKey}
            className="rounded-xl border p-4 space-y-2"
            data-company-dna-rate-task={task.calibrationTaskKey}
          >
            <h3 className="text-sm font-medium">{task.label}</h3>
            <p className="text-xs text-muted-foreground">
              {COMPANY_DNA_WORK_AREA_LABELS[task.workAreaType]}
            </p>
            <p className="text-sm text-muted-foreground">
              Quotr benchmark:{" "}
              {formatHoursPerUnit(task.benchmarkProductivity, task.authorityUnit)}
            </p>
            <p className="text-sm text-muted-foreground">
              Your calibrated productivity:{" "}
              {row?.cost_rate != null
                ? formatHoursPerUnit(row.cost_rate, task.authorityUnit)
                : "Not calibrated"}
            </p>
            <p className="text-sm">Used: {used}</p>
            {canCalibrate ? (
              <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap pt-1">
                <Link
                  href={`/app/setup/dna/${encodeURIComponent(task.calibrationTaskKey)}`}
                  className={cn(buttonVariants({ variant: "outline", size: "sm" }), "min-h-11")}
                >
                  Edit calibration
                </Link>
                {calibrated ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="min-h-11"
                    disabled={resetting === task.calibrationTaskKey}
                    onClick={() => void onReset(task.calibrationTaskKey)}
                  >
                    {DNA_RESET_CTA}
                  </Button>
                ) : null}
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
