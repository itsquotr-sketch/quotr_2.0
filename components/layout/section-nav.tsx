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
};

export function SettingsSectionNav({
  items,
  activeId,
  onChange,
  className,
}: SettingsSectionNavProps) {
  return (
    <div
      className={cn(
        "-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0",
        className
      )}
      role="tablist"
      aria-label="Settings sections"
    >
      <div className="flex w-max min-w-full gap-1.5 pb-1 lg:flex-wrap lg:w-auto">
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
                "shrink-0 rounded-full border px-3.5 py-1.5 text-xs font-medium whitespace-nowrap transition-[color,background-color,border-color,box-shadow] duration-150",
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
