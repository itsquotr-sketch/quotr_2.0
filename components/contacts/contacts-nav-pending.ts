"use client";

import { useLayoutEffect } from "react";
import { usePathname } from "next/navigation";

export type ContactsNavPending = "list" | "record" | "customers";

export function markContactsNav(kind: ContactsNavPending) {
  document.documentElement.setAttribute("data-contacts-nav", kind);
}

export function useSettleContactsNav() {
  const pathname = usePathname();
  useLayoutEffect(() => {
    const pending = document.documentElement.getAttribute("data-contacts-nav");
    const onRecord = /^\/app\/contacts\/subcontractors\/[^/]+$/.test(pathname);
    const onList = pathname === "/app/contacts/subcontractors";
    const onCustomers = pathname === "/app/contacts";
    if (
      (pending === "list" && onList) ||
      (pending === "record" && onRecord) ||
      (pending === "customers" && onCustomers)
    ) {
      document.documentElement.removeAttribute("data-contacts-nav");
    }
  }, [pathname]);
}
