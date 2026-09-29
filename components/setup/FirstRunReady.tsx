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

type FirstRunReadyProps = {
  improveHref: string;
};

export function FirstRunReady({ improveHref }: FirstRunReadyProps) {
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

  async function openOptional(href: string) {
    setError(null);
    setLeaving(true);
    const ok = await finish();
    setLeaving(false);
    if (!ok) return;
    router.push(href);
  }

  return (
    <Card>
      <CardHeader className="pb-4">
        <CardTitle className="text-xl">You can price your first job</CardTitle>
        <CardDescription>
          Personalising rates and work areas can wait. It does not block this
          job.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {error ? (
          <p role="alert" className="rounded-lg border border-destructive/20 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </p>
        ) : null}
        <p className="text-sm leading-snug text-muted-foreground">
          Quotr will use the carpenter and labourer costs and the default
          gross margin you just entered.
        </p>
        <p className="text-sm leading-snug text-muted-foreground">
          Optional — personalise material, labour and productivity rates for
          more accurate estimates. You can do this later.
        </p>
      </CardContent>
      <CardFooter className="flex flex-col items-stretch gap-3 border-t sm:items-end">
        <NewProjectDialog intent="first-job" beforeOpen={finish} />
        <Button
          type="button"
          variant="outline"
          className="h-11 w-full sm:w-auto"
          disabled={leaving}
          onClick={() => void openOptional(improveHref)}
        >
          Improve my rates and productivity
        </Button>
      </CardFooter>
    </Card>
  );
}
