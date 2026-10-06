/**
 * Analytics periods are calendar windows in the organisation timezone.
 * Persisted timestamps stay UTC. The end instant is exclusive.
 */

export const ANALYTICS_PERIODS = [
  { id: "this_month", label: "This month" },
  { id: "last_month", label: "Last month" },
  { id: "this_quarter", label: "This quarter" },
  { id: "last_quarter", label: "Last quarter" },
  { id: "last_90_days", label: "Last 90 days" },
  { id: "year_to_date", label: "Year to date" },
  { id: "last_12_months", label: "Last 12 months" },
] as const;

export type AnalyticsPeriodId = (typeof ANALYTICS_PERIODS)[number]["id"];
export type AnalyticsWindowId = AnalyticsPeriodId | "custom";

/** Inclusive calendar days. Covers last 12 months, including one leap day. */
export const ANALYTICS_MAX_RANGE_DAYS = 372;

export type PeriodWindow = {
  id: AnalyticsWindowId;
  label: string;
  timeZone: string;
  /** Inclusive UTC instant. */
  start: string;
  /** Exclusive UTC instant. */
  end: string;
  /** Custom range start date, YYYY-MM-DD. Null for a preset. */
  from: string | null;
  /** Custom range end date, YYYY-MM-DD, inclusive for the user. */
  to: string | null;
};

type CalendarDate = { year: number; month: number; day: number };

export function parseAnalyticsPeriod(
  value: string | null | undefined
): AnalyticsPeriodId {
  const match = ANALYTICS_PERIODS.find((period) => period.id === value);
  return match?.id ?? "this_month";
}

export function resolveAnalyticsPeriod(input: {
  period: AnalyticsPeriodId;
  timeZone: string;
  now: Date;
}): PeriodWindow {
  const timeZone = input.timeZone;
  const today = calendarDateInTimeZone(input.now, timeZone);
  const tomorrow = addCalendarDays(today, 1);
  const label =
    ANALYTICS_PERIODS.find((period) => period.id === input.period)?.label ??
    "This month";

  let startDate: CalendarDate;
  let endDate: CalendarDate;

  if (input.period === "last_month") {
    startDate = { year: today.year, month: today.month - 1, day: 1 };
    if (startDate.month < 1) {
      startDate = { year: today.year - 1, month: 12, day: 1 };
    }
    endDate = { year: today.year, month: today.month, day: 1 };
  } else if (input.period === "this_quarter" || input.period === "last_quarter") {
    const quarterStartMonth = Math.floor((today.month - 1) / 3) * 3 + 1;
    const thisQuarter = { year: today.year, month: quarterStartMonth, day: 1 };
    if (input.period === "this_quarter") {
      startDate = thisQuarter;
      endDate = addCalendarMonths(thisQuarter, 3);
      const tomorrowUtc = zonedTimeToUtc(tomorrow, timeZone).getTime();
      if (tomorrowUtc < zonedTimeToUtc(endDate, timeZone).getTime()) endDate = tomorrow;
    } else {
      startDate = addCalendarMonths(thisQuarter, -3);
      endDate = thisQuarter;
    }
  } else if (input.period === "last_90_days") {
    startDate = addCalendarDays(today, -89);
    endDate = tomorrow;
  } else if (input.period === "year_to_date") {
    startDate = { year: today.year, month: 1, day: 1 };
    endDate = tomorrow;
  } else if (input.period === "last_12_months") {
    startDate = addCalendarMonths(today, -12);
    endDate = tomorrow;
  } else {
    startDate = { year: today.year, month: today.month, day: 1 };
    endDate = addCalendarMonths(startDate, 1);
    const tomorrowUtc = zonedTimeToUtc(tomorrow, timeZone).getTime();
    const monthEndUtc = zonedTimeToUtc(endDate, timeZone).getTime();
    if (tomorrowUtc < monthEndUtc) {
      endDate = tomorrow;
    }
  }

  return {
    id: input.period,
    label,
    timeZone,
    start: zonedTimeToUtc(startDate, timeZone).toISOString(),
    end: zonedTimeToUtc(endDate, timeZone).toISOString(),
    from: calendarKey(startDate),
    to: calendarKey(addCalendarDays(endDate, -1)),
  };
}

export type AnalyticsRangeResult =
  | { ok: true; window: PeriodWindow }
  | { ok: false; error: string };

/**
 * Presets use the existing calendar rules. Custom dates are inclusive for the
 * user and become an exclusive end instant at the start of the next day in
 * the organisation timezone.
 */
export function resolveAnalyticsRequest(input: {
  period: string | null | undefined;
  from?: string | null;
  to?: string | null;
  timeZone: string;
  now: Date;
}): AnalyticsRangeResult {
  if (input.period !== "custom") {
    return {
      ok: true,
      window: resolveAnalyticsPeriod({
        period: parseAnalyticsPeriod(input.period),
        timeZone: input.timeZone,
        now: input.now,
      }),
    };
  }
  return resolveCustomRange({
    from: input.from ?? "",
    to: input.to ?? "",
    timeZone: input.timeZone,
  });
}

export function resolveCustomRange(input: {
  from: string;
  to: string;
  timeZone: string;
}): AnalyticsRangeResult {
  const from = parseCalendarDate(input.from);
  const to = parseCalendarDate(input.to);
  if (!from || !to) {
    return { ok: false, error: "Enter a start and end date." };
  }
  if (compareCalendar(from, to) > 0) {
    return { ok: false, error: "The start date has to be on or before the end date." };
  }
  const days = calendarDaySpan(from, to);
  if (days > ANALYTICS_MAX_RANGE_DAYS) {
    return {
      ok: false,
      error: `Choose a range of ${ANALYTICS_MAX_RANGE_DAYS} days or fewer.`,
    };
  }
  const endDate = addCalendarDays(to, 1);
  return {
    ok: true,
    window: {
      id: "custom",
      label: "Custom range",
      timeZone: input.timeZone,
      start: zonedTimeToUtc(from, input.timeZone).toISOString(),
      end: zonedTimeToUtc(endDate, input.timeZone).toISOString(),
      from: calendarKey(from),
      to: calendarKey(to),
    },
  };
}

function parseCalendarDate(value: string): CalendarDate | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const check = new Date(Date.UTC(year, month - 1, day));
  if (
    check.getUTCFullYear() !== year ||
    check.getUTCMonth() !== month - 1 ||
    check.getUTCDate() !== day
  ) {
    return null;
  }
  return { year, month, day };
}

export function inPeriod(iso: string, window: PeriodWindow): boolean {
  const time = Date.parse(iso);
  if (!Number.isFinite(time)) return false;
  return time >= Date.parse(window.start) && time < Date.parse(window.end);
}

export function formatPeriodDate(iso: string, timeZone: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("en-NZ", {
    timeZone,
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}

/** Last calendar instant included in an exclusive-end window. */
export function formatPeriodRange(window: PeriodWindow): string {
  const lastIncluded = new Date(Date.parse(window.end) - 1);
  const start = formatPeriodDate(window.start, window.timeZone);
  const end = formatPeriodDate(lastIncluded.toISOString(), window.timeZone);
  if (start === end) return start;
  return `${start} – ${end}`;
}

export function calendarDateInTimeZone(date: Date, timeZone: string): CalendarDate {
  const parts = zonedParts(date, timeZone);
  return { year: parts.year, month: parts.month, day: parts.day };
}

export type TrendGranularity = "day" | "week" | "month";

export function trendGranularity(window: PeriodWindow): TrendGranularity {
  const start = calendarDateInTimeZone(new Date(window.start), window.timeZone);
  const end = calendarDateInTimeZone(
    new Date(Date.parse(window.end) - 1),
    window.timeZone
  );
  const span = calendarDaySpan(start, end);
  if (span > 35) return "month";
  if (span > 16) return "week";
  return "day";
}

export function trendBuckets(window: PeriodWindow): Array<{
  key: string;
  label: string;
  start: string;
  end: string;
}> {
  const granularity = trendGranularity(window);
  const buckets: Array<{ key: string; label: string; start: string; end: string }> = [];
  let cursor = calendarDateInTimeZone(new Date(window.start), window.timeZone);
  const last = calendarDateInTimeZone(
    new Date(Date.parse(window.end) - 1),
    window.timeZone
  );

  if (granularity === "week") {
    cursor = startOfIsoWeek(cursor);
  } else if (granularity === "month") {
    cursor = { year: cursor.year, month: cursor.month, day: 1 };
  }

  const guard = 400;
  for (let i = 0; i < guard; i += 1) {
    if (compareCalendar(cursor, last) > 0) break;
    const next =
      granularity === "day"
        ? addCalendarDays(cursor, 1)
        : granularity === "week"
          ? addCalendarDays(cursor, 7)
          : addCalendarMonths(cursor, 1);
    const start = zonedTimeToUtc(cursor, window.timeZone);
    const end = zonedTimeToUtc(next, window.timeZone);
    if (end.getTime() <= Date.parse(window.start)) {
      cursor = next;
      continue;
    }
    buckets.push({
      key: calendarKey(cursor),
      label: bucketLabel(cursor, granularity, window.timeZone),
      start: start.toISOString(),
      end: end.toISOString(),
    });
    cursor = next;
  }

  return buckets;
}

function bucketLabel(
  date: CalendarDate,
  granularity: TrendGranularity,
  timeZone: string
): string {
  const instant = zonedTimeToUtc(date, timeZone);
  if (granularity === "month") {
    return new Intl.DateTimeFormat("en-NZ", {
      timeZone,
      month: "short",
      year: "numeric",
    }).format(instant);
  }
  return new Intl.DateTimeFormat("en-NZ", {
    timeZone,
    day: "numeric",
    month: "short",
  }).format(instant);
}

function calendarKey(date: CalendarDate): string {
  return `${date.year}-${String(date.month).padStart(2, "0")}-${String(date.day).padStart(2, "0")}`;
}

function calendarDaySpan(start: CalendarDate, end: CalendarDate): number {
  const a = Date.UTC(start.year, start.month - 1, start.day);
  const b = Date.UTC(end.year, end.month - 1, end.day);
  return Math.floor((b - a) / 86_400_000) + 1;
}

function compareCalendar(a: CalendarDate, b: CalendarDate): number {
  if (a.year !== b.year) return a.year - b.year;
  if (a.month !== b.month) return a.month - b.month;
  return a.day - b.day;
}

function startOfIsoWeek(date: CalendarDate): CalendarDate {
  const sun0 = new Date(Date.UTC(date.year, date.month - 1, date.day)).getUTCDay();
  const monday0 = (sun0 + 6) % 7;
  return addCalendarDays(date, -monday0);
}

function addCalendarDays(date: CalendarDate, days: number): CalendarDate {
  const utc = new Date(Date.UTC(date.year, date.month - 1, date.day + days));
  return {
    year: utc.getUTCFullYear(),
    month: utc.getUTCMonth() + 1,
    day: utc.getUTCDate(),
  };
}

function addCalendarMonths(date: CalendarDate, months: number): CalendarDate {
  const monthIndex = date.month - 1 + months;
  const year = date.year + Math.floor(monthIndex / 12);
  const month = ((monthIndex % 12) + 12) % 12;
  return { year, month: month + 1, day: 1 };
}

function zonedTimeToUtc(date: CalendarDate, timeZone: string): Date {
  let utc = Date.UTC(date.year, date.month - 1, date.day, 0, 0, 0);
  for (let i = 0; i < 4; i += 1) {
    const parts = zonedParts(new Date(utc), timeZone);
    const asUtc = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second);
    const desired = Date.UTC(date.year, date.month - 1, date.day, 0, 0, 0);
    const diff = desired - asUtc;
    if (diff === 0) break;
    utc += diff;
  }
  return new Date(utc);
}

function zonedParts(
  date: Date,
  timeZone: string
): CalendarDate & { hour: number; minute: number; second: number } {
  const formatter = new Intl.DateTimeFormat("en-NZ", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });
  const parts = Object.fromEntries(
    formatter.formatToParts(date).map((part) => [part.type, part.value])
  );
  let hour = Number(parts.hour);
  if (hour === 24) hour = 0;
  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    hour,
    minute: Number(parts.minute),
    second: Number(parts.second),
  };
}
