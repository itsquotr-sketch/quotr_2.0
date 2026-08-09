import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { needsCompanyBasics } from "@/lib/setup/actions";
import { createClient } from "@/lib/supabase/server";

const SETUP_REQUIRED_PATH = "/app/setup-required";
const SETUP_BASICS_PATH = "/app/setup?mode=basics";

function isSetupRequiredPath(pathname: string | null): boolean {
  if (!pathname) {
    return false;
  }
  return (
    pathname === SETUP_REQUIRED_PATH ||
    pathname.startsWith(`${SETUP_REQUIRED_PATH}/`)
  );
}

/** Routes allowed while company basics are not yet confirmed. */
function isCompanyBasicsAllowedPath(pathname: string | null): boolean {
  if (!pathname) {
    return false;
  }
  return pathname === "/app/setup" || pathname.startsWith("/app/setup/");
}

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const headerStore = await headers();
  const pathname = headerStore.get("x-pathname");
  const onSetupRequired = isSetupRequiredPath(pathname);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, org_id")
    .eq("id", user.id)
    .maybeSingle();

  let organisationName: string | null = null;
  let tradingName: string | null = null;
  let organisationValid = false;

  if (profile?.org_id) {
    const [{ data: organisation }, { data: settings }] = await Promise.all([
      supabase
        .from("organisations")
        .select("id, name")
        .eq("id", profile.org_id)
        .maybeSingle(),
      supabase
        .from("organisation_settings")
        .select("trading_name")
        .eq("org_id", profile.org_id)
        .maybeSingle(),
    ]);

    if (organisation) {
      organisationValid = true;
      organisationName = organisation.name ?? null;
      tradingName = (settings?.trading_name as string | null) ?? null;
    }
  }

  if (!organisationValid) {
    if (!onSetupRequired) {
      redirect(SETUP_REQUIRED_PATH);
    }

    return (
      <div className="flex min-h-svh flex-col items-center justify-center bg-muted px-4 py-8">
        <div className="mb-8 w-full max-w-sm text-center">
          <p className="text-lg font-semibold tracking-tight">Quotr</p>
        </div>
        <div className="w-full max-w-sm">{children}</div>
      </div>
    );
  }

  if (onSetupRequired) {
    redirect("/app/dashboard");
  }

  // Stage 3.1C.3-R2A: hard gate basics before Dashboard / app surfaces.
  // Single status read via needsCompanyBasics (no rates catalogue).
  const basicsNeeded = await needsCompanyBasics();
  if (basicsNeeded && !isCompanyBasicsAllowedPath(pathname)) {
    redirect(SETUP_BASICS_PATH);
  }

  // Incomplete badge = basics missing only (not full wizard).
  const setupIncomplete = basicsNeeded;

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
