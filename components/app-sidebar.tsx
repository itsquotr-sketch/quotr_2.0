"use client";

import Link, { useLinkStatus } from "next/link";
import { usePathname } from "next/navigation";
import { BarChart3, BookUser, Briefcase, Building2, DollarSign, LayoutDashboard, Users } from "lucide-react";
import { FeedbackLink } from "@/components/layout/feedback-link";
import { NotificationBell } from "@/components/layout/notification-bell";
import { QuotrLogo } from "@/components/layout/quotr-logo";
import { SidebarAccount } from "@/components/layout/sidebar-account";
import { cn } from "@/lib/utils";

const navLinkClass =
  "flex min-h-11 items-center gap-3 whitespace-nowrap rounded-md px-2.5 text-[14px] text-white/62 outline-none transition-colors hover:bg-white/[0.04] hover:text-white focus-visible:ring-2 focus-visible:ring-[var(--brand-orange)] focus-visible:ring-offset-2 focus-visible:ring-offset-[#141311]";

const activeNavClass = "bg-white/[0.08] text-white";

const PRIMARY_NAV = [
  { href: "/app/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/app/projects", label: "Projects", icon: Briefcase },
  { href: "/app/analytics", label: "Analytics", icon: BarChart3 },
  { href: "/app/contacts", label: "Contacts", icon: BookUser },
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
      className="ml-auto size-1.5 shrink-0 rounded-full bg-[var(--brand-orange)]"
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

function NavSection({
  label,
  items,
  pathname,
}: {
  label: string;
  items: ReadonlyArray<{
    href: string;
    label: string;
    icon: typeof LayoutDashboard;
  }>;
  pathname: string | null;
}) {
  return (
    <div className="flex flex-col">
      <p className="px-2.5 pt-2 pb-1 text-[11px] font-medium tracking-[0.14em] text-white/45 uppercase">
        {label}
      </p>
      <ul className="space-y-0.5">
        {items.map(({ href, label: itemLabel, icon: Icon }) => {
          const isActive = isNavActive(pathname, href);
          return (
            <li key={href}>
              <Link
                href={href}
                prefetch
                aria-current={isActive ? "page" : undefined}
                className={cn(navLinkClass, isActive && activeNavClass)}
              >
                <span
                  className={cn(
                    "h-4 w-0.5 shrink-0",
                    isActive ? "bg-[var(--brand-orange)]" : "bg-transparent"
                  )}
                  aria-hidden
                />
                <Icon className="size-4 shrink-0" />
                <span>{itemLabel}</span>
                <NavPendingMark />
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
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
    <aside className="hidden h-dvh w-56 shrink-0 flex-col overflow-hidden bg-[#141311] text-[#f3f3f1] print:hidden md:flex">
      <div className="px-5 pt-6 pb-5">
        <Link
          href="/app/dashboard"
          className="inline-flex rounded-sm bg-white px-2 py-1 outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-orange)] focus-visible:ring-offset-2 focus-visible:ring-offset-[#141311]"
          aria-label="Quotr"
        >
          <QuotrLogo
            variant="wordmark"
            height={22}
            href={null}
            decorative
            className="h-[22px] w-auto max-w-none object-contain"
          />
        </Link>
        {deploymentLabel ? (
          <p className="mt-2 text-[11px] tracking-[0.14em] text-white/50 uppercase">
            {deploymentLabel}
          </p>
        ) : null}
      </div>
      <nav className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-3 pb-3" aria-label="Application">
        <NavSection label="Work" items={primary} pathname={pathname} />
        {organisation.length > 0 ? (
          <NavSection label="Organisation" items={organisation} pathname={pathname} />
        ) : null}
      </nav>
      <div className="mt-auto shrink-0 border-t border-white/10 px-3 py-3">
        <div className="flex min-h-11 items-center justify-between gap-2 px-2.5">
          <p className="text-[13px] text-white/55">Notifications</p>
          <NotificationBell variant="sidebar" />
        </div>
        <FeedbackLink variant="sidebar-footer" className="min-h-11" />
        <SidebarAccount variant="sidebar" />
      </div>
    </aside>
  );
}
