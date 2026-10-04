import { StatusCountRow } from "@/components/projects/StatusCountRow";
import type { DashboardPipelineSummary } from "@/lib/projects/types";

type DashboardSummaryCardsProps = {
  summary: DashboardPipelineSummary;
};

export function DashboardSummaryCards({ summary }: DashboardSummaryCardsProps) {
  return <StatusCountRow summary={summary} />;
}
