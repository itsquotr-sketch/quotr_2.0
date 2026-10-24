import Link from "next/link";
import { redirect } from "next/navigation";
import { SignedInDeletionForm } from "@/components/account-deletion/DeletionRequestForms";
import { PageHeader } from "@/components/layout/page-header";
import { SettingsContainer } from "@/components/layout/page-containers";
import { loadSignedInDeletionRequest } from "@/lib/account-deletion/actions";
import { requireAuthOrgContext } from "@/lib/security/auth-org-context";

export default async function ProfileDeletionPage() {
  const auth = await requireAuthOrgContext();
  if (!auth.ok) {
    if (auth.code === "not_authenticated") {
      redirect("/login?next=/app/profile/deletion");
    }
    redirect("/app/setup-required");
  }

  const existing = await loadSignedInDeletionRequest();

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <PageHeader
        title="Request account deletion"
        description="Record a request to close your account. This does not delete it."
      />
      <SettingsContainer>
        <div className="mx-auto w-full max-w-lg space-y-4">
          <p className="text-sm">
            <Link href="/app/profile" className="underline underline-offset-4">
              Back to Profile
            </Link>
          </p>
          <SignedInDeletionForm existing={existing} />
        </div>
      </SettingsContainer>
    </div>
  );
}
