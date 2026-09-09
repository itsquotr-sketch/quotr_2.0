"use client";

import Link from "next/link";
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

export function FirstRunReady() {
  return (
    <Card>
      <CardHeader className="pb-4">
        <CardTitle className="text-xl">You&apos;re ready to price your first job.</CardTitle>
        <CardDescription className="hidden md:block">
          Add what you know now — plans and full details aren&apos;t required.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        <p
          className="rounded-lg border border-border/60 bg-muted/20 px-3 py-2.5 text-sm leading-snug text-muted-foreground"
          data-onboarding-standard-rates-notice
        >
          Quotr will start with standard rates. For better accuracy, personalise
          your rates and calibrate Quotr to your business.
        </p>
        <p className="text-xs">
          <Link
            href="/app/setup?mode=improve"
            className="font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
          >
            Personalise Quotr
          </Link>
        </p>
      </CardContent>
      <CardFooter className="flex flex-col gap-3 border-t sm:flex-row sm:justify-end">
        <Button
          render={<Link href="/app/dashboard" />}
          variant="ghost"
          className="h-11 w-full sm:w-auto"
        >
          Go to dashboard
        </Button>
        <NewProjectDialog intent="first-job" />
      </CardFooter>
    </Card>
  );
}
