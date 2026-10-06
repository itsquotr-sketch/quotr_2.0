"use client";

import { useState } from "react";
import Link from "next/link";
import type { AnalyticsWorkArea, BusinessAnalyticsView } from "@/lib/analytics/measure";
import { formatPricingMoney } from "@/lib/pricing/format";
import { cn } from "@/lib/utils";

type SortKey = "activity" | "quoted";

export function WorkAreaPanel({ view }: { view: BusinessAnalyticsView }) {
  const [sort, setSort] = useState<SortKey>("activity");
  const [open, setOpen] = useState<string | null>(null);
  const rows = sortedAreas(view.workAreas ?? [], sort);
  const scale = rows.reduce(
    (highest, row) =>
      Math.max(highest, row.quotedLineExGst ?? 0, row.acceptedLineExGst ?? 0),
    0
  );

  return (
    <section className="min-w-0 rounded-xl border border-border/60 bg-card px-4 py-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-base font-medium">Work areas</h2>
          <p className="mt-1 max-w-2xl text-sm leading-6 text-muted-foreground">
            Where this range’s quoted and accepted money sits. A line with no reliable area is Unallocated.
          </p>
        </div>
        <div className="flex gap-1" role="group" aria-label="Sort work areas">
          <SortButton pressed={sort === "activity"} onClick={() => setSort("activity")} label="Activity" />
          <SortButton pressed={sort === "quoted"} onClick={() => setSort("quoted")} label="Quoted value" />
        </div>
      </div>

      {view.workAreas == null ? (
        <p className="mt-3 text-sm text-muted-foreground">Work areas are hidden because the read was incomplete.</p>
      ) : rows.length === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">No estimates or quote lines in this range.</p>
      ) : (
        <>
          <div className="mt-3 hidden md:block">
            <table className="w-full text-left text-sm">
              <caption className="sr-only">
                Work areas ranked by {sort === "activity" ? "activity" : "quoted ex GST"}. Quoted and accepted amounts use the same scale.
              </caption>
              <thead>
                <tr className="text-[11px] text-muted-foreground">
                  <th scope="col" className="py-2 pr-3 font-medium">Work area</th>
                  <th scope="col" className="py-2 pr-3 font-medium">Estimates</th>
                  <th scope="col" className="py-2 pr-3 font-medium">Quoted jobs</th>
                  <th scope="col" className="py-2 pr-3 font-medium">Quoted ex GST</th>
                  <th scope="col" className="py-2 font-medium">Accepted ex GST</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.name} className="border-t border-border/60">
                    <th scope="row" className="py-2 pr-3 font-medium">
                      {row.name}
                      <AreaLinks row={row} />
                    </th>
                    <td className="py-2 pr-3 tabular-nums">{row.estimates}</td>
                    <td className="py-2 pr-3 tabular-nums">{row.quotedQuotes ?? "—"}</td>
                    <td className="py-2 pr-3">
                      <MoneyBar value={row.quotedLineExGst} max={scale} tone="bg-foreground" />
                    </td>
                    <td className="py-2">
                      <MoneyBar value={row.acceptedLineExGst} max={scale} tone="bg-[var(--brand-orange)]" />
                      {row.acceptedQuotes != null ? (
                        <span className="mt-0.5 block text-[11px] text-muted-foreground tabular-nums">
                          {row.acceptedQuotes} accepted {row.acceptedQuotes === 1 ? "job" : "jobs"}
                        </span>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <ul className="mt-3 md:hidden">
            {rows.map((row) => {
              const expanded = open === row.name;
              return (
                <li key={row.name} className="border-t border-border/60">
                  <button
                    type="button"
                    aria-expanded={expanded}
                    onClick={() => setOpen(expanded ? null : row.name)}
                    className="flex min-h-11 w-full items-center justify-between gap-3 py-2 text-left outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-orange)]"
                  >
                    <span className="min-w-0 truncate font-medium">{row.name}</span>
                    <span className="shrink-0 text-sm tabular-nums">{moneyText(row.quotedLineExGst)}</span>
                  </button>
                  {expanded ? (
                    <div className="grid grid-cols-2 gap-2 pb-3 text-sm">
                      <Detail label="Estimates" value={String(row.estimates)} />
                      <Detail label="Quoted jobs" value={row.quotedQuotes == null ? "—" : String(row.quotedQuotes)} />
                      <Detail label="Quoted ex GST" value={moneyText(row.quotedLineExGst)} />
                      <Detail label="Accepted ex GST" value={moneyText(row.acceptedLineExGst)} />
                      <AreaLinks row={row} />
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </>
      )}

      <details className="mt-3">
        <summary className="flex min-h-11 cursor-pointer list-none items-center text-sm font-medium outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-orange)] [&::-webkit-details-marker]:hidden">
          How this is calculated
        </summary>
        <div className="pb-2 text-xs leading-5 text-muted-foreground">
          <p>
            An estimate counts once in each area it uses. Quoted and accepted money is the sum of included lines in that area. Unallocated is a line with no area, or the difference needed to reach the frozen quote or snapshot total. Optional lines stay out of that total.
          </p>
          {view.workAreaCheck?.quotedFrozenExGst != null ? (
            <p className="mt-2 tabular-nums">
              Area lines {moneyText(view.workAreaCheck.quotedAreasExGst)} = frozen sends{" "}
              {moneyText(view.workAreaCheck.quotedFrozenExGst)}
              {view.workAreaCheck.optionalQuotedExGst
                ? ` · optional lines ${moneyText(view.workAreaCheck.optionalQuotedExGst)} are outside the total`
                : ""}
            </p>
          ) : null}
          {view.workAreaCheck?.acceptedFrozenExGst != null ? (
            <p className="tabular-nums">
              Accepted lines {moneyText(view.workAreaCheck.acceptedAreasExGst)} = snapshots{" "}
              {moneyText(view.workAreaCheck.acceptedFrozenExGst)}
            </p>
          ) : null}
        </div>
      </details>
    </section>
  );
}

function sortedAreas(rows: readonly AnalyticsWorkArea[], sort: SortKey): AnalyticsWorkArea[] {
  const ranked = rows.filter((row) => row.name !== "Unallocated");
  const unallocated = rows.filter((row) => row.name === "Unallocated");
  ranked.sort((a, b) => {
    const delta =
      sort === "quoted"
        ? (b.quotedLineExGst ?? -1) - (a.quotedLineExGst ?? -1)
        : b.estimates + (b.quotedQuotes ?? 0) - (a.estimates + (a.quotedQuotes ?? 0));
    return delta || a.name.localeCompare(b.name);
  });
  return [...ranked, ...unallocated];
}

function MoneyBar({
  value,
  max,
  tone,
}: {
  value: number | null;
  max: number;
  tone: string;
}) {
  const width = value == null || max <= 0 ? 0 : Math.max(value > 0 ? 4 : 0, (value / max) * 100);
  return (
    <span className="block min-w-24">
      <span className="tabular-nums">{moneyText(value)}</span>
      <span className="mt-1 block h-1.5 overflow-hidden rounded-full bg-muted" aria-hidden>
        <span className={cn("block h-full rounded-full", tone)} style={{ width: `${width}%` }} />
      </span>
    </span>
  );
}

function AreaLinks({ row }: { row: AnalyticsWorkArea }) {
  if (row.projects.length === 0) return null;
  return (
    <span className="mt-1 flex flex-wrap gap-x-3 gap-y-1">
      {row.projects.map((project) => (
        <Link
          key={project.projectId}
          href={project.href}
          className="text-xs font-medium underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:ring-[var(--brand-orange)]"
        >
          {project.projectTitle}
        </Link>
      ))}
    </span>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <p>
      <span className="block text-[11px] text-muted-foreground">{label}</span>
      <span className="tabular-nums">{value}</span>
    </p>
  );
}

function SortButton({
  pressed,
  onClick,
  label,
}: {
  pressed: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={onClick}
      className={cn(
        "inline-flex min-h-11 items-center rounded-lg border px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-orange)]",
        pressed ? "border-foreground bg-card" : "border-transparent text-muted-foreground"
      )}
    >
      {label}
    </button>
  );
}

function moneyText(value: number | null): string {
  return value == null ? "—" : formatPricingMoney(value);
}
