import { notFound } from "next/navigation";
import { ContactsPageFrame } from "@/components/contacts/ContactsPageFrame";
import { SubcontractorProfile } from "@/components/subcontractors/SubcontractorProfile";
import { getSubcontractor } from "@/lib/subcontractors/actions";
import { getOnboardingAccess } from "@/lib/setup/actions";
import { memberCanEditSubcontractors } from "@/lib/team/permissions";

type SubcontractorProfilePageProps = {
  params: Promise<{ subcontractorId: string }>;
};

export default async function SubcontractorProfilePage({
  params,
}: SubcontractorProfilePageProps) {
  const { subcontractorId } = await params;
  const [subcontractor, onboardingAccess] = await Promise.all([
    getSubcontractor(subcontractorId),
    getOnboardingAccess(),
  ]);
  if (!subcontractor) notFound();

  return (
    <ContactsPageFrame
      section="subcontractors"
      archived={Boolean(subcontractor.archived_at)}
      description="Business profile, people, and the documents your organisation keeps on file."
    >
      <SubcontractorProfile
        subcontractor={subcontractor}
        canEdit={memberCanEditSubcontractors(onboardingAccess.role)}
      />
    </ContactsPageFrame>
  );
}
