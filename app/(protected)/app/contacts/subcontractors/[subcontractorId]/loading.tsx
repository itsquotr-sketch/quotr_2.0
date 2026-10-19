import Link from "next/link";
import { ContactsPageFrame } from "@/components/contacts/ContactsPageFrame";

export default function SubcontractorLoading() {
  return (
    <ContactsPageFrame
      section="subcontractors"
      archived={false}
      title="Subcontractor"
      description="Subcontractor"
      showSectionNav={false}
    >
      <div className="flex min-w-0 flex-col gap-4">
        <Link
          href="/app/contacts/subcontractors"
          className="inline-flex h-11 min-h-11 items-center rounded-xl border border-border bg-card px-4 text-sm font-medium"
        >
          Back to subcontractors
        </Link>
        <p className="text-sm text-muted-foreground" role="status" data-subcontractor-pending="true">
          Loading subcontractor…
        </p>
      </div>
    </ContactsPageFrame>
  );
}
