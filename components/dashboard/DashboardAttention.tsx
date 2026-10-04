"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import type { DashboardAttentionItem } from "@/lib/dashboard/attention";
import { cn } from "@/lib/utils";

const DESKTOP_CAP = 5;
const PHONE_CAP = 3;

export function DashboardAttention({ items }: { items: DashboardAttentionItem[] }) {
  const [expanded, setExpanded] = useState(false);
  const hiddenOnDesktop = !expanded && items.length > DESKTOP_CAP;
  const hiddenOnPhone = !expanded && items.length > PHONE_CAP;

  return (
    <section aria-labelledby="dashboard-attention-heading" data-dashboard-attention>
      <div className="flex items-center justify-between gap-3">
        <h2 id="dashboard-attention-heading" className="text-sm font-semibold tracking-tight">
          Needs attention
        </h2>
        {items.length > 0 ? (
          <p className="text-xs text-muted-foreground">{items.length}</p>
        ) : null}
      </div>
      {items.length === 0 ? (
        <p className="mt-2 rounded-xl border border-border/70 bg-card px-3 py-2.5 text-sm text-muted-foreground">
          Nothing needs attention. Current work can keep moving.
        </p>
      ) : (
        <div className="mt-2 overflow-hidden rounded-xl border border-border/70 bg-card">
          <ul className="divide-y divide-border/70">
            {items.map((item, index) => (
              <li
                key={item.id}
                className={cn(
                  "px-3 py-2",
                  !expanded && index >= DESKTOP_CAP && "hidden",
                  !expanded && index >= PHONE_CAP && index < DESKTOP_CAP && "max-lg:hidden"
                )}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{item.state}</p>
                    <p className="truncate text-xs text-muted-foreground">{item.context}</p>
                  </div>
                  <Link
                    href={item.href}
                    className={cn(
                      "inline-flex min-h-11 shrink-0 items-center gap-0.5 rounded-md px-1 text-sm outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-orange)]",
                      index === 0
                        ? "font-medium text-[var(--brand-orange)]"
                        : "text-foreground"
                    )}
                  >
                    {item.action}
                    <ChevronRight className="size-3.5" aria-hidden />
                  </Link>
                </div>
              </li>
            ))}
          </ul>
          {hiddenOnDesktop || hiddenOnPhone ? (
            <div
              className={cn(
                "border-t border-border/70 px-3",
                !hiddenOnDesktop && "lg:hidden"
              )}
            >
              <button
                type="button"
                className={cn(
                  "inline-flex min-h-11 items-center text-sm font-medium outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-orange)]",
                  hiddenOnDesktop ? "" : "lg:hidden"
                )}
                onClick={() => setExpanded(true)}
              >
                View all {items.length}
              </button>
            </div>
          ) : null}
          {expanded && items.length > PHONE_CAP ? (
            <div className="border-t border-border/70 px-3">
              <button
                type="button"
                className="inline-flex min-h-11 items-center text-sm font-medium outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-orange)]"
                onClick={() => setExpanded(false)}
              >
                Show less
              </button>
            </div>
          ) : null}
        </div>
      )}
    </section>
  );
}
