"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Building2, LogOut, UserRound } from "lucide-react";
import { logout } from "@/app/(auth)/actions";
import {
  getDisplayUserName,
  useAppUser,
} from "@/components/layout/app-user-context";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

type AccountMenuProps = {
  userEmail?: string;
  fullName?: string | null;
  /**
   * header — compact avatar trigger (page headers)
   * sidebar — avatar + name in dark sidebar chrome
   * panel — avatar + name on light surfaces (mobile sheet)
   */
  variant?: "header" | "sidebar" | "panel";
  className?: string;
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

/**
 * Consistent personal-account entry point for authenticated Quotr surfaces.
 * Uses Base UI Menu via existing dropdown primitives (`onClick`, not `onSelect`).
 */
export function AccountMenu({
  userEmail: userEmailProp,
  fullName: fullNameProp,
  variant = "header",
  className,
}: AccountMenuProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const appUser = useAppUser();

  const userEmail = userEmailProp ?? appUser.userEmail;
  const fullName = fullNameProp ?? appUser.fullName;
  const displayName = getDisplayUserName(fullName, userEmail);
  const initials = getInitials(fullName, userEmail);
  const showIdentity = variant === "sidebar" || variant === "panel";
  const isSidebar = variant === "sidebar";

  function handleLogout() {
    startTransition(async () => {
      await logout();
    });
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        type="button"
        disabled={pending}
        className={cn(
          "inline-flex items-center gap-2.5 outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-orange)] focus-visible:ring-offset-2 disabled:opacity-60",
          showIdentity && "w-full rounded-lg px-1 py-1 text-left",
          isSidebar && "hover:bg-sidebar-accent",
          variant === "panel" && "hover:bg-muted",
          variant === "header" && "rounded-full",
          className
        )}
        aria-label="Open account menu"
        aria-haspopup="menu"
      >
        <Avatar size="sm">
          <AvatarFallback
            className={cn(
              "text-xs font-medium",
              isSidebar && "bg-sidebar-accent text-sidebar-accent-foreground"
            )}
          >
            {initials}
          </AvatarFallback>
        </Avatar>
        {showIdentity ? (
          <span className="min-w-0 flex-1">
            <span
              className={cn(
                "block truncate text-sm font-medium leading-tight",
                isSidebar ? "text-sidebar-foreground" : "text-foreground"
              )}
            >
              {displayName}
            </span>
            {userEmail ? (
              <span
                className={cn(
                  "block truncate text-xs",
                  isSidebar
                    ? "text-sidebar-foreground/70"
                    : "text-muted-foreground"
                )}
              >
                {userEmail}
              </span>
            ) : null}
          </span>
        ) : null}
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align={showIdentity ? "start" : "end"}
        side={isSidebar ? "top" : "bottom"}
        className="w-[min(18rem,calc(100vw-1.5rem))]"
      >
        <DropdownMenuLabel className="font-normal">
          <div className="flex flex-col gap-0.5 px-0.5 py-0.5">
            <p className="truncate text-sm font-medium leading-none">
              {displayName}
            </p>
            {userEmail ? (
              <p className="truncate text-xs text-muted-foreground">{userEmail}</p>
            ) : null}
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          className="min-h-10 cursor-pointer sm:min-h-8"
          onClick={() => router.push("/app/profile")}
        >
          <UserRound className="size-4" />
          Profile
        </DropdownMenuItem>
        <DropdownMenuItem
          className="min-h-10 cursor-pointer sm:min-h-8"
          onClick={() => router.push("/app/settings/company")}
        >
          <Building2 className="size-4" />
          Company settings
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          variant="destructive"
          className="min-h-10 cursor-pointer sm:min-h-8"
          disabled={pending}
          onClick={handleLogout}
        >
          <LogOut className="size-4" />
          {pending ? "Signing out…" : "Log out"}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** @deprecated Prefer AccountMenu — retained for existing imports. */
export function UserMenu(props: Omit<AccountMenuProps, "variant"> & { variant?: AccountMenuProps["variant"] }) {
  return <AccountMenu {...props} variant={props.variant ?? "header"} />;
}
