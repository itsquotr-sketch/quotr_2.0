"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import {
  GENERATE_STATUS_COPY,
  generateStatusDetail,
  type GenerateEstimateStage,
} from "@/lib/assistant/clarify/generate-sync";
import { cn } from "@/lib/utils";

export function GenerateEstimateStatus({
  stage,
  startedAt,
  compact = false,
}: {
  stage: GenerateEstimateStage;
  startedAt: number;
  compact?: boolean;
}) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = window.setInterval(() => {
      setNow(Date.now());
    }, 400);
    return () => window.clearInterval(id);
  }, [startedAt, stage]);

  const elapsedMs = Math.max(0, now - startedAt);
  const detail = generateStatusDetail({ stage, elapsedMs });

  return (
    <div
      className={cn(
        "flex items-start gap-3",
        compact ? "py-0" : "rounded-xl border border-border/70 bg-muted/20 px-3.5 py-3"
      )}
      role="status"
      aria-live="polite"
      aria-atomic="true"
      data-generate-estimate-status={stage}
    >
      <Loader2
        className={cn("shrink-0 animate-spin text-muted-foreground", compact ? "size-3.5" : "size-4")}
        aria-hidden
      />
      <div className="min-w-0">
        <p className={cn("font-medium tracking-tight", compact ? "text-sm" : "text-sm")}>
          {GENERATE_STATUS_COPY.headline}
        </p>
        {!compact ? (
          <p className="mt-0.5 text-xs text-muted-foreground">{detail}</p>
        ) : (
          <span className="sr-only">{detail}</span>
        )}
      </div>
    </div>
  );
}
