import { cache } from "react";

export type AnalyticsClock = {
  t0: number;
  marks: Record<string, number>;
};

/** Request-scoped clock. Layout starts it for Analytics; the loader fills the later marks. */
export const analyticsClock = cache(
  (): AnalyticsClock => ({
    t0: 0,
    marks: {},
  })
);

export function startAnalyticsClock(): void {
  const clock = analyticsClock();
  if (!clock.t0) clock.t0 = Date.now();
}

export function markAnalytics(name: string): void {
  const clock = analyticsClock();
  if (!clock.t0) clock.t0 = Date.now();
  clock.marks[name] = Date.now() - clock.t0;
}

export function analyticsTimingAttribute(marks: Record<string, number>): string {
  return Object.entries(marks)
    .map(([name, value]) => `${name}:${value}`)
    .join(",");
}
