import { ContactsSectionBody } from "@/components/contacts/ContactsSectionBody";
import { PageContainer } from "@/components/layout/page-containers";
import { PageHeader } from "@/components/layout/page-header";

export type ContactsSection = "customers" | "subcontractors";

export function ContactsPageFrame({
  section,
  archived,
  description,
  actions,
  showSectionNav = true,
  title = "Contacts",
  children,
}: {
  section: ContactsSection;
  archived: boolean;
  description: string;
  actions?: React.ReactNode;
  showSectionNav?: boolean;
  title?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-muted/30">
      <PageHeader
        title={title}
        description={description}
        wrapDescription
        alignWithContent
        actions={actions}
      />
      <PageContainer className="min-h-0" innerClassName="py-4 sm:py-6">
        {showSectionNav ? (
          <ContactsSectionBody section={section} archived={archived}>
            {children}
          </ContactsSectionBody>
        ) : (
          children
        )}
      </PageContainer>
    </div>
  );
}
