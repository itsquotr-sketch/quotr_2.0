const PLACEHOLDERS = new Set([
  "as",
  "tbc",
  "tba",
  "na",
  "n/a",
  "todo",
  "scope",
  "work",
  "see",
  "above",
  "below",
  "same",
  "tbd",
]);

/** A sendable scope is readable work, not a placeholder or a blank line. */
export function scopeIsMeaningful(value: string): boolean {
  const trimmed = value.trim().replace(/\s+/g, " ");
  if (trimmed.length < 12) return false;
  const words = trimmed.split(" ").filter((word) => word.length > 1);
  if (words.length < 3) return false;
  const tokens = words.map((word) => word.toLowerCase().replace(/[^a-z/]/g, ""));
  if (tokens.every((token) => PLACEHOLDERS.has(token))) return false;
  return true;
}

/** A due date, when set, must be after today in the builder's local calendar. */
export function dueDateIsFuture(value: string, today: string): boolean {
  if (!value.trim()) return true;
  return value > today;
}

export function localToday(now = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const year = parts.find((part) => part.type === "year")?.value ?? "0000";
  const month = parts.find((part) => part.type === "month")?.value ?? "01";
  const day = parts.find((part) => part.type === "day")?.value ?? "01";
  return `${year}-${month}-${day}`;
}
