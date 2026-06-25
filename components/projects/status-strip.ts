import type { BusinessStatus } from "@/lib/projects/status";

const STATUS_STRIP_COLORS: Partial<Record<BusinessStatus | string, string>> = {
  lead: "bg-slate-400",
  site_visit: "bg-slate-400",
  scoping: "bg-slate-500",
  estimating: "bg-sky-400/90",
  estimate_ready: "bg-amber-400",
  quote_draft: "bg-[var(--brand-orange)]",
  quote_sent: "bg-neutral-800",
  won: "bg-emerald-500",
  lost: "bg-red-300/90",
  archived: "bg-muted-foreground/35",
};

export function getStatusStripColor(status: string, archived?: boolean): string {
  if (archived) {
    return STATUS_STRIP_COLORS.archived ?? "bg-muted-foreground/35";
  }

  return STATUS_STRIP_COLORS[status] ?? "bg-border";
}
