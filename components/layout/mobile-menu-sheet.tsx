"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useTransition } from "react";
import {
  Briefcase,
  Building2,
  CreditCard,
  LogOut,
  Menu,
  UserRound,
  Users,
  X,
} from "lucide-react";
import { logout } from "@/app/(auth)/actions";
import { FeedbackLink } from "@/components/layout/feedback-link";
import { NotificationBell } from "@/components/layout/notification-bell";
import { SidebarAccount } from "@/components/layout/sidebar-account";
import { useAppUser } from "@/components/layout/app-user-context";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

type MobileMenuSheetProps = {
  triggerClassName?: string;
};

const rowClass =
  "flex min-h-11 w-full items-center gap-2.5 whitespace-nowrap rounded-lg px-3 text-sm font-medium outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-orange)]";

export function MobileMenuSheet({ triggerClassName }: MobileMenuSheetProps) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const pathname = usePathname();
  const { setupIncomplete, showTeamNav } = useAppUser();

  function close() {
    setOpen(false);
  }

  function destination(href: string, label: string, icon: typeof Briefcase, prominent = false) {
    const isActive = pathname === href || pathname.startsWith(`${href}/`);
    const Icon = icon;
    return (
      <Link
        key={href}
        href={href}
        prefetch
        aria-current={isActive ? "page" : undefined}
        onClick={close}
        className={cn(
          rowClass,
          prominent ? "text-base" : "text-sm",
          isActive
            ? "bg-[var(--brand-orange-muted)] text-foreground"
            : "text-foreground hover:bg-muted"
        )}
      >
        <Icon
          className={cn(
            "size-4 shrink-0",
            isActive ? "text-[var(--brand-orange)]" : "text-muted-foreground"
          )}
        />
        <span className="min-w-0 flex-1 truncate text-left">{label}</span>
      </Link>
    );
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger className={cn(triggerClassName)} aria-label="Open menu">
        <Menu className="size-5" />
        <span>Menu</span>
      </SheetTrigger>
      <SheetContent
        side="right"
        showCloseButton={false}
        className="h-dvh w-full max-w-sm gap-0 overflow-hidden p-0 sm:max-w-sm"
      >
        <SheetHeader className="shrink-0 border-b px-4 py-3 pr-14 text-left">
          <SheetTitle>Menu</SheetTitle>
        </SheetHeader>
        <SheetClose
          className="absolute top-2 right-2 inline-flex size-11 items-center justify-center rounded-md outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-[var(--brand-orange)]"
          aria-label="Close menu"
        >
          <X className="size-4" />
        </SheetClose>
        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-3 py-3 pb-[max(1rem,env(safe-area-inset-bottom))]">
          {setupIncomplete ? null : (
            <nav className="flex flex-col gap-1" aria-label="Work and organisation">
              <p className="px-3 pb-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                Work
              </p>
              {destination("/app/projects", "Projects", Briefcase, true)}
              <p className="mt-3 px-3 pb-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                Organisation
              </p>
              {destination("/app/settings/company", "Company", Building2)}
              {showTeamNav
                ? destination("/app/settings/team", "Team", Users)
                : null}
            </nav>
          )}
          <div className="mt-4 flex flex-col gap-1">
            <p className="px-3 pb-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              Account
            </p>
            {setupIncomplete
              ? null
              : destination("/app/settings/billing", "Billing", CreditCard)}
            {destination("/app/profile", "Profile", UserRound)}
            <div className="flex min-h-11 items-center justify-between gap-2 rounded-lg px-3">
              <span className="text-sm font-medium">Notifications</span>
              <NotificationBell variant="header" />
            </div>
            <FeedbackLink
              variant="menu"
              className="min-h-11 rounded-lg px-3 text-sm font-medium text-foreground hover:bg-muted"
            />
            <button
              type="button"
              className={cn(rowClass, "text-destructive hover:bg-muted")}
              disabled={pending}
              onClick={() => {
                startTransition(async () => {
                  await logout();
                });
              }}
            >
              <LogOut className="size-4 shrink-0" />
              <span>{pending ? "Signing out…" : "Sign out"}</span>
            </button>
          </div>
          <div className="mt-4 border-t pt-3">
            <SidebarAccount />
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
