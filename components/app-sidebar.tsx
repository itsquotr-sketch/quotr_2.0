"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Building2, DollarSign, LayoutDashboard, Settings2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const navLinkClass =
  "flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground";

const NAV_ITEMS = [
  { href: "/app/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/app/rates", label: "Rates", icon: DollarSign },
  { href: "/app/settings/company", label: "Company", icon: Building2 },
  { href: "/app/setup", label: "Setup", icon: Settings2, showIncomplete: true },
] as const;

type AppSidebarNavProps = {
  userEmail?: string;
  fullName?: string | null;
  setupIncomplete?: boolean;
};

export function AppSidebarNav({
  userEmail,
  fullName,
  setupIncomplete = false,
}: AppSidebarNavProps) {
  const pathname = usePathname();

  return (
    <aside className="hidden w-60 shrink-0 flex-col border-r bg-sidebar md:flex">
      <div className="flex h-14 items-center px-4">
        <Link
          href="/app/dashboard"
          className="text-base font-semibold tracking-tight"
        >
          Quotr
        </Link>
      </div>
      <nav className="flex flex-1 flex-col gap-1 px-3 py-2">
        {NAV_ITEMS.map(({ href, label, icon: Icon, ...item }) => {
          const isActive =
            pathname === href || pathname.startsWith(`${href}/`);
          const showBadge =
            "showIncomplete" in item && item.showIncomplete && setupIncomplete;

          return (
            <Link
              key={href}
              href={href}
              className={cn(
                navLinkClass,
                isActive && "bg-sidebar-accent text-sidebar-accent-foreground"
              )}
            >
              <Icon className="size-4" />
              <span className="flex-1">{label}</span>
              {showBadge ? (
                <Badge variant="secondary" className="h-5 px-1.5 text-[10px]">
                  Incomplete
                </Badge>
              ) : null}
            </Link>
          );
        })}
      </nav>
      <div className="border-t p-4">
        <p className="truncate text-sm font-medium">{fullName ?? "User"}</p>
        <p className="truncate text-xs text-muted-foreground">{userEmail}</p>
      </div>
    </aside>
  );
}
