import { StatusCountRow } from "@/components/projects/StatusCountRow";
import type { DashboardPipelineSummary, ProjectListFilter } from "@/lib/projects/types";

type DashboardSummaryCardsProps = {
  summary: DashboardPipelineSummary;
  activeFilter?: ProjectListFilter;
};

export function DashboardSummaryCards({
  summary,
  activeFilter,
}: DashboardSummaryCardsProps) {
  return <StatusCountRow summary={summary} activeFilter={activeFilter} />;
}
