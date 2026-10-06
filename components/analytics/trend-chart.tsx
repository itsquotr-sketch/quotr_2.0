"use client";

import { useState } from "react";
import { trendChartState } from "@/lib/analytics/presentation";
import { cn } from "@/lib/utils";

type TrendPoint = { label: string; sent: number; accepted: number };

type TrendChartProps = {
  trend: TrendPoint[];
  unavailableReason: string | null;
};

export function TrendChart({ trend, unavailableReason }: TrendChartProps) {
  const [showSent, setShowSent] = useState(true);
  const [showAccepted, setShowAccepted] = useState(true);
  const state = trendChartState({ trend, unavailableReason });

  return (
    <section className="min-w-0 rounded-xl border border-border/60 bg-card px-4 py-4" data-analytics-trend={state}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-sm font-medium">Sends and acceptances</h2>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">
            Counted on their own dates. An acceptance is not a quote sent that day.
          </p>
        </div>
        {state === "chart" ? (
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
      {state === "chart" ? (
        <>
          {!showSent && !showAccepted ? (
            <p className="mt-4 text-sm text-muted-foreground">Turn on Sent or Accepted to see the chart.</p>
          ) : (
            <TrendSvg trend={trend} showSent={showSent} showAccepted={showAccepted} />
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

function TrendSvg({
  trend,
  showSent,
  showAccepted,
}: {
  trend: TrendPoint[];
  showSent: boolean;
  showAccepted: boolean;
}) {
  const max = Math.max(
    1,
    ...trend.map((point) =>
      Math.max(showSent ? point.sent : 0, showAccepted ? point.accepted : 0)
    )
  );
  const slot = 16;
  const height = 72;
  const baseline = 64;
  const label = `Sends and acceptances across ${trend.length} periods. Highest value ${max}.`;

  return (
    <svg
      viewBox={`0 0 ${Math.max(trend.length, 1) * slot} ${height}`}
      className="mt-4 h-36 w-full"
      role="img"
      aria-label={label}
      preserveAspectRatio="none"
    >
      <line
        x1="0"
        y1={baseline}
        x2={trend.length * slot}
        y2={baseline}
        className="stroke-border"
        strokeWidth="1"
      />
      {trend.map((point, index) => {
        const sentHeight = (point.sent / max) * 56;
        const acceptedHeight = (point.accepted / max) * 56;
        const x = index * slot;
        return (
          <g key={`${point.label}-${index}`}>
            {showSent && point.sent > 0 ? (
              <rect
                x={x + 2}
                y={baseline - sentHeight}
                width={5}
                height={sentHeight}
                className="fill-foreground"
              />
            ) : null}
            {showAccepted && point.accepted > 0 ? (
              <rect
                x={x + 8}
                y={baseline - acceptedHeight}
                width={5}
                height={acceptedHeight}
                fill="var(--brand-orange)"
              />
            ) : null}
          </g>
        );
      })}
    </svg>
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
