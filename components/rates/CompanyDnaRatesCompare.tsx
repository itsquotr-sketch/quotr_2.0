"use client";

import { COMPANY_DNA_TASKS } from "@/lib/company-dna/catalogue";
import { LABOUR_RATE_CATALOGUE } from "@/lib/rates/catalogue";
import type { RatesPageRate } from "@/lib/rates/types";
import { formatMoney } from "@/lib/rates/cost-first-presentation";

type CompanyDnaRatesCompareProps = {
  rates: RatesPageRate[];
  variant: "productivity" | "labour";
};

function usedSource(rate: RatesPageRate | undefined): string {
  if (rate?.active && rate.cost_rate != null) {
    if (rate.source === "calibrated_productivity") {
      return "Your calibrated productivity";
    }
    return "Your rate";
  }
  return "Quotr benchmark";
}

export function CompanyDnaRatesCompare({
  rates,
  variant,
}: CompanyDnaRatesCompareProps) {
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
        className="rounded-xl border p-4 space-y-2"
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
      {COMPANY_DNA_TASKS.map((task) => {
        const row = rates.find(
          (rate) =>
            rate.item_key === task.productivityRateKey &&
            rate.rate_type === "productivity" &&
            rate.active
        );
        const used = usedSource(row);
        return (
          <div
            key={task.calibrationTaskKey}
            className="rounded-xl border p-4 space-y-1"
          >
            <h3 className="text-sm font-medium">{task.label}</h3>
            <p className="text-sm text-muted-foreground">
              Quotr benchmark: {task.benchmarkProductivity} person-hours/
              {task.authorityUnit}
            </p>
            <p className="text-sm text-muted-foreground">
              Your company:{" "}
              {row?.cost_rate != null
                ? `${row.cost_rate} person-hours/${task.authorityUnit}`
                : "Not calibrated"}
            </p>
            <p className="text-sm">Used: {used}</p>
          </div>
        );
      })}
    </div>
  );
}
