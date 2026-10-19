import { ContactsPageFrame } from "@/components/contacts/ContactsPageFrame";

export default function SubcontractorsLoading() {
  return (
    <ContactsPageFrame
      section="subcontractors"
      archived={false}
      description="Businesses you can ask for trade work. Work areas are capabilities, not rates or quotations."
    >
      <p className="text-sm text-muted-foreground" role="status" data-subcontractors-pending="true">
        Loading subcontractors…
      </p>
    </ContactsPageFrame>
  );
}
