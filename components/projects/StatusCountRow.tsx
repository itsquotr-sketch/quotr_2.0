import Link from "next/link";
import { WORK_OVERVIEW_MEASURES } from "@/lib/dashboard/work-overview";
import type { DashboardOverviewCounts } from "@/lib/dashboard/work-overview";
import { cn } from "@/lib/utils";

type StatusCountRowProps = {
  summary: DashboardOverviewCounts;
  className?: string;
};

export function StatusCountRow({ summary, className }: StatusCountRowProps) {
  return (
    <div
      className={cn(
        "grid grid-cols-2 items-stretch gap-3 lg:grid-cols-4 lg:gap-4",
        className
      )}
      data-dashboard-overview="four"
    >
      {WORK_OVERVIEW_MEASURES.map((item) => {
        const body = (
          <>
            <p className="text-[11px] font-medium leading-tight text-muted-foreground">
              {item.label}
            </p>
            <p className="mt-1 text-2xl font-semibold tabular-nums tracking-tight">
              {summary[item.key]}
            </p>
            <p className="mt-0.5 text-xs leading-4 text-muted-foreground">{item.context}</p>
          </>
        );
        const cardClass = cn(
          "flex h-full min-h-11 flex-col rounded-xl border border-border/70 bg-card px-3 py-2.5 outline-none",
          item.href &&
            "hover:bg-muted/20 focus-visible:ring-2 focus-visible:ring-[var(--brand-orange)]"
        );

        if (!item.href) {
          return (
            <div key={item.key} className={cardClass} data-overview-key={item.key}>
              {body}
            </div>
          );
        }

        return (
          <Link
            key={item.key}
            href={item.href}
            className={cardClass}
            data-overview-key={item.key}
          >
            {body}
          </Link>
        );
      })}
    </div>
  );
}
