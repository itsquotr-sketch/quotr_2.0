"use client";

import { useState } from "react";
import { trendChartState, trendDensity, initialTrendIndex, formatTrendReadout } from "@/lib/analytics/presentation";
import { cn } from "@/lib/utils";

type TrendPoint = { label: string; sent: number; accepted: number };

type TrendChartProps = {
  trend: TrendPoint[];
  unavailableReason: string | null;
};

export function TrendChart({ trend, unavailableReason }: TrendChartProps) {
  const [showSent, setShowSent] = useState(true);
  const [showAccepted, setShowAccepted] = useState(true);
  const [index, setIndex] = useState(() => initialTrendIndex(trend));
  const state = trendChartState({ trend, unavailableReason });
  const density = state === "chart" && trendDensity({ trend }) === "summary" ? "summary" : state;
  const trendKey = trend.map((point) => `${point.label}:${point.sent}:${point.accepted}`).join("|");
  const [seenKey, setSeenKey] = useState(trendKey);
  if (seenKey !== trendKey) {
    setSeenKey(trendKey);
    setIndex(initialTrendIndex(trend));
  }
  const selected = trend[Math.min(index, Math.max(trend.length - 1, 0))];

  return (
    <section className="min-w-0 rounded-xl border border-border/60 bg-card px-4 py-4" data-analytics-trend={density}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-sm font-medium">Sends and acceptances</h2>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">
            Counted on their own dates. An acceptance is not a quote sent that day.
          </p>
        </div>
        {density === "chart" ? (
          <div className="flex gap-2" role="group" aria-label="Chart series">
            <SeriesToggle
              pressed={showSent}
              onClick={() => setShowSent((value) => !value)}
              label="Sent"
              swatch="bg-foreground"
            />
            <SeriesToggle
              pressed={showAccepted}
              onClick={() => setShowAccepted((value) => !value)}
              label="Accepted"
              swatch="bg-[var(--brand-orange)]"
            />
          </div>
        ) : null}
      </div>

      {state === "unavailable" ? (
        <p className="mt-4 text-sm text-muted-foreground">{unavailableReason}</p>
      ) : null}
      {state === "empty" ? (
        <p className="mt-4 text-sm text-muted-foreground">
          {unavailableReason ?? "No quotes were sent or accepted in this period."}
        </p>
      ) : null}
      {density === "summary" ? (
        <ol className="mt-3 space-y-1">
          {trend
            .filter((point) => point.sent > 0 || point.accepted > 0)
            .map((point) => (
              <li key={point.label} className="flex min-h-11 items-center justify-between gap-3 text-sm">
                <span className="font-medium">{point.label}</span>
                <span className="text-muted-foreground tabular-nums">
                  <span className="text-foreground">Sent {point.sent}</span>
                  <span className="px-1" aria-hidden>·</span>
                  <span className="text-[var(--brand-orange)]">Accepted {point.accepted}</span>
                </span>
              </li>
            ))}
        </ol>
      ) : null}
      {density === "chart" ? (
        <>
          {!showSent && !showAccepted ? (
            <p className="mt-4 text-sm text-muted-foreground">Turn on Sent or Accepted to see the chart.</p>
          ) : (
            <>
              <TrendBars
                trend={trend}
                showSent={showSent}
                showAccepted={showAccepted}
                index={Math.min(index, trend.length - 1)}
                onSelect={setIndex}
              />
              {selected ? (
                <div className="mt-2 flex items-center gap-2">
                  <button
                    type="button"
                    className="inline-flex size-11 shrink-0 items-center justify-center rounded-lg border border-border text-sm outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-orange)] disabled:opacity-40"
                    aria-label="Previous date"
                    disabled={index <= 0}
                    onClick={() => setIndex((value) => Math.max(0, value - 1))}
                  >
                    ‹
                  </button>
                  <p className="min-w-0 flex-1 text-center text-sm tabular-nums" aria-live="polite">
                    {formatTrendReadout(selected)}
                  </p>
                  <button
                    type="button"
                    className="inline-flex size-11 shrink-0 items-center justify-center rounded-lg border border-border text-sm outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-orange)] disabled:opacity-40"
                    aria-label="Next date"
                    disabled={index >= trend.length - 1}
                    onClick={() => setIndex((value) => Math.min(trend.length - 1, value + 1))}
                  >
                    ›
                  </button>
                </div>
              ) : null}
            </>
          )}
          <details className="mt-3">
            <summary className="flex min-h-11 cursor-pointer list-none items-center text-sm font-medium outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-orange)] [&::-webkit-details-marker]:hidden">
              View numbers
            </summary>
            <div className="max-h-64 overflow-auto">
              <TrendTable trend={trend} />
            </div>
          </details>
        </>
      ) : null}
    </section>
  );
}

function SeriesToggle(props: {
  pressed: boolean;
  onClick: () => void;
  label: string;
  swatch: string;
}) {
  return (
    <button
      type="button"
      aria-pressed={props.pressed}
      onClick={props.onClick}
      className={cn(
        "inline-flex min-h-11 items-center gap-2 rounded-lg border px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-orange)]",
        props.pressed ? "border-foreground bg-card" : "border-transparent text-muted-foreground"
      )}
    >
      <span className={cn("size-2.5 rounded-full", props.swatch)} aria-hidden />
      {props.label}
    </button>
  );
}

function TrendBars({
  trend,
  showSent,
  showAccepted,
  index,
  onSelect,
}: {
  trend: TrendPoint[];
  showSent: boolean;
  showAccepted: boolean;
  index: number;
  onSelect: (index: number) => void;
}) {
  const max = Math.max(
    1,
    ...trend.map((point) => Math.max(showSent ? point.sent : 0, showAccepted ? point.accepted : 0))
  );
  const selected = trend[index];

  return (
    <div className="mt-4 overflow-x-auto" role="group" aria-label="Dates">
      <div
        className="flex h-32 items-end gap-1"
        style={{ minWidth: trend.length > 10 ? trend.length * 36 : "100%" }}
      >
        {trend.map((point, pointIndex) => {
          const sentHeight = showSent ? (point.sent / max) * 100 : 0;
          const acceptedHeight = showAccepted ? (point.accepted / max) * 100 : 0;
          const isSelected = pointIndex === index;
          return (
            <button
              key={`${point.label}-${pointIndex}`}
              type="button"
              aria-pressed={isSelected}
              aria-label={formatTrendReadout(point)}
              onClick={() => onSelect(pointIndex)}
              className={cn(
                "flex min-h-11 min-w-9 flex-1 flex-col items-center justify-end gap-1 rounded-md px-0.5 outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-orange)]",
                isSelected && "bg-muted"
              )}
            >
              <span className="flex h-20 w-full items-end justify-center gap-0.5" aria-hidden>
                {showSent ? (
                  <span
                    className="w-1.5 rounded-sm bg-foreground"
                    style={{ height: `${sentHeight}%` }}
                  />
                ) : null}
                {showAccepted ? (
                  <span
                    className="w-1.5 rounded-sm bg-[var(--brand-orange)]"
                    style={{ height: `${acceptedHeight}%` }}
                  />
                ) : null}
              </span>
              <span className="max-w-full truncate text-[10px] leading-4 text-muted-foreground">
                {trend.length <= 8 || isSelected ? point.label : ""}
              </span>
            </button>
          );
        })}
      </div>
      {selected ? <span className="sr-only">{formatTrendReadout(selected)}</span> : null}
    </div>
  );
}

function TrendTable({ trend }: { trend: TrendPoint[] }) {
  return (
    <table className="mt-2 w-full text-left text-sm">
      <caption className="sr-only">
        Sent quotes and accepted quotes by date. The two columns are not paired as the same quotes.
      </caption>
      <thead>
        <tr className="text-[11px] text-muted-foreground">
          <th scope="col" className="py-2 pr-3 font-medium">Period</th>
          <th scope="col" className="py-2 pr-3 font-medium">Sent</th>
          <th scope="col" className="py-2 font-medium">Accepted</th>
        </tr>
      </thead>
      <tbody>
        {trend.map((point, index) => (
          <tr key={`${point.label}-${index}`} className="border-t border-border/60">
            <th scope="row" className="py-2 pr-3 font-normal">{point.label}</th>
            <td className="py-2 pr-3 tabular-nums">{point.sent}</td>
            <td className="py-2 tabular-nums">{point.accepted}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
