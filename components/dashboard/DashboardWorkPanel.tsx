"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { Tabs } from "@base-ui/react/tabs";
import { RecentActivityCard } from "@/components/dashboard/RecentActivityCard";
import type { DashboardAttentionItem } from "@/lib/dashboard/attention";
import { RECENT_ACTIVITY_EMPTY } from "@/lib/dashboard/derive-recent-activity";
import type { RecentActivityItem } from "@/lib/dashboard/derive-recent-activity";
import { defaultDashboardWorkTab } from "@/lib/dashboard/work-panel";
import { cn } from "@/lib/utils";

const DESKTOP_CAP = 5;
const PHONE_CAP = 3;

const tabClass =
  "inline-flex min-h-11 w-full items-center justify-center gap-1.5 px-2 text-center text-sm leading-tight text-muted-foreground outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--brand-orange)] aria-selected:bg-muted/40 aria-selected:font-medium aria-selected:text-foreground aria-selected:shadow-[inset_0_-2px_0_0_var(--brand-orange)]";

type DashboardWorkPanelProps = {
  attention: DashboardAttentionItem[];
  activity: RecentActivityItem[];
};

export function DashboardWorkPanel({
  attention,
  activity,
}: DashboardWorkPanelProps) {
  const [attentionExpanded, setAttentionExpanded] = useState(false);
  const [activityExpanded, setActivityExpanded] = useState(false);
  const defaultTab = defaultDashboardWorkTab(attention.length, activity.length);

  return (
    <section
      className="overflow-hidden rounded-xl border border-border/70 bg-card"
      data-dashboard-work-panel
      data-dashboard-attention
    >
      <Tabs.Root defaultValue={defaultTab}>
        <Tabs.List
          className="grid grid-cols-2 border-b border-border/70"
          aria-label="Needs attention and recent activity"
        >
          <Tabs.Tab value="attention" className={tabClass}>
            <span>Needs attention</span>
            <span className="tabular-nums">{attention.length}</span>
          </Tabs.Tab>
          <Tabs.Tab value="activity" className={tabClass}>
            Recent activity
          </Tabs.Tab>
        </Tabs.List>
        <Tabs.Panel value="attention" keepMounted className="outline-none">
          <AttentionList
            items={attention}
            expanded={attentionExpanded}
            onExpandedChange={setAttentionExpanded}
          />
        </Tabs.Panel>
        <Tabs.Panel
          value="activity"
          keepMounted
          className="outline-none"
          data-dashboard-activity
        >
          <ActivityList
            items={activity}
            expanded={activityExpanded}
            onExpandedChange={setActivityExpanded}
          />
        </Tabs.Panel>
      </Tabs.Root>
    </section>
  );
}

function AttentionList({
  items,
  expanded,
  onExpandedChange,
}: {
  items: DashboardAttentionItem[];
  expanded: boolean;
  onExpandedChange: (expanded: boolean) => void;
}) {
  if (items.length === 0) {
    return (
      <p className="px-3 py-3 text-sm text-muted-foreground">
        Nothing needs attention. Current work can keep moving.
      </p>
    );
  }

  const hiddenOnDesktop = !expanded && items.length > DESKTOP_CAP;
  const hiddenOnPhone = !expanded && items.length > PHONE_CAP;

  return (
    <div>
      <ul className={cn(expanded && "lg:max-h-80 lg:overflow-y-auto")}>
        {items.map((item, index) => (
          <li
            key={item.id}
            className={cn(
              "border-b border-border/70 px-3 py-2 last:border-b-0",
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
      <Disclosure
        count={items.length}
        expanded={expanded}
        hiddenOnDesktop={hiddenOnDesktop}
        hiddenOnPhone={hiddenOnPhone}
        onExpandedChange={onExpandedChange}
      />
    </div>
  );
}

function ActivityList({
  items,
  expanded,
  onExpandedChange,
}: {
  items: RecentActivityItem[];
  expanded: boolean;
  onExpandedChange: (expanded: boolean) => void;
}) {
  if (items.length === 0) {
    return <p className="px-3 py-3 text-sm text-muted-foreground">{RECENT_ACTIVITY_EMPTY}</p>;
  }

  const hiddenOnDesktop = !expanded && items.length > DESKTOP_CAP;
  const hiddenOnPhone = !expanded && items.length > PHONE_CAP;

  return (
    <div>
      <div className={cn("px-3 py-1", expanded && "lg:max-h-80 lg:overflow-y-auto")}>
        <RecentActivityCard items={items} expanded={expanded} />
      </div>
      <Disclosure
        count={items.length}
        expanded={expanded}
        hiddenOnDesktop={hiddenOnDesktop}
        hiddenOnPhone={hiddenOnPhone}
        onExpandedChange={onExpandedChange}
      />
    </div>
  );
}

function Disclosure({
  count,
  expanded,
  hiddenOnDesktop,
  hiddenOnPhone,
  onExpandedChange,
}: {
  count: number;
  expanded: boolean;
  hiddenOnDesktop: boolean;
  hiddenOnPhone: boolean;
  onExpandedChange: (expanded: boolean) => void;
}) {
  if (!expanded && !hiddenOnDesktop && !hiddenOnPhone) return null;

  return (
    <div
      className={cn(
        "border-t border-border/70 px-3",
        expanded ? "" : !hiddenOnDesktop && "lg:hidden"
      )}
    >
      <button
        type="button"
        className="inline-flex min-h-11 items-center text-sm font-medium outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-orange)]"
        aria-expanded={expanded}
        onClick={() => onExpandedChange(!expanded)}
      >
        {expanded ? "Show less" : `View all ${count}`}
      </button>
    </div>
  );
}
