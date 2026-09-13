"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useTransition,
} from "react";
import {
  listMyQuoteNotifications,
  markMyQuoteNotificationsRead,
} from "@/lib/quotes/notification-actions";
import type { QuoteNotificationRecord } from "@/lib/quotes/notifications";

type NotificationContextValue = {
  items: QuoteNotificationRecord[];
  unreadCount: number;
  pending: boolean;
  markOpenRead: () => void;
};

const NotificationContext = createContext<NotificationContextValue | null>(
  null
);

export function NotificationProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [items, setItems] = useState<QuoteNotificationRecord[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    startTransition(async () => {
      const result = await listMyQuoteNotifications();
      setItems(result.notifications);
      setUnreadCount(result.unreadCount);
    });
  }, []);

  function markOpenRead() {
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
    <NotificationContext.Provider
      value={{ items, unreadCount, pending, markOpenRead }}
    >
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications(): NotificationContextValue {
  const value = useContext(NotificationContext);
  if (!value) {
    return {
      items: [],
      unreadCount: 0,
      pending: false,
      markOpenRead: () => {},
    };
  }
  return value;
}
