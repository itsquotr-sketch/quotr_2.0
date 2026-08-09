import Link from "next/link";
import type { SetupSuggestion } from "@/lib/setup/readiness";
import { cn } from "@/lib/utils";

type SetupGuidanceBannerProps = {
  suggestions: SetupSuggestion[];
  className?: string;
  /** Soft guidance allows continuing; required still shows actions. */
  tone?: "info" | "warning";
};

export function SetupGuidanceBanner({
  suggestions,
  className,
  tone = "info",
}: SetupGuidanceBannerProps) {
  if (!suggestions.length) {
    return null;
  }

  const primary = suggestions[0];

  return (
    <div
      role="status"
      className={cn(
        "rounded-lg border px-3 py-3 text-sm",
        tone === "warning"
          ? "border-amber-500/30 bg-amber-500/10 text-amber-950 dark:text-amber-100"
          : "border-border/70 bg-muted/40 text-foreground",
        className
      )}
    >
      <p className="font-medium">{primary.title}</p>
      <p className="mt-1 text-muted-foreground dark:text-amber-100/80">
        {primary.reason}
      </p>
      <p className="mt-2">
        <Link
          href={primary.href}
          className="font-medium underline-offset-4 hover:underline"
        >
          {primary.severity === "required" ? "Complete now" : "Update setup"}
        </Link>
      </p>
    </div>
  );
}
