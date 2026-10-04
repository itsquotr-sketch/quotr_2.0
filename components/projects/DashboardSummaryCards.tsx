import { StatusCountRow } from "@/components/projects/StatusCountRow";
import type { DashboardOverviewCounts } from "@/lib/dashboard/work-overview";

type DashboardSummaryCardsProps = {
  summary: DashboardOverviewCounts;
};

export function DashboardSummaryCards({ summary }: DashboardSummaryCardsProps) {
  return <StatusCountRow summary={summary} />;
}
