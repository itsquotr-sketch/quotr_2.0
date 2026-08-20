"use client";

import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

export function DisclosureHeader({
  title,
  hint,
  open,
  onToggle,
  children,
}: {
  title: string;
  hint?: string;
  open: boolean;
  onToggle: () => void;
  children?: React.ReactNode;
}) {
  return (
    <button
      type="button"
      className="flex w-full min-h-11 items-center justify-between gap-3 px-3.5 py-3 text-left"
      onClick={onToggle}
      aria-expanded={open}
      data-disclosure-header="true"
    >
      <span className="min-w-0">
        <span className="block text-sm font-medium text-foreground">{title}</span>
        {hint && !open ? (
          <span className="mt-0.5 block text-xs text-muted-foreground">{hint}</span>
        ) : null}
        {children}
      </span>
      <ChevronDown
        className={cn(
          "size-4 shrink-0 text-muted-foreground motion-safe:transition-transform",
          open && "rotate-180"
        )}
        aria-hidden
      />
    </button>
  );
}
