import { CustomersDirectory } from "@/components/customers/CustomersDirectory";
import { CustomerFormDialog } from "@/components/customers/CustomerFormDialog";
import { PageContainer } from "@/components/layout/page-containers";
import { PageHeader } from "@/components/layout/page-header";
import { listCustomers } from "@/lib/customers/actions";
import { getOnboardingAccess } from "@/lib/setup/actions";
import {
  memberCanCreateProjects,
  memberCanEditProjects,
} from "@/lib/team/permissions";

type CustomersPageProps = {
  searchParams: Promise<{ archived?: string }>;
};

export default async function CustomersPage({ searchParams }: CustomersPageProps) {
  const params = await searchParams;
  const archived = params.archived === "1";
  const [customers, onboardingAccess] = await Promise.all([
    listCustomers({ archived }),
    getOnboardingAccess(),
  ]);
  const canCreate = memberCanCreateProjects(onboardingAccess.role);
  const canEdit = memberCanEditProjects(onboardingAccess.role);

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-muted/30">
      <PageHeader
        title="Customers"
        description="Save customer details for faster project setup."
        wrapDescription
        actions={
          !archived && canCreate ? (
            <CustomerFormDialog mode="create" triggerLabel="New customer" />
          ) : null
        }
      />
      <PageContainer innerClassName="max-md:py-3 max-md:pb-4">
        <CustomersDirectory
          customers={customers}
          archived={archived}
          canCreate={canCreate}
          canEdit={canEdit}
        />
      </PageContainer>
    </div>
  );
}
