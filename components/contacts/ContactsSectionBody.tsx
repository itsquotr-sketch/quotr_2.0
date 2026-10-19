"use client";

import Link from "next/link";
import type { ContactsSection } from "@/components/contacts/ContactsPageFrame";
import { markContactsNav, useSettleContactsNav } from "@/components/contacts/contacts-nav-pending";
import { cn } from "@/lib/utils";

function ContactsSectionNav({
  section,
  archived,
}: {
  section: ContactsSection;
  archived: boolean;
}) {
  const archivedQuery = archived ? "?archived=1" : "";
  const items = [
    {
      id: "customers" as const,
      href: `/app/contacts${archivedQuery}`,
      label: "Customers",
    },
    {
      id: "subcontractors" as const,
      href: `/app/contacts/subcontractors${archivedQuery}`,
      label: "Subcontractors",
    },
  ];

  return (
    <nav aria-label="Contacts sections" data-contacts-sections className="flex flex-wrap gap-2">
      {items.map((item) => {
        const selected = item.id === section;
        return (
          <Link
            key={item.id}
            href={item.href}
            aria-current={selected ? "page" : undefined}
            onClick={() => {
              if (!selected) markContactsNav(item.id === "subcontractors" ? "list" : "customers");
            }}
            className={cn(
              "inline-flex min-h-11 items-center rounded-xl px-4 text-sm font-medium outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-orange)]",
              selected
                ? "bg-[var(--brand-orange-muted)] text-foreground"
                : "text-muted-foreground hover:bg-muted"
            )}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

export function ContactsSectionBody({
  section,
  archived,
  children,
}: {
  section: ContactsSection;
  archived: boolean;
  children: React.ReactNode;
}) {
  useSettleContactsNav();

  return (
    <>
      <div className="mb-4">
        <ContactsSectionNav section={section} archived={archived} />
      </div>
      <p className="contacts-nav-feedback contacts-nav-feedback-list text-sm text-muted-foreground" role="status" data-subcontractors-pending="true">
        Loading subcontractors…
      </p>
      <p className="contacts-nav-feedback contacts-nav-feedback-customers text-sm text-muted-foreground" role="status">
        Loading customers…
      </p>
      <div className="contacts-nav-hide-list contacts-nav-hide-customers">{children}</div>
    </>
  );
}
