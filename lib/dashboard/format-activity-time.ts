import { resolveDisplayTimezone } from "@/lib/org/timezone";

function ymdInZone(date: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en-NZ", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const year = parts.find((part) => part.type === "year")?.value ?? "";
  const month = parts.find((part) => part.type === "month")?.value ?? "";
  const day = parts.find((part) => part.type === "day")?.value ?? "";
  return `${year}-${month}-${day}`;
}

function addCalendarDays(ymd: string, days: number): string {
  const [year, month, day] = ymd.split("-").map(Number);
  const utc = Date.UTC(year, month - 1, day + days);
  const next = new Date(utc);
  const y = next.getUTCFullYear();
  const m = String(next.getUTCMonth() + 1).padStart(2, "0");
  const d = String(next.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/**
 * Relative timestamps for Recent Activity, using organisation timezone
 * for calendar day (Yesterday). UTC storage remains canonical.
 */
export function formatActivityWhen(
  value: string | Date,
  timeZone: string,
  now: Date = new Date()
): string {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const zone = resolveDisplayTimezone(timeZone);
  const diffMs = now.getTime() - date.getTime();
  if (diffMs < 0) return "Just now";

  const minutes = Math.round(diffMs / 60_000);
  if (minutes < 1) return "Just now";
  if (minutes === 1) return "1 minute ago";
  if (minutes < 60) return `${minutes} minutes ago`;

  const today = ymdInZone(now, zone);
  const that = ymdInZone(date, zone);
  if (that === today) {
    const hours = Math.max(1, Math.round(diffMs / 3_600_000));
    return hours === 1 ? "1 hour ago" : `${hours} hours ago`;
  }
  if (that === addCalendarDays(today, -1)) return "Yesterday";

  const days = Math.round(diffMs / 86_400_000);
  if (days < 7) {
    return days <= 1 ? "Yesterday" : `${days} days ago`;
  }

  return new Intl.DateTimeFormat("en-NZ", {
    timeZone: zone,
    day: "numeric",
    month: "short",
  }).format(date);
}
