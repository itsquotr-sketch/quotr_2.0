"use client";

import { cn } from "@/lib/utils";

export type SectionNavItem = {
  id: string;
  label: string;
};

type SettingsSectionNavProps = {
  items: SectionNavItem[];
  activeId: string;
  onChange: (id: string) => void;
  className?: string;
  label?: string;
  touchTargets?: boolean;
  /** Wrap pills instead of scrolling when the row is wider than the page. */
  wrap?: boolean;
};

export function SettingsSectionNav({
  items,
  activeId,
  onChange,
  className,
  label = "Settings sections",
  touchTargets = false,
  wrap = false,
}: SettingsSectionNavProps) {
  return (
    <div
      className={cn(
        wrap ? "overflow-visible" : "-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0",
        className
      )}
      role="tablist"
      aria-label={label}
    >
      <div
        className={cn(
          "flex gap-1.5 pb-1",
          wrap ? "flex-wrap" : "w-max min-w-full lg:w-auto lg:flex-wrap"
        )}
      >
        {items.map((item) => {
          const isActive = item.id === activeId;

          return (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => onChange(item.id)}
              className={cn(
                "shrink-0 rounded-full border px-3.5 py-1.5 text-xs font-medium whitespace-nowrap outline-none transition-[color,background-color,border-color,box-shadow] duration-150 focus-visible:ring-2 focus-visible:ring-[var(--brand-orange)] focus-visible:ring-offset-2",
                touchTargets && "min-h-11",
                isActive
                  ? "border-[var(--brand-orange-muted)] bg-[var(--brand-orange-muted)] text-foreground shadow-[inset_0_0_0_1px_oklch(0.705_0.213_47.604/0.25)]"
                  : "border-border/60 bg-card text-muted-foreground hover:border-border hover:text-foreground"
              )}
            >
              {item.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
