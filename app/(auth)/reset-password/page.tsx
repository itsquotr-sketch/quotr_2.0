import { Suspense } from "react";
import Link from "next/link";
import { ResetPasswordClient } from "@/components/auth/ResetPasswordClient";
import { createClient } from "@/lib/supabase/server";
import {
  AuthCard,
  AuthCardFooter,
  AuthCardHeader,
} from "@/components/auth/AuthCard";
import { Button } from "@/components/ui/button";

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
      <AuthCard>
        <AuthCardHeader
          title="Reset link unavailable"
          description="This password reset link is invalid or has expired."
        />
        <AuthCardFooter className="gap-3">
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
        </AuthCardFooter>
      </AuthCard>
    );
  }

  return (
    <Suspense
      fallback={
        <AuthCard>
          <div className="min-h-48" />
        </AuthCard>
      }
    >
      <ResetPasswordClient />
    </Suspense>
  );
}
