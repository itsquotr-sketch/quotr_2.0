"use client";

import { createContext, useContext } from "react";

export type AppUserContextValue = {
  userEmail?: string;
  fullName?: string | null;
  organisationName?: string | null;
  tradingName?: string | null;
  setupIncomplete?: boolean;
};

const AppUserContext = createContext<AppUserContextValue>({});

export function AppUserProvider({
  children,
  value,
}: {
  children: React.ReactNode;
  value: AppUserContextValue;
}) {
  return (
    <AppUserContext.Provider value={value}>{children}</AppUserContext.Provider>
  );
}

export function useAppUser() {
  return useContext(AppUserContext);
}

export function getDisplayCompanyName(
  tradingName?: string | null,
  organisationName?: string | null
): string {
  const trading = tradingName?.trim();
  if (trading) return trading;

  const org = organisationName?.trim();
  if (org) return org;

  return "Company not set";
}

export function getDisplayUserName(
  fullName?: string | null,
  userEmail?: string
): string {
  const name = fullName?.trim();
  if (name) return name;

  const email = userEmail?.trim();
  if (email) return email.split("@")[0] ?? "User";

  return "User";
}
