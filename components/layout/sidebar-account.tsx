"use client";

import { AccountMenu } from "@/components/layout/account-menu";

type SidebarAccountProps = {
  variant?: "sidebar" | "default";
};

/**
 * Sidebar / mobile account entry — opens the shared AccountMenu.
 * Entire row is the DropdownMenuTrigger (see AccountMenu sidebar/panel variants).
 */
export function SidebarAccount({ variant = "default" }: SidebarAccountProps) {
  return (
    <AccountMenu
      variant={variant === "sidebar" ? "sidebar" : "panel"}
      className="w-full"
    />
  );
}
