"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  Building2,
  Menu,
  Settings2,
} from "lucide-react";
import { FeedbackLink } from "@/components/layout/feedback-link";
import { SidebarAccount } from "@/components/layout/sidebar-account";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { useAppUser } from "@/components/layout/app-user-context";
import { cn } from "@/lib/utils";

const MENU_LINKS = [
  { href: "/app/settings/company", label: "Company", icon: Building2 },
  { href: "/app/setup", label: "Setup", icon: Settings2, showIncomplete: true },
] as const;

type MobileMenuSheetProps = {
  triggerClassName?: string;
};

export function MobileMenuSheet({ triggerClassName }: MobileMenuSheetProps) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const { setupIncomplete } = useAppUser();

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger
        className={cn(triggerClassName)}
        aria-label="Open menu"
      >
        <Menu className="size-5" />
        <span>Menu</span>
      </SheetTrigger>
      <SheetContent side="bottom" className="max-h-[85vh] rounded-t-2xl px-4 pb-8">
        <SheetHeader className="border-b pb-4 text-left">
          <SheetTitle className="text-base">Menu</SheetTitle>
        </SheetHeader>
        <div className="space-y-4 pt-4">
          <SidebarAccount />
          <nav className="flex flex-col gap-1">
            {MENU_LINKS.map(({ href, label, icon: Icon, ...item }) => {
              const isActive =
                pathname === href || pathname.startsWith(`${href}/`);
              const showBadge =
                "showIncomplete" in item &&
                item.showIncomplete &&
                setupIncomplete;

              return (
                <Button
                  key={href}
                  variant="ghost"
                  className={cn(
                    "h-11 w-full justify-start gap-2 px-3",
                    isActive && "bg-muted"
                  )}
                  render={<Link href={href} onClick={() => setOpen(false)} />}
                >
                  <Icon className="size-4" />
                  <span className="flex-1 text-left">{label}</span>
                  {showBadge ? (
                    <Badge
                      variant="secondary"
                      className="h-5 border-[var(--brand-orange-muted)] bg-[var(--brand-orange-muted)] px-1.5 text-[10px]"
                    >
                      Incomplete
                    </Badge>
                  ) : null}
                </Button>
              );
            })}
            <FeedbackLink
              variant="menu"
              className="h-11 rounded-md px-3 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
            />
          </nav>
        </div>
      </SheetContent>
    </Sheet>
  );
}
