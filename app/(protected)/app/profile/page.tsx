import { redirect } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { SettingsContainer } from "@/components/layout/page-containers";
import { AccountMenu } from "@/components/layout/account-menu";
import { ProfilePageContent } from "@/components/profile/ProfilePageContent";
import { measureServerLoad } from "@/lib/perf/timing";
import { getAuthDisplayProfile } from "@/lib/security/auth-display";
import { requireAuthOrgContext } from "@/lib/security/auth-org-context";

/**
 * Personal account Profile (/app/profile).
 *
 * Authority:
 * - full name / role → public.profiles (auth.uid()) via request-scoped display
 * - email → authenticated Supabase Auth user (requireAuthOrgContext)
 * - organisation name → organisations row for profiles.org_id (cached)
 *
 * Routing states:
 * A — no auth user → /login
 * B — profile + organisation → render
 * C — missing profile / org_id → /app/setup-required
 * D — org_id present but organisation unresolvable → /app/setup-required
 * E — optional null personal fields → safe empty presentation
 *
 * Layout already resolved auth + display in this request. This page reuses
 * those helpers; it does not start a second getUser/profile/org waterfall.
 */
function formatRole(role: string | null | undefined): string {
  if (!role?.trim()) return "Member";
  return role.trim();
}

export default async function ProfilePage() {
  const auth = await requireAuthOrgContext();

  // STATE A — unauthenticated
  if (!auth.ok) {
    if (auth.code === "not_authenticated") {
      redirect("/login");
    }
    // STATE C / D — missing profile, org binding, or unresolvable org
    redirect("/app/setup-required");
  }

  const display = await measureServerLoad("profile", () =>
    getAuthDisplayProfile()
  );

  // STATE C — display could not be assembled from the signed-in org
  if (!display) {
    redirect("/app/setup-required");
  }

  // STATE B + E — provisioned user; null optional fields render safely
  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <PageHeader
        title="Profile"
        description="Manage your personal account and security."
        actions={<AccountMenu />}
      />
      <SettingsContainer>
        <ProfilePageContent
          fullName={display.fullName?.trim() ?? ""}
          email={auth.user.email ?? display.userEmail ?? ""}
          role={formatRole(display.role)}
          organisationName={display.organisationName?.trim() || "Company not set"}
        />
      </SettingsContainer>
    </div>
  );
}
