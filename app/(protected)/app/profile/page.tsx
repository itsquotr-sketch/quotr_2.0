import { redirect } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { SettingsContainer } from "@/components/layout/page-containers";
import { AccountMenu } from "@/components/layout/account-menu";
import { ProfilePageContent } from "@/components/profile/ProfilePageContent";
import { createClient } from "@/lib/supabase/server";

/**
 * Personal account Profile (/app/profile).
 *
 * Authority:
 * - full name / role / org_id → public.profiles (auth.uid())
 * - email → authenticated Supabase Auth user
 * - organisation name → organisations row for profiles.org_id
 *
 * Routing states:
 * A — no auth user → /login
 * B — profile + organisation → render
 * C — missing profile / org_id → /app/setup-required
 * D — org_id present but organisation unresolvable → /app/setup-required
 * E — optional null personal fields → safe empty presentation
 */
function formatRole(role: string | null | undefined): string {
  if (!role?.trim()) return "Member";
  return role.trim();
}

export default async function ProfilePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // STATE A — unauthenticated (middleware should already redirect; belt-and-braces)
  if (!user) {
    redirect("/login");
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("full_name, role, org_id")
    .eq("id", user.id)
    .maybeSingle();

  // STATE C — missing profile or tenant binding (do not surface as generic 500)
  if (profileError || !profile?.org_id) {
    redirect("/app/setup-required");
  }

  const { data: organisation, error: organisationError } = await supabase
    .from("organisations")
    .select("name")
    .eq("id", profile.org_id)
    .maybeSingle();

  // STATE D — tenant integrity failure: do not invent another organisation
  if (organisationError || !organisation) {
    redirect("/app/setup-required");
  }

  // STATE B + E — provisioned user; null optional fields render safely
  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <PageHeader
        title="Profile"
        description="Manage your personal account and security."
        actions={
          <AccountMenu
            userEmail={user.email}
            fullName={profile.full_name}
          />
        }
      />
      <SettingsContainer>
        <ProfilePageContent
          fullName={profile.full_name?.trim() ?? ""}
          email={user.email ?? ""}
          role={formatRole(profile.role)}
          organisationName={organisation.name?.trim() || "Company not set"}
        />
      </SettingsContainer>
    </div>
  );
}
