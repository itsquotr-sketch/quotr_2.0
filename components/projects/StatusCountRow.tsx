import Link from "next/link";
import type { DashboardPipelineSummary } from "@/lib/projects/types";
import type { ProjectListFilter } from "@/lib/projects/types";
import { cn } from "@/lib/utils";

type StatusCountRowProps = {
  summary: DashboardPipelineSummary;
  activeFilter?: ProjectListFilter;
  className?: string;
};

const STATUS_ITEMS: {
  key: keyof DashboardPipelineSummary;
  label: string;
  /** Shorter label for dense mobile KPI tiles */
  shortLabel?: string;
  filter: ProjectListFilter;
}[] = [
  { key: "activeCount", label: "Active", filter: "active" },
  {
    key: "estimatingPricingCount",
    label: "Estimating / Pricing",
    shortLabel: "Estimating",
    filter: "estimating",
  },
  { key: "quoteDraftCount", label: "Quote draft", shortLabel: "Draft", filter: "quote_draft" },
  { key: "quotesSentCount", label: "Quote sent", shortLabel: "Sent", filter: "quote_sent" },
  { key: "wonCount", label: "Won", filter: "won" },
  { key: "lostCount", label: "Lost", filter: "lost" },
];

function buildFilterHref(filter: ProjectListFilter): string {
  if (filter === "all") {
    return "/app/dashboard";
  }
  return `/app/dashboard?filter=${filter}`;
}

export function StatusCountRow({
  summary,
  activeFilter = "all",
  className,
}: StatusCountRowProps) {
  return (
    <div
      className={cn(
        "grid grid-cols-2 gap-1.5 sm:gap-2 lg:grid-cols-6",
        className
      )}
    >
      {STATUS_ITEMS.map((item) => {
        const isActive =
          activeFilter === item.filter ||
          (item.filter === "active" && activeFilter === "active");
        const mobileLabel = item.shortLabel ?? item.label;

        return (
          <Link
            key={item.key}
            href={buildFilterHref(item.filter)}
            className={cn(
              "flex h-full min-h-11 flex-col justify-between rounded-lg border px-2.5 py-1.5 transition-[border-color,background-color,box-shadow] sm:min-h-[4.25rem] sm:px-3 sm:py-2.5",
              isActive
                ? "border-[var(--brand-orange-muted)] bg-[var(--brand-orange-muted)]/50 shadow-[inset_0_0_0_1px_oklch(0.705_0.213_47.604/0.2)]"
                : "border-border/60 bg-card hover:border-border hover:bg-muted/20"
            )}
          >
            <p className="text-[10px] font-medium leading-tight text-muted-foreground sm:text-[11px]">
              <span className="sm:hidden">{mobileLabel}</span>
              <span className="hidden sm:inline">{item.label}</span>
            </p>
            <p className="mt-0.5 text-lg font-semibold tabular-nums tracking-tight sm:text-xl">
              {summary[item.key]}
            </p>
          </Link>
        );
      })}
    </div>
  );
}
