"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { NewProjectDialog } from "@/components/projects/NewProjectDialog";
import { completeRequiredOnboarding } from "@/lib/setup/actions";

export function FirstRunReady() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [leaving, setLeaving] = useState(false);

  async function finish(): Promise<boolean> {
    const result = await completeRequiredOnboarding();
    if (result.error) {
      setError(result.error);
      return false;
    }
    return true;
  }

  async function goToDashboard() {
    setError(null);
    setLeaving(true);
    const ok = await finish();
    setLeaving(false);
    if (!ok) return;
    router.push("/app/dashboard");
  }

  return (
    <Card>
      <CardHeader className="pb-4">
        <CardTitle className="text-xl">{"You're ready"}</CardTitle>
        <CardDescription>
          You can refine materials, labour and productivity later under Rates.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {error ? (
          <p
            role="alert"
            className="rounded-lg border border-destructive/20 bg-destructive/10 px-3 py-2 text-sm text-destructive"
          >
            {error}
          </p>
        ) : null}
        <p className="text-sm leading-snug text-muted-foreground">
          Quotr will use the carpenter and labourer costs and the default
          gross margin you just entered.
        </p>
      </CardContent>
      <CardFooter className="flex flex-col items-stretch gap-3 border-t sm:items-end">
        <NewProjectDialog
          intent="first-job"
          beforeOpen={finish}
          trigger={
            <Button type="button" size="touch" className="w-full sm:w-auto">
              Create your first project
            </Button>
          }
        />
        <button
          type="button"
          className="h-11 text-sm text-muted-foreground underline-offset-4 hover:underline disabled:opacity-50"
          disabled={leaving}
          onClick={() => void goToDashboard()}
        >
          Go to Dashboard
        </button>
      </CardFooter>
    </Card>
  );
}
