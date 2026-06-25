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
  filter: ProjectListFilter;
}[] = [
  { key: "activeCount", label: "Active", filter: "active" },
  {
    key: "estimatingPricingCount",
    label: "Estimating / Pricing",
    filter: "estimating",
  },
  { key: "quoteDraftCount", label: "Quote draft", filter: "quote_draft" },
  { key: "quotesSentCount", label: "Quote sent", filter: "quote_sent" },
  { key: "wonCount", label: "Won", filter: "won" },
  { key: "lostCount", label: "Lost", filter: "lost" },
];

function buildFilterHref(filter: ProjectListFilter): string {
  if (filter === "active") {
    return "/app/dashboard";
  }
  return `/app/dashboard?filter=${filter}`;
}

export function StatusCountRow({
  summary,
  activeFilter = "active",
  className,
}: StatusCountRowProps) {
  return (
    <div
      className={cn(
        "grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6",
        className
      )}
    >
      {STATUS_ITEMS.map((item) => {
        const isActive =
          activeFilter === item.filter ||
          (item.filter === "active" && activeFilter === "active");

        return (
          <Link
            key={item.key}
            href={buildFilterHref(item.filter)}
            className={cn(
              "rounded-lg border px-3 py-2.5 transition-[border-color,background-color,box-shadow]",
              isActive
                ? "border-[var(--brand-orange-muted)] bg-[var(--brand-orange-muted)]/50 shadow-[inset_0_0_0_1px_oklch(0.705_0.213_47.604/0.2)]"
                : "border-border/60 bg-card hover:border-border hover:bg-muted/20"
            )}
          >
            <p className="text-[11px] font-medium text-muted-foreground">
              {item.label}
            </p>
            <p className="mt-0.5 text-xl font-semibold tabular-nums tracking-tight">
              {summary[item.key]}
            </p>
          </Link>
        );
      })}
    </div>
  );
}
