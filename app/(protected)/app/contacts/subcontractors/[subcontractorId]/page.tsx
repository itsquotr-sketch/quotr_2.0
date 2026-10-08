import { notFound } from "next/navigation";
import { ContactsPageFrame } from "@/components/contacts/ContactsPageFrame";
import { SubcontractorProfile } from "@/components/subcontractors/SubcontractorProfile";
import { getSubcontractor } from "@/lib/subcontractors/actions";
import { listSubcontractorRequestActivity } from "@/lib/subcontractors/activity";
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
  const [subcontractor, rates, requests, onboardingAccess] = await Promise.all([
    getSubcontractor(subcontractorId),
    listSubcontractorRates(subcontractorId),
    listSubcontractorRequestActivity(subcontractorId),
    getOnboardingAccess(),
  ]);
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Pacific/Auckland" }).format(new Date());
  if (!subcontractor) notFound();

  return (
    <ContactsPageFrame
      section="subcontractors"
      archived={Boolean(subcontractor.archived_at)}
      title={subcontractor.trading_name}
      description="Subcontractor"
      showSectionNav={false}
    >
      <SubcontractorProfile
        subcontractor={subcontractor}
        rates={rates}
        requests={requests}
        today={today}
        canEdit={memberCanEditSubcontractors(onboardingAccess.role)}
      />
    </ContactsPageFrame>
  );
}
