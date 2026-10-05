import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import {
  calibrationStatusLabel,
  calibrationWorkAreaHref,
} from "@/lib/rates/calibration-access";
import { summarizeProductivityWorkAreas } from "@/lib/rates/productivity-work-area-summary";
import type { RatesPageRate } from "@/lib/rates/types";
import { cn } from "@/lib/utils";

type RatesCalibrationAccessProps = {
  rates: RatesPageRate[];
  preferredWorkAreaTypes?: string[];
};

export function RatesCalibrationAccess({
  rates,
  preferredWorkAreaTypes = [],
}: RatesCalibrationAccessProps) {
  const summaries = summarizeProductivityWorkAreas(rates, preferredWorkAreaTypes);
  const preferred = new Set(preferredWorkAreaTypes);
  const selected = summaries.filter((row) => preferred.has(row.workAreaType));
  const others = summaries.filter((row) => !preferred.has(row.workAreaType));
  const groups =
    selected.length > 0
      ? [
          { title: "Your work areas", rows: selected },
          { title: "Other work areas", rows: others },
        ]
      : [{ title: "Work areas", rows: summaries }];

  return (
    <div className="space-y-4" data-rates-calibration>
      <div>
        <h2 className="text-sm font-semibold">Productivity by work area</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Open a work area to set how long the work takes. Hourly costs stay on
          Labour.
        </p>
      </div>
      {groups.map((group) =>
        group.rows.length === 0 ? null : (
          <section key={group.title} className="space-y-2">
            <h3 className="text-xs font-medium text-muted-foreground">
              {group.title}
            </h3>
            <ul className="divide-y divide-border/70 overflow-hidden rounded-xl border border-border/60 bg-card">
              {group.rows.map((row) => (
                <li
                  key={row.workAreaType}
                  className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium">{row.label}</p>
                    <p className="text-sm text-muted-foreground">
                      {calibrationStatusLabel(row.status)}
                    </p>
                  </div>
                  <Link
                    href={calibrationWorkAreaHref(row)}
                    className={cn(
                      buttonVariants({ variant: "outline", size: "touch" }),
                      "w-full sm:w-auto"
                    )}
                  >
                    {row.status === "benchmarks"
                      ? `Calibrate ${row.label}`
                      : `Open ${row.label}`}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )
      )}
    </div>
  );
}
