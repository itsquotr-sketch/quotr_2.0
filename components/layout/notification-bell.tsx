"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { Bell } from "lucide-react";
import {
  listMyQuoteNotifications,
  markMyQuoteNotificationsRead,
} from "@/lib/quotes/notification-actions";
import type { QuoteNotificationRecord } from "@/lib/quotes/notifications";
import { formatQuoteDateTime } from "@/lib/quotes/display";
import { useAppUser } from "@/components/layout/app-user-context";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

type NotificationBellProps = {
  variant?: "header" | "sidebar";
};

export function NotificationBell({ variant = "header" }: NotificationBellProps) {
  const { displayTimezone } = useAppUser();
  const [items, setItems] = useState<QuoteNotificationRecord[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [pending, startTransition] = useTransition();
  const isSidebar = variant === "sidebar";

  useEffect(() => {
    startTransition(async () => {
      const result = await listMyQuoteNotifications();
      setItems(result.notifications);
      setUnreadCount(result.unreadCount);
    });
  }, []);

  function handleOpenChange(open: boolean) {
    if (!open) return;
    const unreadIds = items.filter((item) => !item.read_at).map((item) => item.id);
    if (unreadIds.length === 0) return;
    startTransition(async () => {
      await markMyQuoteNotificationsRead(unreadIds);
      setItems((current) =>
        current.map((item) =>
          unreadIds.includes(item.id)
            ? { ...item, read_at: item.read_at ?? new Date().toISOString() }
            : item
        )
      );
      setUnreadCount(0);
    });
  }

  return (
    <DropdownMenu onOpenChange={handleOpenChange}>
      <DropdownMenuTrigger
        className={cn(
          "relative inline-flex size-9 items-center justify-center rounded-lg outline-none",
          isSidebar
            ? "text-sidebar-foreground/85 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
            : "text-foreground hover:bg-muted"
        )}
        aria-label={
          unreadCount > 0
            ? `${unreadCount} unread notifications`
            : "Notifications"
        }
      >
        <Bell className="size-4" />
        {unreadCount > 0 ? (
          <span className="absolute top-1.5 right-1.5 size-2 rounded-full bg-[var(--brand-orange)]" />
        ) : null}
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align={isSidebar ? "start" : "end"}
        side={isSidebar ? "top" : "bottom"}
        className="w-[min(22rem,calc(100vw-2rem))] p-0"
      >
        <div className="border-b px-3 py-2">
          <p className="text-sm font-medium">Notifications</p>
        </div>
        <div className="max-h-80 overflow-y-auto">
          {items.length === 0 ? (
            <p className="px-3 py-6 text-sm text-muted-foreground">
              {pending ? "Loading…" : "No quote responses yet."}
            </p>
          ) : (
            items.map((item) => (
              <Link
                key={item.id}
                href={item.action_url || "/app/dashboard"}
                className="block border-b px-3 py-2.5 last:border-0 hover:bg-muted/60"
              >
                <p className="text-sm font-medium">{item.title}</p>
                <p className="mt-0.5 whitespace-pre-line text-xs leading-snug text-muted-foreground">
                  {item.body}
                </p>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  {formatQuoteDateTime(item.created_at, displayTimezone ?? undefined) ?? ""}
                </p>
              </Link>
            ))
          )}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
