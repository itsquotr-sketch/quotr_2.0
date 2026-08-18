"use client";

import type { AssistantUnderstandingSummary } from "@/lib/assistant/presentation/assistant-understanding-summary";

type AssistantUnderstandingSummaryProps = {
  readonly summaries: readonly AssistantUnderstandingSummary[];
};

export function AssistantUnderstandingSummaryCard({
  summaries,
}: AssistantUnderstandingSummaryProps) {
  const visible = summaries.filter((summary) => summary.lines.length > 0);
  if (visible.length === 0) {
    return null;
  }

  return (
    <div
      className="rounded-lg border border-border/60 bg-muted/30 px-3 py-3"
      data-assistant-understanding-summary="true"
    >
      <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
        What Quotr understood
      </p>
      <ul className="mt-2 space-y-1.5">
        {visible.map((summary) => (
          <li key={summary.workAreaLabel} className="text-sm text-foreground">
            {summary.lines.length === 1 ? (
              <span>{summary.lines[0]}</span>
            ) : (
              <>
                <span className="font-medium">{summary.workAreaLabel}</span>
                <span className="text-muted-foreground"> — </span>
                <span>{summary.compactLine}</span>
              </>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
