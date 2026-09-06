"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  COMPANY_DNA_WORK_AREA_LABELS,
} from "@/lib/company-dna/catalogue";
import { DNA_RATES_PRODUCTIVITY_HELPER, DNA_RESET_CTA } from "@/lib/company-dna/copy";
import { resetCompanyDnaCalibration } from "@/lib/company-dna/actions";
import { LABOUR_RATE_CATALOGUE } from "@/lib/rates/catalogue";
import { summarizeProductivityWorkAreas } from "@/lib/rates/productivity-work-area-summary";
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
  const [openAreas, setOpenAreas] = useState<Record<string, boolean>>({});

  const groups = useMemo(
    () => summarizeProductivityWorkAreas(rates, preferredWorkAreaTypes),
    [rates, preferredWorkAreaTypes]
  );

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
        className="rounded-lg border border-border/60 px-3 py-2.5"
        data-company-dna-rate-compare="labour"
      >
        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
          <h3 className="text-sm font-medium">{carpenter.label}</h3>
          <p className="text-xs text-muted-foreground">
            {row?.cost_rate != null ? "Your rate" : "Quotr benchmark"}
          </p>
        </div>
        <p className="mt-1 text-sm tabular-nums">
          Your rate:{" "}
          {row?.cost_rate != null ? `${formatMoney(row.cost_rate)}/hr` : "—"}
        </p>
        <p className="text-sm text-muted-foreground tabular-nums">
          Quotr benchmark: {formatMoney(carpenter.defaultCostRate ?? 60)}/hr
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
    <div className="space-y-2" data-company-dna-rate-compare="productivity">
      <p className="text-sm text-muted-foreground">{DNA_RATES_PRODUCTIVITY_HELPER}</p>
      {notice ? (
        <p className="text-sm text-muted-foreground" role="status">
          {notice}
        </p>
      ) : null}
      {groups.map((group) => {
        const open = Boolean(openAreas[group.workAreaType]);
        return (
          <div
            key={group.workAreaType}
            className="rounded-lg border border-border/60"
            data-productivity-work-area={group.workAreaType}
          >
            <div className="flex flex-wrap items-center gap-2 px-3 py-2.5">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">{group.label}</p>
                <p className="text-xs text-muted-foreground">
                  {group.calibratedCount} of {group.taskTotal} tasks calibrated
                </p>
                <p className="text-xs text-muted-foreground">{group.statusLabel}</p>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 shrink-0"
                onClick={() =>
                  setOpenAreas((prev) => ({
                    ...prev,
                    [group.workAreaType]: !open,
                  }))
                }
              >
                {open ? "Hide" : group.cta}
              </Button>
            </div>
            {open ? (
              <div className="space-y-2 border-t border-border/60 px-3 py-2">
                {group.tasks.map((row) => {
                  const rate = rates.find(
                    (item) =>
                      item.item_key === row.task.productivityRateKey &&
                      item.rate_type === "productivity" &&
                      item.active
                  );
                  const used = usedProductivitySource(rate);
                  const calibrated =
                    rate?.active &&
                    rate.cost_rate != null &&
                    rate.source === "calibrated_productivity";
                  return (
                    <div
                      key={row.task.calibrationTaskKey}
                      className="rounded-md bg-muted/20 px-2.5 py-2"
                      data-company-dna-rate-task={row.task.calibrationTaskKey}
                    >
                      <p className="text-sm font-medium">{row.task.label}</p>
                      <p className="text-[11px] text-muted-foreground">
                        {COMPANY_DNA_WORK_AREA_LABELS[row.task.workAreaType]}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground tabular-nums">
                        Quotr benchmark:{" "}
                        {formatHoursPerUnit(
                          row.task.benchmarkProductivity,
                          row.task.authorityUnit
                        )}
                      </p>
                      <p className="text-xs text-muted-foreground tabular-nums">
                        Your calibrated productivity:{" "}
                        {rate?.cost_rate != null
                          ? formatHoursPerUnit(rate.cost_rate, row.task.authorityUnit)
                          : "—"}
                      </p>
                      <p className="text-xs">Used: {used}</p>
                      {canCalibrate ? (
                        <div className="mt-1.5 flex flex-wrap gap-1.5">
                          <Link
                            href={`/app/setup/dna/${encodeURIComponent(row.task.calibrationTaskKey)}`}
                            className={cn(
                              buttonVariants({ variant: "outline", size: "sm" }),
                              "h-8"
                            )}
                          >
                            Edit calibration
                          </Link>
                          {calibrated ? (
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="h-8"
                              disabled={resetting === row.task.calibrationTaskKey}
                              onClick={() => void onReset(row.task.calibrationTaskKey)}
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
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
