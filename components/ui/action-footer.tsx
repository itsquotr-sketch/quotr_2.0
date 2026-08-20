import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";

type ActionFooterProps = {
  children: ReactNode;
  className?: string;
  innerClassName?: string;
} & HTMLAttributes<HTMLDivElement>;

/** Sticky decision-area footer for primary/secondary actions. */
export function ActionFooter({
  children,
  className,
  innerClassName,
  ...props
}: ActionFooterProps) {
  return (
    <div
      data-action-footer="true"
      className={cn(
        "sticky bottom-0 z-10 border-t border-border bg-background/95 px-3 pt-3 backdrop-blur pb-[max(0.75rem,env(safe-area-inset-bottom))]",
        className
      )}
      {...props}
    >
      <div className={cn("flex flex-wrap items-center gap-2", innerClassName)}>
        {children}
      </div>
    </div>
  );
}
