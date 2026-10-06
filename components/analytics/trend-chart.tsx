"use client";

import { useState } from "react";
import { trendChartState, trendDensity, initialTrendIndex, formatTrendReadout } from "@/lib/analytics/presentation";
import { formatPricingMoney } from "@/lib/pricing/format";
import { cn } from "@/lib/utils";

type TrendPoint = {
  label: string;
  sent: number;
  accepted: number;
  quotedExGst?: number | null;
  acceptedExGst?: number | null;
};

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
  const moneyReady = trend.every(
    (point) => point.quotedExGst != null && point.acceptedExGst != null
  );
  const sentTotal = trend.reduce((sum, point) => sum + point.sent, 0);
  const acceptedTotal = trend.reduce((sum, point) => sum + point.accepted, 0);
  const quotedTotal = moneyReady
    ? trend.reduce((sum, point) => sum + (point.quotedExGst ?? 0), 0)
    : null;
  const acceptedValueTotal = moneyReady
    ? trend.reduce((sum, point) => sum + (point.acceptedExGst ?? 0), 0)
    : null;

  return (
    <section className="min-w-0 rounded-xl border border-border/60 bg-card px-4 py-4" data-analytics-trend={density}>
      <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-sm font-medium">Commercial activity</h2>
          </div>
        {density === "chart" ? (
          <div className="flex gap-2" role="group" aria-label="Chart series">
            <SeriesToggle
              pressed={showSent}
              onClick={() => setShowSent((value) => !value)}
              label={moneyReady ? "Quoted ex GST" : "Sent"}
              swatch="bg-foreground"
            />
            <SeriesToggle
              pressed={showAccepted}
              onClick={() => setShowAccepted((value) => !value)}
              label={moneyReady ? "Accepted ex GST" : "Accepted"}
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
        <div className="mt-3">
          <p className="text-sm tabular-nums">
            {sentTotal} first {sentTotal === 1 ? "send" : "sends"}
            {quotedTotal == null ? "" : ` · ${formatPricingMoney(quotedTotal)} quoted ex GST`}
          </p>
          <p className="text-sm tabular-nums">
            {acceptedTotal} accepted {acceptedTotal === 1 ? "quote" : "quotes"}
            {acceptedTotal === 0
              ? " · None in this range"
              : acceptedValueTotal == null
                ? ""
                : ` · ${formatPricingMoney(acceptedValueTotal)} accepted ex GST`}
          </p>
          <p className="mt-2 text-xs leading-5 text-muted-foreground">
            {moneyReady
              ? "Quoted ex GST is frozen when the quote leaves draft, on the send date. Accepted ex GST is the snapshot, on the acceptance date."
              : "Sends and acceptances are counted on their own dates. Quoted money is hidden because a sent total is missing."}
          </p>
          <ol className="mt-2 space-y-1">
            {trend
              .filter((point) => point.sent > 0 || point.accepted > 0)
              .map((point) => (
                <li key={point.label} className="flex min-h-11 items-center justify-between gap-3 text-sm">
                  <span className="font-medium">{point.label}</span>
                  <span className="text-right text-muted-foreground tabular-nums">
                    <span className="text-foreground">
                      Sent {point.sent}
                      {point.quotedExGst == null ? "" : ` · ${formatPricingMoney(point.quotedExGst)}`}
                    </span>
                    <span className="block text-[var(--brand-orange)]">
                      Accepted {point.accepted}
                      {point.accepted === 0
                        ? " · None"
                        : point.acceptedExGst == null
                          ? ""
                          : ` · ${formatPricingMoney(point.acceptedExGst)}`}
                    </span>
                  </span>
                </li>
              ))}
          </ol>
        </div>
      ) : null}
      {density === "chart" ? (
        <>
          <p className="mt-2 text-xs leading-5 text-muted-foreground">
            {moneyReady
              ? "Quoted ex GST is frozen when the quote leaves draft, on the send date. Accepted ex GST is the snapshot, on the acceptance date."
              : "Sends and acceptances are counted on their own dates. Quoted money is hidden because a sent total is missing."}
          </p>
          {!showSent && !showAccepted ? (
            <p className="mt-4 text-sm text-muted-foreground">Turn on Sent or Accepted to see the chart.</p>
          ) : (
            <>
              <TrendBars
                trend={trend}
                showSent={showSent}
                showAccepted={showAccepted}
                money={moneyReady}
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
              <TrendTable trend={trend} money={moneyReady} />
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
  money,
  index,
  onSelect,
}: {
  trend: TrendPoint[];
  showSent: boolean;
  showAccepted: boolean;
  money: boolean;
  index: number;
  onSelect: (index: number) => void;
}) {
  const value = (point: TrendPoint, series: "sent" | "accepted") =>
    money
      ? series === "sent"
        ? (point.quotedExGst ?? 0)
        : (point.acceptedExGst ?? 0)
      : series === "sent"
        ? point.sent
        : point.accepted;
  const max = Math.max(
    1,
    ...trend.map((point) => Math.max(showSent ? value(point, "sent") : 0, showAccepted ? value(point, "accepted") : 0))
  );
  const selected = trend[index];

  return (
      <div
        className="mt-3 min-w-0"
        role="group"
        aria-label="Dates"
        onKeyDown={(event) => {
          if (event.key === "ArrowRight") {
            event.preventDefault();
            onSelect(Math.min(trend.length - 1, index + 1));
          }
          if (event.key === "ArrowLeft") {
            event.preventDefault();
            onSelect(Math.max(0, index - 1));
          }
        }}
      >
      <div className="flex min-w-0 gap-2">
        <div className="flex h-36 w-14 shrink-0 flex-col justify-between pb-5 text-right text-[10px] leading-4 text-muted-foreground tabular-nums">
          <span>{money ? formatPricingMoney(max) : max}</span>
          <span>{money ? formatPricingMoney(max / 2) : Math.round(max / 2)}</span>
          <span>0</span>
        </div>
        <div className="relative min-w-0 flex-1">
          <div className="pointer-events-none absolute inset-x-0 top-0 bottom-5 flex flex-col justify-between" aria-hidden>
            <span className="border-t border-border/70" />
            <span className="border-t border-border/40" />
            <span className="border-t border-foreground/20" />
          </div>
          <div className="relative flex h-36 items-end">
            {trend.map((point, pointIndex) => {
              const sentHeight = showSent ? (value(point, "sent") / max) * 100 : 0;
              const acceptedHeight = showAccepted ? (value(point, "accepted") / max) * 100 : 0;
              const isSelected = pointIndex === index;
              return (
                <button
                  key={`${point.label}-${pointIndex}`}
                  type="button"
                  aria-pressed={isSelected}
                  aria-label={formatTrendReadout(point)}
                  onClick={() => onSelect(pointIndex)}
                  onMouseEnter={() => onSelect(pointIndex)}
                  onFocus={() => onSelect(pointIndex)}
                  className={cn(
                    "flex h-full min-h-11 min-w-0 flex-1 flex-col items-center justify-end rounded-md px-0.5 outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-orange)]",
                    isSelected && "bg-muted"
                  )}
                >
                  <span className="flex h-28 w-full items-end justify-center gap-1" aria-hidden>
                    {showSent ? (
                      <span
                        className="w-[calc(50%-0.25rem)] max-w-14 rounded-t-sm bg-foreground"
                        style={{ height: barHeight(sentHeight, value(point, "sent")) }}
                      />
                    ) : null}
                    {showAccepted ? (
                      <span
                        className="w-[calc(50%-0.25rem)] max-w-14 rounded-t-sm bg-[var(--brand-orange)]"
                        style={{ height: barHeight(acceptedHeight, value(point, "accepted")) }}
                      />
                    ) : null}
                  </span>
                  <span className="max-w-full truncate px-0.5 text-center text-[10px] leading-4 text-muted-foreground">
                    {trend.length <= 8 || isSelected ? point.label : ""}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
      {selected ? <span className="sr-only">{formatTrendReadout(selected)}</span> : null}
    </div>
  );
}

function barHeight(percent: number, amount: number): string {
  if (amount <= 0) return "2px";
  return `${Math.max(percent, 8)}%`;
}

function TrendTable({ trend, money }: { trend: TrendPoint[]; money: boolean }) {
  return (
    <table className="mt-2 w-full text-left text-sm">
      <caption className="sr-only">
        Quoted and accepted amounts by date. Quoted is the frozen send subtotal. Accepted is the snapshot. They are not the same quotes.
      </caption>
      <thead>
        <tr className="text-[11px] text-muted-foreground">
          <th scope="col" className="py-2 pr-3 font-medium">Period</th>
          <th scope="col" className="py-2 pr-3 font-medium">Sent</th>
          {money ? <th scope="col" className="py-2 pr-3 font-medium">Quoted ex GST</th> : null}
          <th scope="col" className="py-2 pr-3 font-medium">Accepted</th>
          {money ? <th scope="col" className="py-2 font-medium">Accepted ex GST</th> : null}
        </tr>
      </thead>
      <tbody>
        {trend.map((point, index) => (
          <tr key={`${point.label}-${index}`} className="border-t border-border/60">
            <th scope="row" className="py-2 pr-3 font-normal">{point.label}</th>
            <td className="py-2 pr-3 tabular-nums">{point.sent}</td>
            {money ? (
              <td className="py-2 pr-3 tabular-nums">
                {point.quotedExGst == null ? "—" : formatPricingMoney(point.quotedExGst)}
              </td>
            ) : null}
            <td className="py-2 pr-3 tabular-nums">{point.accepted}</td>
            {money ? (
              <td className="py-2 tabular-nums">
                {point.acceptedExGst == null ? "—" : formatPricingMoney(point.acceptedExGst)}
              </td>
            ) : null}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
