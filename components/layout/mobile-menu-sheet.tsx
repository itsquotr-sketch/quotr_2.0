"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
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
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const html = document.documentElement;
    const body = document.body;
    const previousHtmlOverflow = html.style.overflow;
    const previousBodyOverflow = body.style.overflow;
    html.style.overflow = "hidden";
    body.style.overflow = "hidden";
    return () => {
      html.style.overflow = previousHtmlOverflow;
      body.style.overflow = previousBodyOverflow;
    };
  }, [open]);

  function close() {
    setOpen(false);
  }

  function destination(href: string, label: string, icon: typeof Briefcase) {
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
        <span className="min-w-0 flex-1 text-left">{label}</span>
      </Link>
    );
  }

  return (
    <Sheet modal open={open} onOpenChange={setOpen}>
      <SheetTrigger
        ref={triggerRef}
        className={cn(triggerClassName)}
        aria-label="Open menu"
      >
        <Menu className="size-5" />
        <span>Menu</span>
      </SheetTrigger>
      <SheetContent
        side="right"
        showCloseButton={false}
        finalFocus={triggerRef}
        data-mobile-menu="viewport"
        className="top-0 right-0 bottom-0 flex h-dvh max-h-dvh w-full max-w-sm flex-col gap-0 overflow-hidden p-0 sm:max-w-sm"
        style={{
          position: "fixed",
          top: 0,
          right: 0,
          bottom: 0,
          height: "100dvh",
          maxHeight: "100dvh",
        }}
      >
        <SheetHeader className="relative shrink-0 border-b px-4 py-3 pr-16 pt-[max(0.75rem,env(safe-area-inset-top))] text-left">
          <SheetTitle>Menu</SheetTitle>
        </SheetHeader>
        <SheetClose
          className="absolute top-[max(0.5rem,env(safe-area-inset-top))] right-2 inline-flex size-11 items-center justify-center rounded-md outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-[var(--brand-orange)]"
          aria-label="Close menu"
        >
          <X className="size-4" />
        </SheetClose>
        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain px-3 py-3">
          {setupIncomplete ? null : (
            <nav className="flex flex-col gap-1" aria-label="Work and organisation">
              {destination("/app/projects", "Projects", Briefcase)}
              {destination("/app/settings/company", "Company", Building2)}
              {showTeamNav
                ? destination("/app/settings/team", "Team", Users)
                : null}
            </nav>
          )}
          <div className="mt-2 flex flex-col gap-1">
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
          <div className="mt-auto shrink-0 border-t pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
            <SidebarAccount />
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
