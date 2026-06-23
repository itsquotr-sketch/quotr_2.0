import { redirect } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { isSetupIncomplete } from "@/lib/setup/actions";
import { createClient } from "@/lib/supabase/server";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const [{ data: profile }, setupIncomplete] = await Promise.all([
    supabase
      .from("profiles")
      .select("full_name, org_id")
      .eq("id", user.id)
      .maybeSingle(),
    isSetupIncomplete(),
  ]);

  let organisationName: string | null = null;
  let tradingName: string | null = null;

  if (profile?.org_id) {
    const [{ data: organisation }, { data: settings }] = await Promise.all([
      supabase
        .from("organisations")
        .select("name")
        .eq("id", profile.org_id)
        .maybeSingle(),
      supabase
        .from("organisation_settings")
        .select("trading_name")
        .eq("org_id", profile.org_id)
        .maybeSingle(),
    ]);

    organisationName = organisation?.name ?? null;
    tradingName = (settings?.trading_name as string | null) ?? null;
  }

  return (
    <AppShell
      userEmail={user.email}
      fullName={profile?.full_name}
      organisationName={organisationName}
      tradingName={tradingName}
      setupIncomplete={setupIncomplete}
    >
      {children}
    </AppShell>
  );
}
