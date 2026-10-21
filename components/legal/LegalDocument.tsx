import Link from "next/link";
import type { ReactNode } from "react";
import { QuotrLogo } from "@/components/layout/quotr-logo";
import { QUOTR_PRODUCT_LINE } from "@/lib/branding/assets";
import { TERMS_OF_USE_VERSION } from "@/lib/auth/signup-choices";

export function LegalDocument({
  title,
  kicker,
  children,
}: {
  title: string;
  kicker: string;
  children: ReactNode;
}) {
  return (
    <div className="fixed inset-0 overflow-y-auto bg-background text-foreground">
      <article className="mx-auto w-full min-w-0 max-w-3xl px-4 py-8 sm:px-6 sm:py-12">
        <header className="space-y-4">
          <Link
            href="/login"
            className="inline-flex rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-orange)] focus-visible:ring-offset-2"
            aria-label="Quotr"
          >
            <QuotrLogo variant="wordmark" href={null} height={32} className="h-8 w-auto" />
          </Link>
          <p className="text-sm text-muted-foreground">{QUOTR_PRODUCT_LINE}</p>
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">{kicker}</p>
            <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
              {title}
            </h1>
            <p className="text-sm text-muted-foreground">
              Version {TERMS_OF_USE_VERSION}. 22 October 2026.
            </p>
          </div>
        </header>
        <div className="mt-8 space-y-8 text-sm leading-6 sm:text-base sm:leading-7">
          {children}
        </div>
      </article>
    </div>
  );
}

export function LegalSection({
  id,
  title,
  children,
}: {
  id: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-6 space-y-3">
      <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
      <div className="space-y-3">{children}</div>
    </section>
  );
}
