"use client";

import {
  getDisplayCompanyName,
  getDisplayUserName,
  useAppUser,
} from "@/components/layout/app-user-context";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

function getInitials(fullName?: string | null, email?: string) {
  const display = getDisplayUserName(fullName, email);
  if (display.includes("@")) {
    return display[0]?.toUpperCase() ?? "U";
  }

  const parts = display.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  }

  return (parts[0]?.[0] ?? "U").toUpperCase();
}

type SidebarAccountProps = {
  variant?: "sidebar" | "default";
};

export function SidebarAccount({ variant = "default" }: SidebarAccountProps) {
  const { userEmail, fullName, organisationName, tradingName } = useAppUser();
  const companyName = getDisplayCompanyName(tradingName, organisationName);
  const userName = getDisplayUserName(fullName, userEmail);
  const initials = getInitials(fullName, userEmail);
  const isSidebar = variant === "sidebar";

  return (
    <div className="flex items-center gap-2.5">
      <Avatar size="sm">
        <AvatarFallback
          className={cn(
            "text-[10px] font-medium",
            isSidebar && "bg-sidebar-accent text-sidebar-accent-foreground"
          )}
        >
          {initials}
        </AvatarFallback>
      </Avatar>
      <div className="min-w-0 flex-1">
        <p
          className={cn(
            "truncate text-sm font-medium leading-tight",
            isSidebar && "text-sidebar-foreground"
          )}
        >
          {userName}
        </p>
        <p
          className={cn(
            "truncate text-xs",
            isSidebar
              ? "text-sidebar-foreground/70"
              : "text-muted-foreground"
          )}
          title={companyName}
        >
          {companyName}
        </p>
        {userEmail && !isSidebar ? (
          <p
            className={cn(
              "truncate text-[11px]",
              isSidebar
                ? "hidden"
                : "text-muted-foreground/80"
            )}
          >
            {userEmail}
          </p>
        ) : null}
      </div>
    </div>
  );
}
