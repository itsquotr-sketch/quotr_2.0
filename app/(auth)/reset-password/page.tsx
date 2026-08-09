import { Suspense } from "react";
import { ResetPasswordClient } from "@/components/auth/ResetPasswordClient";
import { createClient } from "@/lib/supabase/server";
import {
  Card,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";

type ResetPasswordPageProps = {
  searchParams: Promise<{ error?: string }>;
};

export default async function ResetPasswordPage({
  searchParams,
}: ResetPasswordPageProps) {
  const params = await searchParams;
  const linkInvalid = params.error === "invalid";

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (linkInvalid || !user) {
    return (
      <Card>
        <CardHeader className="pb-4 sm:pb-6">
          <CardTitle className="text-xl">Reset link unavailable</CardTitle>
          <CardDescription>
            This password reset link is invalid or has expired.
          </CardDescription>
        </CardHeader>
        <CardFooter className="flex flex-col gap-3">
          <Button
            render={<Link href="/forgot-password" />}
            className="h-11 w-full"
          >
            Request a new reset link
          </Button>
          <Button
            variant="outline"
            render={<Link href="/login" />}
            className="h-11 w-full"
          >
            Back to login
          </Button>
        </CardFooter>
      </Card>
    );
  }

  return (
    <Suspense fallback={<Card className="min-h-48 animate-pulse" />}>
      <ResetPasswordClient />
    </Suspense>
  );
}
