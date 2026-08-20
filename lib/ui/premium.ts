/**
 * UX-PREMIUM-01 — shared presentation tokens.
 * Visual only. Do not import into calculators or rate resolvers.
 */

export const PREMIUM = {
  actionGap: "flex flex-wrap items-center gap-2",
  card: "rounded-xl border border-border/70 bg-card",
  cardPad: "px-4 py-3.5",
  secondaryPanel: "rounded-xl border border-border/50 bg-muted/20",
  warningPanel:
    "rounded-xl border border-amber-300/80 bg-amber-50/80 dark:border-amber-800/60 dark:bg-amber-950/30",
  eyebrow:
    "text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground",
  sectionTitle: "text-sm font-semibold tracking-tight text-foreground",
  helper: "text-xs leading-snug text-muted-foreground",
  caption: "text-[11px] text-muted-foreground",
  metricLabel:
    "text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground",
  metricValue: "text-sm font-semibold tabular-nums tracking-tight",
  heroValue: "text-3xl font-semibold tracking-tight tabular-nums",
} as const;
