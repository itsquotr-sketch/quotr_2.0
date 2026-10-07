import Link from "next/link";
import { PageContainer } from "@/components/layout/page-containers";
import { PageHeader } from "@/components/layout/page-header";
import { cn } from "@/lib/utils";

type ContactsSection = "customers" | "subcontractors";

export function ContactsSectionNav({
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

export function ContactsPageFrame({
  section,
  archived,
  description,
  actions,
  children,
}: {
  section: ContactsSection;
  archived: boolean;
  description: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-muted/30">
      <PageHeader
        title="Contacts"
        description={description}
        wrapDescription
        alignWithContent
        actions={actions}
      />
      <PageContainer className="min-h-0" innerClassName="py-4 sm:py-6">
        <div className="mb-4">
          <ContactsSectionNav section={section} archived={archived} />
        </div>
        {children}
      </PageContainer>
    </div>
  );
}
