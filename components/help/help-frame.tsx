import Link from "next/link";
import type { ReactNode } from "react";
import { QuotrLogo } from "@/components/layout/quotr-logo";
import { HELP_SUPPORT_EMAIL } from "@/lib/help/content";

const linkClass =
  "underline decoration-foreground/30 underline-offset-4 outline-none hover:decoration-foreground focus-visible:ring-2 focus-visible:ring-[var(--brand-orange)] focus-visible:ring-offset-2";

export function HelpFrame({ children }: { children: ReactNode }) {
  return (
    <div className="fixed inset-0 overflow-x-hidden overflow-y-auto bg-background text-foreground">
      <div className="mx-auto w-full min-w-0 max-w-3xl px-4 py-6 sm:px-6 sm:py-10">
        <header className="flex items-center justify-between gap-3">
          <Link
            href="/help"
            className="inline-flex rounded-md outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-orange)] focus-visible:ring-offset-2"
            aria-label="Quotr help"
          >
            <QuotrLogo variant="wordmark" href={null} height={28} className="h-7 w-auto" />
          </Link>
          <Link href="/login" className={`inline-flex min-h-11 items-center text-sm ${linkClass}`}>
            Sign in
          </Link>
        </header>
        <div className="mt-6 min-w-0">{children}</div>
      </div>
    </div>
  );
}

export function HelpSupport() {
  return (
    <section className="mt-10 border-t border-border pt-6" aria-labelledby="help-support-heading">
      <h2 id="help-support-heading" className="text-base font-semibold tracking-tight">
        Need a hand?
      </h2>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">
        Email{" "}
        <a className={linkClass} href={`mailto:${HELP_SUPPORT_EMAIL}`}>
          {HELP_SUPPORT_EMAIL}
        </a>
        .
      </p>
    </section>
  );
}

export function helpLinkClass(): string {
  return linkClass;
}
