"use client";

import { useEffect, useState } from "react";
import { QuotrLoader } from "@/components/brand/QuotrLoader";
import {
  GENERATE_EXTENDED_COPY_MS,
  generateStatusDetail,
  generateStatusSupporting,
  type GenerateEstimateStage,
} from "@/lib/assistant/clarify/generate-sync";

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
    const elapsed = Date.now() - startedAt;
    const wait = GENERATE_EXTENDED_COPY_MS - elapsed;
    if (wait <= 0) return;
    const id = window.setTimeout(() => setNow(Date.now()), wait);
    return () => window.clearTimeout(id);
  }, [startedAt, stage]);

  const elapsedMs = Math.max(0, now - startedAt);
  const status = generateStatusDetail({ stage });
  const supporting = generateStatusSupporting(elapsedMs);

  if (compact) {
    return (
      <QuotrLoader
        variant="compact"
        status={status}
        supporting={supporting ?? undefined}
        generateStage={stage}
        className="max-w-full"
      />
    );
  }

  return (
    <QuotrLoader
      status={status}
      supporting={supporting ?? undefined}
      generateStage={stage}
      className="overflow-y-auto"
    />
  );
}
