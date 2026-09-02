import { QUOTE_DISPLAY_TIMEZONE } from "@/lib/quotes/display";
import type { EffectiveTrialState } from "@/lib/billing/types";

export type TrialCountdownTone =
  | "normal"
  | "subtle"
  | "strong"
  | "urgent"
  | "expired";

export type TrialCountdown = {
  expired: boolean;
  /** Whole remaining 24h periods, rounded up. Null when expired or unknown. */
  daysRemaining: number | null;
  label: string;
  tone: TrialCountdownTone;
  trialEndsAt: string;
};

function aucklandDateKey(date: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: QUOTE_DISPLAY_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function addAucklandDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
}

/**
 * Server-clock countdown. Do not use the browser clock as authority.
 * Avoids hour-level false precision.
 */
export function deriveTrialCountdown(input: {
  trialEndsAt: string | null;
  effectiveTrialState: EffectiveTrialState | null;
  now?: Date;
}): TrialCountdown | null {
  if (!input.trialEndsAt) return null;
  const ends = new Date(input.trialEndsAt);
  if (!Number.isFinite(ends.getTime())) return null;

  const now = input.now ?? new Date();
  const expired =
    input.effectiveTrialState === "trial_expired" || now.getTime() >= ends.getTime();

  if (expired) {
    return {
      expired: true,
      daysRemaining: 0,
      label: "Your 14-day trial has ended.",
      tone: "expired",
      trialEndsAt: input.trialEndsAt,
    };
  }

  const ms = ends.getTime() - now.getTime();
  const daysRemaining = Math.max(1, Math.ceil(ms / (24 * 60 * 60 * 1000)));
  const todayKey = aucklandDateKey(now);
  const endKey = aucklandDateKey(ends);
  const tomorrowKey = aucklandDateKey(addAucklandDays(now, 1));

  let label: string;
  if (endKey === todayKey) {
    label = "Trial ends today.";
  } else if (endKey === tomorrowKey) {
    label = "Ends tomorrow.";
  } else if (daysRemaining === 1) {
    label = "1 day remaining.";
  } else {
    label = `${daysRemaining} days remaining.`;
  }

  let tone: TrialCountdownTone = "normal";
  if (endKey === todayKey || daysRemaining <= 1) {
    tone = "urgent";
  } else if (daysRemaining <= 3) {
    tone = "strong";
  } else if (daysRemaining <= 7) {
    tone = "subtle";
  }

  return {
    expired: false,
    daysRemaining,
    label,
    tone,
    trialEndsAt: input.trialEndsAt,
  };
}

export function formatTrialEndDate(iso: string): string {
  const date = new Date(iso);
  if (!Number.isFinite(date.getTime())) return iso;
  return new Intl.DateTimeFormat("en-NZ", {
    timeZone: QUOTE_DISPLAY_TIMEZONE,
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}

export type TrialBannerNotice = {
  tone: Exclude<TrialCountdownTone, "normal">;
  title: string;
  message: string;
  ctaLabel: string;
  href: string;
};

export function trialBannerNotice(
  countdown: TrialCountdown | null
): TrialBannerNotice | null {
  if (!countdown) return null;
  if (countdown.tone === "normal") return null;

  if (countdown.expired) {
    return {
      tone: "expired",
      title: "Trial ended",
      message:
        "Your 14-day trial has ended. Choose Quotr Builder or Business to continue creating and sending new work.",
      ctaLabel: "Choose a plan",
      href: "/app/settings/billing",
    };
  }

  if (countdown.tone === "urgent") {
    return {
      tone: "urgent",
      title: "Trial ending",
      message: `${countdown.label} Subscribe now to keep creating and sending work.`,
      ctaLabel: "Subscribe now",
      href: "/app/settings/billing",
    };
  }

  if (countdown.tone === "strong") {
    return {
      tone: "strong",
      title: "Trial ending soon",
      message: `${countdown.label} Choose a plan before your trial ends.`,
      ctaLabel: "Choose a plan",
      href: "/app/settings/billing",
    };
  }

  return {
    tone: "subtle",
    title: "Quotr Trial",
    message: countdown.label,
    ctaLabel: "Choose a plan",
    href: "/app/settings/billing",
  };
}
