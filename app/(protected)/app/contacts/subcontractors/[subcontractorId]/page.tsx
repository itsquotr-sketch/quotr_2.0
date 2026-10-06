import { notFound } from "next/navigation";
import { ContactsPageFrame } from "@/components/contacts/ContactsPageFrame";
import { SubcontractorProfile } from "@/components/subcontractors/SubcontractorProfile";
import { getSubcontractor } from "@/lib/subcontractors/actions";
import { listSubcontractorRates } from "@/lib/subcontractors/rate-actions";
import { getOnboardingAccess } from "@/lib/setup/actions";
import { memberCanEditSubcontractors } from "@/lib/team/permissions";

type SubcontractorProfilePageProps = {
  params: Promise<{ subcontractorId: string }>;
};

export default async function SubcontractorProfilePage({
  params,
}: SubcontractorProfilePageProps) {
  const { subcontractorId } = await params;
  const [subcontractor, rates, onboardingAccess] = await Promise.all([
    getSubcontractor(subcontractorId),
    listSubcontractorRates(subcontractorId),
    getOnboardingAccess(),
  ]);
  if (!subcontractor) notFound();

  return (
    <ContactsPageFrame
      section="subcontractors"
      archived={Boolean(subcontractor.archived_at)}
      description="Business profile, people, documents, and reusable rates."
    >
      <SubcontractorProfile
        subcontractor={subcontractor}
        rates={rates}
        canEdit={memberCanEditSubcontractors(onboardingAccess.role)}
      />
    </ContactsPageFrame>
  );
}
