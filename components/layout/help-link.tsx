"use client";

import Link from "next/link";
import { CircleHelp } from "lucide-react";
import { cn } from "@/lib/utils";

type HelpLinkProps = {
  className?: string;
  variant?: "menu" | "sidebar-footer" | "text";
  onNavigate?: () => void;
};

export function HelpLink({
  className,
  variant = "sidebar-footer",
  onNavigate,
}: HelpLinkProps) {
  return (
    <Link
      href="/help"
      onClick={onNavigate}
      className={cn(
        variant === "sidebar-footer" &&
          "flex min-h-11 items-center gap-1.5 rounded-md px-2.5 text-[13px] text-white/55 outline-none transition-colors hover:bg-white/[0.04] hover:text-white focus-visible:ring-2 focus-visible:ring-[var(--brand-orange)] focus-visible:ring-offset-2 focus-visible:ring-offset-[#141311] print:hidden",
        variant === "menu" &&
          "flex min-h-11 w-full items-center gap-2.5 whitespace-nowrap rounded-lg px-3 text-sm font-medium text-foreground outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-[var(--brand-orange)]",
        variant === "text" &&
          "inline-flex min-h-11 items-center text-sm font-medium underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-orange)] focus-visible:ring-offset-2",
        className
      )}
    >
      {variant === "text" ? null : (
        <CircleHelp
          className={
            variant === "sidebar-footer"
              ? "size-3.5 opacity-70"
              : "size-4 shrink-0 text-muted-foreground"
          }
          aria-hidden
        />
      )}
      Help
    </Link>
  );
}
