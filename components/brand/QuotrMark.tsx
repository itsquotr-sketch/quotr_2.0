import { cn } from "@/lib/utils";

type QuotrMarkProps = {
  size?: number;
  className?: string;
};

/**
 * Code-native Quotr Q: black circular bowl with the orange diagonal.
 * Resting geometry is the complete mark. Motion only draws and settles it.
 */
export function QuotrMark({ size = 72, className }: QuotrMarkProps) {
  return (
    <svg
      data-quotr-mark
      width={size}
      height={size}
      viewBox="0 0 80 80"
      fill="none"
      aria-hidden="true"
      focusable="false"
      className={cn("quotr-mark shrink-0", className)}
    >
      <g className="quotr-mark-ring">
        <path
          className="quotr-mark-stroke"
          pathLength={100}
          d="M44.51 65.61A26 26 0 1 1 62.96 52.21"
          stroke="currentColor"
          strokeWidth="9"
          strokeLinecap="round"
        />
      </g>
      <g className="quotr-mark-slash">
        <line
          x1="48"
          y1="46"
          x2="69"
          y2="71"
          stroke="var(--brand-orange)"
          strokeWidth="9"
          strokeLinecap="round"
        />
      </g>
    </svg>
  );
}
