import { ContactsPageFrame } from "@/components/contacts/ContactsPageFrame";
import { SubcontractorCreateDialog } from "@/components/subcontractors/SubcontractorCreateDialog";
import { SubcontractorsDirectory } from "@/components/subcontractors/SubcontractorsDirectory";
import { getOnboardingAccess } from "@/lib/setup/actions";
import {
  getContactsOrganisationCountry,
  listSubcontractors,
} from "@/lib/subcontractors/actions";
import { memberCanEditSubcontractors } from "@/lib/team/permissions";

type SubcontractorsPageProps = {
  searchParams: Promise<{ archived?: string }>;
};

export default async function SubcontractorsPage({
  searchParams,
}: SubcontractorsPageProps) {
  const params = await searchParams;
  const archived = params.archived === "1";
  const [subcontractors, onboardingAccess, organisationCountry] = await Promise.all([
    listSubcontractors({ archived }),
    getOnboardingAccess(),
    getContactsOrganisationCountry(),
  ]);
  const canEdit = memberCanEditSubcontractors(onboardingAccess.role);

  return (
    <ContactsPageFrame
      section="subcontractors"
      archived={archived}
      description="Businesses you can ask for trade work. Work areas are capabilities, not rates or quotations."
      actions={
        !archived && canEdit ? (
          <SubcontractorCreateDialog
            organisationCountry={organisationCountry}
            triggerLabel="New subcontractor"
          />
        ) : null
      }
    >
      <SubcontractorsDirectory
        subcontractors={subcontractors}
        archived={archived}
        canEdit={canEdit}
        organisationCountry={organisationCountry}
      />
    </ContactsPageFrame>
  );
}
