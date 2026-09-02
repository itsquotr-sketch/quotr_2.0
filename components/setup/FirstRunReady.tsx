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
        <CardDescription>
          Add what you know now — plans and full details aren&apos;t required.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-muted-foreground">
          Quotr can already estimate using your settings and benchmark rates.
          You can personalise it further anytime.
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
