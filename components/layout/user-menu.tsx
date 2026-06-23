"use client";

import { useRouter, usePathname } from "next/navigation";
import {
  Building2,
  DollarSign,
  LogOut,
  MessageSquare,
  Settings2,
} from "lucide-react";
import { logout } from "@/app/(auth)/actions";
import {
  getDisplayCompanyName,
  getDisplayUserName,
  useAppUser,
} from "@/components/layout/app-user-context";
import {
  buildFeedbackMailtoHref,
  extractProjectIdFromPath,
} from "@/lib/feedback";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type UserMenuProps = {
  userEmail?: string;
  fullName?: string | null;
};

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

export function UserMenu({ userEmail: userEmailProp, fullName: fullNameProp }: UserMenuProps) {
  const router = useRouter();
  const pathname = usePathname();
  const appUser = useAppUser();

  const userEmail = userEmailProp ?? appUser.userEmail;
  const fullName = fullNameProp ?? appUser.fullName;
  const companyName = getDisplayCompanyName(
    appUser.tradingName,
    appUser.organisationName
  );
  const displayName = getDisplayUserName(fullName, userEmail);
  const initials = getInitials(fullName, userEmail);

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          type="button"
          className="inline-flex rounded-full outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-orange)] focus-visible:ring-offset-2"
          aria-label="Open account menu"
        >
          <Avatar size="sm">
            <AvatarFallback className="text-xs font-medium">
              {initials}
            </AvatarFallback>
          </Avatar>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel className="font-normal">
            <div className="flex flex-col gap-1">
              <p className="truncate text-sm font-medium leading-none">
                {displayName}
              </p>
              <p className="truncate text-xs text-muted-foreground">
                {companyName}
              </p>
              {userEmail ? (
                <p className="truncate text-xs text-muted-foreground/80">
                  {userEmail}
                </p>
              ) : null}
            </div>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onSelect={() => router.push("/app/settings/company")}
          >
            <Building2 className="size-4" />
            Company settings
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => router.push("/app/rates")}>
            <DollarSign className="size-4" />
            Rates
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => router.push("/app/setup")}>
            <Settings2 className="size-4" />
            Setup
          </DropdownMenuItem>
          <DropdownMenuItem
            onSelect={() => {
              window.location.href = buildFeedbackMailtoHref({
                pageUrl: window.location.href,
                userEmail,
                projectId: extractProjectIdFromPath(
                  pathname ?? window.location.pathname
                ),
              });
            }}
          >
            <MessageSquare className="size-4" />
            Report issue
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            variant="destructive"
            onClick={() => {
              (
                document.getElementById("logout-form") as HTMLFormElement | null
              )?.requestSubmit();
            }}
          >
            <LogOut className="size-4" />
            Sign out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <form id="logout-form" action={logout} className="hidden" />
    </>
  );
}
