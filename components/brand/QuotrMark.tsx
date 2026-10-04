import { cn } from "@/lib/utils";

type QuotrMarkProps = {
  size?: number;
  className?: string;
};

/**
 * Code-native Quotr Q. The orange diagonal stays still.
 * While loading, a near-complete black arc turns on a neutral track.
 * Reduced motion swaps that arc for the completed static bowl.
 */
export function QuotrMark({ size = 72, className }: QuotrMarkProps) {
  return (
    <svg
      data-quotr-mark
      width={size}
      height={size}
      viewBox="-8 -8 96 96"
      fill="none"
      aria-hidden="true"
      focusable="false"
      overflow="visible"
      className={cn("quotr-mark shrink-0 overflow-visible", className)}
    >
      <circle
        className="quotr-mark-track"
        cx="40"
        cy="40"
        r="26"
        stroke="currentColor"
        strokeWidth="9"
      />
      <circle
        className="quotr-mark-ring quotr-mark-stroke"
        cx="40"
        cy="40"
        r="26"
        stroke="currentColor"
        strokeWidth="9"
        strokeLinecap="round"
      />
      <path
        className="quotr-mark-rest"
        d="M44.51 65.61A26 26 0 1 1 62.96 52.21"
        stroke="currentColor"
        strokeWidth="9"
        strokeLinecap="round"
      />
      <line
        className="quotr-mark-slash"
        x1="48"
        y1="46"
        x2="69"
        y2="71"
        stroke="var(--brand-orange)"
        strokeWidth="9"
        strokeLinecap="round"
      />
    </svg>
  );
}
