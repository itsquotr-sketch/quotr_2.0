"use client";

import Link from "next/link";
import {
  playSurfaceTrialMessage,
  type TrialBannerNotice,
} from "@/lib/billing/trial-countdown";
import { cn } from "@/lib/utils";
import { PLAY_SURFACE_BILLING_NOTE } from "@/lib/android/play-surface";
import { usePlaySurface } from "@/components/android/PlaySurfaceProvider";

type TrialNoticeBannerProps = {
  notice: TrialBannerNotice;
};

const TONE_CLASS: Record<TrialBannerNotice["tone"], string> = {
  subtle: "border-border bg-muted/60 text-foreground",
  strong: "border-amber-300/70 bg-amber-50 text-amber-950 dark:border-amber-500/40 dark:bg-amber-950/40 dark:text-amber-50",
  urgent:
    "border-[var(--brand-orange-muted)] bg-[var(--brand-orange-muted)] text-foreground",
  expired: "border-destructive/30 bg-destructive/10 text-destructive",
};

export function TrialNoticeBanner({ notice }: TrialNoticeBannerProps) {
  const playSurface = usePlaySurface();
  return (
    <div
      className={cn(
        "flex shrink-0 flex-col gap-2 border-b px-4 py-2.5 sm:flex-row sm:items-center sm:justify-between sm:px-6 print:hidden",
        TONE_CLASS[notice.tone]
      )}
    >
      <div className="min-w-0">
        <p className="text-sm font-medium">{notice.title}</p>
        <p className="text-sm opacity-90">
          {playSurface ? playSurfaceTrialMessage(notice) : notice.message}
        </p>
        {playSurface ? (
          <p className="text-sm opacity-90">{PLAY_SURFACE_BILLING_NOTE}</p>
        ) : null}
      </div>
      {playSurface ? null : (
      <Link
        href={notice.href}
        className="shrink-0 text-sm font-medium underline-offset-4 hover:underline"
      >
        {notice.ctaLabel}
      </Link>
      )}
    </div>
  );
}
