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

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name")
    .eq("id", user.id)
    .maybeSingle();

  const setupIncomplete = await isSetupIncomplete();

  return (
    <AppShell
      userEmail={user.email}
      fullName={profile?.full_name}
      setupIncomplete={setupIncomplete}
    >
      {children}
    </AppShell>
  );
}
