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
      : [{ title: "Supported work areas", rows: summaries }];

  return (
    <div className="space-y-4" data-rates-calibration>
      <Card>
        <CardHeader>
          <CardTitle>Calibration</CardTitle>
          <CardDescription>
            Calibration adjusts your company productivity assumptions. Quotr
            uses those assumptions when it prices labour time. Hourly costs and
            the default gross margin stay on Labour and Defaults.
          </CardDescription>
        </CardHeader>
      </Card>
      {groups.map((group) =>
        group.rows.length === 0 ? null : (
          <section key={group.title} className="space-y-3">
            <h3 className="text-sm font-medium">{group.title}</h3>
            <ul className="space-y-3">
              {group.rows.map((row) => (
                <li key={row.workAreaType}>
                  <Card>
                    <CardContent className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
                      <div className="min-w-0">
                        <p className="text-sm font-medium">{row.label}</p>
                        <p className="mt-0.5 text-sm text-muted-foreground">
                          {calibrationStatusLabel(row.status)}
                        </p>
                      </div>
                      <Link
                        href={calibrationWorkAreaHref(row)}
                        className={cn(
                          buttonVariants({ variant: "outline", size: "sm" }),
                          "h-9 w-full sm:w-auto"
                        )}
                      >
                        {row.status === "benchmarks"
                          ? `Calibrate ${row.label}`
                          : `Open ${row.label}`}
                      </Link>
                    </CardContent>
                  </Card>
                </li>
              ))}
            </ul>
          </section>
        )
      )}
    </div>
  );
}
