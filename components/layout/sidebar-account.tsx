"use client";

import { AccountMenu } from "@/components/layout/account-menu";

type SidebarAccountProps = {
  variant?: "sidebar" | "default";
};

/**
 * Sidebar / mobile account entry — opens the shared AccountMenu.
 * Previously a non-interactive display stub (root cause of “profile does nothing”).
 */
export function SidebarAccount({ variant = "default" }: SidebarAccountProps) {
  return (
    <AccountMenu variant={variant === "sidebar" ? "sidebar" : "panel"} />
  );
}
