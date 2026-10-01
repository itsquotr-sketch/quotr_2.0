"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { DollarSign, LayoutDashboard } from "lucide-react";
import { MobileMenuSheet } from "@/components/layout/mobile-menu-sheet";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { href: "/app/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/app/rates", label: "Rates", icon: DollarSign },
] as const;

export function MobileNav() {
  const pathname = usePathname();

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 border-t bg-background/95 backdrop-blur-sm print:hidden md:hidden"
      aria-label="Main navigation"
    >
      <div className="mx-auto flex h-14 max-w-lg items-stretch justify-around px-2 pb-[env(safe-area-inset-bottom)]">
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
          const isActive =
            pathname === href || pathname.startsWith(`${href}/`);

          return (
            <Link
              key={href}
              href={href}
              prefetch
              aria-current={isActive ? "page" : undefined}
              className={cn(
                "flex min-h-11 min-w-0 flex-1 flex-col items-center justify-center gap-0.5 px-2 text-[11px] font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-[var(--brand-orange)]",
                isActive
                  ? "text-[var(--brand-orange)]"
                  : "text-muted-foreground"
              )}
            >
              <Icon className="size-5" strokeWidth={isActive ? 2.25 : 2} />
              <span className="truncate">{label}</span>
            </Link>
          );
        })}
        <MobileMenuSheet
          triggerClassName="flex min-h-11 min-w-0 flex-1 flex-col items-center justify-center gap-0.5 px-2 text-[11px] font-medium text-muted-foreground outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-orange)]"
        />
      </div>
    </nav>
  );
}
