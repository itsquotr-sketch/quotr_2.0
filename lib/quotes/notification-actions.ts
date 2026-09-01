"use server";

import { requireAuthOrgContext } from "@/lib/security/auth-org-context";
import type { QuoteNotificationRecord } from "@/lib/quotes/notifications";

function payloadString(
  payload: Record<string, unknown>,
  key: string
): string | null {
  const value = payload[key];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export async function listMyQuoteNotifications(): Promise<{
  notifications: QuoteNotificationRecord[];
  unreadCount: number;
}> {
  const auth = await requireAuthOrgContext();
  if (!auth.ok) {
    return { notifications: [], unreadCount: 0 };
  }
  const { data, error } = await auth.supabase
    .from("notifications")
    .select(
      "id, notification_type, title, body, resource_id, project_id, payload, read_at, created_at"
    )
    .eq("org_id", auth.orgId)
    .eq("recipient_user_id", auth.user.id)
    .order("created_at", { ascending: false })
    .limit(20);
  if (error || !data) {
    return { notifications: [], unreadCount: 0 };
  }
  const notifications = data.map((row) => {
    const payload =
      row.payload && typeof row.payload === "object"
        ? (row.payload as Record<string, unknown>)
        : {};
    return {
      id: row.id as string,
      notification_type:
        row.notification_type as QuoteNotificationRecord["notification_type"],
      title: row.title as string,
      body: row.body as string,
      resource_id: (row.resource_id as string | null) ?? null,
      project_id: (row.project_id as string | null) ?? null,
      payload,
      read_at: (row.read_at as string | null) ?? null,
      created_at: row.created_at as string,
      action_url: payloadString(payload, "actionUrl"),
    };
  });
  return {
    notifications,
    unreadCount: notifications.filter((row) => !row.read_at).length,
  };
}

export async function markMyQuoteNotificationsRead(ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  const auth = await requireAuthOrgContext();
  if (!auth.ok) return;
  await auth.supabase.rpc("mark_notifications_read_v1", { p_ids: ids });
}
