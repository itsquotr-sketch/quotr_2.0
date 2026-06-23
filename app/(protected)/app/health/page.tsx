import { PageHeader } from "@/components/layout/page-header";
import { UserMenu } from "@/components/layout/user-menu";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getEnvSummary } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";
import packageJson from "@/package.json";

export default async function HealthPage() {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  const { data: profile } = user
    ? await supabase
        .from("profiles")
        .select("full_name, org_id")
        .eq("id", user.id)
        .maybeSingle()
    : { data: null };

  let supabaseConnected = false;
  let supabaseCheck = "Not checked";

  if (user) {
    const { error } = await supabase
      .from("profiles")
      .select("id")
      .eq("id", user.id)
      .limit(1)
      .maybeSingle();

    supabaseConnected = !error;
    supabaseCheck = error ? `Query failed: ${error.message}` : "Connected";
  } else if (authError) {
    supabaseCheck = `Auth error: ${authError.message}`;
  } else {
    supabaseCheck = "No signed-in user";
  }

  const envSummary = getEnvSummary();
  const buildDate = process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? "local";
  const environment =
    process.env.VERCEL_ENV ?? process.env.NODE_ENV ?? "development";

  return (
    <>
      <PageHeader
        title="App health"
        description="Internal status for test-user support. No secrets are shown here."
        actions={
          <UserMenu userEmail={user?.email} fullName={profile?.full_name} />
        }
      />
      <div className="flex-1 overflow-auto">
        <div className="mx-auto w-full max-w-2xl px-4 py-6 sm:px-6 lg:px-8">
          <Card className="border-border/60 shadow-none">
            <CardHeader>
              <CardTitle className="text-base">Runtime</CardTitle>
              <CardDescription>
                Quick checks for deployment and support.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <HealthRow label="Signed-in user" value={user?.email ?? "—"} />
              <HealthRow
                label="Organisation ID"
                value={profile?.org_id ?? "—"}
              />
              <HealthRow label="Supabase" value={supabaseCheck} />
              <HealthRow
                label="Supabase connected"
                value={supabaseConnected ? "Yes" : "No"}
              />
              <HealthRow label="App version" value={packageJson.version} />
              <HealthRow label="Build ref" value={buildDate} />
              <HealthRow label="Environment" value={environment} />
            </CardContent>
          </Card>

          <Card className="mt-4 border-border/60 shadow-none">
            <CardHeader>
              <CardTitle className="text-base">Environment variables</CardTitle>
              <CardDescription>
                Configured names only — values are never displayed.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <HealthRow
                label="Public configured"
                value={
                  envSummary.publicConfigured.length > 0
                    ? envSummary.publicConfigured.join(", ")
                    : "None"
                }
              />
              <HealthRow
                label="Public missing"
                value={
                  envSummary.publicMissing.length > 0
                    ? envSummary.publicMissing.join(", ")
                    : "None"
                }
              />
              <HealthRow
                label="Server configured"
                value={
                  envSummary.serverConfigured.length > 0
                    ? envSummary.serverConfigured.join(", ")
                    : "None"
                }
              />
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}

function HealthRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5 sm:flex-row sm:items-baseline sm:justify-between sm:gap-4">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium break-all sm:text-right">{value}</span>
    </div>
  );
}
