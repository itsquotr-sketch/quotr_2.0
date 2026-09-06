"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  DNA_CALIBRATE,
  DNA_RECALIBRATE,
  DNA_RATES_PRODUCTIVITY_HELPER,
  DNA_RESET_CTA,
  DNA_SOURCE_QUOTR_BENCHMARK,
  DNA_SOURCE_YOUR_CALIBRATION,
  formatDnaCompactHoursPerUnit,
  formatDnaOptionalRemaining,
  formatDnaRwSystemLine,
} from "@/lib/company-dna/copy";
import { resetCompanyDnaCalibration } from "@/lib/company-dna/actions";
import { nextCompanyDnaV2Task, v2HubHref } from "@/lib/company-dna/v2-ui";
import {
  listRwSystemProgress,
  rwSystemOfTask,
} from "@/lib/company-dna/rw-v2";
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

const RW_GROUPS = [
  ["shared", "Shared"],
  ["timber", "Timber"],
  ["sleeper", "Sleeper"],
  ["masonry", "Masonry"],
] as const;

function usedProductivitySource(rate: RatesPageRate | undefined): string {
  if (rate?.active && rate.cost_rate != null) {
    if (rate.source === "calibrated_productivity") {
      return DNA_SOURCE_YOUR_CALIBRATION;
    }
    return "Your company rate";
  }
  return DNA_SOURCE_QUOTR_BENCHMARK;
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
            {row?.cost_rate != null ? "Your company rate" : DNA_SOURCE_QUOTR_BENCHMARK}
          </p>
        </div>
        <p className="mt-1 text-sm tabular-nums">
          Your company rate:{" "}
          {row?.cost_rate != null ? `${formatMoney(row.cost_rate)}/hr` : "—"}
        </p>
        <p className="text-sm text-muted-foreground tabular-nums">
          Quotr benchmark: {formatMoney(carpenter.defaultCostRate ?? 60)}/hr
        </p>
        <p className="text-sm">
          Used:{" "}
          {row?.cost_rate != null
            ? `${formatMoney(row.cost_rate)}/hr — Your company rate`
            : `${formatMoney(carpenter.defaultCostRate ?? 60)}/hr — ${DNA_SOURCE_QUOTR_BENCHMARK}`}
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
        const isV2 = group.generation !== "v1";
        const calibratedKeys = group.tasks
          .filter((row) => row.calibrated)
          .map((row) => row.task.calibrationTaskKey);
        const optionalNote =
          group.status === "calibrated"
            ? formatDnaOptionalRemaining({
                optionalTotal: group.optionalTotal,
                optionalCalibrated: group.optionalCalibrated,
              })
            : null;
        const rwSystems =
          group.workAreaType === "retaining_wall"
            ? listRwSystemProgress(calibratedKeys)
            : [];
        return (
          <div
            key={group.workAreaType}
            className="rounded-lg border border-border/60"
            data-productivity-work-area={group.workAreaType}
            data-productivity-generation={group.generation}
          >
            <div className="flex flex-wrap items-center gap-2 px-3 py-2.5">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">{group.label}</p>
                <p className="text-xs text-muted-foreground">
                  {group.summaryLine
                    ? group.summaryLine
                    : group.keyTaskTotal > 0
                    ? `${group.keyTaskCalibrated} of ${group.keyTaskTotal} key tasks calibrated`
                    : `${group.calibratedCount} of ${group.taskTotal} tasks calibrated`}
                </p>
                <p className="text-xs text-muted-foreground">{group.statusLabel}</p>
                {optionalNote ? (
                  <p className="text-xs text-muted-foreground">{optionalNote}</p>
                ) : null}
              </div>
              {isV2 ? (
                <Link
                  href={v2HubHref({
                    workAreaType: group.workAreaType,
                    status: group.status,
                    nextTaskKey: nextCompanyDnaV2Task({
                      workAreaType: group.workAreaType,
                      calibratedTaskKeys: calibratedKeys,
                    })?.calibrationTaskKey,
                  })}
                  className={cn(
                    buttonVariants({ variant: "outline", size: "sm" }),
                    "h-8 shrink-0"
                  )}
                  data-company-dna-rates-cta
                >
                  {group.cta}
                </Link>
              ) : null}
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
                {open ? "Hide" : isV2 ? "Show tasks" : group.cta}
              </Button>
            </div>
            {open ? (
              <div className="space-y-3 border-t border-border/60 px-3 py-2">
                {group.workAreaType === "retaining_wall"
                  ? RW_GROUPS.map(([groupKey, heading]) => {
                      const rows = group.tasks.filter((row) =>
                        rwSystemOfTask(row.task.calibrationTaskKey) === groupKey
                      );
                      if (rows.length === 0) return null;
                      const systemRow =
                        groupKey === "shared"
                          ? null
                          : rwSystems.find((item) => item.system === groupKey);
                      return (
                        <div
                          key={groupKey}
                          data-company-dna-rate-group={groupKey}
                        >
                          <p className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                            {heading}
                            {systemRow
                              ? ` · ${formatDnaRwSystemLine(systemRow).replace(`${systemRow.label}: `, "")}`
                              : ""}
                          </p>
                          <div className="space-y-2">
                            {rows.map((row) => (
                              <RatesTaskRow
                                key={row.task.calibrationTaskKey}
                                row={row}
                                rates={rates}
                                canCalibrate={canCalibrate}
                                resetting={resetting}
                                onReset={onReset}
                              />
                            ))}
                          </div>
                        </div>
                      );
                    })
                  : group.tasks.map((row) => (
                      <RatesTaskRow
                        key={row.task.calibrationTaskKey}
                        row={row}
                        rates={rates}
                        canCalibrate={canCalibrate}
                        resetting={resetting}
                        onReset={onReset}
                      />
                    ))}
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

function RatesTaskRow(params: {
  row: {
    task: {
      calibrationTaskKey: string;
      label: string;
      productivityRateKey: string;
      authorityUnit: string;
      benchmarkProductivity: number;
    };
    calibrated: boolean;
  };
  rates: RatesPageRate[];
  canCalibrate: boolean;
  resetting: string | null;
  onReset: (taskKey: string) => void;
}) {
  const rate = params.rates.find(
    (item) =>
      item.item_key === params.row.task.productivityRateKey &&
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
      className="rounded-md bg-muted/20 px-2.5 py-2"
      data-company-dna-rate-task={params.row.task.calibrationTaskKey}
    >
      <p className="text-sm font-medium">{params.row.task.label}</p>
      <p className="mt-1 text-xs text-muted-foreground tabular-nums">
        {DNA_SOURCE_QUOTR_BENCHMARK}:{" "}
        {formatDnaCompactHoursPerUnit(
          params.row.task.benchmarkProductivity,
          params.row.task.authorityUnit
        )}
      </p>
      <p className="text-xs text-muted-foreground tabular-nums">
        {DNA_SOURCE_YOUR_CALIBRATION}:{" "}
        {rate?.cost_rate != null
          ? formatDnaCompactHoursPerUnit(
              rate.cost_rate,
              params.row.task.authorityUnit
            )
          : "—"}
      </p>
      <p className="text-xs">Used: {used}</p>
      {params.canCalibrate ? (
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          <Link
            href={`/app/setup/dna/${encodeURIComponent(params.row.task.calibrationTaskKey)}`}
            className={cn(
              buttonVariants({ variant: "outline", size: "sm" }),
              "h-8"
            )}
          >
            {calibrated ? DNA_RECALIBRATE : DNA_CALIBRATE}
          </Link>
          {calibrated ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-8"
              disabled={params.resetting === params.row.task.calibrationTaskKey}
              onClick={() => params.onReset(params.row.task.calibrationTaskKey)}
            >
              {DNA_RESET_CTA}
            </Button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
