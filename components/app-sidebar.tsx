"use client";

import Link, { useLinkStatus } from "next/link";
import { usePathname } from "next/navigation";
import { Briefcase, Building2, DollarSign, LayoutDashboard, Users } from "lucide-react";
import { FeedbackLink } from "@/components/layout/feedback-link";
import { NotificationBell } from "@/components/layout/notification-bell";
import { QuotrLogo } from "@/components/layout/quotr-logo";
import { SidebarAccount } from "@/components/layout/sidebar-account";
import { cn } from "@/lib/utils";

const navLinkClass =
  "flex min-h-11 items-center gap-2.5 whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium text-sidebar-foreground/85 outline-none transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:ring-2 focus-visible:ring-[var(--brand-orange)] focus-visible:ring-offset-2 focus-visible:ring-offset-sidebar";

const activeNavClass =
  "bg-sidebar-accent text-sidebar-accent-foreground shadow-[inset_3px_0_0_0_var(--brand-orange)]";

const PRIMARY_NAV = [
  { href: "/app/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/app/projects", label: "Projects", icon: Briefcase },
  { href: "/app/rates", label: "Rates", icon: DollarSign },
] as const;

const ORGANISATION_NAV = [
  { href: "/app/settings/company", label: "Company", icon: Building2 },
  { href: "/app/settings/team", label: "Team", icon: Users },
] as const;

function NavPendingMark() {
  const { pending } = useLinkStatus();
  if (!pending) return null;
  return (
    <span
      className="size-1.5 shrink-0 rounded-full bg-[var(--brand-orange)]"
      aria-hidden
    />
  );
}

type AppSidebarNavProps = {
  setupIncomplete?: boolean;
  showTeamNav?: boolean;
  deploymentLabel?: "Local" | "Preview" | null;
};

function isNavActive(pathname: string | null, href: string): boolean {
  if (!pathname) return false;
  if (href === "/app/dashboard") return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AppSidebarNav({
  setupIncomplete = false,
  showTeamNav = false,
  deploymentLabel = null,
}: AppSidebarNavProps) {
  const pathname = usePathname();
  const primary = setupIncomplete ? PRIMARY_NAV.slice(0, 1) : PRIMARY_NAV;
  const organisation = setupIncomplete
    ? []
    : ORGANISATION_NAV.filter(
        (item) => item.href !== "/app/settings/team" || showTeamNav
      );

  return (
    <aside className="hidden h-dvh w-[232px] shrink-0 flex-col overflow-hidden border-r border-sidebar-border bg-sidebar text-sidebar-foreground print:hidden md:flex">
      <div className="flex h-12 shrink-0 items-center gap-2.5 border-b border-sidebar-border px-3">
        <div className="flex h-8 items-center justify-center rounded-md border border-white/10 bg-white/[0.97] px-2.5">
          <QuotrLogo
            variant="wordmark"
            height={18}
            className="h-[18px] w-auto max-w-none object-contain"
          />
        </div>
        {deploymentLabel ? (
          <span className="shrink-0 rounded-full border border-sidebar-border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-sidebar-foreground/70">
            {deploymentLabel}
          </span>
        ) : null}
      </div>
      <nav className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-2.5 py-3" aria-label="Application">
        <div className="flex flex-col gap-1">
          <p className="px-3 pb-1 text-[11px] font-medium uppercase tracking-wide text-sidebar-foreground/50">
            Work
          </p>
          {primary.map(({ href, label, icon: Icon }) => {
            const isActive = isNavActive(pathname, href);
            return (
              <Link
                key={href}
                href={href}
                prefetch
                aria-current={isActive ? "page" : undefined}
                className={cn(navLinkClass, isActive && activeNavClass)}
              >
                <Icon
                  className={cn(
                    "size-4 shrink-0",
                    isActive ? "text-[var(--brand-orange)]" : "opacity-80"
                  )}
                />
                <span className="min-w-0 flex-1 truncate">{label}</span>
                <NavPendingMark />
              </Link>
            );
          })}
        </div>
        {organisation.length > 0 ? (
          <div className="flex flex-col gap-1">
            <p className="px-3 pb-1 text-[11px] font-medium uppercase tracking-wide text-sidebar-foreground/50">
              Organisation
            </p>
            {organisation.map(({ href, label, icon: Icon }) => {
              const isActive = isNavActive(pathname, href);
              return (
                <Link
                  key={href}
                  href={href}
                  prefetch
                  aria-current={isActive ? "page" : undefined}
                  className={cn(navLinkClass, isActive && activeNavClass)}
                >
                  <Icon
                    className={cn(
                      "size-4 shrink-0",
                      isActive ? "text-[var(--brand-orange)]" : "opacity-80"
                    )}
                  />
                  <span className="min-w-0 flex-1 truncate">{label}</span>
                  <NavPendingMark />
                </Link>
              );
            })}
          </div>
        ) : null}
      </nav>
      <div className="mt-auto shrink-0 border-t border-sidebar-border p-3">
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-medium text-sidebar-foreground/70">
              Notifications
            </p>
            <NotificationBell variant="sidebar" />
          </div>
          <FeedbackLink variant="sidebar-footer" />
          <SidebarAccount variant="sidebar" />
        </div>
      </div>
    </aside>
  );
}
