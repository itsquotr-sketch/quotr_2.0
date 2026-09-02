"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Building2, CreditCard, DollarSign, LayoutDashboard, Settings2, Users } from "lucide-react";
import { FeedbackLink } from "@/components/layout/feedback-link";
import { NotificationBell } from "@/components/layout/notification-bell";
import { QuotrLogo } from "@/components/layout/quotr-logo";
import { SidebarAccount } from "@/components/layout/sidebar-account";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const navLinkClass =
  "flex min-h-10 items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium text-sidebar-foreground/85 transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground";

const activeNavClass =
  "bg-sidebar-accent text-sidebar-accent-foreground shadow-[inset_3px_0_0_0_var(--brand-orange)] text-sidebar-accent-foreground";

const NAV_ITEMS = [
  { href: "/app/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/app/rates", label: "Rates", icon: DollarSign },
  { href: "/app/settings/company", label: "Company", icon: Building2 },
  { href: "/app/settings/team", label: "Team", icon: Users },
  { href: "/app/settings/billing", label: "Billing", icon: CreditCard },
  { href: "/app/setup", label: "Setup", icon: Settings2, showIncomplete: true },
] as const;

type AppSidebarNavProps = {
  setupIncomplete?: boolean;
  deploymentLabel?: "Local" | "Preview" | null;
};

export function AppSidebarNav({
  setupIncomplete = false,
  deploymentLabel = null,
}: AppSidebarNavProps) {
  const pathname = usePathname();

  return (
    <aside className="hidden h-dvh w-[232px] shrink-0 flex-col overflow-hidden border-r border-sidebar-border bg-sidebar text-sidebar-foreground print:hidden md:flex">
      <div className="flex h-12 shrink-0 items-center gap-2 border-b border-sidebar-border px-3">
        <div className="rounded-md border border-white/10 bg-white/[0.97] px-2.5 py-1">
          <QuotrLogo height={28} />
        </div>
        {deploymentLabel ? (
          <span className="rounded-full border border-sidebar-border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-sidebar-foreground/70">
            {deploymentLabel}
          </span>
        ) : null}
      </div>
      <nav className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto px-2.5 py-3">
        {NAV_ITEMS.map(({ href, label, icon: Icon, ...item }) => {
          const isActive =
            pathname === href || pathname.startsWith(`${href}/`);
          const showBadge =
            "showIncomplete" in item && item.showIncomplete && setupIncomplete;

          return (
            <Link
              key={href}
              href={href}
              className={cn(navLinkClass, isActive && activeNavClass)}
            >
              <Icon className="size-4 opacity-80" />
              <span className="flex-1">{label}</span>
              {showBadge ? (
                <Badge
                  variant="secondary"
                  className="h-5 border-[var(--brand-orange-muted)] bg-[var(--brand-orange-muted)] px-1.5 text-[10px] text-sidebar-foreground"
                >
                  Incomplete
                </Badge>
              ) : null}
            </Link>
          );
        })}
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
