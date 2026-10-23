import Link from "next/link";
import { cn } from "@/lib/utils";

const linkClass =
  "underline decoration-foreground/30 underline-offset-4 outline-none hover:decoration-foreground focus-visible:ring-2 focus-visible:ring-[var(--brand-orange)] focus-visible:ring-offset-2";

/**
 * Same-origin legal documents. These links do not open signup, Checkout,
 * or the billing portal.
 */
export function LegalDocumentLinks({ className }: { className?: string }) {
  return (
    <p className={cn("text-sm text-muted-foreground", className)}>
      <Link href="/terms" className={linkClass}>
        Application Terms
      </Link>
      <span aria-hidden="true"> · </span>
      <Link href="/privacy" className={linkClass}>
        Privacy Notice
      </Link>
    </p>
  );
}
