"use client";

import Link from "next/link";
import { formatActivityWhen } from "@/lib/dashboard/format-activity-time";
import {
  RECENT_ACTIVITY_EMPTY,
  type RecentActivityItem,
} from "@/lib/dashboard/derive-recent-activity";
import { useAppUser } from "@/components/layout/app-user-context";
import { DEFAULT_ORG_TIMEZONE } from "@/lib/org/timezone";

type RecentActivityCardProps = {
  items: RecentActivityItem[];
};

export function RecentActivityCard({ items }: RecentActivityCardProps) {
  const { displayTimezone } = useAppUser();
  const timeZone = displayTimezone?.trim() || DEFAULT_ORG_TIMEZONE;

  return (
    <section
      className="rounded-xl border border-border/70 bg-card px-3 py-3"
      data-recent-activity
      aria-labelledby="recent-activity-heading"
    >
      <h2 id="recent-activity-heading" className="text-sm font-semibold tracking-tight">
        Recent activity
      </h2>
      {items.length === 0 ? (
        <p className="mt-2 text-sm text-muted-foreground">{RECENT_ACTIVITY_EMPTY}</p>
      ) : (
        <ul className="mt-2 max-h-[min(36rem,70vh)] divide-y divide-border/60 overflow-y-auto">
          {items.map((item) => {
            const when = formatActivityWhen(item.occurredAt, timeZone);
            return (
              <li key={item.id} className="py-1.5 first:pt-1 last:pb-0">
                <Link
                  href={item.href}
                  className="block min-w-0 rounded-md px-1 py-0.5 outline-none ring-offset-background hover:bg-muted/40 focus-visible:ring-2 focus-visible:ring-ring"
                  aria-label={`${item.projectTitle}: ${item.detail}${when ? `, ${when}` : ""}`}
                >
                  <p className="truncate text-sm font-medium leading-snug">
                    {item.projectTitle}
                  </p>
                  <p className="text-sm leading-snug text-muted-foreground">
                    {item.detail}
                  </p>
                  {when ? (
                    <p className="text-xs leading-snug text-muted-foreground">
                      {when}
                    </p>
                  ) : null}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
