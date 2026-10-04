"use client";

import { useAppUser } from "@/components/layout/app-user-context";

const DASHBOARD_SENTENCE =
  "What needs attention, what is moving, and where to continue.";

export function DashboardHeaderSubtitle() {
  const { tradingName, organisationName } = useAppUser();
  const name = tradingName?.trim() || organisationName?.trim();
  if (!name) return DASHBOARD_SENTENCE;

  return (
    <>
      {name}
      {" · "}
      {DASHBOARD_SENTENCE}
    </>
  );
}
