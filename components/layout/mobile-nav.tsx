"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Briefcase, DollarSign, LayoutDashboard, Plus } from "lucide-react";
import { MobileMenuSheet } from "@/components/layout/mobile-menu-sheet";
import {
  isDashboardRoute,
  isNewProjectRoute,
  isProjectsRoute,
  isRatesRoute,
} from "@/components/layout/mobile-nav-metrics";
import { NewProjectDialog } from "@/components/projects/NewProjectDialog";
import { cn } from "@/lib/utils";

const itemClass =
  "flex h-[4.5rem] w-full min-h-11 min-w-0 flex-col items-center justify-center gap-1 px-0.5 text-[9px] font-medium leading-none tracking-tight outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--brand-orange)] min-[360px]:text-[10px]";

export function MobileNav() {
  const pathname = usePathname();
  const newCurrent = isNewProjectRoute(pathname);

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 overflow-visible border-t bg-background/95 backdrop-blur-sm print:hidden md:hidden"
      aria-label="Main navigation"
      data-mobile-nav="five"
    >
      <div className="grid w-full min-w-0 grid-cols-5 items-stretch pb-[env(safe-area-inset-bottom)]">
        <NavLink
          href="/app/dashboard"
          label="Dashboard"
          icon={LayoutDashboard}
          active={isDashboardRoute(pathname)}
        />
        <NavLink
          href="/app/projects"
          label="Projects"
          icon={Briefcase}
          active={isProjectsRoute(pathname)}
        />
        <div className="relative flex h-[4.5rem] min-w-0 flex-col items-center justify-center gap-1 px-0.5">
          <div className="relative h-[22px] w-full shrink-0">
            <NewProjectDialog
              trigger={
                <button
                  type="button"
                  aria-label="New project"
                  aria-current={newCurrent ? "page" : undefined}
                  data-mobile-new-project
                  className={cn(
                    "absolute bottom-0 left-1/2 z-10 inline-flex size-14 -translate-x-1/2 items-center justify-center rounded-full bg-[var(--brand-orange)] text-white shadow-md outline-none focus-visible:ring-2 focus-visible:ring-foreground focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                    newCurrent && "ring-2 ring-foreground ring-offset-2 ring-offset-background"
                  )}
                >
                  <Plus className="size-7" strokeWidth={2.5} aria-hidden />
                </button>
              }
            />
          </div>
          <span
            className={cn(
              "max-w-full truncate text-[9px] font-medium leading-none tracking-tight min-[360px]:text-[10px]",
              newCurrent ? "text-[var(--brand-orange)]" : "text-muted-foreground"
            )}
            aria-hidden
          >
            New
          </span>
        </div>
        <NavLink
          href="/app/rates"
          label="Rates"
          icon={DollarSign}
          active={isRatesRoute(pathname)}
        />
        <MobileMenuSheet triggerClassName={cn(itemClass, "text-muted-foreground")} />
      </div>
    </nav>
  );
}

function NavLink({
  href,
  label,
  icon: Icon,
  active,
}: {
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      prefetch
      aria-current={active ? "page" : undefined}
      className={cn(
        itemClass,
        active ? "text-[var(--brand-orange)]" : "text-muted-foreground"
      )}
    >
      <Icon className="size-[22px] shrink-0" strokeWidth={active ? 2.25 : 2} aria-hidden />
      <span className="max-w-full truncate">{label}</span>
    </Link>
  );
}
