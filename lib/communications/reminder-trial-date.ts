import { QUOTE_DISPLAY_TIMEZONE } from "@/lib/quotes/display";

/**
 * Display date for the trial reminder only.
 * Same Auckland calendar day as the rest of Quotr. No time of day.
 */
export function formatReminderTrialEndsOn(iso: string): string {
  const date = new Date(iso);
  if (!Number.isFinite(date.getTime())) return iso;
  return new Intl.DateTimeFormat("en-NZ", {
    timeZone: QUOTE_DISPLAY_TIMEZONE,
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
}
