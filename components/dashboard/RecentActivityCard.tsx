"use client";

import Link from "next/link";
import { formatActivityWhen } from "@/lib/dashboard/format-activity-time";
import type { RecentActivityItem } from "@/lib/dashboard/derive-recent-activity";
import { useAppUser } from "@/components/layout/app-user-context";
import { DEFAULT_ORG_TIMEZONE } from "@/lib/org/timezone";
import { cn } from "@/lib/utils";

const DESKTOP_CAP = 5;
const PHONE_CAP = 3;

type RecentActivityCardProps = {
  items: RecentActivityItem[];
};

export function RecentActivityCard({ items }: RecentActivityCardProps) {
  const { displayTimezone } = useAppUser();
  const timeZone = displayTimezone?.trim() || DEFAULT_ORG_TIMEZONE;
  const visible = items.slice(0, DESKTOP_CAP);

  if (visible.length === 0) return null;

  return (
    <section
      className="rounded-xl border border-border/70 bg-card px-3 py-3"
      data-recent-activity
      data-activity-cap={DESKTOP_CAP}
      aria-labelledby="recent-activity-heading"
    >
      <h2 id="recent-activity-heading" className="text-sm font-semibold tracking-tight">
        Recent activity
      </h2>
      <ol className="mt-2 space-y-0">
        {visible.map((item, index) => {
          const when = formatActivityWhen(item.occurredAt, timeZone);
          return (
            <li
              key={item.id}
              className={cn(
                "relative border-l border-border/70 py-1.5 pl-3",
                index >= PHONE_CAP && "max-lg:hidden"
              )}
            >
              <span
                className="absolute top-3 -left-1 size-2 rounded-full bg-border"
                aria-hidden
              />
              <Link
                href={item.href}
                className="block min-w-0 rounded-md outline-none ring-offset-background hover:bg-muted/40 focus-visible:ring-2 focus-visible:ring-ring"
                aria-label={`${item.projectTitle}: ${item.detail}${when ? `, ${when}` : ""}`}
              >
                <p className="truncate text-sm leading-snug">{item.detail}</p>
                <p className="truncate text-xs text-muted-foreground">{item.projectTitle}</p>
                {when ? (
                  <p className="text-xs text-muted-foreground">{when}</p>
                ) : null}
              </Link>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
