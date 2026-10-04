import { QuotrMark } from "@/components/brand/QuotrMark";
import { cn } from "@/lib/utils";

type QuotrLoaderProps = {
  variant?: "fullscreen" | "compact";
  /** Visible status. Also the polite live announcement. */
  status: string;
  /** Optional second line. Omit when it would repeat the status. */
  supporting?: string;
  className?: string;
  /** Optional stage marker for the estimate generation state. */
  generateStage?: string;
};

/**
 * Branded loading state. Fullscreen covers the viewport for major
 * transitions. Compact sits inside a button. Neither delays navigation.
 */
export function QuotrLoader({
  variant = "fullscreen",
  status,
  supporting,
  className,
  generateStage,
}: QuotrLoaderProps) {
  const mark = (
    <span
      className={cn(
        "inline-flex items-center justify-center text-foreground",
        variant === "compact" &&
          "size-6 rounded-full bg-white shadow-[inset_0_0_0_1px_rgba(0,0,0,0.08)]"
      )}
    >
      <QuotrMark size={variant === "compact" ? 16 : 72} />
    </span>
  );

  if (variant === "compact") {
    return (
      <span
        role="status"
        aria-live="polite"
        data-quotr-loader="compact"
        data-generate-estimate-status={generateStage}
        className={cn(
          "inline-flex items-center justify-center gap-2",
          className
        )}
      >
        {mark}
        <span>{status}</span>
      </span>
    );
  }

  return (
    <div
      role="status"
      aria-live="polite"
      aria-atomic="true"
      data-quotr-loader="fullscreen"
      data-generate-estimate-status={generateStage}
      className={cn(
        "fixed inset-0 z-50 flex min-h-dvh flex-col items-center justify-center bg-background px-6 text-center",
        "pt-[max(1.5rem,env(safe-area-inset-top))] pb-[max(1.5rem,env(safe-area-inset-bottom))]",
        "pl-[max(1.5rem,env(safe-area-inset-left))] pr-[max(1.5rem,env(safe-area-inset-right))]",
        className
      )}
    >
      {mark}
      <p className="mt-6 min-h-6 max-w-sm text-base font-medium text-foreground">
        {status}
      </p>
      {supporting ? (
        <p className="mt-2 max-w-sm text-sm leading-relaxed text-muted-foreground">
          {supporting}
        </p>
      ) : null}
    </div>
  );
}
