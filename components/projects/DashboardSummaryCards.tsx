import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { DashboardPipelineSummary } from "@/lib/projects/types";

type DashboardSummaryCardsProps = {
  summary: DashboardPipelineSummary;
};

const SUMMARY_ITEMS: {
  key: keyof DashboardPipelineSummary;
  label: string;
}[] = [
  { key: "activeCount", label: "Active projects" },
  { key: "estimateReadyCount", label: "Estimates ready" },
  { key: "quotesSentCount", label: "Quotes sent" },
  { key: "wonCount", label: "Won" },
  { key: "lostCount", label: "Lost" },
];

export function DashboardSummaryCards({ summary }: DashboardSummaryCardsProps) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
      {SUMMARY_ITEMS.map((item) => (
        <Card key={item.key} className="border-border/60 shadow-none">
          <CardHeader className="pb-1">
            <CardTitle className="text-xs font-medium text-muted-foreground">
              {item.label}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold tabular-nums tracking-tight">
              {summary[item.key]}
            </p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
