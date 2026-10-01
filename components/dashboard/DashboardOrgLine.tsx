"use client";

import { useAppUser } from "@/components/layout/app-user-context";

export function DashboardOrgLine() {
  const { tradingName, organisationName } = useAppUser();
  const name = tradingName?.trim() || organisationName?.trim();
  if (!name) return null;

  return <p className="text-sm text-muted-foreground">{name}</p>;
}
