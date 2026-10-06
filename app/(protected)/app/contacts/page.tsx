import { ContactsPageFrame } from "@/components/contacts/ContactsPageFrame";
import { CustomerFormDialog } from "@/components/customers/CustomerFormDialog";
import { CustomersDirectory } from "@/components/customers/CustomersDirectory";
import { listCustomers } from "@/lib/customers/actions";
import { getOnboardingAccess } from "@/lib/setup/actions";
import {
  memberCanCreateProjects,
  memberCanEditProjects,
} from "@/lib/team/permissions";

type ContactsCustomersPageProps = {
  searchParams: Promise<{ archived?: string }>;
};

export default async function ContactsCustomersPage({
  searchParams,
}: ContactsCustomersPageProps) {
  const params = await searchParams;
  const archived = params.archived === "1";
  const [customers, onboardingAccess] = await Promise.all([
    listCustomers({ archived }),
    getOnboardingAccess(),
  ]);
  const canCreate = memberCanCreateProjects(onboardingAccess.role);
  const canEdit = memberCanEditProjects(onboardingAccess.role);

  return (
    <ContactsPageFrame
      section="customers"
      archived={archived}
      description="Save customer details for faster project setup."
      actions={
        !archived && canCreate ? (
          <CustomerFormDialog mode="create" triggerLabel="New customer" />
        ) : null
      }
    >
      <CustomersDirectory
        customers={customers}
        archived={archived}
        canCreate={canCreate}
        canEdit={canEdit}
      />
    </ContactsPageFrame>
  );
}
