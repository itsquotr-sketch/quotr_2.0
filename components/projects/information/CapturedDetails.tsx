"use client";

import { useState } from "react";
import {
  filterCapturedDetailGroups,
  type CapturedDetailGroup,
  type CapturedDetailSummary,
} from "@/lib/projects/project-information";

type CapturedDetailsProps = {
  summary: CapturedDetailSummary;
  groups: readonly CapturedDetailGroup[];
};

export function CapturedDetails({ summary, groups }: CapturedDetailsProps) {
  const [query, setQuery] = useState("");
  const [openIds, setOpenIds] = useState<ReadonlySet<string>>(() => new Set());
  const visible = filterCapturedDetailGroups(groups, query);

  return (
    <div className="min-w-0" data-captured-details="true">
      <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <SummaryItem label="Work Areas" value={String(summary.workAreaCount)} />
        <SummaryItem label="Captured facts" value={String(summary.factCount)} />
        <SummaryItem label="Conditions" value={String(summary.conditionCount)} />
        <SummaryItem label="Needing details" value={String(summary.needingDetailsCount)} />
      </dl>
      <label className="mt-3 grid gap-1">
        <span className="text-xs leading-4 text-foreground/70">Search captured details</span>
        <input
          type="search"
          value={query}
          data-captured-search
          aria-label="Search captured details"
          className="h-11 min-h-11 w-full rounded-md border border-border bg-background px-3 text-base focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand-orange)]"
          onChange={(event) => setQuery(event.target.value)}
        />
      </label>
      {visible.length === 0 ? (
        <p className="mt-3 text-sm leading-5 text-foreground/75">No matching captured details.</p>
      ) : (
        <div className="mt-3 space-y-2">
          {visible.map((group) => {
            const open = openIds.has(group.id);
            const panelId = `captured-detail-${group.id}`;
            return (
              <section key={group.id} className="rounded-md border border-border/70" data-captured-group={group.name}>
                <button
                  type="button"
                  className="flex min-h-11 w-full items-start gap-3 px-3 py-2 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand-orange)]"
                  aria-expanded={open}
                  aria-controls={panelId}
                  onClick={() =>
                    setOpenIds((current) => {
                      const next = new Set(current);
                      if (next.has(group.id)) next.delete(group.id);
                      else next.add(group.id);
                      return next;
                    })
                  }
                >
                  <span className="min-w-0 flex-1">
                    <span className="block break-words text-base font-medium leading-snug [overflow-wrap:anywhere]">
                      {group.name}
                    </span>
                    <span className="mt-0.5 block text-sm leading-5 text-foreground/75">
                      {[group.status, group.completeness].filter(Boolean).join(" · ")}
                      {group.status || group.completeness ? " · " : ""}
                      {group.factCount} captured
                      {" · "}
                      {group.conditionCount} conditions
                    </span>
                  </span>
                  <span className="shrink-0 text-sm leading-5 text-foreground/70">
                    {open ? "Hide details" : "View details"}
                  </span>
                </button>
                {open ? (
                  <div id={panelId} className="grid gap-3 border-t border-border/70 px-3 py-3">
                    {group.categories.map((category) => (
                      <div key={category.name}>
                        <h4 className="text-sm font-medium leading-5">{category.name}</h4>
                        <dl className="mt-2 grid gap-2 lg:grid-cols-2">
                          {category.facts.map((fact) => (
                            <div key={`${category.name}-${fact.label}`} className="min-w-0">
                              <dt className="text-xs leading-4 text-foreground/70">{fact.label}</dt>
                              <dd className="mt-0.5 break-words text-sm leading-5 [overflow-wrap:anywhere]">
                                {fact.value}
                                {fact.unit ? (
                                  <span className="text-foreground/70"> {fact.unit}</span>
                                ) : null}
                              </dd>
                            </div>
                          ))}
                        </dl>
                      </div>
                    ))}
                    {group.conditions.length > 0 ? (
                      <div>
                        <h4 className="text-sm font-medium leading-5">Conditions</h4>
                        <dl className="mt-2 grid gap-2 lg:grid-cols-2">
                          {group.conditions.map((item) => (
                            <div key={item.label} className="min-w-0">
                              <dt className="text-xs leading-4 text-foreground/70">{item.label}</dt>
                              <dd className="mt-0.5 break-words text-sm leading-5 [overflow-wrap:anywhere]">
                                {item.value}
                              </dd>
                            </div>
                          ))}
                        </dl>
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}

function SummaryItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs leading-4 text-foreground/70">{label}</dt>
      <dd className="mt-0.5 text-sm leading-5 tabular-nums">{value}</dd>
    </div>
  );
}
