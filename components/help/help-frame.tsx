import Link from "next/link";
import type { ReactNode } from "react";
import { QuotrLogo } from "@/components/layout/quotr-logo";
import { HELP_SUPPORT_EMAIL } from "@/lib/help/content";
import { LegalDocumentLinks } from "@/components/legal/LegalDocumentLinks";

const linkClass =
  "underline decoration-foreground/30 underline-offset-4 outline-none hover:decoration-foreground focus-visible:ring-2 focus-visible:ring-[var(--brand-orange)] focus-visible:ring-offset-2";

export function HelpFrame({
  children,
  signedIn,
}: {
  children: ReactNode;
  signedIn: boolean;
}) {
  return (
    <div className="fixed inset-0 overflow-x-hidden overflow-y-auto bg-background text-foreground">
      <div className="mx-auto w-full min-w-0 max-w-[760px] px-4 py-6 sm:px-6 sm:py-10">
        <header className="flex items-center justify-between gap-3">
          <Link
            href="/help"
            className="inline-flex rounded-md outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-orange)] focus-visible:ring-offset-2"
            aria-label="Quotr help"
          >
            <QuotrLogo variant="wordmark" href={null} height={28} className="h-7 w-auto" />
          </Link>
          {signedIn ? (
            <Link
              href="/app/dashboard"
              data-help-return="signed-in"
              className={`inline-flex min-h-11 items-center text-sm ${linkClass}`}
            >
              Back to Quotr
            </Link>
          ) : (
            <Link
              href="/login"
              data-help-return="signed-out"
              className={`inline-flex min-h-11 items-center text-sm ${linkClass}`}
            >
              Sign in
            </Link>
          )}
        </header>
        <div className="mt-8 min-w-0">{children}</div>
      </div>
    </div>
  );
}

export function HelpSupport() {
  return (
    <section className="mt-8 border-t border-border pt-8" aria-labelledby="help-support-heading">
      <h2 id="help-support-heading" className="text-base font-semibold tracking-tight">
        Need a hand?
      </h2>
      <p className="mt-3 text-base leading-[1.6] text-foreground/75">
        Email{" "}
        <a className={linkClass} href={`mailto:${HELP_SUPPORT_EMAIL}`}>
          {HELP_SUPPORT_EMAIL}
        </a>
        .
      </p>
      <LegalDocumentLinks className="mt-3" />
    </section>
  );
}

export function helpLinkClass(): string {
  return linkClass;
}
