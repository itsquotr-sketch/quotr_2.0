import type { Metadata } from "next";
import Link from "next/link";
import { PublicDeletionForm } from "@/components/account-deletion/DeletionRequestForms";
import {
  AuthCard,
  AuthCardContent,
  AuthCardHeader,
} from "@/components/auth/AuthCard";
import { LegalDocumentLinks } from "@/components/legal/LegalDocumentLinks";

export const metadata: Metadata = {
  title: "Request account deletion | Quotr",
  robots: { index: false, follow: false },
};

export default function AccountDeletionPage() {
  return (
    <main className="flex min-h-full items-center justify-center px-4 py-10">
      <div className="w-full max-w-md space-y-4">
        <AuthCard>
          <AuthCardHeader
            title="Request account deletion"
            description="This records a request. It does not delete an account or a company."
          />
          <AuthCardContent>
            <PublicDeletionForm />
            <p className="text-center text-sm text-muted-foreground">
              <Link href="/login" className="underline underline-offset-4">
                Sign in
              </Link>
            </p>
          </AuthCardContent>
        </AuthCard>
        <LegalDocumentLinks className="text-center" />
      </div>
    </main>
  );
}
