"use client";

import {
  getDisplayCompanyName,
  getDisplayUserName,
  useAppUser,
} from "@/components/layout/app-user-context";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

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

export function SidebarAccount() {
  const { userEmail, fullName, organisationName, tradingName } = useAppUser();
  const companyName = getDisplayCompanyName(tradingName, organisationName);
  const userName = getDisplayUserName(fullName, userEmail);
  const initials = getInitials(fullName, userEmail);

  return (
    <div className="flex items-center gap-2.5">
      <Avatar size="sm">
        <AvatarFallback className="text-[10px] font-medium">
          {initials}
        </AvatarFallback>
      </Avatar>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium leading-tight">{userName}</p>
        <p
          className="truncate text-xs text-muted-foreground"
          title={companyName}
        >
          {companyName}
        </p>
        {userEmail ? (
          <p className="truncate text-[11px] text-muted-foreground/80">
            {userEmail}
          </p>
        ) : null}
      </div>
    </div>
  );
}
