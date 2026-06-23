import { cn } from "@/lib/utils";

type WorkspaceBannerProps = {
  children: React.ReactNode;
  className?: string;
};

/** Consistent review/responsibility banner for pricing and quote workspaces. */
export function WorkspaceBanner({ children, className }: WorkspaceBannerProps) {
  return (
    <div
      className={cn(
        "rounded-lg border border-amber-200/80 bg-amber-50/80 px-4 py-2.5 text-sm leading-relaxed text-amber-950",
        "dark:border-amber-900/60 dark:bg-amber-950/25 dark:text-amber-100",
        className
      )}
      role="status"
    >
      {children}
    </div>
  );
}
